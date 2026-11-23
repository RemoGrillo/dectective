// The reader: the full text, with marks that say at a glance where someone lies, is deluded or makes an honest
// mistake, where reasoning and identities are at play. The legend is a sticky bar of toggles above the text.
// Selecting a sentence opens the panel with its kaleidoscope.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useApi, type Mark, type TextParagraph, type TextPayload, type TextSentence } from "../api";
import { ErrorBox, Loading } from "../components/Bits";
import { DiagIcon } from "../components/Glyphs";
import { SentenceDrawer } from "../components/SentenceDrawer";
import { stageOf, useApp, withMode } from "../state";
import { Meter, useTimeline } from "../components/DeductionBits";
import { DIAG } from "../vocab";

type Toggle = Exclude<Mark, "annotated">;
const MARKS: { id: Toggle; label: string; help: string; sample: string }[] = [
  { id: "lie", label: DIAG.lie.label, help: DIAG.lie.rule, sample: "m-lie" },
  { id: "delusion", label: DIAG.delusion.label, help: DIAG.delusion.rule, sample: "m-delusion" },
  { id: "mistake", label: DIAG.mistake.label, help: DIAG.mistake.rule, sample: "m-mistake" },
  { id: "identity", label: "Names & identity", help: "Who is who, and under which name", sample: "m-identity" },
  { id: "reasoning", label: "Reasoning", help: "Holmes's solution, guesses and hypotheses", sample: "m-reasoning" },
];
const ORDER = ["C1", "C2", "C3", "C4", "G"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

function loadMarks(): Set<Toggle> {
  try {
    const v = JSON.parse(window.localStorage.getItem("dectective.marks") ?? "null");
    if (Array.isArray(v)) return new Set(v);
  } catch { /* ignore */ }
  return new Set<Toggle>(["lie", "delusion", "mistake", "identity", "reasoning"]);
}

export function Reader() {
  const { mode, q, meta, setMode } = useApp();
  const { data, error } = useApi<TextPayload>(q("/api/text"));
  const [params, setParams] = useSearchParams();
  const sel = params.get("s");
  const [marks, setMarks] = useState<Set<Toggle>>(loadMarks);
  const [showCases, setShowCases] = useState<boolean>(() => { try { return window.localStorage.getItem("dectective.cases") !== "0"; } catch { return true; } });
  const [showDed, setShowDed] = useState<boolean>(() => { try { return window.localStorage.getItem("dectective.deductions") !== "0"; } catch { return true; } });
  useEffect(() => { try { window.localStorage.setItem("dectective.deductions", showDed ? "1" : "0"); } catch { /* ignore */ } }, [showDed]);
  const { data: tl } = useTimeline();
  // clue sentences: how many new story-level conclusions DEC draws there
  const clues = useMemo(() => new Map((tl?.steps ?? []).map((st) => [st.sid, { n: st.n, page: st.page, add: tl!.conclusions.filter((c) => c.step === st.n && c.cls === "story").length }])), [tl]);
  const [readingClue, setReadingClue] = useState(1);
  useEffect(() => { try { window.localStorage.setItem("dectective.cases", showCases ? "1" : "0"); } catch { /* ignore */ } }, [showCases]);
  const [tocOpen, setTocOpen] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [current, setCurrent] = useState<string>("I");

  useEffect(() => { try { window.localStorage.setItem("dectective.marks", JSON.stringify([...marks])); } catch { /* ignore */ } }, [marks]);

  const visible = useMemo(() => {
    if (!data) return [] as TextParagraph[];
    if (mode === "gold") return data.paragraphs;
    return data.paragraphs.filter((p) => ORDER.indexOf(p.revealedBy) <= ORDER.indexOf(mode));
  }, [data, mode]);
  const clickable = (s: TextSentence) => s.nProps > 0 || s.dossiers.length > 0;
  const navigable = useMemo(() => visible.flatMap((p) => p.sentences.filter(clickable).map((s) => s.id)), [visible]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of visible) for (const s of p.sentences) for (const m of s.marks) c[m] = (c[m] ?? 0) + 1;
    return c;
  }, [visible]);
  const sectionPage = useMemo(() => Object.fromEntries((data?.sections ?? []).map((s) => [s.id, data!.paragraphs.find((p) => p.id === s.from)?.page ?? 0])), [data]);

  const select = useCallback((sid: string | null, focus = false) => {
    setParams((p) => { const n = new URLSearchParams(p); if (sid) n.set("s", sid); else n.delete("s"); return n; }, { replace: true });
    if (sid && focus) requestAnimationFrame(() => document.getElementById("s-" + sid)?.focus());
  }, [setParams]);

  // scroll the selected sentence into view on first load / deep link (after fonts settle)
  const scrolled = useRef(false);
  useEffect(() => {
    if (!data || !sel || scrolled.current) return;
    scrolled.current = true;
    const go = () => document.getElementById("s-" + sel)?.scrollIntoView({ block: "center" });
    requestAnimationFrame(go);
    document.fonts?.ready.then(() => setTimeout(go, 60));
  }, [data, sel]);

  // current section in the contents
  useEffect(() => {
    if (!data) return;
    const heads = [...document.querySelectorAll<HTMLElement>(".section-head")];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setCurrent(vis[0].target.id.replace("sec-", ""));
    }, { rootMargin: "-80px 0px -60% 0px" });
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [data, visible.length]);

  // the clue the reader has reached: the last clue sentence above the middle of the screen
  useEffect(() => {
    if (!tl) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      let n = 1;
      for (const st of tl.steps) {
        const el = document.querySelector(`[data-sentence="${st.sid}"]`);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.5) n = st.n;
      }
      setReadingClue(n);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [tl, visible.length]);

  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (!t.dataset.sid) return;
    const i = navigable.indexOf(t.dataset.sid);
    if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); document.getElementById("s-" + navigable[Math.min(i + 1, navigable.length - 1)])?.focus(); }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); document.getElementById("s-" + navigable[Math.max(i - 1, 0)])?.focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(t.dataset.sid); }
    else if (e.key === "Escape") select(null);
  };

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Loading what="Setting the type" /></div>;

  const focusTarget = focused && navigable.includes(focused) ? focused : sel && navigable.includes(sel) ? sel : navigable[0];
  const hiddenCount = data.paragraphs.length - visible.length;
  let lastPage = 0;
  let lastSpeaker = "";

  return (
    <div className="page wide">
      <div className={`reader ${sel ? "" : "drawer-closed"}`}>
        <aside className={`toc ${tocOpen ? "open" : ""}`} aria-label="Contents">
          <div className="spread" style={{ marginBottom: 6 }}>
            <span className="label">Contents</span>
            <button className="btn small toc-toggle" aria-expanded={tocOpen} onClick={() => setTocOpen(!tocOpen)}>{tocOpen ? "Hide" : "Show"}</button>
          </div>
          <div className="toc-body">
            <ol>
              {data.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#sec-${s.id}`} className={current === s.id ? "current" : ""} onClick={() => setTocOpen(false)}>
                    <span className="num">{ROMAN[i]}</span><span>{s.title}</span><span className="pg">p. {sectionPage[s.id]}</span>
                  </a>
                </li>
              ))}
            </ol>
            {tl && (() => {
              const st = tl.steps.find((x) => x.n === readingClue) ?? tl.steps[0];
              const now = tl.conclusions.filter((c) => c.step <= st.n && c.cls === "story").length;
              const v = tl.events.filter((e) => e.kind === "verdict" && e.step <= st.n).length;
              return (
                <div className="dec-meter" aria-live="polite">
                  <span className="label">DEC so far</span>
                  <div className="muted" style={{ margin: "2px 0 4px" }}>clue {st.n} of {tl.steps.length} · p. {st.page}</div>
                  <Meter label="conclusions" now={now} total={tl.totals.conclusions} />
                  <Meter label="verdicts" now={v} total={tl.totals.verdicts} red />
                  <Link to={withMode(`/deductions?at=${st.sid}`, mode)}>Follow the deductions →</Link>
                </div>
              );
            })()}
            <p className="small muted" style={{ margin: "14px 8px 0" }}>
              <span className="kbd">↑</span> <span className="kbd">↓</span> move between marked sentences · <span className="kbd">Enter</span> opens · <span className="kbd">Esc</span> closes
            </p>
          </div>
        </aside>

        <div className="text-col">
          <div className="marks-bar" role="group" aria-label="Marks in the text (click to show or hide)">
            {MARKS.map((m, i) => (
              <Fragment key={m.id}>
                {i === 3 && <span className="sep" aria-hidden="true" />}
                <button className="chip" aria-pressed={marks.has(m.id)} title={m.help}
                  onClick={() => setMarks((cur) => { const n = new Set(cur); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}>
                  {m.id === "lie" || m.id === "delusion" || m.id === "mistake" ? <DiagIcon kind={m.id} size={16} /> : null}
                  <span className={`s ${m.sample} click`} style={{ cursor: "inherit", background: "none" }}>{m.label}</span>
                  <span className="count">{counts[m.id] ?? 0}</span>
                </button>
              </Fragment>
            ))}
            <span className="sep" aria-hidden="true" />
            <button className="chip" aria-pressed={showCases} onClick={() => setShowCases(!showCases)} title="Sentences cited by a case file"><span className="case-pin" style={{ margin: 0 }}>▤</span> Case files</button>
            <button className="chip" aria-pressed={showDed} onClick={() => setShowDed(!showDed)} title="Sentences after which DEC can draw new conclusions"><span className="ded-pin" style={{ margin: 0 }}>⚙</span> New deductions</button>
            <span className="hint">Underlined sentences open the kaleidoscope.</span>
          </div>
          <article className="leaf" aria-label="The text of A Case of Identity" onKeyDown={onKey}
            onFocus={(e) => { const sid = (e.target as HTMLElement).dataset.sid; if (sid) setFocused(sid); }}>
            {visible.map((p) => {
              const section = data.sections.find((s) => s.from === p.id);
              const si = section ? data.sections.indexOf(section) : -1;
              const pageChange = p.page !== lastPage;
              lastPage = p.page;
              const speakerChange = p.speaker !== lastSpeaker || !!section;
              lastSpeaker = p.speaker;
              const stage = data.checkpoints.find((c) => c.after === p.id && c.id !== "G");
              return (
                <Fragment key={p.id}>
                  {section && (
                    <header className="section-head" id={`sec-${section.id}`}>
                      <span className="num">Part {ROMAN[si]}</span>
                      <h2>{section.title}</h2>
                      <div className="sub">{section.subtitle}</div>
                    </header>
                  )}
                  <div className={`para ${p.speaker === "document" ? "document" : ""}`} id={p.id}>
                    {pageChange && <span className="page-no" title={`Printed page ${p.page}`}>p. {p.page}</span>}
                    {speakerChange && <span className="para-speaker">{data.speakerNames[p.speaker] ?? p.speaker}</span>}
                    {p.sentences.map((s, i) => (
                      <Fragment key={s.id}>
                        <Sentence s={s} marks={marks} selected={sel === s.id} tabbable={focusTarget === s.id} clickable={clickable(s)} onSelect={select} />
                        {showDed && (clues.get(s.id)?.add ?? 0) > 0 && (
                          <span className="ded-pin" role="presentation" onClick={() => select(s.id)}
                            title={`DEC can now draw ${clues.get(s.id)!.add} new conclusion(s) — clue ${clues.get(s.id)!.n}`}>⚙+{clues.get(s.id)!.add}</span>
                        )}
                        {showCases && s.dossiers.length > 0 && (
                          <span className="case-pin" role="presentation" onClick={() => select(s.id)}
                            title={`Case files: ${s.dossiers.map((d) => `No. ${d.number} ${d.type} (${d.stamp.word})`).join("; ")}`}>▤ {s.dossiers.length}</span>
                        )}
                        {i < p.sentences.length - 1 ? " " : ""}
                      </Fragment>
                    ))}
                  </div>
                  {stage && (
                    <div className="stage-end" role="separator" aria-label={`End of stage: ${stage.label}`}>
                      <span>End of “{stage.label}”</span>
                      {mode === "gold" && <button className="btn small ghost" onClick={() => setMode(stage.id as any)} title="Use only what a reader knows at this point">Pause here, no spoilers</button>}
                    </div>
                  )}
                </Fragment>
              );
            })}
            {hiddenCount > 0 && (
              <div className="sealed">
                <p style={{ fontSize: "1.1rem", margin: "0 0 6px" }}>SEALED · {hiddenCount} more paragraphs</p>
                <p className="small" style={{ margin: "0 0 10px" }}>You are reading without spoilers, up to “{stageOf(meta, mode).label}”.</p>
                <button className="btn small" onClick={() => setMode("gold")}>Show the whole story</button>
              </div>
            )}
          </article>
        </div>

        {sel && (
          <aside className="drawer" aria-label="The selected sentence">
            <SentenceDrawer sid={sel} onClose={() => { const s = sel; select(null); requestAnimationFrame(() => document.getElementById("s-" + s)?.focus()); }} />
          </aside>
        )}
      </div>
    </div>
  );
}

