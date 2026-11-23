// Cytoscape is large: load the graph view only when a graph is actually shown.
import { lazy, Suspense, type ComponentProps } from "react";
import { Loading } from "./Bits";

const Inner = lazy(() => import("./GraphView").then((m) => ({ default: m.GraphView })));

export function GraphView(props: ComponentProps<typeof Inner>) {
  return <Suspense fallback={<Loading what="Drawing the connections" />}><Inner {...props} /></Suspense>;
}
