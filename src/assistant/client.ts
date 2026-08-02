/**
 * Verso — cliente del asistente.
 *
 * BYOK. Un solo cliente OpenAI-compatible sirve para FreeRouter y para el proveedor
 * que configure quien use la app. Las credenciales viven en SecureStore: nunca en
 * SQLite, nunca en el pack, nunca en el repo.
 *
 * El asistente es SECUNDARIO (ARQUITECTURA.md §7). El modelo conoce el libro entero
 * y puede filtrar aunque se lo prohíbas: sus respuestas se marcan como no verificadas
 * y no se mezclan con el material curado.
 */
import * as SecureStore from 'expo-secure-store';

const K_BASE = 'verso.assistant.base';
const K_KEY = 'verso.assistant.key';
const K_MODEL = 'verso.assistant.model';

export type Config = { base: string; key: string; model: string };

export async function loadConfig(): Promise<Config | null> {
  const [base, key, model] = await Promise.all([
    SecureStore.getItemAsync(K_BASE),
    SecureStore.getItemAsync(K_KEY),
    SecureStore.getItemAsync(K_MODEL),
  ]);
  if (!base || !key) return null;
  return { base, key, model: model || 'gpt-4o-mini' };
}

export async function saveConfig(c: Config): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(K_BASE, c.base.trim().replace(/\/$/, '')),
    SecureStore.setItemAsync(K_KEY, c.key.trim()),
    SecureStore.setItemAsync(K_MODEL, c.model.trim()),
  ]);
}

export async function clearConfig(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(K_BASE),
    SecureStore.deleteItemAsync(K_KEY),
    SecureStore.deleteItemAsync(K_MODEL),
  ]);
}

export function systemPrompt(bookTitle: string, unitLabel: string, unitTitle?: string | null) {
  return [
    `El lector está leyendo "${bookTitle}".`,
    `Va exactamente por: ${unitLabel}${unitTitle ? ` — ${unitTitle}` : ''}.`,
    '',
    'REGLA ABSOLUTA: no reveles NADA que ocurra después de ese punto del libro.',
    'No adelantes destinos de personajes, giros, muertes, identidades ocultas ni',
    'revelaciones posteriores, ni siquiera insinuadas o "sin dar detalles".',
    'Si la respuesta honesta exige información posterior, dilo así:',
    '"Eso se responde más adelante en el libro" — y para ahí.',
    '',
    'Responde en español, breve y concreto. Si no lo sabes, dilo.',
  ].join('\n');
}

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function ask(cfg: Config, messages: Msg[]): Promise<string> {
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.3 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}
