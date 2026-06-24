import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setThemeMode: (theme: ThemeMode) => void;
  cycleThemeMode: () => void;
};

const STORAGE_KEY = "erp-theme-mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveEffectiveTheme(mode: ThemeMode): EffectiveTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    resolveEffectiveTheme(getStoredThemeMode()),
  );

  useEffect(() => {
    const nextTheme = resolveEffectiveTheme(themeMode);
    setEffectiveTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.themeMode = themeMode;
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeMode === "system") {
        setEffectiveTheme(resolveEffectiveTheme("system"));
        document.documentElement.dataset.theme = resolveEffectiveTheme("system");
      }
    };

    handleChange();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      effectiveTheme,
      setThemeMode: setThemeModeState,
      cycleThemeMode: () => {
        setThemeModeState((current) =>
          current === "light" ? "dark" : current === "dark" ? "system" : "light",
        );
      },
    }),
    [effectiveTheme, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
