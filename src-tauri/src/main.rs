// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[derive(serde::Serialize)]
struct OpenResult {
    path: String,
    content: String,
}

// 1. 系统门户另存为（返回保存的完整路径）
#[tauri::command]
fn save_file_dialog(
    content: String,
    filename: Option<String>,
    file_name: Option<String>,
    default_name: Option<String>,
    default_path: Option<String>,
    name: Option<String>,
) -> Option<String> {
    let target_name = filename
        .or(file_name)
        .or(default_name)
        .or(default_path)
        .or(name)
        .unwrap_or_else(|| "思维导图.mind".to_string());

    let file_path = rfd::FileDialog::new()
        .add_filter("MindMap", &["mind", "json"])
        .set_file_name(&target_name)
        .save_file();

    if let Some(path) = file_path {
        if std::fs::write(&path, &content).is_ok() {
            return Some(path.to_string_lossy().to_string());
        }
    }
    None
}

// 2. 已有文件直接原路径覆盖保存（无需弹窗）
#[tauri::command]
fn save_file_direct(path: String, content: String) -> bool {
    std::fs::write(path, content).is_ok()
}

// 3. 打开文件（返回文件内容与路径）
#[tauri::command]
fn open_file_dialog() -> Option<OpenResult> {
    if let Some(path) = rfd::FileDialog::new()
        .add_filter("MindMap", &["mind", "json"])
        .pick_file()
    {
        if let Ok(content) = std::fs::read_to_string(&path) {
            return Some(OpenResult {
                path: path.to_string_lossy().to_string(),
                content,
            });
        }
    }
    None
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_file_dialog,
            save_file_direct,
            open_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
