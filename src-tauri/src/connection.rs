use std::sync::Mutex;

/// Active-server connection info shared between the TS layer (which owns
/// profile/session state) and Rust consumers (the dn:// media proxy).
/// TS pushes updates via `set_connection` whenever the active profile,
/// token, or cert policy changes.
#[derive(Clone, Debug, Default)]
pub struct Connection {
    pub base_url: String,
    pub token: Option<String>,
    pub accept_invalid_certs: bool,
}

#[derive(Default)]
pub struct ConnectionState(pub Mutex<Option<Connection>>);

#[tauri::command]
pub fn set_connection(
    state: tauri::State<'_, ConnectionState>,
    base_url: Option<String>,
    token: Option<String>,
    accept_invalid_certs: Option<bool>,
) {
    let mut guard = state.0.lock().unwrap();
    match base_url {
        Some(url) => {
            *guard = Some(Connection {
                base_url: url.trim_end_matches('/').to_string(),
                token,
                accept_invalid_certs: accept_invalid_certs.unwrap_or(false),
            });
        }
        None => *guard = None,
    }
}
