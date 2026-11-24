// Character portraits: a PNG from /portraits/<id>.png when the editors have added one (listed in /api/meta),
// otherwise a pencil-style placeholder (hatched profile in an oval, with the monogram).
import { useId } from "react";
import type { Meta } from "../api";
import { useApp } from "../state";
import { RealityDisc } from "./Glyphs";

const MONO: Record<string, string> = { mary: "MS", windibank: "JW", hosmer: "HA", holmes: "SH", watson: "DW", mother: "MM", reader: "?", whatif: "W?" };

/** URL of a portrait: "face" = round thumbnail crop, "full" = the whole oval drawing. */
export function portraitUrl(meta: Meta | null, id: string, kind: "face" | "full" = "face"): string | undefined {
  return meta?.portraits?.[id]?.[kind];
}

export function Portrait({ id, size = 44, name, oval = false }: { id: string; size?: number; name?: string; oval?: boolean }) {
  const { meta } = useApp();
  const pid = useId().replace(/:/g, "");
  if (id === "reality") return <span className="portrait reality" style={{ width: size, height: size, border: 0, background: "transparent" }}><RealityDisc size={size} /></span>;
  const src = portraitUrl(meta, id, oval ? "full" : "face");
  const w = size, h = oval && !src ? Math.round(size * 1.24) : size;     // the drawn portraits are round; placeholders oval
  const label = name ? `Portrait of ${name}` : "Portrait";
  if (src) {
    // the oval drawings carry their own frame: shown whole, without the placeholder's border
    return <span className={`portrait ${oval ? "oval drawn" : ""}`} style={{ width: w, height: h }}><img src={src} alt={label} loading="lazy" /></span>;
  }
  return (
    <span className={`portrait ${oval ? "oval" : ""}`} style={{ width: w, height: h }} role="img" aria-label={`${label} (placeholder)`}>
      <svg width="100%" height="100%" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id={`${pid}-h`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth=".9" opacity=".55" />
          </pattern>
        </defs>
        <rect width="100" height="120" fill="var(--paper)" />
        {id === "reader" ? (
          <g fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round">
            <path d="M18 44 C32 38 44 40 50 48 C56 40 68 38 82 44 V86 C68 80 56 82 50 90 C44 82 32 80 18 86 Z" fill={`url(#${pid}-h)`} />
            <path d="M50 48 V90" />
          </g>
        ) : id === "whatif" ? (
          <g>
            <path d="M28 88 L70 34 L80 42 L38 96 L24 100 Z" fill={`url(#${pid}-h)`} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
            <path d="M66 39 L76 47" stroke="var(--ink)" strokeWidth="3" />
          </g>
        ) : (
          <g>
            <path d="M62 20 C44 18 33 32 34 47 C34 53 32 56 28 61 C27 63 29 64 32 64 C32 68 33 71 35 72 C34 74 35 76 37 77 C37 83 41 87 48 87 C51 87 54 87 56 89 L56 97 C45 99 29 105 24 122 L96 122 C94 105 81 99 70 97 L70 87 C79 81 83 70 83 55 C83 34 77 22 62 20 Z"
              fill={`url(#${pid}-h)`} stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
            {id === "hosmer" && <><circle cx="42" cy="49" r="6" fill="var(--ink)" opacity=".85" /><path d="M48 49 H58" stroke="var(--ink)" strokeWidth="2" /></>}
            {id === "mary" && <path d="M30 30 C44 8 82 6 92 26 C80 22 54 22 30 30 Z" fill="var(--ink)" opacity=".75" />}
          </g>
        )}
        <text x="50" y="114" textAnchor="middle" fontFamily="var(--f-display)" fontWeight="800" fontSize="15" fill="var(--ink)">{MONO[id] ?? id.slice(0, 2).toUpperCase()}</text>
      </svg>
    </span>
  );
}

/** Portrait + name, as used in lists. */
export function Who({ id, name, size = 28, alias }: { id: string; name: string; size?: number; alias?: string }) {
  return (
    <span className="who"><Portrait id={id} size={size} name={name} /><span><span className="name">{name}</span>{alias && <span className="small muted"> · alias “{alias}”</span>}</span></span>
  );
}
