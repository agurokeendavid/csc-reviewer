"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { readTheme, setTheme, subscribeTheme, THEME_COLORS } from "../lib/theme.js";

export default function ThemeToggle() {
  // The static build always renders light; the browser value takes over after hydration.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light");
  const dark = theme === "dark";

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  return (
    <button type="button" className="theme-toggle" aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>Dark mode</span>
    </button>
  );
}
