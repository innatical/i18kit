use async_trait::async_trait;
use keyring_core::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

const KEYRING_SERVICE: &str = "i18kit";

const ALL_PROVIDERS: &[(&str, &str)] = &[
    ("google", "Google Translate"),
    ("deepl", "DeepL"),
    ("openai", "OpenAI"),
    ("claude", "Claude"),
    ("gemini", "Gemini"),
];

// ─── Trait ────────────────────────────────────────────────────────────────────

#[async_trait]
pub trait TranslationProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String>;
}

// ─── Provider Structs ─────────────────────────────────────────────────────────

pub struct GoogleTranslate {
    client: Client,
    key: String,
}
pub struct DeepL {
    client: Client,
    key: String,
}
pub struct OpenAI {
    client: Client,
    key: String,
}
pub struct Claude {
    client: Client,
    key: String,
}
pub struct Gemini {
    client: Client,
    key: String,
}

// ─── Implementations ──────────────────────────────────────────────────────────

#[async_trait]
impl TranslationProvider for GoogleTranslate {
    fn id(&self) -> &'static str {
        "google"
    }
    fn label(&self) -> &'static str {
        "Google Translate"
    }

    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String> {
        #[derive(Serialize)]
        struct Req<'a> {
            q: &'a str,
            source: &'a str,
            target: &'a str,
            format: &'a str,
        }
        #[derive(Deserialize)]
        struct Resp {
            data: Data,
        }
        #[derive(Deserialize)]
        struct Data {
            translations: Vec<Translation>,
        }
        #[derive(Deserialize)]
        struct Translation {
            #[serde(rename = "translatedText")]
            translated_text: String,
        }

        let resp = self
            .client
            .post(format!(
                "https://translation.googleapis.com/language/translate/v2?key={}",
                self.key
            ))
            .json(&Req {
                q: text,
                source,
                target,
                format: "text",
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!(
                "Google Translate: {}",
                resp.text().await.unwrap_or_default()
            ));
        }

        resp.json::<Resp>()
            .await
            .map_err(|e| e.to_string())?
            .data
            .translations
            .into_iter()
            .next()
            .map(|t| t.translated_text)
            .ok_or_else(|| "No translation returned".into())
    }
}

#[async_trait]
impl TranslationProvider for DeepL {
    fn id(&self) -> &'static str {
        "deepl"
    }
    fn label(&self) -> &'static str {
        "DeepL"
    }

    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String> {
        #[derive(Serialize)]
        struct Req {
            text: Vec<String>,
            source_lang: String,
            target_lang: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            translations: Vec<Translation>,
        }
        #[derive(Deserialize)]
        struct Translation {
            text: String,
        }

        let base = if self.key.ends_with(":fx") {
            "https://api-free.deepl.com"
        } else {
            "https://api.deepl.com"
        };

        let resp = self
            .client
            .post(format!("{base}/v2/translate"))
            .header("Authorization", format!("DeepL-Auth-Key {}", self.key))
            .json(&Req {
                text: vec![text.to_string()],
                source_lang: source.split('-').next().unwrap_or(source).to_uppercase(),
                target_lang: target.to_uppercase(),
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("DeepL: {}", resp.text().await.unwrap_or_default()));
        }

        resp.json::<Resp>()
            .await
            .map_err(|e| e.to_string())?
            .translations
            .into_iter()
            .next()
            .map(|t| t.text)
            .ok_or_else(|| "No translation returned".into())
    }
}

#[async_trait]
impl TranslationProvider for OpenAI {
    fn id(&self) -> &'static str {
        "openai"
    }
    fn label(&self) -> &'static str {
        "OpenAI"
    }

    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String> {
        #[derive(Serialize)]
        struct Req {
            model: String,
            messages: Vec<Msg>,
            max_tokens: u32,
        }
        #[derive(Serialize)]
        struct Msg {
            role: String,
            content: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            choices: Vec<Choice>,
        }
        #[derive(Deserialize)]
        struct Choice {
            message: MsgResp,
        }
        #[derive(Deserialize)]
        struct MsgResp {
            content: String,
        }

        let resp = self.client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.key))
            .json(&Req {
                model: "gpt-4o-mini".into(),
                messages: vec![Msg {
                    role: "user".into(),
                    content: format!(
                        "Translate from {source} to {target}. Return only the translated text, no explanation.\n\n{text}"
                    ),
                }],
                max_tokens: 1024,
            })
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("OpenAI: {}", resp.text().await.unwrap_or_default()));
        }

        resp.json::<Resp>()
            .await
            .map_err(|e| e.to_string())?
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content.trim().to_string())
            .ok_or_else(|| "No translation returned".into())
    }
}

