// Worlds: every point of view (a statement, someone's beliefs, a conclusion, a guess) grouped by person around Reality,
// always in the same places. Lines show only DEC's conflict flags against Reality, re-examined by the edition:
// Conflict (red), Only if… (red, dashed: under an assumption), False alarm (grey: DEC's single-value bug).
// Selecting a point of view shows all of its flags and why.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApi, type DecType } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { RealityDisc, WorldIcon } from "../components/Glyphs";
import { Portrait } from "../components/Portrait";
import { stageOf, useApp } from "../state";
import { KIND, PAIR } from "../vocab";

type W = { local: string; title: string; desc: string; decType: DecType; sources: string[]; testedWith: string[]; delusional: any[]; delusionalVerdict: string | null;
  governedBy: { agent: string; name: string; predicate: string; viaIdentity: boolean }[] };
type Pair = { a: string; b: string; runs: any[]; verdict: string; conflicts: { kind: string; text: string }[]; identical: string[] };
type Payload = { mode: string; worlds: W[]; disagreements: Pair[] };

const AREA: Record<string, string> = { reader: "a", shared: "b", hosmer: "c", mary: "d", windibank: "e", watson: "f", holmes: "g", whatif: "h" };

export default function Worlds() {
  const { q, meta, mode } = useApp();
  const { data, error } = useApi<Payload>(q("/api/worlds"));
  const [sel, setSel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ key: string; d: string; x: number; y: number; verdict: string; label: string; dim: boolean }[]>([]);

  const agentOf = (iri: string) => meta?.agents.find((a) => a.gold === iri || a.sim === iri);
  const groups = useMemo(() => {
    if (!data || !meta) return [];
    const m = new Map<string, W[]>();
    for (const w of data.worlds) {
      if (w.local === "reality" || w.local === "shared") continue;
      const own = w.governedBy.find((g) => !g.viaIdentity) ?? w.governedBy[0];
      let ag = own ? agentOf(own.agent) : undefined;
      // a persona whose worlds are also governed, via identity, by the man behind the mask: grouped under him
      if (ag?.maskOf && w.governedBy.some((g) => g.viaIdentity && agentOf(g.agent)?.id === ag!.maskOf)) ag = meta.agents.find((a) => a.id === ag!.maskOf);
      const id = ag?.id ?? "whatif";
      m.set(id, [...(m.get(id) ?? []), w]);
    }
    return [...m.entries()].map(([id, ws]) => ({ id, agent: meta.agents.find((a) => a.id === id)!, worlds: ws }));
  }, [data, meta]);

  const vsReality = (w: string) => data?.disagreements.find((p) => (p.a === w && p.b === "reality") || (p.b === w && p.a === "reality"));
  const shown = useMemo(() => (data?.disagreements ?? []).filter((p) => sel ? p.a === sel || p.b === sel : p.a === "reality" || p.b === "reality"), [data, sel]);

  // draw the lines once the cards are laid out
  useLayoutEffect(() => {
    const host = box.current;
    if (!host || !data) return;
    const draw = () => {
      const hr = host.getBoundingClientRect();
      const rect = (w: string) => host.querySelector<HTMLElement>(`[data-world="${w}"]`)?.getBoundingClientRect();
      const out: typeof lines = [];
      const mk = (a: string, b: string, verdict: string, label: string, key: string) => {
        const ra = rect(a), rb = rect(b);
        if (!ra || !rb) return;
        const ca = { x: ra.left + ra.width / 2 - hr.left, y: ra.top + ra.height / 2 - hr.top };
        const cb = { x: rb.left + rb.width / 2 - hr.left, y: rb.top + rb.height / 2 - hr.top };
        const edge = (r: DOMRect, c: { x: number; y: number }, t: { x: number; y: number }, round: boolean) => {
          if (round) { const dx = t.x - c.x, dy = t.y - c.y, L = Math.hypot(dx, dy) || 1; return { x: c.x + dx / L * r.width / 2, y: c.y + dy / L * r.height / 2 }; }
          const dx = t.x - c.x, dy = t.y - c.y;
          const sx = Math.abs(dx) / (r.width / 2), sy = Math.abs(dy) / (r.height / 2), s = Math.max(sx, sy) || 1;
          return { x: c.x + dx / s, y: c.y + dy / s };
        };
        const pa = edge(ra, ca, cb, a === "reality"), pb = edge(rb, cb, ca, b === "reality");
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        const bend = a === "reality" || b === "reality" ? 0 : 40;
        const nx = -(pb.y - pa.y), ny = pb.x - pa.x, L = Math.hypot(nx, ny) || 1;
        const qx = mx + nx / L * bend, qy = my + ny / L * bend;
        out.push({ key, d: `M${pa.x},${pa.y} Q${qx},${qy} ${pb.x},${pb.y}`, x: (pa.x + 2 * qx + pb.x) / 4, y: (pa.y + 2 * qy + pb.y) / 4, verdict, label, dim: false });
      };
      for (const p of shown) mk(p.a, p.b, p.verdict, PAIR[p.verdict]?.label ?? p.verdict, p.a + "|" + p.b);
      const sol = data.worlds.find((w) => w.decType === "epistemic");
      if (sol && !sel) mk(sol.local, "reality", "accepted", "accepted by the story", "accepted");
      setLines(out);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    document.fonts?.ready.then(draw);
    return () => ro.disconnect();
  }, [data, shown, sel, groups]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data || !meta) return <div className="page"><Loading what="Drawing the map" /></div>;
  const selW = data.worlds.find((w) => w.local === sel);
  const reality = data.worlds.find((w) => w.local === "reality");

  return (
    <div className="page wide" style={{ maxWidth: 1300 }}>
      <div className="page-head">
        <h1>Worlds</h1>
        <p className="lede">Every point of view, checked against Reality{mode !== "gold" ? ` (up to “${stageOf(meta, mode).label}”)` : ""}. Click one to see all its conflicts.</p>
      </div>
      <div className="row small" style={{ marginBottom: 6 }} aria-label="Legend">
        <span className="row" style={{ gap: 4 }}><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="var(--red)" strokeWidth="3" /></svg> conflict</span>
        <span className="row" style={{ gap: 4 }}><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="var(--red)" strokeWidth="3" strokeDasharray="5 4" /></svg> only if… (an assumption)</span>
        <span className="row" style={{ gap: 4 }}><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="var(--muted)" strokeWidth="2" strokeDasharray="2 3" /></svg> false alarm (DEC bug)</span>
        <span className="row" style={{ gap: 4 }}><svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="var(--ink)" strokeWidth="2" /></svg> accepted into Reality</span>
        <span className="muted">· Guesses take Reality for granted; beliefs and statements do not.</span>
      </div>

      <div className="wmap" ref={box}>
        <svg className="wmap-lines" aria-hidden="true">
          {lines.map((l) => (
            <g key={l.key}>
              <path d={l.d} fill="none" stroke={l.verdict === "artifact" || l.verdict === "unexplained" ? "var(--muted)" : l.verdict === "accepted" ? "var(--ink)" : "var(--red)"}
                strokeWidth={l.verdict === "artifact" ? 2 : 3} strokeDasharray={l.verdict === "assumption" ? "6 5" : l.verdict === "artifact" ? "2 4" : undefined} />
            </g>
          ))}
        </svg>
        <button className="wreality" data-world="reality" style={{ gridArea: "r" }} onClick={() => setSel(null)} title={reality?.desc}>
          <span className="t">Reality</span>
          <span className="d">What is true in the story, including Holmes's accepted solution</span>
        </button>
        <div className="wgroup" style={{ gridArea: AREA.shared }}>
          <div className="wgroup-head"><WorldIcon type="shared" size={22} /><span className="name">Shared background</span></div>
          <p className="small" style={{ margin: 0 }}>Rules everyone shares: a journey is not both actual and pretended, a disappearance not both voluntary and involuntary…</p>
        </div>
        {groups.map((g) => (
          <div key={g.id} className="wgroup" style={{ gridArea: AREA[g.id] ?? "auto" }}>
            <div className="wgroup-head"><Portrait id={g.id} size={34} name={g.agent?.name} /><span className="name">{g.agent?.short ?? g.id}</span></div>
            {g.worlds.map((w) => {
              const p = vsReality(w.local);
              return (
                <button key={w.local} className={`wchip ${p && p.verdict !== "artifact" ? "flag" : ""}`} data-world={w.local} aria-pressed={sel === w.local}
                  onClick={() => setSel(sel === w.local ? null : w.local)} title={`${w.desc} (DEC: ${KIND[w.decType].dec} “${w.local}”)`}>
                  <WorldIcon type={w.decType} size={18} />
                  <span>{w.title}</span>
                  <span className="status tiny">{p ? <span className={p.verdict === "artifact" ? "muted" : "red"} style={{ fontWeight: 700 }}>{PAIR[p.verdict]?.label}</span>
                    : w.testedWith.includes("reality") ? <span className="muted">✓ agrees</span> : w.decType === "conjectural" ? <span className="muted">inherits</span> : <span className="muted">not checked</span>}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className="card pad" style={{ marginTop: 18 }} aria-live="polite">
        {selW ? (
          <>
            <div className="spread"><h2 style={{ margin: 0 }}><WorldIcon type={selW.decType} size={22} /> {selW.title}</h2><button className="btn small" onClick={() => setSel(null)}>Back to Reality</button></div>
            <p style={{ margin: "6px 0" }}>{selW.desc}</p>
            <p className="small muted">{KIND[selW.decType].label} · DEC: {KIND[selW.decType].dec} “{selW.local}” · takes for granted: {selW.sources.length ? selW.sources.map((s) => s === "reality" ? "Reality" : s === "shared" ? "shared background" : data.worlds.find((w) => w.local === s)?.title ?? s).join(", ") : "nothing (a statement keeps only what was said)"}</p>
          </>
        ) : <h2 style={{ margin: 0 }}>DEC's conflict flags, re-examined</h2>}
        <div className="pair-list" style={{ marginTop: 12 }}>
          {(sel ? shown : data.disagreements).map((p) => {
            const A = data.worlds.find((w) => w.local === p.a), B = data.worlds.find((w) => w.local === p.b);
            return (
              <div key={p.a + p.b} className={`card flat pair ${p.verdict}`}>
                <div><div className="verdict-word">{PAIR[p.verdict]?.label ?? p.verdict}</div><div className="tiny muted">{p.runs.length} DEC run{p.runs.length > 1 ? "s" : ""}</div></div>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.a === "reality" ? <><RealityDisc size={16} /> Reality</> : A?.title} ⟷ {p.b === "reality" ? <><RealityDisc size={16} /> Reality</> : B?.title}</div>
                  <div className="small muted">{PAIR[p.verdict]?.help}</div>
                  {p.conflicts.length > 0 && <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{p.conflicts.slice(0, 4).map((c, i) => <li key={i}>{c.kind === "disjoint" ? "Can't be both: " : "One value only: "}{c.text}</li>)}</ul>}
                  {p.verdict === "artifact" && p.identical.length > 0 && <p className="small" style={{ margin: "6px 0 0" }}>Same value on both sides: {p.identical.join("; ")}.</p>}
                </div>
              </div>
            );
          })}
          {(sel ? shown : data.disagreements).length === 0 && <p className="empty">DEC flags no conflict here.</p>}
        </div>
      </section>
    </div>
  );
}
