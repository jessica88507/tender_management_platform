"use client";

import { useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

const THEME_KEY = "bid-scheduler-theme";

// Safe to read `document` in the initializer: this app renders fully client-side
// (ClientApp is loaded with `ssr: false`), so there's no server render to mismatch against,
// and the inline script in layout.tsx has already set data-theme by the time this mounts.
function initialTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // localStorage unavailable (private mode etc.) — theme just won't persist
    }
  };

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "切換為亮色模式" : "切換為暗色模式"}
      className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md text-ink-soft cursor-pointer hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {theme === "dark" ? <Sun weight="bold" size={17} /> : <Moon weight="bold" size={17} />}
    </button>
  );
}
