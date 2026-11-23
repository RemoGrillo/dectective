// "Who holds what" diagram, laid out left to right in four columns:
//   people → their points of view (statements, beliefs, conclusions, guesses, Reality) → statements about the case → things and ideas.
// Deterministic column layout (no force simulation, no overlaps); pan/zoom with Cytoscape; Expand for a full-screen view.
import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import type { CyEl } from "../api";
import { useApp } from "../state";

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#111";
}

const COL_X = [0, 250, 560, 860];
const COL_GAP = [70, 62, 70, 46];

/** Column layout: each column ordered by the mean position of its neighbours in the previous column. */
function columnLayout(cy: cytoscape.Core) {
  const cols: cytoscape.NodeSingular[][] = [[], [], [], []];
  cy.nodes().forEach((n) => { cols[Math.min(3, Math.max(0, Number(n.data("col") ?? 2)))].push(n); });
  const y = new Map<string, number>();
  const place = (k: number) => {
    const col = cols[k];
    if (k > 0) {
      const score = (n: cytoscape.NodeSingular) => {
        const ys = n.neighborhood("node").map((m) => y.get(m.id())).filter((v): v is number => v !== undefined);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Infinity;
      };
      col.sort((a, b) => score(a) - score(b));
    }
    col.forEach((n, i) => y.set(n.id(), i * COL_GAP[k]));
  };
  // reality first among points of view, main statements before supporting ones
  cols[1].sort((a, b) => (a.data("decType") === "reality" ? -1 : 0) - (b.data("decType") === "reality" ? -1 : 0));
  for (let k = 0; k < 4; k++) place(k);
  // centre each column vertically
  const heights = cols.map((c, k) => Math.max(0, (c.length - 1) * COL_GAP[k]));
  const H = Math.max(...heights);
  const pos: Record<string, { x: number; y: number }> = {};
  cols.forEach((c, k) => c.forEach((n) => { pos[n.id()] = { x: COL_X[k], y: y.get(n.id())! + (H - heights[k]) / 2 }; }));
  cy.layout({ name: "preset", positions: (n: any) => pos[n.id()], fit: true, padding: 34, animate: false } as any).run();
}

function style(): any[] {
  const ink = css("--ink"), paper = css("--paper"), red = css("--red"), muted = css("--muted"), yellow = css("--yellow"), bg = css("--bg"), line = css("--line"), redSoft = css("--red-soft");
  const font = "Barlow, sans-serif";
  return [
    { selector: "node", style: { label: "data(label)", "font-family": font, "font-size": 11, color: ink, "text-wrap": "wrap", "text-max-width": 150, "text-valign": "center", "text-halign": "center", "background-color": paper, "border-color": ink, "border-width": 1.5, shape: "round-rectangle", width: 160, height: 40 } },
    { selector: "node.person", style: { shape: "ellipse", width: 34, height: 34, "background-color": ink, "text-valign": "bottom", "text-margin-y": 5, "font-family": "Barlow Condensed, sans-serif", "font-weight": 700, "font-size": 13, "text-transform": "uppercase" } },
    { selector: "node.person[img]", style: { "background-image": "data(img)", "background-fit": "cover", "background-color": paper, width: 44, height: 44, "border-width": 2 } },
    { selector: "node.world", style: { width: 190, height: 38, "font-weight": 600, "text-max-width": 176, "background-color": bg } },
    { selector: "node.world.reality", style: { "background-color": yellow, color: "#141414", "border-width": 3, "font-family": "Barlow Condensed, sans-serif", "font-size": 14, "font-weight": 800, "text-transform": "uppercase" } },
    { selector: "node.world.conjectural", style: { "border-style": "dashed" } },
    { selector: "node.world.epistemic", style: { "border-width": 3 } },
    { selector: "node.proposition", style: { width: 220, height: 46, "text-max-width": 206, "font-family": "Literata Variable, Georgia, serif", "font-size": 11 } },
    { selector: "node.main", style: { "border-width": 2.5 } },
    { selector: "node.witness", style: { "border-style": "dashed", "border-color": red, "background-color": redSoft } },
    { selector: "node.thing", style: { shape: "ellipse", width: 14, height: 14, "background-color": muted, "border-width": 0, "text-valign": "center", "text-halign": "right", "text-margin-x": 6, "text-max-width": 140 } },
    { selector: "node.idea", style: { shape: "tag", width: 14, height: 12, "background-color": paper, "border-color": muted, "text-valign": "center", "text-halign": "right", "text-margin-x": 6, "font-style": "italic", "text-max-width": 140 } },
    { selector: "edge", style: { width: 1.4, "line-color": line, "target-arrow-color": line, "curve-style": "bezier", "font-family": font, "font-size": 10, color: ink, "text-background-color": paper, "text-background-opacity": 1, "text-background-padding": 2, "text-rotation": "none" } },
    { selector: "edge.about", style: { "line-style": "dotted", width: 1 } },
    { selector: "edge.governs", style: { "line-color": ink, "target-arrow-color": ink, "target-arrow-shape": "triangle", width: 1.8, label: "data(label)" } },
    { selector: "edge.via-identity", style: { "line-style": "dashed" } },
    { selector: "edge.status", style: { "target-arrow-shape": "triangle", "line-color": ink, "target-arrow-color": ink, width: 1.6 } },
    { selector: "edge.status.received", style: { "line-style": "dashed" } },
    { selector: "edge.status.derived", style: { "line-color": ink, "line-style": "dotted", width: 2.2, label: "data(label)" } },
    { selector: "edge.status.contradicted, edge.status.contradicted-assuming", style: { "line-color": red, "target-arrow-color": red, "target-arrow-shape": "tee", width: 2.6, color: red, "font-weight": 700, label: "data(label)" } },
    { selector: "edge.status.contradicted-assuming", style: { "line-style": "dashed" } },
    { selector: "edge.status.holds", style: { "line-style": "dashed", "line-color": muted, "target-arrow-color": muted, label: "" } },
    { selector: "edge.incompatible", style: { "curve-style": "unbundled-bezier", "control-point-distances": 70, "control-point-weights": 0.5, "line-color": red, width: 3, label: "data(label)", color: red, "font-weight": 700, "target-arrow-shape": "none" } },
    { selector: "edge.incompatible.assumption", style: { "line-style": "dashed" } },
    { selector: "node:selected", style: { "border-color": red, "border-width": 4 } },
    { selector: ".faded", style: { opacity: 0.12 } },
  ];
}

