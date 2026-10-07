/**
 * Appearance of the interface, ported from oc3-frontend (src/lib/theme.ts), on two
 * independent axes: the light or dark mode (`Theme`: the system one, or an explicit
 * choice), and the colour palette (`Palette`: standard, or high contrast).
 *
 * The dark tokens live under the `dark` class, the high-contrast ones under the
 * `contrast` class (`styles/tokens.css`), both set here on `<html>`. The choices are
 * kept in local storage and applied before the first render, so the page never
 * flashes the other appearance on load.
 */
export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "om3.theme";

/** Key of the boolean dark mode stored by the webapp before the oc3 themes. */
const LEGACY_DARK_MODE_KEY = "darkMode";

/** jsdom and some embedded browsers have no matchMedia: they get the light mode. */
function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.includes(value as Theme);
}

/**
 * Theme cached locally. A choice made with the former dark mode switch is carried
 * over; "system" as long as nothing has been chosen.
 */
export function cachedTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
    const legacy = localStorage.getItem(LEGACY_DARK_MODE_KEY);
    if (legacy === "true") return "dark";
    if (legacy === "false") return "light";
    return "system";
  } catch {
    // Private browsing or storage refused: the system theme will do.
    return "system";
  }
}

/** Whether a theme resolves to the dark mode, now. */
export function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark());
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", isDarkTheme(theme));
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.removeItem(LEGACY_DARK_MODE_KEY);
  } catch {
    // Without the cache the theme stays correct: it is applied again on the next load.
  }
}

/**
 * Follows the system setting as long as the theme is "system". Returns the
 * unsubscribe function.
 */
export function watchSystemTheme(current: () => Theme, onApplied?: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (current() !== "system") return;
    applyTheme("system");
    onApplied?.();
  };
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

export const PALETTES = ["standard", "contrast"] as const;

export type Palette = (typeof PALETTES)[number];

const PALETTE_STORAGE_KEY = "om3.palette";

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && PALETTES.includes(value as Palette);
}

/** Palette cached locally, "standard" as long as nothing has been chosen. */
export function cachedPalette(): Palette {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPalette(stored) ? stored : "standard";
  } catch {
    return "standard";
  }
}

export function applyPalette(palette: Palette): void {
  document.documentElement.classList.toggle("contrast", palette === "contrast");
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // Without the cache the palette stays correct: it is applied again on the next load.
  }
}
