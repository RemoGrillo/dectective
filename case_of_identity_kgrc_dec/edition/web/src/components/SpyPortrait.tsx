// A portrait with a spyglass: moving over a persona, a lens follows the pointer and shows, under the disguise, the face of
// the person behind the mask (Hosmer Angel → James Windibank). The lens shows a composite of the same portrait with the
// other face pasted in (scripts/build_portraits.py, crops.json "reveals"), so everything outside the face matches exactly.
// Only in the whole story: before the unmasking it would be a spoiler.
import { useState } from "react";
import { useApp } from "../state";
import { Portrait } from "./Portrait";

const BEHIND: Record<string, string> = { hosmer: "James Windibank" };

export function hasReveal(id: string) { return id in BEHIND; }

export function SpyPortrait({ id, size, name }: { id: string; size: number; name: string }) {
  const { meta, mode } = useApp();
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  const urls = meta?.portraits?.[id];
  if (!urls?.reveal || !BEHIND[id] || mode !== "gold") return <Portrait id={id} size={size} name={name} oval />;
  const r = size * 0.24;
  const move = (e: React.PointerEvent) => { const b = e.currentTarget.getBoundingClientRect(); setP({ x: e.clientX - b.left, y: e.clientY - b.top }); };
  return (
    <span className="spy" style={{ width: size, height: size }} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setP(null)}
      role="img" aria-label={`Portrait of ${name}. Look closer with the lens: under the disguise, ${BEHIND[id]}.`}>
      <img src={urls.full} alt="" draggable={false} />
      {p && (
        <>
          <img className="spy-reveal" src={urls.reveal} alt="" draggable={false} style={{ clipPath: `circle(${r}px at ${p.x}px ${p.y}px)` }} />
          <span className="spy-lens" style={{ left: p.x - r, top: p.y - r, width: 2 * r, height: 2 * r }} />
        </>
      )}
      {!p && <span className="spy-hint" aria-hidden="true">🔍</span>}
    </span>
  );
}
