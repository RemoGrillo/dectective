// Short verdict badge (icon + one word: Lie / Delusion / Honest mistake). Hovering (or focusing) it shows a small popup
// that explains the term for this case, the general rule, and the same in DEC's terms; a click keeps it open.
import { useEffect, useRef, useState } from "react";
import { DIAG, type DiagnosisKind } from "../vocab";
import { DiagIcon } from "./Glyphs";

export function TermBadge({ kind, text, assumption, size = "normal" }: { kind: DiagnosisKind; text?: string; assumption?: string; size?: "normal" | "small" }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const open = hover || pinned;
  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPinned(false); setHover(false); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [pinned]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const enter = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(true), 120); };
  const leave = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(false), 150); };
  return (
    <span className="term" ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
      <button type="button" className={`term-badge ${size}`} aria-expanded={open} aria-describedby={open ? undefined : undefined}
        onClick={(e) => { e.stopPropagation(); setPinned(!pinned); }} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
        <DiagIcon kind={kind} size={size === "small" ? 14 : 16} title={DIAG[kind].label} inverse />{DIAG[kind].label}
      </button>
      {open && (
        <span className="term-pop" role="tooltip">
          <strong>{DIAG[kind].label}</strong>
          {text && <span className="term-case">{text}{assumption ? ` — ${assumption}` : ""}.</span>}
          <span className="term-rule">{DIAG[kind].rule}</span>
          <span className="term-dec">DEC: {DIAG[kind].dec}</span>
        </span>
      )}
    </span>
  );
}
