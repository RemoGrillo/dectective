// App shell: masthead (brand, navigation, spoiler control, theme), spoiler band, footer.
import { useEffect, useRef, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router";
import type { Mode } from "../api";
import { stageOf, useApp, withMode } from "../state";
import { EyeIcon, Medallion } from "./Glyphs";

const NAV = [
  ["/read", "Read"],
  ["/kaleidoscope", "Kaleidoscope"],
  ["/deductions", "Deductions"],
  ["/dossiers", "Case files"],
  ["/cast", "Cast"],
  ["/worlds", "Worlds"],
  ["/lab", "SPARQL"],
  ["/method", "How it works"],
] as const;

const STAGES: Mode[] = ["C1", "C2", "C3", "C4", "gold"];

/** "How much of the story may the edition use?" — the whole story, or only up to a point (no spoilers). */
export function SpoilerControl() {
  const { mode, setMode, meta } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const cur = stageOf(meta, mode);
  return (
    <div className="pop" ref={ref}>
      <button className="btn small" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} title="How much of the story the edition may use">
        <EyeIcon closed={mode !== "gold"} size={16} />
        <span className="sp-long">{mode === "gold" ? "Whole story" : <>Up to: <strong>{cur.label}</strong></>}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="pop-panel" role="dialog" aria-label="Read without spoilers">
          <h3>Read without spoilers?</h3>
          <p className="small muted" style={{ margin: 0 }}>Choose how far you have read. Text, viewpoints and cast will use only what is known at that point.</p>
          <ul className="stage-list" role="radiogroup" aria-label="How far you have read">
            {STAGES.map((m) => {
              const st = stageOf(meta, m);
              return (
                <li key={m}>
                  <button role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setOpen(false); }}>
                    <span className="dot" aria-hidden="true" />
                    <span><span className="t">{m === "gold" ? "The whole story" : `Up to ${st.label.replace(/^The /, "the ")}`}</span><span className="d">{st.desc}</span></span>
                    <span className="pg">{m === "gold" ? "all" : `p. ${st.page}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useApp();
  const dark = theme === "noir";
  return (
    <button className="btn small ghost" onClick={() => setTheme(dark ? "giallo" : "noir")} aria-pressed={dark} title={dark ? "Switch to the light theme" : "Switch to the dark theme"}>
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span><span className="sr-only">Dark theme</span>
    </button>
  );
}

export function Layout() {
  const { mode, setMode, meta } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { if (!loc.hash && !loc.search.includes("s=")) window.scrollTo(0, 0); }, [loc.pathname]);
  const st = stageOf(meta, mode);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="masthead">
        <div className="masthead-inner">
          <Link to={withMode("/", mode)} className="brand" aria-label="A Case of Identity — cover">
            <Medallion size={36} />
            <span>
              <span className="brand-title">A Case of Identity</span>
              <span className="brand-series">An augmented edition</span>
            </span>
          </Link>
          <nav id="mainnav" className={`mainnav ${open ? "open" : ""}`} aria-label="Main">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={withMode(to, mode)} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
            ))}
          </nav>
          <div className="tools">
            <SpoilerControl />
            <ThemeToggle />
            <button className="btn small menu-toggle" aria-expanded={open} aria-controls="mainnav" onClick={() => setOpen(!open)}>Menu</button>
          </div>
        </div>
      </header>
      {mode !== "gold" && (
        <div className="spoiler-band" role="status">
          <div className="inner">
            <EyeIcon closed size={16} />
            <span><strong>No spoilers:</strong> up to “{st.label}” (p. {st.page}). Everything shown uses only what a reader knows by then.</span>
            <button className="btn small" onClick={() => setMode("gold")}>Show the whole story</button>
          </div>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">
        <span>Text: Arthur Conan Doyle, <em>A Case of Identity</em> (1891), public domain. Reasoner: DEC (MIT), commit {meta?.decCommit.slice(0, 8) ?? "…"}. Comparison graph: KGRC (CC BY 4.0).</span>
        <span><Link to={withMode("/method", mode)}>How it works &amp; credits</Link> · <Link to="/lab">SPARQL endpoint</Link></span>
      </footer>
    </div>
  );
}
