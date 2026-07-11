use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// System-tray presence: an always-on icon whose tooltip and taskbar badge
/// reflect the download queue, a menu for the common jumps, and click-to-focus.
/// Menu selections emit `tray://navigate` (path) which the frontend routes.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open DroppedNeedle", true, None::<&str>)?;
    let downloads = MenuItem::with_id(app, "downloads", "Downloads", true, None::<&str>)?;
    let review = MenuItem::with_id(app, "review", "Needs review", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &downloads, &review, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("DroppedNeedle")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => focus_main(app),
            "downloads" => navigate(app, "/downloads"),
            "review" => navigate(app, "/downloads"),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn navigate<R: Runtime>(app: &AppHandle<R>, path: &str) {
    focus_main(app);
    let _ = app.emit("tray://navigate", path);
}

/// Update the tray tooltip and taskbar badge from the frontend's poll-diff
/// watcher. `active` downloads + `held` items needing review.
#[tauri::command]
pub fn set_tray_status<R: Runtime>(
    app: AppHandle<R>,
    active: Option<u32>,
    held: Option<u32>,
) -> Result<(), String> {
    let active = active.unwrap_or(0);
    let held = held.unwrap_or(0);

    let mut parts: Vec<String> = Vec::new();
    if active > 0 {
        parts.push(format!("{active} downloading"));
    }
    if held > 0 {
        parts.push(format!("{held} need review"));
    }
    let tooltip = if parts.is_empty() {
        "DroppedNeedle".to_string()
    } else {
        format!("DroppedNeedle — {}", parts.join(" · "))
    };

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
    if let Some(window) = app.get_webview_window("main") {
        let total = active + held;
        let _ = window.set_badge_count(if total > 0 { Some(total as i64) } else { None });
    }
    Ok(())
}
