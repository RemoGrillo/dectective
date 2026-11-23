// Global UI state: how much of the story the views may use ("gold" = the whole story; C1–C4 = spoiler-free stages) and colour theme.
// Mode lives in the URL (?mode=C2) so links are shareable; both are remembered in localStorage when available.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useApi, type Meta, type Mode } from "./api";

const MODES: Mode[] = ["gold", "C1", "C2", "C3", "C4"];
type Theme = "giallo" | "noir";

function load(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function save(key: string, v: string) {
  try { window.localStorage.setItem(key, v); } catch { /* storage unavailable: keep in memory only */ }
}

type Ctx = { mode: Mode; setMode: (m: Mode) => void; theme: Theme; setTheme: (t: Theme) => void; meta: Meta | null; q: (path: string) => string };
const AppCtx = createContext<Ctx | null>(null);

export function AppState({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const urlMode = params.get("mode") as Mode | null;
  const [stored, setStored] = useState<Mode>(() => (MODES.includes(load("dectective.mode") as Mode) ? (load("dectective.mode") as Mode) : "gold"));
  const mode: Mode = urlMode && MODES.includes(urlMode) ? urlMode : stored;
  const urlTheme = params.get("theme");
  const [theme, setThemeState] = useState<Theme>(() => (urlTheme === "noir" || urlTheme === "giallo" ? urlTheme : load("dectective.theme") === "noir" ? "noir" : "giallo"));
  const { data: meta } = useApi<Meta>("/api/meta");

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const setMode = useCallback((m: Mode) => {
    setStored(m);
    save("dectective.mode", m);
    setParams((p) => { const n = new URLSearchParams(p); if (m === "gold") n.delete("mode"); else n.set("mode", m); return n; }, { replace: true });
  }, [setParams]);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); save("dectective.theme", t); }, []);
  const q = useCallback((path: string) => `${path}${path.includes("?") ? "&" : "?"}mode=${mode}`, [mode]);

  const value = useMemo(() => ({ mode, setMode, theme, setTheme, meta, q }), [mode, setMode, theme, setTheme, meta, q]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppState");
  return c;
}

/** The reading stage of a mode, in plain words ("The whole story", "Up to the clues"…). */
export function stageOf(meta: Meta | null, mode: Mode) {
  const c = meta?.checkpoints.find((x) => x.id === (mode === "gold" ? "G" : mode));
  return { label: c?.label ?? (mode === "gold" ? "The whole story" : mode), desc: c?.desc ?? "", page: c?.page ?? 0 };
}
/** Path that keeps the current mode in the query string. */
export function withMode(path: string, mode: Mode) {
  return mode === "gold" ? path : `${path}${path.includes("?") ? "&" : "?"}mode=${mode}`;
}
