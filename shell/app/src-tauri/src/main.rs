#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod store;
use store::{Artboard, NewArtboard, Store};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager};

struct AppState { store: Mutex<Store>, pending: Mutex<Option<String>> }

#[tauri::command]
fn home(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "index": store.list()?, "preferences": store.preferences }))
}
#[tauri::command]
fn create_artboard(state: tauri::State<AppState>, input: NewArtboard) -> Result<Artboard, String> {
    state.store.lock().map_err(|e| e.to_string())?.create(input)
}
#[tauri::command]
fn read_artboard(state: tauri::State<AppState>, folder: String) -> Result<Artboard, String> {
    state.store.lock().map_err(|e| e.to_string())?.read(&folder)
}
#[tauri::command]
fn rename_artboard(state: tauri::State<AppState>, folder: String, name: String) -> Result<Artboard, String> {
    state.store.lock().map_err(|e| e.to_string())?.rename(&folder, &name)
}
#[tauri::command]
fn artboard_image(state: tauri::State<AppState>, folder: String) -> Result<Vec<u8>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let path = store.folder(&folder)?.join("main.png");
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 64 * 1024 * 1024 { return Err("Image too large".into()); }
    fs::read(path).map_err(|e| e.to_string())
}
#[tauri::command]
fn set_theme(state: tauri::State<AppState>, theme: String) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let root = store.preferences.root.clone(); store.set_preferences(root, theme)
}
#[tauri::command]
async fn choose_root(handle: tauri::AppHandle) -> Result<bool, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| rfd::FileDialog::new().set_title("Carpeta de artboards de BASEMENT").pick_folder()).await.map_err(|e| e.to_string())?;
    let Some(root) = picked else { return Ok(false) };
    let state = handle.state::<AppState>();
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let theme = store.preferences.theme.clone(); store.set_preferences(root, theme)?;
    Ok(true)
}
#[tauri::command]
async fn export_png(handle: tauri::AppHandle, folder: String) -> Result<Option<String>, String> {
    let (bytes, name) = {
        let state = handle.state::<AppState>(); let store = state.store.lock().map_err(|e| e.to_string())?;
        let board = store.read(&folder)?;
        (fs::read(store.folder(&folder)?.join("main.png")).map_err(|e| e.to_string())?, format!("{}.png", board.project.name))
    };
    let destination = tauri::async_runtime::spawn_blocking(move || rfd::FileDialog::new().set_file_name(&name).add_filter("PNG", &["png"]).save_file()).await.map_err(|e| e.to_string())?;
    let Some(path) = destination else { return Ok(None) };
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}
#[tauri::command]
fn pending_open(state: tauri::State<AppState>) -> Result<Option<String>, String> {
    Ok(state.pending.lock().map_err(|e| e.to_string())?.take())
}

#[tauri::command]
fn qa_mode() -> bool { std::env::var_os("BASEMENT_QA_DIR").is_some() }
#[tauri::command]
fn qa_report(data: serde_json::Value) -> Result<(), String> {
    let folder = PathBuf::from(std::env::var_os("BASEMENT_QA_DIR").ok_or("QA is disabled")?);
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join("native-ui.json");
    let mut report: serde_json::Value = fs::read(&path).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_else(|| serde_json::json!({}));
    if let (Some(target), Some(source)) = (report.as_object_mut(), data.as_object()) { target.extend(source.clone()); }
    fs::write(path, serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn queue_open(app: &tauri::AppHandle, path: PathBuf) -> Result<(), String> {
    let folder = path.file_name().ok_or("Invalid artboard")?.to_string_lossy().into_owned();
    let state = app.state::<AppState>();
    let store = state.store.lock().map_err(|e| e.to_string())?;
    // Finder requests must identify an artboard inside the configured root.
    if fs::canonicalize(&path).map_err(|e| e.to_string())? != store.folder(&folder)? { return Err("El artboard está fuera de la carpeta elegida. Cambiá la carpeta en Preferencias para abrirlo.".into()); }
    store.read(&folder)?;
    *state.pending.lock().map_err(|e| e.to_string())? = Some(folder.clone());
    app.emit("open-artboard", folder).map_err(|e| e.to_string())
}

fn main() {
    let application = tauri::Builder::default()
        .setup(|app| {
            let config = std::env::var_os("BASEMENT_CONFIG_DIR").map(PathBuf::from).unwrap_or(app.path().app_config_dir()?);
            // Preserve any preferences written by the first Phase 4 preview.
            if std::env::var_os("BASEMENT_CONFIG_DIR").is_none() && !config.join("preferences.json").exists() {
                if let Some(parent) = config.parent() {
                    let previous = parent.join("com.basement.app/preferences.json");
                    if previous.is_file() { fs::create_dir_all(&config)?; fs::copy(previous, config.join("preferences.json"))?; }
                }
            }
            let root = std::env::var_os("BASEMENT_ARTBOARD_ROOT").map(PathBuf::from).unwrap_or(app.path().home_dir()?.join("Basement"));
            let store = Store::new(config, root).map_err(std::io::Error::other)?;
            app.manage(AppState { store: Mutex::new(store), pending: Mutex::new(None) });
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
            let preferences = MenuItem::with_id(app, "preferences", "Preferencias…", true, Some("CmdOrCtrl+,"))?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("Salir de BASEMENT"))?;
            let submenu = Submenu::with_items(app, "BASEMENT", true, &[&preferences, &separator, &quit])?;
            let undo = PredefinedMenuItem::undo(app, Some("Deshacer"))?;
            let redo = PredefinedMenuItem::redo(app, Some("Rehacer"))?;
            let cut = PredefinedMenuItem::cut(app, Some("Cortar"))?;
            let copy = PredefinedMenuItem::copy(app, Some("Copiar"))?;
            let paste = PredefinedMenuItem::paste(app, Some("Pegar"))?;
            let select_all = PredefinedMenuItem::select_all(app, Some("Seleccionar todo"))?;
            let edit = Submenu::with_items(app, "Edición", true, &[&undo, &redo, &cut, &copy, &paste, &select_all])?;
            app.set_menu(Menu::with_items(app, &[&submenu, &edit])?)?;
            for arg in std::env::args().skip(1) { if arg.ends_with(".artboard") { let _ = queue_open(app.handle(), PathBuf::from(arg)); } }
            Ok(())
        })
        .on_menu_event(|app, event| { if event.id().as_ref() == "preferences" { let _ = app.emit("preferences", ()); } })
        .invoke_handler(tauri::generate_handler![home, create_artboard, read_artboard, rename_artboard, artboard_image, set_theme, choose_root, export_png, pending_open, qa_mode, qa_report])
        .build(tauri::generate_context!());
    match application {
        Ok(app) => app.run(|handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event { for url in urls { if let Ok(path) = url.to_file_path() { if let Err(error) = queue_open(handle, path) { let _ = handle.emit("open-error", error); } } } }
        }),
        Err(error) => eprintln!("BASEMENT: {error}"),
    }
}
