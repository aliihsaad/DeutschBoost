use tauri::Manager;

#[derive(serde::Serialize)]
struct DeepgramProxyResponse {
    status: u16,
    body: Option<String>,
    body_bytes: Option<Vec<u8>>,
    content_type: String,
}

#[tauri::command]
async fn deepgram_auth_token(api_key: String) -> Result<DeepgramProxyResponse, String> {
    let response = reqwest::Client::new()
        .get("https://api.deepgram.com/v1/auth/token")
        .header("Accept", "application/json")
        .header("Authorization", format!("Token {}", api_key.trim()))
        .send()
        .await
        .map_err(|error| format!("Deepgram auth request failed: {error}"))?;

    response_to_proxy_response(response).await
}

#[tauri::command]
async fn deepgram_transcribe(
    api_key: String,
    model: String,
    language: String,
    audio: Vec<u8>,
    mime_type: String,
    punctuate: Option<bool>,
    smart_format: Option<bool>,
    diarize: Option<bool>,
) -> Result<DeepgramProxyResponse, String> {
    let mut url = reqwest::Url::parse("https://api.deepgram.com/v1/listen")
        .map_err(|error| format!("Could not build Deepgram URL: {error}"))?;

    {
        let mut query = url.query_pairs_mut();
        query.append_pair("model", &model);
        query.append_pair("language", &language);

        if let Some(value) = punctuate {
            query.append_pair("punctuate", if value { "true" } else { "false" });
        }
        if let Some(value) = smart_format {
            query.append_pair("smart_format", if value { "true" } else { "false" });
        }
        if let Some(value) = diarize {
            query.append_pair("diarize", if value { "true" } else { "false" });
        }
    }

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", mime_type)
        .body(audio)
        .send()
        .await
        .map_err(|error| format!("Deepgram transcription request failed: {error}"))?;

    response_to_proxy_response(response).await
}

#[tauri::command]
async fn deepgram_speak(
    api_key: String,
    model: String,
    text: String,
) -> Result<DeepgramProxyResponse, String> {
    let mut url = reqwest::Url::parse("https://api.deepgram.com/v1/speak")
        .map_err(|error| format!("Could not build Deepgram TTS URL: {error}"))?;
    url.query_pairs_mut().append_pair("model", &model);

    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Token {}", api_key.trim()))
        .header("Content-Type", "application/json")
        .body(serde_json::json!({ "text": text }).to_string())
        .send()
        .await
        .map_err(|error| format!("Deepgram TTS request failed: {error}"))?;

    binary_response_to_proxy_response(response).await
}

async fn response_to_proxy_response(
    response: reqwest::Response,
) -> Result<DeepgramProxyResponse, String> {
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read Deepgram response: {error}"))?;

    Ok(DeepgramProxyResponse {
        status,
        body: Some(body),
        body_bytes: None,
        content_type,
    })
}

async fn binary_response_to_proxy_response(
    response: reqwest::Response,
) -> Result<DeepgramProxyResponse, String> {
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("audio/mpeg")
        .to_string();
    let body_bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read Deepgram audio response: {error}"))?
        .to_vec();

    Ok(DeepgramProxyResponse {
        status,
        body: None,
        body_bytes: Some(body_bytes),
        content_type,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            deepgram_auth_token,
            deepgram_speak,
            deepgram_transcribe
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
