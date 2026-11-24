// Perspectives: two views of the same thing, side by side. On the left, "Cognitive worlds": a Venn diagram of who says,
// believes, concludes and supposes what, against Reality (the synthesis). On the right, the Kaleidoscope: every
// proposition × Reality × every person in one table, each proposition carrying its number in the diagram. The point
// under the pointer lights its row and the row under the pointer lights its point. Clicking either opens the
// proposition in a modal: its kaleidoscope (Reality in the middle, one slice per person), the sentence it comes from,
// the verdicts, the diagram and who holds what; ← → move through the propositions of the table.
//  /perspectives?p=<proposition id>   the page with one proposition open
//  /kaleidoscope, /worlds             (old links) redirect here; /kaleidoscope/:sid opens the first proposition of that sentence
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useApi, type SentenceView, type Viewpoint } from "../api";
import { CognitiveWorlds, ConflictFlags } from "../components/CognitiveWorlds";
import { useLast, usePresence, useSwap } from "../components/Motion";
import type { VennData } from "../components/VennMap";
import { ErrorBox, Loading } from "../components/Bits";
import { FocusVenn } from "../components/FocusVenn";
import { IconLegend, RealityDisc, VerbIcon } from "../components/Glyphs";
import { Holders } from "../components/Holders";
import { Kaleidoscope as Wheel, personState } from "../components/Kaleidoscope";
import { Portrait } from "../components/Portrait";
import { TermBadge } from "../components/Term";
import { useApp, withMode } from "../state";
import { PEOPLE_HELP, REALITY, VERB } from "../vocab";

type KPerson = { id: string; short: string; name: string; kind: string; alias?: string; aliasId?: string; aliasShort?: string };
type Knowledge = { mode: string; people: KPerson[]; rows: Viewpoint[] };
type VPerson = Viewpoint["people"][number];
/** A column of the table: a person, or (in the whole story) the persona a person speaks through, shown apart from them:
 *  Windibank "as himself" next to Hosmer, his mask. `asName`: undefined = everything the person holds; null = only as
 *  himself; a name = only under that name. */
type Col = { key: string; person: string; portrait: string; short: string; name: string; sub: string; help: string; asName?: string | null };
function columns(people: KPerson[]): Col[] {
  return people.flatMap((p): Col[] => p.aliasId ? [
    { key: p.id, person: p.id, portrait: p.id, short: p.short, name: p.name, sub: "as himself", help: `${p.name}: what he says and believes as himself`, asName: null },
    { key: p.aliasId, person: p.id, portrait: p.aliasId, short: p.aliasShort ?? p.aliasId, name: p.alias!, sub: `= ${p.short}`, help: `“${p.alias}”, the name ${p.name} uses to court Mary: what is said under this name, ${p.short} says`, asName: p.alias },
  ] : [{ key: p.id, person: p.id, portrait: p.id, short: p.short, name: p.name, sub: " ", help: PEOPLE_HELP[p.id] ?? p.name }]);
}
function cellPerson(c: Col, r: Viewpoint): VPerson | undefined {
  const p = r.people.find((x) => x.id === c.person);
  if (!p || c.asName === undefined) return p;
  const stances = p.stances.filter((s) => (c.asName ? s.asName === c.asName : !s.asName));
  const diagnoses = [...new Set(r.diagnoses.filter((d) => d.person === p.id && stances.some((s) => s.world === d.world)).map((d) => d.kind))];
  return { ...p, stances, diagnoses };
}
type Filter = "clashes" | "diagnosed" | "all";
const inFilter = (r: Viewpoint, f: Filter) => f === "all" || (f === "diagnosed" ? r.diagnoses.length > 0 : r.divergent || r.diagnoses.length > 0);

