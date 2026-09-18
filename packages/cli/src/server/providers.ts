export const PROVIDERS = [
  { id: 'google', label: 'Google Translate' },
  { id: 'deepl', label: 'DeepL' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
] as const

export type ProviderId = (typeof PROVIDERS)[number]['id']

export function isProviderId(id: unknown): id is ProviderId {
  return PROVIDERS.some((p) => p.id === id)
}

type Translate = (key: string, text: string, source: string, target: string) => Promise<string>

const prompt = (text: string, source: string, target: string) =>
  `Translate from ${source} to ${target}. Return only the translated text, no explanation.\n\n${text}`

async function post(label: string, url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${label}: ${await res.text()}`)
  return res.json() as Promise<any>
}

const noTranslation = () => new Error('No translation returned')

const providers: Record<ProviderId, Translate> = {
  async google(key, text, source, target) {
    const json = await post(
      'Google Translate',
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {},
      { q: text, source, target, format: 'text' },
    )
    const out = json.data?.translations?.[0]?.translatedText
    if (typeof out !== 'string') throw noTranslation()
    return out
  },

  async deepl(key, text, source, target) {
    const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
    const json = await post(
      'DeepL',
      `${base}/v2/translate`,
      { Authorization: `DeepL-Auth-Key ${key}` },
      {
        text: [text],
        source_lang: source.split('-')[0].toUpperCase(),
        target_lang: target.toUpperCase(),
      },
    )
    const out = json.translations?.[0]?.text
    if (typeof out !== 'string') throw noTranslation()
    return out
  },

  async openai(key, text, source, target) {
    const json = await post(
      'OpenAI',
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${key}` },
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt(text, source, target) }],
        max_tokens: 1024,
      },
    )
    const out = json.choices?.[0]?.message?.content
    if (typeof out !== 'string') throw noTranslation()
    return out.trim()
  },

  async claude(key, text, source, target) {
    const json = await post(
      'Claude',
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt(text, source, target) }],
      },
    )
    const out = json.content?.find((b: any) => b.type === 'text')?.text
    if (typeof out !== 'string') throw noTranslation()
    return out.trim()
  },

  async gemini(key, text, source, target) {
    const json = await post(
      'Gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {},
      { contents: [{ parts: [{ text: prompt(text, source, target) }] }] },
    )
    const out = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof out !== 'string') throw noTranslation()
    return out.trim()
  },
}

export async function translateWith(
  provider: ProviderId,
  key: string,
  text: string,
  source: string,
  target: string,
): Promise<string> {
  try {
    return await providers[provider](key, text, source, target)
  } catch (err) {
    // Some providers take the key in the URL and may echo it in errors.
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(message.split(key).join('***'))
  }
}
