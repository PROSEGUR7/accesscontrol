"use client"
import React from "react";

import { useTheme } from "next-themes"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

const themes = [
  { value: "neutral", label: "Neutro" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "orange", label: "Naranja" },
  { value: "stone", label: "Piedra" },
  { value: "zinc", label: "Zinc" },
]

export function ThemeSelect() {
  const { theme } = useTheme();
  const [baseColor, setBaseColor] = React.useState<string>(
    typeof window !== "undefined" ? (window.localStorage.getItem("baseColor") || "neutral") : "neutral"
  );

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("baseColor") || "neutral";
      setBaseColor(stored);
    }
  }, []);

  const { theme } = useTheme();
  const handleChange = (value: string) => {
    setBaseColor(value);
    window.localStorage.setItem("baseColor", value);
    if (typeof document !== "undefined") {
      const colors = ["neutral", "blue", "green", "orange", "stone", "zinc", "dark"];
      colors.forEach(c => document.documentElement.classList.remove(c));
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add(value);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  };

  return (
    <Select value={baseColor} onValueChange={handleChange}>
      <SelectTrigger className="min-w-[120px]">
        <span className="font-semibold">Theme:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {themes.map((theme) => (
          <SelectItem key={theme.value} value={theme.value}>
            {theme.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
