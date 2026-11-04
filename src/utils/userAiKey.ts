const STORAGE_KEY = 'mamina_teka_user_gemini_key_v1';

export function getUserGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUserGeminiKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function aiHeaders(): Record<string, string> {
  const key = getUserGeminiKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'x-gemini-key': key } : {}),
  };
}
