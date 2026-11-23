// Best-effort explanation of a triple that DEC materialised in a world without it being asserted there.
// The edition does not re-run OWL: it recognises the rule patterns used in this dataset.
import { NS, type Mode } from "../config.ts";
import { graphs } from "../data.ts";
import { ask, n3, select } from "../store.ts";
import type { Triple } from "./incompatibility.ts";

export type Hint =
  | { rule: "identity"; from: string; to: string; via: string; viaWorld?: string }
  | { rule: "symmetric"; property: string }
  | { rule: "subclass"; from: string }
  | { rule: "inverse-functional"; property: string; value: string }
  | { rule: "inverse"; property: string }
  | { rule: "subproperty"; from: string }
  | { rule: "domain"; property: string; value: string }
  | { rule: "range"; property: string; value: string }
  | { rule: "unidentified" };

/** Every rule pattern that explains t in the world (the first one is the default explanation). */
export function derivationHints(t: Triple, mode: Mode, world: string): Hint[] {
  const { M } = graphs(mode, world);
  const AX = graphs(mode, "shared").A;
  const out: Hint[] = [];
  // identity substitution: the subject or the object is swapped for an individual it is the same as
  if (t.p.value !== NS.owl + "sameAs") {
    const subj = select(`SELECT ?s2 WHERE { GRAPH <${M}> { ?s2 ${n3(t.p)} ${n3(t.o)} . { ?s2 owl:sameAs ${n3(t.s)} } UNION { ${n3(t.s)} owl:sameAs ?s2 } }
        FILTER(?s2 != ${n3(t.s)}) } LIMIT 1`);
    if (subj.length) out.push({ rule: "identity", from: subj[0].s2.value, to: t.s.value, via: NS.owl + "sameAs" });
    if (t.o.type === "uri") {
      const obj = select(`SELECT ?o2 WHERE { GRAPH <${M}> { ${n3(t.s)} ${n3(t.p)} ?o2 . { ?o2 owl:sameAs ${n3(t.o)} } UNION { ${n3(t.o)} owl:sameAs ?o2 } }
          FILTER(?o2 != ${n3(t.o)}) } LIMIT 1`);
      if (obj.length) out.push({ rule: "identity", from: obj[0].o2.value, to: t.o.value, via: NS.owl + "sameAs" });
    }
  }
  if (t.p.value === NS.owl + "sameAs") {
    const ifp = select(`SELECT ?p ?v WHERE { GRAPH <${M}> { ?p a owl:InverseFunctionalProperty . ${n3(t.s)} ?p ?v . ${n3(t.o)} ?p ?v } } LIMIT 1`);
    if (ifp.length) out.push({ rule: "inverse-functional", property: ifp[0].p.value, value: ifp[0].v.value });
    if (ask(`ASK { GRAPH <${M}> { ${n3(t.o)} owl:sameAs ${n3(t.s)} } }`)) out.push({ rule: "symmetric", property: NS.owl + "sameAs" });
  }
  if (ask(`ASK { GRAPH <${AX}> { ${n3(t.p)} a owl:SymmetricProperty } GRAPH <${M}> { ${n3(t.o)} ${n3(t.p)} ${n3(t.s)} } }`)) {
    out.push({ rule: "symmetric", property: t.p.value });
  }
  if (t.p.value === NS.rdf + "type") {
    const sc = select(`SELECT ?d WHERE { GRAPH <${M}> { ${n3(t.s)} a ?d . ?d rdfs:subClassOf ${n3(t.o)} } FILTER(?d != ${n3(t.o)}) } LIMIT 1`);
    if (sc.length) out.push({ rule: "subclass", from: sc[0].d.value });
  }
  // the same relation read from the other side (owl:inverseOf, declared in the shared schema)
  const inv = select(`SELECT ?q WHERE { { GRAPH <${AX}> { ${n3(t.p)} owl:inverseOf ?q } } UNION { GRAPH <${AX}> { ?q owl:inverseOf ${n3(t.p)} } }
      GRAPH <${M}> { ${n3(t.o)} ?q ${n3(t.s)} } } LIMIT 1`);
  if (inv.length && t.o.type === "uri") out.push({ rule: "inverse", property: inv[0].q.value });
  // a more specific relation implies a more general one (rdfs:subPropertyOf)
  const sub = select(`SELECT ?q WHERE { GRAPH <${AX}> { ?q rdfs:subPropertyOf ${n3(t.p)} } GRAPH <${M}> { ${n3(t.s)} ?q ${n3(t.o)} } FILTER(?q != ${n3(t.p)}) } LIMIT 1`);
  if (sub.length) out.push({ rule: "subproperty", from: sub[0].q.value });
  if (t.p.value === NS.rdf + "type") {
    // only a C can be the subject / object of q (rdfs:domain / rdfs:range)
    const dom = select(`SELECT ?q ?v WHERE { GRAPH <${AX}> { ?q rdfs:domain ${n3(t.o)} } GRAPH <${M}> { ${n3(t.s)} ?q ?v } } LIMIT 1`);
    if (dom.length) out.push({ rule: "domain", property: dom[0].q.value, value: dom[0].v.value });
    const rng = select(`SELECT ?q ?v WHERE { GRAPH <${AX}> { ?q rdfs:range ${n3(t.o)} } GRAPH <${M}> { ?v ?q ${n3(t.s)} } } LIMIT 1`);
    if (rng.length) out.push({ rule: "range", property: rng[0].q.value, value: rng[0].v.value });
  }
  return out;
}

export function derivationHint(t: Triple, mode: Mode, world: string): Hint {
  return derivationHints(t, mode, world)[0] ?? { rule: "unidentified" };
}