export default function Perspectives() {
  const { sid } = useParams();
  const [params, setParams] = useSearchParams();
  const { q, mode } = useApp();
  const navigate = useNavigate();
  const { data, error } = useApi<Knowledge>(q("/api/knowledge"));
  const { data: venn } = useApi<VennData>(q("/api/venn"));
  const [filter, setFilter] = useState<Filter>("clashes");
  const [text, setText] = useState("");
  const [rowHover, setRowHover] = useState<string | null>(null);     // the row under the pointer lights its point
  const [pointHover, setPointHover] = useState<string | null>(null); // the point under the pointer lights its row
  const sel = params.get("p");
  const tableBox = useRef<HTMLDivElement>(null);

  // old links (/kaleidoscope/:sid): open the first proposition of the sentence
  useEffect(() => {
    if (!sid || !data) return;
    const r = data.rows.find((x) => x.sentences.includes(sid));
    navigate(withMode(`/perspectives${r ? `?p=${r.id}` : ""}`, mode), { replace: true });
  }, [sid, data, mode, navigate]);
  const selected = data?.rows.find((r) => r.id === sel) ?? null;
  // a proposition opened from elsewhere stays visible in the table
  useEffect(() => { if (selected && !inFilter(selected, filter)) setFilter("all"); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the modal fades out before it goes, keeping the last proposition while it does
  const modal = usePresence(!!selected);
  const modalVp = useLast(selected);

  const cols = useMemo(() => columns(data?.people ?? []), [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => inFilter(r, filter) && (!text || r.text.toLowerCase().includes(text.toLowerCase()))), [data, filter, text]);
  const nums = useMemo(() => new Map((venn?.items ?? []).map((it) => [it.id, it])), [venn]);
  const open = (id: string | null, replace = false) => {
    const next = new URLSearchParams(params);
    if (id) next.set("p", id); else next.delete("p");
    setParams(next, { replace, preventScrollReset: true });
  };
  // the row of the point under the pointer is scrolled into view inside the table (never the page)
  useEffect(() => {
    const box = tableBox.current, row = pointHover ? document.getElementById(`row-${pointHover}`) : null;
    if (!box || !row) return;
    const head = (box.querySelector("thead") as HTMLElement | null)?.offsetHeight ?? 0;
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (top - head < box.scrollTop) box.scrollTo({ top: top - head - 8, behavior: "smooth" });
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight + 8, behavior: "smooth" });
  }, [pointHover]);
  const idx = modalVp ? rows.findIndex((r) => r.id === modalVp.id) : -1;

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Perspectives</h1>
        <p className="lede">Who says, believes, concludes or supposes what, against Reality: at a glance on the left, proposition by proposition on the right.</p>
      </div>

      <div className="persp-grid">
        <section className="persp-col" aria-labelledby="cw-h">
          <div className="persp-head">
            <h2 id="cw-h">Cognitive worlds</h2>
            <p className="small muted">Each circle is what one person says, believes, concludes or supposes; the yellow one is Reality.</p>
          </div>
          <CognitiveWorlds selected={sel} onSelect={(id) => open(id)} hoverId={rowHover} onHover={setPointHover} />
        </section>

        <section className="persp-col" id="kaleidoscope" aria-labelledby="kal-h">
          <div className="persp-head">
            <h2 id="kal-h">Kaleidoscope</h2>
            <p className="small muted">Every proposition, every point of view. Click one to turn its kaleidoscope.</p>
          </div>
          {error ? <ErrorBox error={error} /> : !data ? <Loading what="Asking everyone" /> : (
            <>
              <div className="matrix-tools">
                <div className="seg" role="group" aria-label="Which propositions">
                  <button aria-pressed={filter === "clashes"} onClick={() => setFilter("clashes")}>Where views clash ({data.rows.filter((r) => inFilter(r, "clashes")).length})</button>
                  <button aria-pressed={filter === "diagnosed"} onClick={() => setFilter("diagnosed")}>Lies &amp; delusions ({data.rows.filter((r) => inFilter(r, "diagnosed")).length})</button>
                  <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({data.rows.length})</button>
                </div>
                <input type="search" placeholder="Find a proposition…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find a proposition" />
              </div>
              <div className="table-wrap kal-table" ref={tableBox} onMouseLeave={() => setRowHover(null)}>
                <table className="matrix">
                  <colgroup>
                    <col className="c-prop" /><col className="c-reality" />{cols.map((c) => <col key={c.key} className="c-person" />)}<col className="c-verdict" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="fact">Proposition</th>
                      <th title="What is true in the story (DEC: reality)"><div className="col-head"><RealityDisc size={30} /><span>Reality</span><span className="sub">&nbsp;</span></div></th>
                      {cols.map((c) => (
                        <th key={c.key} title={c.help} className={c.asName ? "mask" : ""}>
                          <div className="col-head"><Portrait id={c.portrait} size={30} name={c.name} /><span>{c.short}</span><span className="sub">{c.sub}</span></div>
                        </th>
                      ))}
                      <th className="verdict-h">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const on = r.id === sel;
                      const num = nums.get(r.id);
                      return (
                        <tr key={r.id} id={`row-${r.id}`} className={[on ? "sel" : "", pointHover === r.id ? "lit" : ""].join(" ")}
                          onMouseEnter={() => setRowHover(r.id)} onClick={() => open(r.id)}>
                          <td className="fact">
                            <button className="prop-btn" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); open(r.id); }}
                              onFocus={() => setRowHover(r.id)} onBlur={() => setRowHover(null)}>
                              <span className={`vnum ${num ? `vnum-${num.reality}` : "none"}`} title={num ? `Point ${num.n} in the diagram` : "Not in the diagram (nobody holds it)"}>{num?.n ?? ""}</span>
                              <span>{r.text}</span>
                            </button>
                          </td>
                          <td className="reality" title={`${REALITY[r.reality.value].label}: ${r.reality.how}`}>
                            <span className="rv"><RealityDisc value={r.reality.value} size={20} /><span>{REALITY[r.reality.value].short}</span></span>
                          </td>
                          {cols.map((c) => {
                            const p = cellPerson(c, r);
                            if (!p) return <td key={c.key}><span className="silent-dot" aria-label="silent">·</span></td>;
                            const st = personState(p, r);
                            return (
                              <td key={c.key} className={st === "conflict" ? "conflict" : ""} title={p.stances.map((s) => `${c.short} ${VERB[s.verb][s.polarity]} — ${s.how}`).join("\n") || `${c.short}: silent`}>
                                {p.stances.length
                                  ? <span className="cell-marks">{p.stances.map((s, k) => <VerbIcon key={k} verb={s.verb} polarity={s.polarity} size={22} title={`${c.short} ${VERB[s.verb][s.polarity]}${s.asName ? ` (that is, ${p.short})` : ""}`} />)}</span>
                                  : <span className="silent-dot" aria-label="silent">·</span>}
                              </td>
                            );
                          })}
                          <td className="vcell" onClick={(e) => e.stopPropagation()}>
                            {r.diagnoses.map((d, i) => (
                              <span key={i} className="vd" title={whoOf(d, r, data.people)}><TermBadge kind={d.kind} text={d.text} assumption={d.assumption} size="small" /></span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="empty" style={{ padding: 16 }}>No proposition matches.</p>}
              </div>
              <div className="kal-foot">
                <IconLegend compact />
                <span className="small muted">Red cell: clashes with Reality · “·”: silent · numbers: the points in the diagram.</span>
              </div>
            </>
          )}
        </section>
      </div>

      <details className="more persp-flags">
        <summary>DEC's conflict flags, re-examined <span className="muted">every pair of points of view DEC flags, and what the edition finds</span></summary>
        <div className="more-body"><ConflictFlags /></div>
      </details>

      {modal.mounted && modalVp && (
        <PropositionModal vp={modalVp} leaving={modal.leaving} pos={idx} count={rows.length}
          onPrev={idx > 0 ? () => open(rows[idx - 1].id, true) : undefined}
          onNext={idx >= 0 && idx < rows.length - 1 ? () => open(rows[idx + 1].id, true) : undefined}
          onClose={() => open(null, true)} />
      )}
    </div>
  );
}

