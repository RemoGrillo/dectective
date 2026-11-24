// Cognitive worlds (top of the Perspectives page): a Venn diagram of who says, believes, concludes and supposes what,
// against Reality, with "who influences whom" (what X says that Y believes) beside it and the zones in words folded
// below. DEC's conflict flags, re-examined, are a separate block for the bottom of the page.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useApi } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagIcon, RealityDisc, VerbIcon } from "../components/Glyphs";
import { Portrait } from "../components/Portrait";
import { VennMap, type VennData, type VSet } from "../components/VennMap";
import { useApp, withMode } from "../state";
import { PAIR, VERB, type Verb } from "../vocab";

type Pair = { a: string; b: string; runs: any[]; verdict: string; conflicts: { kind: string; text: string }[]; identical: string[] };
type WPayload = { worlds: { local: string; title: string }[]; disagreements: Pair[] };

const LINK_TEXT: Record<string, string> = {
  deceives: "deceives: says what he believes false, and it is believed",
  misleads: "misleads: says something false in good faith, and it is believed",
  tells: "tells: what is said is believed (the story has not judged it yet)",
};
const truthOf = (r: string) => (r === "true" ? "T" : r === "unknown" ? "U" : "F");
const TRUTH: Record<string, string> = { T: "true in Reality", F: "ruled out by Reality", U: "not settled by the story" };

/** The synthetic view: who holds what, against Reality. A point opens the proposition (`onSelect`); the point under the
 *  pointer and the row lit in the Kaleidoscope next to it follow each other (`hoverId` / `onHover`). */
