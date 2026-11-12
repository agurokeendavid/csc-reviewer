// The theme is a per-browser preference. Light is the default; the inline script in
// app/layout.js applies a saved "dark" choice before the first paint.
export const THEME_KEY = "csc-reviewer:theme";
export const THEME_COLORS = { light: "#f5f6f8", dark: "#141829" };

export const themeScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`;

const listeners = new Set();

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    if (theme === "dark") window.localStorage.setItem(THEME_KEY, "dark");
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    // Private windows can block storage; the theme still applies for this visit.
  }
  for (const listener of listeners) listener();
}