/** Who a verdict is about, naming the mask when it was said under another name ("Windibank as Hosmer"). */
function whoOf(d: Viewpoint["diagnoses"][number], r: Viewpoint, people: KPerson[]) {
  const p = people.find((x) => x.id === d.person);
  if (!p) return d.personName;
  const masked = r.people.find((x) => x.id === p.id)?.stances.some((s) => s.world === d.world && s.asName);
  return masked && p.aliasShort ? `${p.short} as ${p.aliasShort}` : p.short;
}

/** The modal of one proposition: the proposition, the sentence it comes from and the verdicts; its kaleidoscope next to
 *  the diagram; who holds what. Moving to another proposition keeps the modal and swaps its content with a short fade. */
function PropositionModal({ vp: target, leaving, pos, count, onPrev, onNext, onClose }: {
  vp: Viewpoint; leaving: boolean; pos: number; count: number; onPrev?: () => void; onNext?: () => void; onClose: () => void;
}) {
  const { q, mode } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const tsid = target.sentences[0];
  const { data: ts } = useApi<SentenceView>(tsid ? q(`/api/sentence/${tsid}`) : null);
  const { data: text } = useApi<{ speakerNames: Record<string, string> }>(q("/api/text"));
  // the previous proposition stays until the next one (with its sentence) is ready; then a short fade swaps them
  const ready = useMemo(() => (!tsid || ts ? { vp: target, s: ts } : null), [target, tsid, ts]);
  const { shown, phase } = useSwap(ready, (x) => x.vp.id);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const html = document.documentElement, overflow = html.style.overflow;
    html.style.overflow = "hidden";
    // Esc: let the modal fade out instead of vanishing
    const onCancel = (e: Event) => { e.preventDefault(); close.current(); };
    const onNativeClose = () => close.current();
    d.addEventListener("cancel", onCancel);
    d.addEventListener("close", onNativeClose);
    return () => { d.removeEventListener("cancel", onCancel); d.removeEventListener("close", onNativeClose); html.style.overflow = overflow; };
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
    if (e.key === "ArrowRight" && onNext) { e.preventDefault(); onNext(); }
  };

  const vp = shown?.vp, s = shown?.s;
  const sid = vp?.sentences[0];
  const speaker = s && !s.hidden ? text?.speakerNames[s.paragraph.speaker] ?? s.paragraph.speaker : "";
  return (
    <dialog ref={ref} className={`prop-modal ${leaving ? "leaving" : ""}`} aria-labelledby="pm-title" onKeyDown={onKey}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="pm-inner">
        <header className="pm-head">
          <span className="kicker" style={{ margin: 0 }}>{pos >= 0 ? `Proposition ${pos + 1} of ${count}` : "Proposition"}</span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn small" onClick={onPrev} disabled={!onPrev} aria-label="Previous proposition" title="Previous (←)">←</button>
            <button className="btn small" onClick={onNext} disabled={!onNext} aria-label="Next proposition" title="Next (→)">→</button>
            <button className="btn small ghost" onClick={onClose} aria-label="Close">Close ✕</button>
          </span>
        </header>
        {!vp ? <Loading what="Turning the kaleidoscope" /> : (
          <div className={`pm-body swap ${phase}`} key={vp.id}>
            <h2 id="pm-title" className="pm-title">{vp.text}</h2>
            {s && !s.hidden && <blockquote className="quote quote-small">{s.text}<span className="muted"> — {speaker}, p. {s.paragraph.page}</span></blockquote>}
            {vp.diagnoses.length > 0 && <div className="row" style={{ gap: 6, margin: "6px 0 2px" }}>{vp.diagnoses.map((d, i) => <TermBadge key={i} kind={d.kind} text={d.text} assumption={d.assumption} />)}</div>}
            <div className="pm-grid">
              <div className="pm-wheel"><Wheel vp={vp} size={280} /></div>
              <div>
                <span className="label">Diagram · who holds it, against Reality</span>
                <FocusVenn url={q(`/api/venn/proposition/${vp.id}`)} height={380} minWidth={340} />
              </div>
            </div>
            <details className="more">
              <summary>Who holds what</summary>
              <div className="more-body"><Holders vp={vp} /></div>
            </details>
            {sid && <div className="row" style={{ marginTop: 6 }}><Link className="btn small" to={withMode(`/read?s=${sid}`, mode)}>Read it in context →</Link></div>}
          </div>
        )}
      </div>
    </dialog>
  );
}