export function GraphView({ elements, height = "", caption }: { elements: CyEl[]; height?: "" | "tall" | "short"; caption?: string; quietEdges?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { theme, meta } = useApp();
  const [info, setInfo] = useState<string | null>(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const withImg = elements.map((e) => {
      const img = e.data.kind === "person" && e.data.agent ? meta?.portraits?.[e.data.agent]?.face : undefined;
      return img ? { ...e, data: { ...e.data, img } } : e;
    });
    const cy = cytoscape({ container: ref.current, elements: withImg as any, style: style(), layout: { name: "preset" } as any, wheelSensitivity: 0.25, minZoom: 0.2, maxZoom: 2.5 });
    cy.on("tap", "node", (e) => {
      const n = e.target;
      cy.elements().addClass("faded");
      n.closedNeighborhood().removeClass("faded");
      const d = n.data();
      setInfo(`${d.label}${d.dec ? `  ·  DEC: ${d.dec}` : ""}`);
    });
    cy.on("tap", (e) => { if (e.target === cy) { cy.elements().removeClass("faded"); setInfo(null); } });
    cy.on("mouseover", "edge", (e) => { const d = e.target.data(); if (d.label) setInfo(`${d.label}${d.dec ? `  ·  DEC: ${d.dec}` : ""}`); });
    columnLayout(cy);
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [elements, meta]);

  useEffect(() => { cyRef.current?.style(style() as any); }, [theme]);
  useEffect(() => {
    const cy = cyRef.current;
    if (cy) { cy.resize(); cy.fit(undefined, 34); }
    if (!big) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  const nodes = elements.filter((e) => !e.data.source).length;
  return (
    <figure style={{ margin: 0 }}>
      {big && <div className="graph-backdrop" onClick={() => setBig(false)} aria-hidden="true" />}
      <div className={`graph-box ${height} ${big ? "expanded" : ""}`} role={big ? "dialog" : undefined} aria-modal={big || undefined} aria-label={big ? "Expanded diagram" : undefined}>
        <div className="graph-tools">
          <button className="btn small" onClick={() => setBig(!big)} aria-expanded={big}>{big ? "Close ✕" : "Expand"}</button>
          <button className="btn small" onClick={() => cyRef.current?.fit(undefined, 34)}>Fit</button>
        </div>
        <div ref={ref} className="graph-canvas" role="img" aria-label={`Diagram with ${nodes} elements: ${caption ?? "people, points of view and statements"}. The same information is given in text on this page.`} />
        {info && <div className="graph-info">{info}</div>}
      </div>
      <GraphLegend />
    </figure>
  );
}

export function GraphLegend() {
  const sw = (s: React.ReactNode, w = 26) => <svg width={w} height="12" aria-hidden="true">{s}</svg>;
  return (
    <div className="graph-legend" aria-label="Diagram legend">
      <span><strong>Columns:</strong> people → points of view → statements → things &amp; ideas.</span>
      <span>{sw(<line x1="0" y1="6" x2="26" y2="6" stroke="var(--ink)" strokeWidth="1.6" />)} states</span>
      <span>{sw(<line x1="0" y1="6" x2="26" y2="6" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="4 3" />)} inherits</span>
      <span>{sw(<line x1="0" y1="6" x2="26" y2="6" stroke="var(--ink)" strokeWidth="2.2" strokeDasharray="1 3" />)} DEC infers</span>
      <span>{sw(<><line x1="0" y1="6" x2="22" y2="6" stroke="var(--red)" strokeWidth="2.6" /><line x1="23" y1="1" x2="23" y2="11" stroke="var(--red)" strokeWidth="2.6" /></>)} rules out</span>
      <span>{sw(<path d="M1 10 Q13 0 25 10" fill="none" stroke="var(--red)" strokeWidth="3" />)} can't both be true</span>
      <span>{sw(<rect x="1" y="1" width="24" height="10" rx="2" fill="var(--yellow)" stroke="#141414" strokeWidth="2" />)} Reality</span>
    </div>
  );
}
