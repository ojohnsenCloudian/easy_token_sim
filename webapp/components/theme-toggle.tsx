"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — render only after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      title={`Theme: ${theme}. Click to cycle light → dark → system`}
      className="w-9 h-9 rounded-lg"
    >
      {theme === "dark" ? (
        <Moon className="w-4 h-4" />
      ) : theme === "light" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Monitor className="w-4 h-4" />
      )}
    </Button>
  );
}
