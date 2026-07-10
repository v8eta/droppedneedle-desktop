use crate::connection::ConnectionState;
use tauri::http;
use tauri::Manager;
use tauri_plugin_http::reqwest;

/// Handles the `dn://` custom URI scheme: proxies GETs to the active
/// DroppedNeedle server with the bearer header attached. This is what lets
/// plain <img> and <audio> elements load authenticated API resources
/// (cover art, held-track previews) — element-initiated loads can't carry
/// an Authorization header and production DN sends no CORS headers.
///
/// On Windows/WebView2 the page-side origin form is `http://dn.localhost/<path>`.
/// Responses are buffered (covers are small; held previews are single tracks);
/// Range headers are forwarded both ways so <audio> seeking works.
pub fn handle(
    ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();

    let conn = {
        let state = app.state::<ConnectionState>();
        let guard = state.0.lock().unwrap();
        guard.clone()
    };

    let Some(conn) = conn else {
        responder.respond(plain_response(503, "no active server connection"));
        return;
    };

    let path_and_query = {
        let uri = request.uri();
        let mut s = uri.path().to_string();
        if let Some(q) = uri.query() {
            s.push('?');
            s.push_str(q);
        }
        s
    };
    let url = format!("{}{}", conn.base_url, path_and_query);
    let range = request
        .headers()
        .get(http::header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    tauri::async_runtime::spawn(async move {
        let client = match reqwest::Client::builder()
            .danger_accept_invalid_certs(conn.accept_invalid_certs)
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                responder.respond(plain_response(502, &format!("client build failed: {e}")));
                return;
            }
        };

        let mut req = client.get(&url);
        if let Some(token) = &conn.token {
            req = req.bearer_auth(token);
        }
        if let Some(range) = range {
            req = req.header(http::header::RANGE, range);
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let mut builder = http::Response::builder().status(status);
                for name in [
                    "content-type",
                    "content-length",
                    "content-range",
                    "accept-ranges",
                    "cache-control",
                    "etag",
                ] {
                    if let Some(v) = resp.headers().get(name) {
                        builder = builder.header(name, v.as_bytes());
                    }
                }
                let body = resp.bytes().await.unwrap_or_default().to_vec();
                match builder.body(body) {
                    Ok(r) => responder.respond(r),
                    Err(e) => responder.respond(plain_response(500, &format!("response build failed: {e}"))),
                }
            }
            Err(e) => responder.respond(plain_response(502, &format!("upstream request failed: {e}"))),
        }
    });
}

fn plain_response(status: u16, msg: &str) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(msg.as_bytes().to_vec())
        .unwrap()
}