const PRIORITY: Toggle[] = ["lie", "delusion", "mistake", "identity", "reasoning"];

function Sentence({ s, marks, selected, tabbable, clickable, onSelect }: { s: TextSentence; marks: Set<Toggle>; selected: boolean; tabbable: boolean; clickable: boolean; onSelect: (sid: string) => void }) {
  if (!clickable) return <span className="s" data-sentence={s.id}>{s.text}</span>;
  const primary = PRIORITY.find((m) => marks.has(m) && s.marks.includes(m));
  const diags = [...new Set(s.diagnoses.map((d) => d.kind))].filter((k) => marks.has(k));
  const cls = ["s", "click", primary ? "m-" + primary : "", selected ? "selected" : ""].join(" ");
  const label = s.diagnoses.length ? s.diagnoses.map((d) => `${DIAG[d.kind].label}: ${d.text}`).join("; ") : "Open the kaleidoscope for this sentence";
  return (
    <>
      <span id={"s-" + s.id} data-sid={s.id} data-sentence={s.id} className={cls} role="button" tabIndex={tabbable || selected ? 0 : -1} aria-pressed={selected} title={label} onClick={() => onSelect(s.id)}>
        {s.text}
      </span>
      {diags.length > 0 && <span className="s-icons" aria-hidden="true">{diags.map((k) => <DiagIcon key={k} kind={k} size={15} />)}</span>}
    </>
  );
}
