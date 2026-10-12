use serde::{Deserialize, Serialize};
use std::{fs, io::Cursor, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub version: u32, pub id: String, pub studio: String, pub name: String,
    pub created_at: u64, pub updated_at: u64,
    pub width: u32, pub height: u32, pub resolution: u32,
    pub background: String, pub work_file: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artboard { pub folder: String, pub project: Project }

#[derive(Serialize)]
pub struct Index { pub artboards: Vec<Artboard>, pub warnings: Vec<String> }

#[derive(Clone, Serialize, Deserialize)]
pub struct Preferences { pub root: PathBuf, pub theme: String }

pub struct Store { pub preferences: Preferences, pub config: PathBuf }

#[derive(Deserialize)]
pub struct NewArtboard {
    pub studio: String, pub name: String, pub width: u32, pub height: u32,
    pub resolution: u32, pub background: String,
}

fn now() -> Result<u64, String> {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).map_err(|e| e.to_string())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let name = path.file_name().ok_or("Invalid filename")?.to_string_lossy();
    let temporary = path.with_file_name(format!(".{name}.{}.pending", now()?));
    fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
    fs::rename(&temporary, path).map_err(|e| e.to_string())
}

fn json_write<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    atomic_write(path, &serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?)
}

fn safe_name(name: &str) -> Result<String, String> {
    let clean: String = name.trim().chars().filter(|c| !c.is_control() && !"/\\:".contains(*c)).take(100).collect();
    let clean = clean.trim_matches('.').trim().to_string();
    if clean.is_empty() { return Err("El nombre no puede estar vacío.".into()); }
    Ok(clean)
}

fn rgba(background: &str) -> Result<[u8; 4], String> {
    if background == "transparent" { return Ok([0, 0, 0, 0]); }
    if background.len() != 7 || !background.starts_with('#') || !background[1..].is_ascii() { return Err("Elegí un color de fondo válido.".into()); }
    let mut out = [0, 0, 0, 255];
    for (i, value) in out[..3].iter_mut().enumerate() {
        *value = u8::from_str_radix(&background[1 + i * 2..3 + i * 2], 16).map_err(|_| "Elegí un color de fondo válido.")?;
    }
    Ok(out)
}

pub fn blank_png(width: u32, height: u32, background: &str, resolution: u32) -> Result<Vec<u8>, String> {
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > 24_000_000 { return Err("El artboard no puede superar 24 megapíxeles.".into()); }
    let color = rgba(background)?;
    let mut data = vec![0; width as usize * height as usize * 4];
    for pixel in data.chunks_exact_mut(4) { pixel.copy_from_slice(&color); }
    let mut output = Cursor::new(Vec::new());
    {
        let mut encoder = png::Encoder::new(&mut output, width, height);
        encoder.set_color(png::ColorType::Rgba); encoder.set_depth(png::BitDepth::Eight);
        let pixels_per_meter = (f64::from(resolution) / 0.0254).round() as u32;
        encoder.set_pixel_dims(Some(png::PixelDimensions { xppu: pixels_per_meter, yppu: pixels_per_meter, unit: png::Unit::Meter }));
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&data).map_err(|e| e.to_string())?;
    }
    Ok(output.into_inner())
}

