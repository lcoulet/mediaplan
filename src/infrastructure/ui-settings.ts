// ui-settings.ts — Per-browser UI preferences, stored in localStorage under a
// dedicated key SEPARATE from AppData ('mediaplan_data_v1'). They are purely
// local display preferences and must never appear in the JSON export.
const UI_SETTINGS_KEY = 'mediaplan_ui_settings_v1';

interface UiSettings {
  dynamicMasking: boolean;
}

function readSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return { dynamicMasking: false };
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return { dynamicMasking: parsed.dynamicMasking === true };
  } catch {
    return { dynamicMasking: false };
  }
}

function writeSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — non-critical, keep in-memory default
  }
}

export function getDynamicMasking(): boolean {
  return readSettings().dynamicMasking;
}

export function setDynamicMasking(value: boolean): void {
  writeSettings({ dynamicMasking: value });
}
