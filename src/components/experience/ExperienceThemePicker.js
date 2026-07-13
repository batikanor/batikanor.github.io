"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./ExperienceThemePicker.module.css";

export const EXPERIENCE_THEMES = [
  { id: "aurora", label: "Aurora", icon: "✦", color: "#75f2c5" },
  { id: "ember", label: "Ember", icon: "◆", color: "#ff9a5c" },
  { id: "cobalt", label: "Cobalt", icon: "●", color: "#73a7ff" },
  { id: "mono", label: "Monochrome", icon: "◐", color: "#d8dde5" },
];

export function useExperienceTheme() {
  const [theme, setTheme] = useState("aurora");

  useEffect(() => {
    const stored = window.localStorage.getItem("experience-color-scheme");
    if (EXPERIENCE_THEMES.some((option) => option.id === stored)) setTheme(stored);
  }, []);

  const selectTheme = useCallback((nextTheme) => {
    setTheme(nextTheme);
    window.localStorage.setItem("experience-color-scheme", nextTheme);
  }, []);

  return [theme, selectTheme];
}

export default function ExperienceThemePicker({ className = "", theme, onChange }) {
  return (
    <div className={`${styles.picker} ${className}`} aria-label="Color scheme">
      {EXPERIENCE_THEMES.map((option) => (
        <button
          type="button"
          className={theme === option.id ? styles.active : ""}
          style={{ "--theme-swatch": option.color }}
          onClick={() => onChange(option.id)}
          aria-label={`${option.label} color scheme`}
          title={option.label}
          key={option.id}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