impl Store {
    pub fn new(config: PathBuf, default_root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&config).map_err(|e| e.to_string())?;
        let path = config.join("preferences.json");
        let preferences = if path.exists() {
            serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| format!("Invalid preferences: {e}"))?
        } else { Preferences { root: default_root, theme: "dark".into() } };
        let store = Self { preferences, config };
        fs::create_dir_all(&store.preferences.root).map_err(|e| e.to_string())?;
        Ok(store)
    }

    pub fn set_preferences(&mut self, root: PathBuf, theme: String) -> Result<(), String> {
        if !["dark", "light"].contains(&theme.as_str()) { return Err("Invalid theme".into()); }
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
        let preferences = Preferences { root, theme };
        json_write(&self.config.join("preferences.json"), &preferences)?;
        self.preferences = preferences;
        Ok(())
    }

    pub fn folder(&self, name: &str) -> Result<PathBuf, String> {
        if !name.ends_with(".artboard") || name.contains(['/', '\\']) || name.starts_with('.') { return Err("Invalid artboard folder".into()); }
        let root = fs::canonicalize(&self.preferences.root).map_err(|e| e.to_string())?;
        let folder = fs::canonicalize(root.join(name)).map_err(|e| e.to_string())?;
        if folder.parent() != Some(root.as_path()) { return Err("El artboard está fuera de la carpeta elegida en Preferencias.".into()); }
        Ok(folder)
    }

    pub fn read(&self, folder: &str) -> Result<Artboard, String> {
        let path = self.folder(folder)?.join("project.json");
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 64 * 1024 { return Err("Project metadata too large".into()); }
        let project: Project = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        if project.version != 1 || !["endo", "prism", "quill", "reel", "folio", "lux", "mirage"].contains(&project.studio.as_str()) { return Err("Unsupported project version or Studio".into()); }
        if !(1..=8192).contains(&project.width) || !(1..=8192).contains(&project.height) { return Err("Invalid artboard dimensions".into()); }
        Ok(Artboard { folder: folder.into(), project })
    }

    pub fn list(&self) -> Result<Index, String> {
        let mut artboards = Vec::new(); let mut warnings = Vec::new();
        for entry in fs::read_dir(&self.preferences.root).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.ends_with(".artboard") { continue; }
            match self.read(&name) { Ok(board) => artboards.push(board), Err(error) => warnings.push(format!("{name}: {error}")) }
        }
        artboards.sort_by(|a, b| b.project.updated_at.cmp(&a.project.updated_at));
        Ok(Index { artboards, warnings })
    }

    fn available_name(&self, name: &str, current: Option<&str>) -> Result<String, String> {
        let name = safe_name(name)?;
        for i in 1..10_000 {
            let candidate = if i == 1 { format!("{name}.artboard") } else { format!("{name} ({i}).artboard") };
            if current == Some(candidate.as_str()) || !self.preferences.root.join(&candidate).exists() { return Ok(candidate); }
        }
        Err("Hay demasiados artboards con este nombre.".into())
    }

    pub fn create(&self, input: NewArtboard) -> Result<Artboard, String> {
        if !["endo", "prism"].contains(&input.studio.as_str()) { return Err("Este Studio todavía no está disponible.".into()); }
        if !(128..=8192).contains(&input.width) || !(128..=8192).contains(&input.height) || !(1..=1200).contains(&input.resolution) { return Err("Elegí un tamaño de 128 a 8192 px y una resolución de 1 a 1200 ppi.".into()); }
        let png = blank_png(input.width, input.height, &input.background, input.resolution)?;
        let name = safe_name(&input.name)?;
        let folder = self.available_name(&name, None)?;
        let path = self.preferences.root.join(&folder);
        fs::create_dir(&path).map_err(|e| e.to_string())?;
        fs::create_dir(path.join("assets")).map_err(|e| e.to_string())?;
        let time = now()?;
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let project = Project { version: 1, id: format!("{unique}-{}", input.studio), studio: input.studio, name,
            created_at: time, updated_at: time, width: input.width, height: input.height, resolution: input.resolution,
            background: input.background, work_file: "main.png".into() };
        atomic_write(&path.join("main.png"), &png)?;
        let ratio = 160.0 / f64::from(project.width.max(project.height));
        atomic_write(&path.join("thumbnail.png"), &blank_png((f64::from(project.width) * ratio).round().max(1.0) as u32, (f64::from(project.height) * ratio).round().max(1.0) as u32, &project.background, 72)?)?;
        json_write(&path.join("project.json"), &project)?;
        Ok(Artboard { folder, project })
    }

    pub fn rename(&self, folder: &str, name: &str) -> Result<Artboard, String> {
        let mut board = self.read(folder)?;
        let previous = board.project.clone();
        let target = self.available_name(name, Some(folder))?;
        let old_path = self.folder(folder)?;
        board.project.name = safe_name(name)?; board.project.updated_at = now()?;
        json_write(&old_path.join("project.json"), &board.project)?;
        if target != folder {
            if let Err(error) = fs::rename(&old_path, self.preferences.root.join(&target)) {
                let _ = json_write(&old_path.join("project.json"), &previous);
                return Err(error.to_string());
            }
        }
        board.folder = target;
        Ok(board)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (Store, PathBuf) {
        let path = std::env::temp_dir().join(format!("basement-store-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        (Store::new(path.join("config"), path.join("artboards")).unwrap(), path)
    }
    fn input(studio: &str, name: &str) -> NewArtboard { NewArtboard { studio: studio.into(), name: name.into(), width: 256, height: 128, resolution: 72, background: "transparent".into() } }
    #[test]
    fn create_reopen_rename_and_collisions_keep_both_documents() {
        let (store, path) = setup();
        let first = store.create(input("endo", "Brush testing")).unwrap();
        let second = store.create(input("prism", "Brush testing")).unwrap();
        assert_ne!(first.folder, second.folder);
        assert_eq!(store.list().unwrap().artboards.len(), 2);
        let renamed = store.rename(&first.folder, "Prueba nueva").unwrap();
        assert_eq!(store.read(&renamed.folder).unwrap().project.id, first.project.id);
        assert!(store.folder(&second.folder).unwrap().join("thumbnail.png").is_file());
        let reopened = Store::new(store.config.clone(), store.preferences.root.clone()).unwrap();
        assert_eq!(reopened.list().unwrap().artboards.len(), 2);
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn rejects_escape_unsupported_studios_and_oversized_canvases() {
        let (store, path) = setup();
        assert!(store.folder("../escape.artboard").is_err());
        assert!(store.create(input("quill", "Not built")).is_err());
        assert!(blank_png(8192, 8192, "#ffffff", 72).is_err());
        assert!(rgba("#é0000").is_err());
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn invalid_project_is_reported_and_root_switch_is_persistent() {
        let (mut store, path) = setup();
        store.create(input("endo", "Valid")).unwrap();
        fs::create_dir(store.preferences.root.join("Broken.artboard")).unwrap();
        let list = store.list().unwrap(); assert_eq!(list.artboards.len(), 1); assert_eq!(list.warnings.len(), 1);
        store.set_preferences(path.join("other"), "light".into()).unwrap();
        assert!(store.list().unwrap().artboards.is_empty());
        let reopened = Store::new(store.config.clone(), path.join("unused")).unwrap();
        assert_eq!(reopened.preferences.root, store.preferences.root); assert_eq!(reopened.preferences.theme, "light");
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn exported_png_preserves_dimensions_color_and_print_resolution() {
        let bytes = blank_png(128, 256, "#123456", 300).unwrap();
        let mut reader = png::Decoder::new(Cursor::new(bytes)).read_info().unwrap();
        assert_eq!((reader.info().width, reader.info().height), (128, 256));
        assert_eq!(reader.info().pixel_dims.unwrap().xppu, 11811);
        let mut output = vec![0; reader.output_buffer_size().unwrap()];
        reader.next_frame(&mut output).unwrap();
        assert_eq!(&output[..4], &[0x12, 0x34, 0x56, 255]);
    }
}
