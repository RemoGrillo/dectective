// The edition's icon set. One icon per idea, used everywhere:
//   says = speech bubble · believes = thought cloud · concludes = magnifier · supposes = dashed bubble with "?"
//   inside the icon: ✓ = holds it, ✕ (red) = holds otherwise.
//   Diagnoses are FILLED red badges: lie (bubble ✕), delusion (cloud ✕), honest mistake (bubble !).
//   Reality is a yellow disc. Every icon has a text label (title + aria-label): colour is never the only cue.
import type { DecType } from "../api";
import { DIAG, KIND, REALITY, VERB, type DiagnosisKind, type Polarity, type RealityValue, type Verb } from "../vocab";

const BUBBLE = "M4 3.5h16a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2h-8.6L6.2 21v-4.3H4a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z";
const CLOUD = "M7.2 15.6a4.1 4.1 0 0 1-.6-8.2 5.3 5.3 0 0 1 10.1-1.1 3.9 3.9 0 0 1 1.6 7.5 3.4 3.4 0 0 1-3.3 1.8z";
const CHECK = (cx: number, cy: number) => `M${cx - 4} ${cy + .2}l2.8 2.8 5-5.6`;
const CROSS = (cx: number, cy: number) => `M${cx - 3.4} ${cy - 3.4}l6.8 6.8M${cx + 3.4} ${cy - 3.4}l-6.8 6.8`;

function Mark({ polarity, cx, cy }: { polarity?: Polarity; cx: number; cy: number }) {
  if (!polarity) return null;
  return polarity === "yes"
    ? <path d={CHECK(cx, cy)} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    : <path d={CROSS(cx, cy)} fill="none" stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" />;
}

export function VerbIcon({ verb, polarity, size = 20, title }: { verb: Verb; polarity?: Polarity; size?: number; title?: string }) {
  const t = title ?? (polarity ? VERB[verb][polarity] : VERB[verb].label);
  const stroke = polarity === "no" ? "var(--red)" : "var(--ink)";
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      {verb === "says" && <><path d={BUBBLE} fill="var(--paper)" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" /><Mark polarity={polarity} cx={12} cy={9.6} /></>}
      {verb === "believes" && <>
        <path d={CLOUD} transform="translate(-1.6 -1.2) scale(1.14)" fill="var(--paper)" stroke={stroke} strokeWidth="1.55" strokeLinejoin="round" />
        <circle cx="4.6" cy="19.2" r="1.7" fill="var(--paper)" stroke={stroke} strokeWidth="1.4" />
        <circle cx="2.4" cy="22.2" r="1.05" fill={stroke} />
        <Mark polarity={polarity} cx={12.4} cy={10.4} />
      </>}
      {verb === "concludes" && <>
        <circle cx="10" cy="10" r="7.2" fill="var(--paper)" stroke={stroke} strokeWidth="2" />
        <path d="M15.3 15.3l6 6" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <Mark polarity={polarity} cx={10} cy={10} />
      </>}
      {verb === "supposes" && <>
        <path d={BUBBLE} fill="var(--paper)" stroke={stroke} strokeWidth="1.7" strokeDasharray="3 2.2" strokeLinejoin="round" />
        {polarity ? <Mark polarity={polarity} cx={12} cy={9.6} /> : <text x="12" y="13.6" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--ink)" fontFamily="var(--f-display)">?</text>}
      </>}
    </svg>
  );
}

