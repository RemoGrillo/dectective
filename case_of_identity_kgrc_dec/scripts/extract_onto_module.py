#!/usr/bin/env python3
"""Extract a minimal CIDOC CRM 7.1.3 + CRMinf 1.2.1 module for a given set of terms.

For each requested class: rdf:type + transitive rdfs:subClassOf closure (to the roots).
For each requested property: rdf:type + transitive rdfs:subPropertyOf closure, rdfs:domain,
rdfs:range (and the classes they mention, with their closure), owl:inverseOf if declared.
No labels or comments (they add triples without adding entailments). Source files are the
official RDFS in sources/ontologies (SHA-256 in the manifest).

Usage (as a module): extract(terms) -> rdflib.Graph ; CLI: python -I scripts/extract_onto_module.py <root> term1 term2 ...
"""
import os
import sys

import rdflib
from rdflib import OWL, RDF, RDFS, URIRef

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
INF = "http://www.cidoc-crm.org/extensions/crminf/"


def load_sources(root):
    g = rdflib.Graph()
    g.parse(os.path.join(root, "sources/ontologies/CIDOC_CRM_v7.1.3.rdf"), format="xml")
    g.parse(os.path.join(root, "sources/ontologies/CRMinf_v1.2.1.rdf"), format="xml")
    return g


def expand(term):
    if term.startswith("http"):
        return URIRef(term)
    if term.startswith(("E", "P")) and "_" in term:
        return URIRef(CRM + term)
    if term.startswith(("I", "J")) and "_" in term:
        return URIRef(INF + term)
    raise ValueError(term)


def extract(src, terms):
    out = rdflib.Graph()
    seen = set()
    todo = [expand(t) for t in terms]
    while todo:
        t = todo.pop()
        if t in seen:
            continue
        seen.add(t)
        types = set(src.objects(t, RDF.type))
        is_prop = RDF.Property in types or OWL.ObjectProperty in types or any(src.triples((t, RDFS.subPropertyOf, None))) or any(src.triples((t, RDFS.domain, None)))
        for ty in types:
            out.add((t, RDF.type, ty))
        if not types:
            out.add((t, RDF.type, RDF.Property if is_prop else RDFS.Class))
        if is_prop:
            for sp in src.objects(t, RDFS.subPropertyOf):
                out.add((t, RDFS.subPropertyOf, sp)); todo.append(sp)
            for d in src.objects(t, RDFS.domain):
                out.add((t, RDFS.domain, d)); todo.append(d)
            for r in src.objects(t, RDFS.range):
                if isinstance(r, URIRef) and str(r).startswith((CRM, INF)):
                    out.add((t, RDFS.range, r)); todo.append(r)
            for inv in src.objects(t, OWL.inverseOf):
                out.add((t, OWL.inverseOf, inv))
        else:
            for sc in src.objects(t, RDFS.subClassOf):
                if isinstance(sc, URIRef) and str(sc).startswith((CRM, INF)):
                    out.add((t, RDFS.subClassOf, sc)); todo.append(sc)
    return out


if __name__ == "__main__":
    root = sys.argv[1]
    g = extract(load_sources(root), sys.argv[2:])
    print(g.serialize(format="turtle"))
    print("#", len(g), "triples", file=sys.stderr)
