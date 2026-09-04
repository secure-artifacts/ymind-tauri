// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::Manager;


// 🌟 Rust 原生保存引擎：支持弹窗选目录保存 & 覆盖保存
#[tauri::command]
fn save_mindmap_file(path: Option<String>, default_name: String, content: String) -> Result<String, String> {
    let target_path = match path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => {
            let file_path = rfd::FileDialog::new()
                .set_file_name(&default_name)
                .add_filter("YMind 思维导图 (*.ymind)", &["ymind", "mind", "json"])
                .add_filter("所有文件 (*.*)", &["*"])
                .save_file();

            match file_path {
                Some(p) => p,
                None => return Ok("CANCELLED".to_string()),
            }
        }
    };

    fs::write(&target_path, content).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(target_path.to_string_lossy().to_string())
}

// 🌟 Rust 原生打开引擎：支持读取任意 .mind, .ymind, .json, .xmind
#[tauri::command]
fn open_mindmap_file() -> Result<Option<(String, String)>, String> {
    let file_path = rfd::FileDialog::new()
        .add_filter("思维导图文件 (*.mind, *.ymind, *.json, *.xmind)", &["mind", "ymind", "json", "xmind"])
        .add_filter("所有文件 (*.*)", &["*"])
        .pick_file();

    match file_path {
        Some(p) => {
            let content = fs::read_to_string(&p).map_err(|e| format!("读取文件失败: {}", e))?;
            Ok(Some((p.to_string_lossy().to_string(), content)))
        }
        None => Ok(None),
    }
}


#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
                let window = app.get_webview_window("main").unwrap();
                window.maximize()?;
                Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file_content, save_mindmap_file, open_mindmap_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
