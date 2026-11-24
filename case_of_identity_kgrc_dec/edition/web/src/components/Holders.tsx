// "Who holds what" for one proposition: Reality first, then only the people who hold something; the silent ones in one line.
import type { Viewpoint } from "../api";
import { REALITY } from "../vocab";
import { RealityDisc } from "./Glyphs";
import { PersonDetail, personState } from "./Kaleidoscope";

export function Holders({ vp }: { vp: Viewpoint }) {
  const active = vp.people.filter((p) => p.stances.length);
  const silent = vp.people.filter((p) => !p.stances.length);
  return (
    <div className="holders">
      <div className="holder" title={`DEC: ${vp.reality.dec}`}>
        <RealityDisc value={vp.reality.value} size={40} />
        <div className="lines">
          <div className="line"><span className="name">Reality</span><span className="small">{REALITY[vp.reality.value].label}</span></div>
          {vp.reality.value !== "unknown" && <div className="how">{vp.reality.how}</div>}
        </div>
      </div>
      {active.map((p) => <div key={p.id} className={personState(p, vp) === "conflict" ? "conflict" : ""}><PersonDetail p={p} vp={vp} /></div>)}
      {silent.length > 0 && <p className="small muted" style={{ margin: 0 }}>Silent: {silent.map((p) => p.short).join(", ")}.</p>}
    </div>
  );
}
