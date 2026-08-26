import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AppTheme, UserSettings } from '../../shared/types';
import { DEFAULT_LANGUAGE_PREFERENCE, isLanguagePreference } from '../../shared/i18n';
import { defaultUserName } from './progressFile';
import { stripBom, writeFileAtomic } from './atomicWrite';

export const USER_SETTINGS_FILENAME = 'settings.json';

function settingsPath(): string {
  return path.join(app.getPath('userData'), USER_SETTINGS_FILENAME);
}

function defaultSettings(): UserSettings {
  return {
    username: defaultUserName(),
    theme: 'light',
    language: DEFAULT_LANGUAGE_PREFERENCE,
    modelPath: null,
    showPixelGrid: false,
    showRulers: false
  };
}

function isAppTheme(v: unknown): v is AppTheme {
  return v === 'light' || v === 'dark';
}

/**
 * Accepts settings written by any earlier version of the app: only `username`
 * is required, every other field falls back to its default. This keeps an
 * existing settings.json usable after a field is added.
 */
function normalize(raw: unknown): UserSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const username = o['username'];
  if (typeof username !== 'string' || username.length === 0) return null;
  const theme = isAppTheme(o['theme']) ? o['theme'] : 'light';
  const language = isLanguagePreference(o['language'])
    ? o['language']
    : DEFAULT_LANGUAGE_PREFERENCE;
  const modelPathRaw = o['modelPath'];
  const modelPath =
    typeof modelPathRaw === 'string' && modelPathRaw.length > 0 ? modelPathRaw : null;
  const showPixelGrid = typeof o['showPixelGrid'] === 'boolean' ? o['showPixelGrid'] : false;
  const showRulers = typeof o['showRulers'] === 'boolean' ? o['showRulers'] : false;
  return { username, theme, language, modelPath, showPixelGrid, showRulers };
}

function isValidSettings(raw: unknown): raw is UserSettings {
  return normalize(raw) !== null;
}

export async function loadUserSettings(): Promise<UserSettings> {
  const filePath = settingsPath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      const fresh = defaultSettings();
      await writeFileAtomic(filePath, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch {
    return defaultSettings();
  }
  const normalized = normalize(parsed);
  return normalized ?? defaultSettings();
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  if (!isValidSettings(settings)) {
    throw new Error('Invalid settings payload');
  }
  await writeFileAtomic(settingsPath(), JSON.stringify(settings, null, 2));
}