export function DiagIcon({ kind, size = 18, title }: { kind: DiagnosisKind; size?: number; title?: string }) {
  const t = title ?? `${DIAG[kind].label}: ${DIAG[kind].short}`;
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill="var(--red)" />
      {kind === "delusion"
        ? <g transform="translate(1.6 1.2) scale(.86)"><path d={CLOUD} fill="var(--on-red)" /><circle cx="5.2" cy="18.6" r="1.6" fill="var(--on-red)" /><circle cx="3" cy="21.6" r="1" fill="var(--on-red)" /></g>
        : <g transform="translate(1.7 1.6) scale(.86)"><path d={BUBBLE} fill="var(--on-red)" /></g>}
      {kind === "mistake"
        ? <><path d="M12 6.2v5.4" stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="14.4" r="1.4" fill="var(--red)" /></>
        : <path d={CROSS(12, kind === "delusion" ? 10.2 : 9.9)} stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

export function DiagBadge({ kind, outline = false }: { kind: DiagnosisKind; outline?: boolean }) {
  return <span className={`diag-badge ${outline ? "outline" : ""}`} title={DIAG[kind].rule}><DiagIcon kind={kind} size={16} />{DIAG[kind].label}</span>;
}

export function RealityDisc({ value, size = 22, title }: { value?: RealityValue; size?: number; title?: string }) {
  const t = title ?? (value ? `Reality: ${REALITY[value].label}` : "Reality");
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      <circle cx="12" cy="12" r="10.5" fill="var(--yellow)" stroke="#141414" strokeWidth="1.8" />
      {value === "true" && <path d={CHECK(12, 11.6)} fill="none" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      {(value === "false" || value === "false-if") && <path d={CROSS(12, 12)} fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeDasharray={value === "false-if" ? "3 2" : undefined} />}
      {value === "unknown" && <text x="12" y="16.2" textAnchor="middle" fontSize="12" fontWeight="800" fill="#141414" fontFamily="var(--f-display)">?</text>}
    </svg>
  );
}

/** World kind icon (a world is a point of view: a statement, beliefs, a conclusion, a guess, Reality). */
export function WorldIcon({ type, size = 18 }: { type: DecType; size?: number }) {
  const t = `${KIND[type]?.label ?? type} (DEC: ${KIND[type]?.dec ?? type})`;
  if (type === "reality") return <RealityDisc size={size} title={t} />;
  if (type === "verbatim") return <VerbIcon verb="says" size={size} title={t} />;
  if (type === "doxastic") return <VerbIcon verb="believes" size={size} title={t} />;
  if (type === "epistemic") return <VerbIcon verb="concludes" size={size} title={t} />;
  if (type === "conjectural") return <VerbIcon verb="supposes" size={size} title={t} />;
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}><title>{t}</title>
      <path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.7" />
    </svg>
  );
}

export function DecBadge({ title = "DEC, the reasoner: this comes from its inferences or verdicts" }: { title?: string }) {
  return <span className="dec-badge" title={title}>⚙ DEC</span>;
}

export function EyeIcon({ closed = false, size = 18 }: { closed?: boolean; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      {closed && <path d="M4 20L20 4" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}

/** Original medallion: a magnifying glass over a typed "e" whose stroke is slurred (the typewriter clue). */
export function Medallion({ size = 48, className, fill = "#F2C200" }: { size?: number; className?: string; fill?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Medallion: a magnifying glass over a slurred typewritten letter e">
      <title>DECTECTIVE medallion</title>
      <circle cx="100" cy="100" r="96" fill={fill} stroke="#141414" strokeWidth="6" />
      <circle cx="100" cy="100" r="84" fill="none" stroke="#141414" strokeWidth="1.5" />
      <text x="86" y="122" textAnchor="middle" fontFamily="'Courier Prime', 'Courier New', monospace" fontWeight="700" fontSize="92" fill="#141414" opacity=".28">e</text>
      <text x="83" y="120" textAnchor="middle" fontFamily="'Courier Prime', 'Courier New', monospace" fontWeight="700" fontSize="92" fill="#141414">e</text>
      <circle cx="88" cy="92" r="44" fill="none" stroke="#141414" strokeWidth="9" />
      <circle cx="88" cy="92" r="38" fill="none" stroke="#B3121F" strokeWidth="2" strokeDasharray="5 5" />
      <path d="M120 124 L158 162" stroke="#141414" strokeWidth="16" strokeLinecap="round" />
      <path d="M126 130 L156 160" stroke="#B3121F" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** One-line legend of the icon set. */
export function IconLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="kal-legend" aria-label="Legend of the icons">
      {(["says", "believes", "concludes", "supposes"] as Verb[]).map((v) => <span key={v} title={`${VERB[v].help} (DEC: ${VERB[v].dec})`}><VerbIcon verb={v} size={16} /> {VERB[v].label}</span>)}
      <span><VerbIcon verb="says" polarity="yes" size={16} /> ✓ holds it</span>
      <span><VerbIcon verb="says" polarity="no" size={16} /> ✕ holds otherwise</span>
      {!compact && <span><RealityDisc size={16} /> Reality</span>}
    </div>
  );
}
