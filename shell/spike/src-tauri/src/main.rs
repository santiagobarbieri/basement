#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{fs, path::PathBuf};

#[derive(Serialize)]
struct DocumentBytes { name: String, bytes: Vec<u8> }

fn workspace() -> Result<PathBuf, String> {
    let root = if let Some(path) = std::env::var_os("BASEMENT_SPIKE_WORKSPACE") {
        PathBuf::from(path)
    } else {
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        executable.ancestors()
            .find(|p| p.join("AGENTS.md").is_file() && p.join("shell/spike").is_dir())
            .map(PathBuf::from).ok_or("Preview must stay inside the BASEMENT checkout")?
    };
    fs::canonicalize(root).map_err(|e| e.to_string())
}

#[tauri::command]
fn probe_options() -> serde_json::Value {
    serde_json::json!({
        "auto": std::env::var_os("BASEMENT_SPIKE_AUTOTEST").is_some(),
        "backend": std::env::var("BASEMENT_SPIKE_BACKEND").unwrap_or_default()
    })
}

#[tauri::command]
fn load_fixture() -> Result<DocumentBytes, String> {
    let root = workspace()?;
    let copy = root.join(".audit-runtime/spike/input.psd");
    let path = if copy.exists() { copy } else { root.join("docs/audit/evidence/prism-test.psd") };
    Ok(DocumentBytes { name: "prism-test.psd".into(), bytes: fs::read(path).map_err(|e| e.to_string())? })
}

#[tauri::command]
async fn pick_document() -> Result<Option<DocumentBytes>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(path) = rfd::FileDialog::new().add_filter("Document", &["psd", "pcraft", "png", "jpg"]).pick_file() else { return Ok(None) };
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 { return Err("Preview limit: 32 MiB".into()); }
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        Ok(Some(DocumentBytes { name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "image.png".into()), bytes }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn save_export(name: String, bytes: Vec<u8>) -> Result<String, String> {
    if name.is_empty() || name.contains(['/', '\\']) || name.starts_with('.') || bytes.len() > 32 * 1024 * 1024 {
        return Err("Invalid export name or preview size".into());
    }
    let folder = workspace()?.join(".audit-runtime/spike/exports");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join(name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn record_probe(label: String, data: serde_json::Value) -> Result<(), String> {
    if !label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') { return Err("Invalid probe label".into()); }
    let folder = workspace()?.join(".audit-runtime/spike");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    fs::write(folder.join(format!("{label}.json")), serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn main() {
    if let Err(error) = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![probe_options, load_fixture, pick_document, save_export, record_probe])
        .run(tauri::generate_context!()) {
        eprintln!("BASEMENT preview: {error}");
    }
}