#[async_trait]
impl TranslationProvider for Claude {
    fn id(&self) -> &'static str {
        "claude"
    }
    fn label(&self) -> &'static str {
        "Claude"
    }

    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String> {
        #[derive(Serialize)]
        struct Req {
            model: String,
            max_tokens: u32,
            messages: Vec<Msg>,
        }
        #[derive(Serialize)]
        struct Msg {
            role: String,
            content: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            content: Vec<Block>,
        }
        #[derive(Deserialize)]
        struct Block {
            #[serde(rename = "type")]
            kind: String,
            text: Option<String>,
        }

        let resp = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.key)
            .header("anthropic-version", "2023-06-01")
            .json(&Req {
                model: "claude-haiku-4-5-20251001".into(),
                max_tokens: 1024,
                messages: vec![Msg {
                    role: "user".into(),
                    content: format!(
                        "Translate from {source} to {target}. Return only the translated text, no explanation.\n\n{text}"
                    ),
                }],
            })
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("Claude: {}", resp.text().await.unwrap_or_default()));
        }

        resp.json::<Resp>()
            .await
            .map_err(|e| e.to_string())?
            .content
            .into_iter()
            .find(|b| b.kind == "text")
            .and_then(|b| b.text)
            .map(|t| t.trim().to_string())
            .ok_or_else(|| "No translation returned".into())
    }
}

#[async_trait]
impl TranslationProvider for Gemini {
    fn id(&self) -> &'static str {
        "gemini"
    }
    fn label(&self) -> &'static str {
        "Gemini"
    }

    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String, String> {
        #[derive(Serialize)]
        struct Req {
            contents: Vec<Content>,
        }
        #[derive(Serialize)]
        struct Content {
            parts: Vec<Part>,
        }
        #[derive(Serialize)]
        struct Part {
            text: String,
        }
        #[derive(Deserialize)]
        struct Resp {
            candidates: Vec<Candidate>,
        }
        #[derive(Deserialize)]
        struct Candidate {
            content: ContentResp,
        }
        #[derive(Deserialize)]
        struct ContentResp {
            parts: Vec<PartResp>,
        }
        #[derive(Deserialize)]
        struct PartResp {
            text: String,
        }

        let resp = self.client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
                self.key
            ))
            .json(&Req {
                contents: vec![Content {
                    parts: vec![Part {
                        text: format!(
                            "Translate from {source} to {target}. Return only the translated text, no explanation.\n\n{text}"
                        ),
                    }],
                }],
            })
            .send().await.map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("Gemini: {}", resp.text().await.unwrap_or_default()));
        }

        resp.json::<Resp>()
            .await
            .map_err(|e| e.to_string())?
            .candidates
            .into_iter()
            .next()
            .and_then(|c| c.content.parts.into_iter().next())
            .map(|p| p.text.trim().to_string())
            .ok_or_else(|| "No translation returned".into())
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

fn get_provider(id: &str) -> Result<Box<dyn TranslationProvider>, String> {
    let key = keyring_entry(id)?
        .get_password()
        .map_err(|_| format!("No API key configured for '{id}'. Add one in Settings."))?;
    let client = Client::new();
    match id {
        "google" => Ok(Box::new(GoogleTranslate { client, key })),
        "deepl" => Ok(Box::new(DeepL { client, key })),
        "openai" => Ok(Box::new(OpenAI { client, key })),
        "claude" => Ok(Box::new(Claude { client, key })),
        "gemini" => Ok(Box::new(Gemini { client, key })),
        _ => Err(format!("Unknown provider: {id}")),
    }
}

// ─── Keyring Helpers ──────────────────────────────────────────────────────────

fn keyring_entry(provider: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("{provider}_api_key")).map_err(|e| e.to_string())
}

fn check_has_key(provider: &str) -> bool {
    match keyring_entry(provider).and_then(|e| e.get_password().map_err(|e| e.to_string())) {
        Ok(_) => true,
        Err(e) => {
            eprintln!("[keyring] check_has_key({provider}) failed: {e}");
            false
        }
    }
}

#[tauri::command]
pub fn debug_api_key(provider: String) -> String {
    match keyring_entry(&provider).and_then(|e| e.get_password().map_err(|e| e.to_string())) {
        Ok(key) => format!("found key, length={}", key.len()),
        Err(e) => format!("error: {e}"),
    }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_provider: Option<String>,
}

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("settings.json"))
        .map_err(|e| e.to_string())
}

// ─── Commands ─────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub id: String,
    pub label: String,
    pub has_key: bool,
}

#[tauri::command]
pub fn list_providers() -> Vec<ProviderInfo> {
    ALL_PROVIDERS
        .iter()
        .map(|(id, label)| ProviderInfo {
            id: id.to_string(),
            label: label.to_string(),
            has_key: check_has_key(id),
        })
        .collect()
}

#[tauri::command]
pub fn save_api_key(provider: String, key: String) -> Result<(), String> {
    keyring_entry(&provider)?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    match keyring_entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(
        &path,
        serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn translate_text(
    provider: String,
    text: String,
    source_lang: String,
    target_lang: String,
) -> Result<String, String> {
    get_provider(&provider)?
        .translate(&text, &source_lang, &target_lang)
        .await
}
