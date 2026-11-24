// The edition's icon set: one coherent language, used everywhere.
//   SHAPE = who holds it / how: says = speech bubble · believes = thought cloud · concludes = magnifier ·
//           supposes = light bulb · Reality = yellow disc.
//   CORNER MARK = polarity: black disc ✓ = holds it · red disc ✕ = holds otherwise (the shape turns red too).
//   REALITY'S VALUE uses the same marks, full size: black ✓ = true · red ✕ = false · dashed red ✕ = false if… ·
//           grey ? = not said (the same colours as the dots of the Worlds diagram).
//   VERDICTS are SOLID red shapes: lie = bubble ✕ · delusion = cloud ✕ · honest mistake = bubble !
//           (`inverse` draws them white, for red badges).
// Every icon has a text label (title + aria-label): colour is never the only cue.
import type { DecType } from "../api";
import { DIAG, KIND, REALITY, VERB, type DiagnosisKind, type Polarity, type RealityValue, type Verb } from "../vocab";

const SW = 1.7;                                   // one stroke width for every outline
// shapes keep the bottom-right corner free for the polarity mark
const BUBBLE = "M5 3h12a3 3 0 0 1 3 3v6.6a3 3 0 0 1-3 3h-6.6l-4.6 4.2v-4.2H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z";
const CLOUD = "M6.9 15.4h9.6a3.5 3.5 0 0 0 .5-6.96 5.1 5.1 0 0 0-9.6-1.24 4.15 4.15 0 0 0-.5 8.2z";
const CLOUD_DOTS = [{ cx: 5.3, cy: 19.1, r: 1.45 }, { cx: 2.6, cy: 21.9, r: .95 }];
const BULB = "M8.3 15.3c0-1.7-.9-2.5-1.9-3.7A5.8 5.8 0 0 1 11 2.6a5.8 5.8 0 0 1 4.6 9c-1 1.2-1.9 2-1.9 3.7z";
const CHECK = (cx: number, cy: number, k = 1) => `M${cx - 3.6 * k} ${cy + .1 * k}l${2.5 * k} ${2.5 * k} ${4.7 * k} -${5.2 * k}`;
const CROSS = (cx: number, cy: number, k = 1) => `M${cx - 3.2 * k} ${cy - 3.2 * k}l${6.4 * k} ${6.4 * k}M${cx + 3.2 * k} ${cy - 3.2 * k}l-${6.4 * k} ${6.4 * k}`;

