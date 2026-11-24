// Calm transitions for panels whose content changes (the Perspectives side column, the Reader's panel, the Identikit
// sheet). Rules: the layout moves first, content fades in after it; when the content changes, the old one stays on
// screen until the new one is ready, fades out briefly, and the new one fades in. Nothing moves for readers who ask
// for reduced motion.
import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Shows `next` once it is ready; when it changes, keeps the old one, fades it out (`phase: "out"`), then swaps.
 *  While `next` is null (still loading) the old item stays on screen. Render the item under `key={key}` with the class
 *  `swap` (+ `out`) so the new one fades in. `next` must be stable between renders (state, or memoised). */
export function useSwap<T>(next: T | null | undefined, keyOf: (v: T) => string, outMs = 150): { shown: T | null; phase: "in" | "out"; key: string | null } {
  const [shown, setShown] = useState<T | null>(next ?? null);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const nextKey = next ? keyOf(next) : null;
  const shownKey = shown ? keyOf(shown) : null;
  useEffect(() => {
    if (!next) return;
    if (!shown || nextKey === shownKey || reducedMotion()) { if (next !== shown) setShown(next); setPhase("in"); return; }
    setPhase("out");
    const t = setTimeout(() => { setShown(next); setPhase("in"); }, outMs);
    return () => clearTimeout(t);
  }, [nextKey, next]); // eslint-disable-line react-hooks/exhaustive-deps
  return { shown, phase, key: shownKey };
}

/** Keeps a closing panel on screen for `ms` so it can fade out before the layout closes. */
export function usePresence(open: boolean, ms = 170): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (reducedMotion()) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted: open || mounted, leaving: !open && mounted };
}

/** The last non-null value: what a closing panel keeps showing while it fades out. */
export function useLast<T>(v: T | null | undefined): T | null {
  const r = useRef<T | null>(v ?? null);
  if (v) r.current = v;
  return r.current;
}
