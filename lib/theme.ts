"use client";

// Theme (light/dark) and text-size are stored locally on the device and
// applied to <html>. A pre-paint script in app/layout.tsx applies the saved
// values before first render to avoid a flash.

export type Theme = "light" | "dark";
export type TextSize = "normal" | "large" | "xlarge";

export const THEME_KEY = "nudge-theme";
export const TEXT_SIZE_KEY = "nudge-textsize";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function getTextSize(): TextSize {
  if (typeof document === "undefined") return "normal";
  const el = document.documentElement;
  if (el.classList.contains("text-xlarge")) return "xlarge";
  if (el.classList.contains("text-large")) return "large";
  return "normal";
}

export function setTextSize(size: TextSize) {
  const el = document.documentElement;
  el.classList.remove("text-large", "text-xlarge");
  if (size === "large") el.classList.add("text-large");
  if (size === "xlarge") el.classList.add("text-xlarge");
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {}
}

// Inlined into <head> as a string so it runs before paint.
export const PREPAINT_SCRIPT = `(function(){try{
  var t=localStorage.getItem('${THEME_KEY}');
  var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
  if(d)document.documentElement.classList.add('dark');
  var s=localStorage.getItem('${TEXT_SIZE_KEY}');
  if(s==='large')document.documentElement.classList.add('text-large');
  if(s==='xlarge')document.documentElement.classList.add('text-xlarge');
}catch(e){}})();`;