/** Polarity mark in the bottom-right corner: black ✓ (holds it) or red ✕ (holds otherwise), ringed with paper. */
function Corner({ polarity }: { polarity?: Polarity }) {
  if (!polarity) return null;
  const yes = polarity === "yes";
  return (
    <g>
      <circle cx="18.6" cy="18.6" r="5.3" fill={yes ? "var(--ink)" : "var(--red)"} stroke="var(--paper)" strokeWidth="1.6" />
      <path d={yes ? CHECK(18.7, 18.4, .62) : CROSS(18.6, 18.6, .58)} fill="none" stroke={yes ? "var(--paper)" : "var(--on-red)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Shape({ verb, stroke, dashed = false }: { verb: Verb; stroke: string; dashed?: boolean }) {
  const common = { fill: "var(--paper)", stroke, strokeWidth: SW, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (verb) {
    case "says": return <path d={BUBBLE} {...common} />;
    case "believes": return <>
      <path d={CLOUD} {...common} />
      <circle {...CLOUD_DOTS[0]} {...common} strokeWidth="1.5" />
      <circle {...CLOUD_DOTS[1]} r={1.15} fill={stroke} />
    </>;
    case "concludes": return <>
      <circle cx="13" cy="9.4" r="6.2" {...common} strokeWidth="2" />
      <path d="M8.5 13.9 3.3 19.1" stroke={stroke} strokeWidth="3.1" strokeLinecap="round" />
    </>;
    case "supposes": return <>
      <path d={BULB} {...common} strokeDasharray={dashed ? "2.6 2" : undefined} />
      <path d="M8.5 17.8h5M9.3 20.4h3.4" stroke={stroke} strokeWidth={SW} strokeLinecap="round" />
    </>;
  }
}

export function VerbIcon({ verb, polarity, size = 20, title }: { verb: Verb; polarity?: Polarity; size?: number; title?: string }) {
  const t = title ?? (polarity ? VERB[verb][polarity] : VERB[verb].label);
  const stroke = polarity === "no" ? "var(--red)" : "var(--ink)";
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      <Shape verb={verb} stroke={stroke} />
      <Corner polarity={polarity} />
    </svg>
  );
}

/** Verdict icon: a SOLID red shape (bubble for what is said, cloud for what is believed) with a white mark. */
export function DiagIcon({ kind, size = 18, title, inverse = false }: { kind: DiagnosisKind; size?: number; title?: string; inverse?: boolean }) {
  const t = title ?? `${DIAG[kind].label}: ${DIAG[kind].short}`;
  const body = inverse ? "var(--on-red)" : "var(--red)", mark = inverse ? "var(--red)" : "var(--on-red)";
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      {kind === "delusion" ? <>
        <path d={CLOUD} fill={body} stroke={body} strokeWidth="1.2" strokeLinejoin="round" />
        {CLOUD_DOTS.map((c, i) => <circle key={i} {...c} r={c.r + .25} fill={body} />)}
        <path d={CROSS(11.6, 10.1, .8)} stroke={mark} strokeWidth="2.3" strokeLinecap="round" />
      </> : <>
        <path d={BUBBLE} fill={body} stroke={body} strokeWidth="1.2" strokeLinejoin="round" />
        {kind === "lie"
          ? <path d={CROSS(11, 9.3, .85)} stroke={mark} strokeWidth="2.3" strokeLinecap="round" />
          : <><path d="M11 5.6v4.6" stroke={mark} strokeWidth="2.4" strokeLinecap="round" /><circle cx="11" cy="13" r="1.4" fill={mark} /></>}
      </>}
    </svg>
  );
}

export function DiagBadge({ kind, outline = false }: { kind: DiagnosisKind; outline?: boolean }) {
  return <span className={`diag-badge ${outline ? "outline" : ""}`} title={DIAG[kind].rule}><DiagIcon kind={kind} size={16} inverse={!outline} />{DIAG[kind].label}</span>;
}

/** Reality: the yellow disc. With a value, the disc shows Reality's verdict in the edition's marks:
 *  black ✓ true · red ✕ false · dashed red ✕ false if… · grey ? not said. */
export function RealityDisc({ value, size = 22, title }: { value?: RealityValue; size?: number; title?: string }) {
  const t = title ?? (value ? `Reality: ${REALITY[value].label}` : "Reality");
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={t}>
      <title>{t}</title>
      {!value && <><circle cx="12" cy="12" r="10.6" fill="var(--yellow)" stroke="#141414" strokeWidth="1.8" /><circle cx="12" cy="12" r="7.2" fill="none" stroke="#141414" strokeWidth=".9" /></>}
      {value === "true" && <><circle cx="12" cy="12" r="11" fill="var(--ink)" /><path d={CHECK(12.2, 11.7, 1.18)} fill="none" stroke="var(--paper)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" /></>}
      {value === "false" && <><circle cx="12" cy="12" r="11" fill="var(--red)" /><path d={CROSS(12, 12, 1.02)} stroke="var(--on-red)" strokeWidth="2.7" strokeLinecap="round" /></>}
      {value === "false-if" && <><circle cx="12" cy="12" r="10.1" fill="var(--paper)" stroke="var(--red)" strokeWidth="1.9" strokeDasharray="3.4 2.3" /><path d={CROSS(12, 12, .9)} stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" /></>}
      {value === "unknown" && <><circle cx="12" cy="12" r="10.1" fill="var(--paper)" stroke="var(--muted)" strokeWidth="1.6" /><text x="12" y="16.6" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--muted)" fontFamily="var(--f-display)">?</text></>}
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
      {(["says", "believes", "concludes", "supposes"] as Verb[]).map((v) => <span key={v} title={`${VERB[v].help} (DEC: ${VERB[v].dec})`}><VerbIcon verb={v} size={18} /> {VERB[v].label}</span>)}
      <span><VerbIcon verb="says" polarity="yes" size={18} /> holds it</span>
      <span><VerbIcon verb="says" polarity="no" size={18} /> holds otherwise</span>
      {!compact && <span><RealityDisc size={18} /> Reality</span>}
    </div>
  );
}