export function CognitiveWorlds({ selected, onSelect, hoverId, onHover }: {
  selected: string | null; onSelect: (id: string | null) => void; hoverId?: string | null; onHover?: (id: string | null) => void;
}) {
  const { q, meta, mode } = useApp();
  const { data, error } = useApi<VennData>(q("/api/venn"));
  // guesses (supposes) and the editors' what-if are off by default; choices are kept per reading stage
  const [hiddenBy, setHiddenBy] = useState<Record<string, Set<string>>>({});
  const defaults = useMemo(() => new Set((data?.sets ?? []).filter((s) => s.kind === "supposes" || s.person === "whatif").map((s) => s.id)), [data]);
  const hidden = hiddenBy[mode] ?? defaults;
  const setHidden = (f: (h: Set<string>) => Set<string>) => setHiddenBy((m) => ({ ...m, [mode]: f(m[mode] ?? defaults) }));

  const people = useMemo(() => {
    const m = new Map<string, { id: string; name: string; alias?: string; sets: VSet[] }>();
    for (const s of data?.sets ?? []) if (s.person) {
      if (!m.has(s.person)) m.set(s.person, { id: s.person, name: s.personName!, alias: s.alias, sets: [] });
      m.get(s.person)!.sets.push(s);
    }
    return [...m.values()];
  }, [data]);
  const zones = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, { sig: string[]; truth: string; items: VennData["items"] }>();
    for (const it of data.items) {
      const sig = it.sets.filter((s) => s !== "reality" && !hidden.has(s));
      if (!sig.length) continue;
      const k = sig.join("|") + "#" + truthOf(it.reality);
      if (!m.has(k)) m.set(k, { sig, truth: truthOf(it.reality), items: [] });
      m.get(k)!.items.push(it);
    }
    const deceit = new Set(data.links.filter((l) => l.kind !== "tells").flatMap((l) => l.items));
    const rank = (z: { truth: string; items: VennData["items"] }) => (z.items.some((i) => deceit.has(i.id)) ? 0 : z.truth === "F" ? 1 : z.truth === "U" ? 2 : 3);
    return [...m.values()].sort((a, b) => rank(a) - rank(b) || b.sig.length - a.sig.length);
  }, [data, hidden]);

  if (error) return <ErrorBox error={error} />;
  if (!data || !meta) return <Loading what="Drawing the worlds" />;
  const setOf = (id: string) => data.sets.find((s) => s.id === id)!;
  const toggle = (ids: string[]) => setHidden((h) => { const n = new Set(h); const all = ids.every((i) => n.has(i)); for (const i of ids) { if (all) n.delete(i); else n.add(i); } return n; });
  const saysIds = data.sets.filter((s) => s.kind === "says").map((s) => s.id);
  const guessIds = data.sets.filter((s) => s.kind === "supposes").map((s) => s.id);

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }} role="group" aria-label="Show or hide">
        <span className="label">Show</span>
        {people.map((p) => (
          <button key={p.id} className="chip" aria-pressed={!p.sets.every((s) => hidden.has(s.id))} onClick={() => toggle(p.sets.map((s) => s.id))}>
            <Portrait id={p.id} size={18} name={p.name} /> {p.name}
          </button>
        ))}
        <span className="sep" style={{ width: 1, height: 22, background: "var(--line)" }} />
        {saysIds.length > 0 && <button className="chip" aria-pressed={!saysIds.every((i) => hidden.has(i))} onClick={() => toggle(saysIds)}><VerbIcon verb="says" size={16} /> What they say</button>}
        {guessIds.length > 0 && <button className="chip" aria-pressed={!guessIds.every((i) => hidden.has(i))} onClick={() => toggle(guessIds)}><VerbIcon verb="supposes" size={16} /> Guesses</button>}
      </div>

      <div className="cw-stack">
        <section className="card pad" aria-label="Venn diagram">
          <VennMap data={data} hidden={hidden} selected={null} onSelect={(id) => id && onSelect(id)} minWidth={440} autoHeight hoverId={hoverId} onHover={onHover} />
          <div className="venn-legend">
            <span><svg width="26" height="16"><circle cx="13" cy="8" r="7" fill="var(--yellow)" fillOpacity=".35" stroke="#141414" strokeWidth="2" /></svg> Reality: inside = true in the story</span>
            <span><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="var(--ink)" /><text x="10" y="13.5" textAnchor="middle" fontSize="9" fill="var(--paper)">1</text></svg> true</span>
            <span><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="var(--red)" /><text x="10" y="13.5" textAnchor="middle" fontSize="9" fill="var(--on-red)">2</text></svg> ruled out by Reality</span>
            <span><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="var(--paper)" stroke="var(--red)" strokeDasharray="3 2" strokeWidth="1.6" /></svg> ruled out, if…</span>
            <span><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="var(--paper)" stroke="var(--muted)" strokeWidth="1.6" /></svg> not settled</span>
            <span><svg width="30" height="16"><circle cx="15" cy="8" r="7" fill="none" stroke="var(--ink)" strokeWidth="2" /></svg> believes</span>
            <span><svg width="30" height="16"><circle cx="15" cy="8" r="7" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" /></svg> says</span>
            <span><svg width="30" height="16"><circle cx="15" cy="8" r="7" fill="none" stroke="var(--ink)" strokeWidth="3" /></svg> concludes</span>
            <span><svg width="30" height="16"><circle cx="15" cy="8" r="7" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2 3" /></svg> supposes</span>
            <span><svg width="26" height="16"><rect x="2" y="2" width="22" height="12" fill="var(--red-soft)" stroke="var(--red)" strokeWidth="2" /></svg> what X says, inside what Y believes, outside Reality</span>
          </div>
        </section>

        <section className="card pad" aria-labelledby="infl-h">
          <h3 id="infl-h">Who influences whom</h3>
          {data.links.length === 0 ? <p className="small muted">Nobody believes what someone else says, among the propositions of the model.</p> : data.links.map((l) => {
            const a = setOf(l.from), b = setOf(l.to);
            return (
              <div key={l.from + l.to} className={`influence ${l.kind}`}>
                <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <Portrait id={a.person!} size={28} name={a.personName} /><VerbIcon verb="says" size={18} />
                  <span aria-hidden="true">→</span>
                  <Portrait id={b.person!} size={28} name={b.personName} /><VerbIcon verb="believes" size={18} />
                  <strong className={l.kind === "tells" ? "" : "red"} style={{ marginLeft: 4 }}>{a.personName} {l.kind} {b.personName}</strong>
                </div>
                <div className="small muted">{LINK_TEXT[l.kind]}{a.alias ? ` (also speaking as “${a.alias}”)` : ""}</div>
                <ul className="plain" style={{ marginTop: 4 }}>
                  {l.items.map((id) => { const it = data.items.find((x) => x.id === id)!; return (
                    <li key={id} className="small"><button className="linklike" onClick={() => onSelect(id)}>{it.n}. {it.text}</button>
                      {" "}{l.byItem[id] === "deceives" ? <DiagIcon kind="lie" size={14} /> : <RealityDisc value={it.reality} size={14} />}</li>
                  ); })}
                </ul>
              </div>
            );
          })}
        </section>
      </div>

      <details className="more">
        <summary>Zone by zone <span className="muted">the same diagram in words</span></summary>
        <div className="more-body">
          <ul className="plain zones zones-cols">
            {zones.map((z, i) => (
              <li key={i}>
                <div className="zone-title">
                  {z.sig.map((sid) => { const s = setOf(sid); return <span key={sid} className="who-verb"><Portrait id={s.person!} size={16} name={s.personName} />{s.personName} {VERB[s.kind as Verb].label}</span>; })}
                  <span className={z.truth === "T" ? "" : z.truth === "F" ? "red" : "muted"}> — {TRUTH[z.truth]}</span>
                </div>
                <ul className="plain">
                  {z.items.map((it) => (
                    <li key={it.id} className={`small ${selected === it.id ? "picked" : ""}`}>
                      <button className="linklike" onClick={() => onSelect(selected === it.id ? null : it.id)}>{it.n}. {it.text}</button>
                      {it.sid && <> <Link className="tiny" to={withMode(`/read?s=${it.sid}`, mode)}>read</Link></>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}

/** DEC's conflict flags between points of view, each re-examined by the edition. */
export function ConflictFlags() {
  const { q } = useApp();
  const { data: worlds } = useApi<WPayload>(q("/api/worlds"));
  if (!worlds) return null;
  return (
    <div className="pair-list">
      {worlds.disagreements.map((p) => {
        const A = worlds.worlds.find((w) => w.local === p.a), B = worlds.worlds.find((w) => w.local === p.b);
        return (
          <div key={p.a + p.b} className={`card flat pair ${p.verdict}`}>
            <div><div className="verdict-word">{PAIR[p.verdict]?.label ?? p.verdict}</div><div className="tiny muted">{p.runs.length} DEC run{p.runs.length > 1 ? "s" : ""}</div></div>
            <div>
              <div style={{ fontWeight: 600 }}>{p.a === "reality" ? "Reality" : A?.title} ⟷ {p.b === "reality" ? "Reality" : B?.title}</div>
              <div className="small muted">{PAIR[p.verdict]?.help}</div>
              {p.conflicts.length > 0 && <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{p.conflicts.slice(0, 4).map((c, i) => <li key={i}>{c.kind === "disjoint" ? "Can't be both: " : c.kind === "distinct" ? "Same and not the same: " : "One value only: "}{c.text}</li>)}</ul>}
              {p.verdict === "artifact" && p.identical.length > 0 && <p className="small" style={{ margin: "6px 0 0" }}>Same value on both sides: {p.identical.join("; ")}.</p>}
            </div>
          </div>
        );
      })}
      {worlds.disagreements.length === 0 && <p className="empty">DEC flags no conflict here.</p>}
    </div>
  );
}
