package dectective;

import java.io.File;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;

import org.apache.jena.atlas.json.JSON;
import org.apache.jena.atlas.json.JsonArray;
import org.apache.jena.atlas.json.JsonObject;
import org.apache.jena.atlas.json.JsonNumber;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.*;
import org.apache.jena.rdf.model.InfModel;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.reasoner.Reasoner;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.reasoner.ValidityReport;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.sparql.algebra.Algebra;
import org.apache.jena.sparql.algebra.Op;
import org.apache.jena.sparql.algebra.OpVisitorBase;
import org.apache.jena.sparql.algebra.OpWalker;
import org.apache.jena.sparql.algebra.op.OpQuadBlock;
import org.apache.jena.sparql.algebra.op.OpQuadPattern;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.DatasetGraphFactory;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.sparql.core.Substitute;
import org.apache.jena.sparql.engine.binding.Binding;
import org.apache.jena.sparql.graph.GraphFactory;
import org.apache.jena.graph.compose.MultiUnion;
import org.w3id.conjectures.DecDataset;
import org.w3id.conjectures.DecWorld;

/**
 * Measurement harness for one data slice and one SPARQL query under one configuration.
 *
 * Configurations (same input TriG, same query text, same Jena 4.8.0 OWL FB rule reasoner):
 *   asserted : no inference at all (answers available by plain lookup)
 *   flat     : every triple of every graph unioned into ONE graph + OWL FB; every graph name
 *              (and dec:reality) is mapped to that single inferred graph (no context separation)
 *   ctx      : each named graph is inferred separately over (own triples + graphs typed
 *              dec:sharedWorld); dec:reality = default graph + shared. Standard per-graph reasoning,
 *              NO DEC permeation (no epistemic->reality, no reality->conjectural), no cross-world checks
 *   dec      : fvitali/dec-reasoner DecDataset (in memory), OWL FB base reasoner
 *
 * Usage: Runner --data slice.trig --query q.rq --config dec|flat|ctx|asserted --out result.json
 *               [--warmup 1] [--reps 10] [--instrument] [--dump file.nq] [--timeout-ms 120000]
 */
public class Runner {

    static final String DEC = "http://w3id.org/conjectures/";
    static final Node REALITY = NodeFactory.createURI(DEC + "reality");
    static final String RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
    static final String RDFS = "http://www.w3.org/2000/01/rdf-schema#";
    static final String OWL = "http://www.w3.org/2002/07/owl#";
    static final String XSD = "http://www.w3.org/2001/XMLSchema#";
    static final Node RDF_TYPE = NodeFactory.createURI(RDF + "type");
    static final Node SHARED_WORLD = NodeFactory.createURI(DEC + "sharedWorld");
    static boolean PROBE_SECOND_CALL = false;
    static final String CRM = "http://www.cidoc-crm.org/cidoc-crm/";
    static final String INF = "http://www.cidoc-crm.org/extensions/crminf/";
    static final String PROFNS = "http://example.org/dectective/profile#";

    /** Taxonomic inference: membership in an ontology class (CRM, CRMinf, local profile). */
    static boolean isTaxonomic(Triple t) {
        if (!t.getPredicate().equals(RDF_TYPE) || !t.getObject().isURI()) return false;
        String o = t.getObject().getURI();
        return o.startsWith(CRM) || o.startsWith(INF) || o.startsWith(PROFNS);
    }

    // ---------------------------------------------------------------- helpers
    static boolean isVocab(Node n) {
        if (!n.isURI()) return false;
        String u = n.getURI();
        return u.startsWith(RDF) || u.startsWith(RDFS) || u.startsWith(OWL) || u.startsWith(XSD) || u.startsWith("urn:x-hp-jena:");
    }

    static boolean isDecNode(Node n) { return n.isURI() && n.getURI().startsWith(DEC); }

    /** DEC control/diagnostic triple: dec: predicate or dec: object. */
    static boolean isDecTriple(Triple t) { return isDecNode(t.getPredicate()) || isDecNode(t.getObject()); }

    /** Heuristic "trivial" inference (declared in reports/dec_performance.md). */
    static boolean isTrivial(Triple t) {
        Node s = t.getSubject(), p = t.getPredicate(), o = t.getObject();
        if (isVocab(s)) return true;                                       // facts about the RDF/RDFS/OWL vocabulary itself
        if (p.equals(RDF_TYPE) && isVocab(o)) return true;                 // x a rdfs:Resource / owl:Thing / owl:Class ...
        String pu = p.isURI() ? p.getURI() : "";
        if ((pu.equals(OWL + "sameAs") || pu.equals(RDFS + "subClassOf") || pu.equals(RDFS + "subPropertyOf")
                || pu.equals(OWL + "equivalentClass") || pu.equals(OWL + "equivalentProperty")) && s.equals(o)) return true; // reflexive
        if ((pu.startsWith(RDFS) || pu.startsWith(OWL)) && isVocab(o)) return true;   // C subClassOf owl:Thing, p range rdfs:Resource ...
        return false;
    }

    static Set<Triple> toSet(Graph g) {
        Set<Triple> s = new HashSet<>();
        g.find().forEachRemaining(s::add);
        return s;
    }

    static String sha256(List<String> lines) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (String l : lines) md.update((l + "\n").getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    static String fmt(Node n) { return n == null ? "null" : n.toString(); }

    // ---------------------------------------------------------------- result of one materialisation
    static class Materialised {
        DatasetGraph view;                                  // what SPARQL sees
        Map<String, Set<Triple>> asserted = new TreeMap<>();
        Map<String, Set<Triple>> base = new TreeMap<>();     // base graph after permeation (DEC) / own+imported (ctx)
        Map<String, Set<Triple>> full = new TreeMap<>();     // complete inferred view per world
        Map<String, String> worldType = new TreeMap<>();
        Map<String, Long> phaseNs = new LinkedHashMap<>();
        Map<String, Long> perWorldNs = new LinkedHashMap<>();
        Map<String, Boolean> validity = new TreeMap<>();
        int pairsChecked = 0;
        List<String> decDiagnostics = new ArrayList<>();
        Map<Node, String> nameToWorld = new HashMap<>();    // graph node used in queries -> world key
        Map<String, Set<String>> sources = new TreeMap<>(); // world -> worlds it receives triples from (permeation)
    }

    // ---------------------------------------------------------------- input
    static DatasetGraph load(String path) {
        DatasetGraph dsg = DatasetGraphFactory.createTxnMem();
        RDFDataMgr.read(dsg, path);
        return dsg;
    }

    static Set<Triple> assertedReality(DatasetGraph src) {
        Set<Triple> s = new HashSet<>();
        src.getDefaultGraph().find().forEachRemaining(t -> { if (!isDecTriple(t)) s.add(t); });
        return s;
    }

    static Set<Node> sharedGraphs(DatasetGraph src) {
        Set<Node> s = new HashSet<>();
        src.getDefaultGraph().find(Node.ANY, RDF_TYPE, SHARED_WORLD).forEachRemaining(t -> s.add(t.getSubject()));
        return s;
    }

    // ---------------------------------------------------------------- configurations
    static Materialised runAsserted(DatasetGraph src, Reasoner r) {
        Materialised m = new Materialised();
        long t0 = System.nanoTime();
        DatasetGraph view = DatasetGraphFactory.createGeneral();
        src.find().forEachRemaining(q -> view.add(q));
        // make dec:reality an alias of the default graph so that the same queries run unchanged
        view.addGraph(REALITY, view.getDefaultGraph());
        m.phaseNs.put("build", System.nanoTime() - t0);
        m.view = view;
        Set<Triple> real = assertedReality(src);
        m.asserted.put(REALITY.getURI(), real); m.base.put(REALITY.getURI(), real); m.full.put(REALITY.getURI(), real);
        m.worldType.put(REALITY.getURI(), "reality(asserted)");
        src.listGraphNodes().forEachRemaining(g -> {
            Set<Triple> s = toSet(src.getGraph(g));
            m.asserted.put(g.getURI(), s); m.base.put(g.getURI(), s); m.full.put(g.getURI(), s);
            m.worldType.put(g.getURI(), "named(asserted)");
            m.nameToWorld.put(g, g.getURI());
        });
        m.nameToWorld.put(REALITY, REALITY.getURI());
        return m;
    }

    static Materialised runFlat(DatasetGraph src, Reasoner r) {
        Materialised m = new Materialised();
        long t0 = System.nanoTime();
        Graph union = GraphFactory.createDefaultGraph();
        src.find().forEachRemaining(q -> union.add(q.asTriple()));
        InfModel inf = ModelFactory.createInfModel(r, ModelFactory.createModelForGraph(union));
        m.phaseNs.put("build", System.nanoTime() - t0);
        long t1 = System.nanoTime();
        Set<Triple> full = toSet(inf.getGraph());                      // forces complete inference
        m.phaseNs.put("enumerate", System.nanoTime() - t1);
        long t2 = System.nanoTime();
        m.validity.put("flat", inf.validate().isValid());
        m.phaseNs.put("validate", System.nanoTime() - t2);
        DatasetGraph view = DatasetGraphFactory.create(inf.getGraph());
        view.addGraph(REALITY, inf.getGraph());
        src.listGraphNodes().forEachRemaining(g -> { view.addGraph(g, inf.getGraph()); m.nameToWorld.put(g, "flat"); });
        m.nameToWorld.put(REALITY, "flat");
        m.view = view;
        Set<Triple> u = toSet(union);
        m.asserted.put("flat", u); m.base.put("flat", u); m.full.put("flat", full); m.worldType.put("flat", "flat");
        return m;
    }

    static Materialised runCtx(DatasetGraph src, Reasoner r) {
        Materialised m = new Materialised();
        Set<Node> shared = sharedGraphs(src);
        long t0 = System.nanoTime();
        Map<Node, InfModel> infs = new LinkedHashMap<>();
        Graph realityBase = GraphFactory.createDefaultGraph();
        src.getDefaultGraph().find().forEachRemaining(t -> { if (!isDecTriple(t)) realityBase.add(t); });
        for (Node sg : shared) src.getGraph(sg).find().forEachRemaining(realityBase::add);
        infs.put(REALITY, ModelFactory.createInfModel(r, ModelFactory.createModelForGraph(realityBase)));
        Map<Node, Graph> bases = new LinkedHashMap<>();
        bases.put(REALITY, realityBase);
        Iterator<Node> it = src.listGraphNodes();
        while (it.hasNext()) {
            Node g = it.next();
            Graph b = GraphFactory.createDefaultGraph();
            src.getGraph(g).find().forEachRemaining(b::add);
            if (!shared.contains(g)) for (Node sg : shared) src.getGraph(sg).find().forEachRemaining(b::add);
            bases.put(g, b);
            infs.put(g, ModelFactory.createInfModel(r, ModelFactory.createModelForGraph(b)));
        }
        m.phaseNs.put("build", System.nanoTime() - t0);
        long t1 = System.nanoTime();
        for (Map.Entry<Node, InfModel> e : infs.entrySet()) {
            long tw = System.nanoTime();
            m.full.put(e.getKey().getURI(), toSet(e.getValue().getGraph()));
            m.perWorldNs.put(e.getKey().getURI(), System.nanoTime() - tw);
        }
        m.phaseNs.put("enumerate", System.nanoTime() - t1);
        long t2 = System.nanoTime();
        for (Map.Entry<Node, InfModel> e : infs.entrySet()) m.validity.put(e.getKey().getURI(), e.getValue().validate().isValid());
        m.phaseNs.put("validate", System.nanoTime() - t2);
        DatasetGraph view = DatasetGraphFactory.create(infs.get(REALITY).getGraph());
        for (Map.Entry<Node, InfModel> e : infs.entrySet()) {
            view.addGraph(e.getKey(), e.getValue().getGraph());
            m.nameToWorld.put(e.getKey(), e.getKey().getURI());
        }
        m.view = view;
        m.asserted.put(REALITY.getURI(), assertedReality(src));
        m.base.put(REALITY.getURI(), toSet(realityBase));
        m.worldType.put(REALITY.getURI(), "reality(ctx)");
        Set<String> sh = new TreeSet<>(); for (Node sg : shared) sh.add(sg.getURI());
        m.sources.put(REALITY.getURI(), sh);
        src.listGraphNodes().forEachRemaining(g -> { if (!shared.contains(g)) m.sources.put(g.getURI(), sh); });
        src.listGraphNodes().forEachRemaining(g -> {
            m.asserted.put(g.getURI(), toSet(src.getGraph(g)));
            m.base.put(g.getURI(), toSet(bases.get(g)));
            m.worldType.put(g.getURI(), shared.contains(g) ? "shared(ctx)" : "named(ctx)");
        });
        return m;
    }

    static void setField(Object o, String name, Object value) throws Exception {
        Field f = o.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(o, value);
    }

    static Materialised runDec(DatasetGraph src, Reasoner r, boolean instrument, int timeoutMs) throws Exception {
        Materialised m = new Materialised();
        long t0 = System.nanoTime();
        DecDataset dec = new DecDataset(null, false, false, true, timeoutMs, r, "0 0 0 0 0 0 0 0 0 0 0");
        src.find().forEachRemaining(q -> dec.add(q));
        m.phaseNs.put("load", System.nanoTime() - t0);
        long t1 = System.nanoTime();
        if (!instrument) {
            dec.getDefaultGraph();                      // natural lazy trigger: runs handlePermeation() once
            m.phaseNs.put("handlePermeation", System.nanoTime() - t1);
        } else {
            // Same public sequence as DecDataset.handlePermeation(), with timers between steps.
            var dsh = dec.getDecStatementHandler();
            var reh = dec.getReificationHandler();
            var rsh = dec.getRDFStarHandler();
            var dgh = dec.getDefaultGraphHandler();
            dec.isPermeating = true;
            synchronized (dec.permeatingLock) {
                long a = System.nanoTime(); dsh.clearDecData();                         m.phaseNs.put("clearDecData", System.nanoTime() - a);
                a = System.nanoTime(); reh.handleReifications();                        m.phaseNs.put("handleReifications", System.nanoTime() - a);
                a = System.nanoTime(); dsh.assignDecTypes();                            m.phaseNs.put("assignDecTypes", System.nanoTime() - a);
                a = System.nanoTime(); dsh.assignDecPermeationsAndInferenceSettings(); m.phaseNs.put("assignPermeations", System.nanoTime() - a);
                a = System.nanoTime();
                for (DecWorld w : dec.getWorlds().values()) {
                    long tw = System.nanoTime(); w.getPermeatedGraph(); m.perWorldNs.put(w.getName(), System.nanoTime() - tw);
                }
                m.phaseNs.put("permeateWorlds", System.nanoTime() - a);
                a = System.nanoTime(); dsh.verifyClosedFor();                           m.phaseNs.put("verifyClosedFor", System.nanoTime() - a);
                a = System.nanoTime(); dsh.verifyInconsistencies();                     m.phaseNs.put("verifyInconsistencies", System.nanoTime() - a);
                a = System.nanoTime(); dec.prepareRestore(); reh.restoreReifications(); rsh.restoreRdfStarTriples(); dgh.restoreDefaultGraph();
                m.phaseNs.put("restore", System.nanoTime() - a);
            }
            dec.isPermeating = false;
            setField(dec, "needsPermeating", false);    // reflection: the flag is private in DecDataset
            m.phaseNs.put("handlePermeation", System.nanoTime() - t1);
        }
        if (PROBE_SECOND_CALL) {
            long t2 = System.nanoTime();
            dec.handlePermeation();                     // second call: expected no-op if all worlds are ready (observed: it is not)
            m.phaseNs.put("handlePermeation_second_call", System.nanoTime() - t2);
        }
        long t3 = System.nanoTime();
        int pairs = 0;
        List<DecWorld> ws = new ArrayList<>(dec.getWorlds().values());
        for (int i = 0; i < ws.size(); i++) for (int j = i + 1; j < ws.size(); j++) {
            String a = ws.get(i).getDecType(), b = ws.get(j).getDecType();
            if (!"special".equals(a) && !"special".equals(b) && !"shared".equals(a) && !"shared".equals(b)) pairs++;
        }
        m.pairsChecked = pairs;
        String dflt = Quad.defaultGraphNodeGenerated.getURI();
        java.util.function.Function<String, String> canon = n -> (n.equals(dflt) || n.equals(REALITY.getURI())) ? REALITY.getURI() : n;
        for (Map.Entry<Node, DecWorld> e : dec.getWorlds().entrySet()) {
            DecWorld w = e.getValue();
            String key = canon.apply(w.getName());
            if ("special".equals(w.getDecType()) && !key.equals(REALITY.getURI())) continue;   // dec:statements bookkeeping world
            m.worldType.put(key, w.getGraphType() + "/" + w.getDecType());
            m.base.put(key, toSet(w.getBaseGraph()));
            long tw = System.nanoTime();
            Set<Triple> full;
            if (key.equals(REALITY.getURI())) full = toSet(dec.getDefaultGraph());   // restored default graph = materialised reality
            else full = w.isModelValid() ? toSet(w.getPermeatedGraph()) : new HashSet<>();
            m.full.put(key, full);
            m.perWorldNs.merge(key + "#enumerate", System.nanoTime() - tw, Long::sum);
            Set<String> srcs = new TreeSet<>();
            for (DecWorld pw : w.getPermeations()) if (pw != null) srcs.add(canon.apply(pw.getName()));
            srcs.remove(key);
            m.sources.put(key, srcs);
            m.nameToWorld.put(e.getKey(), key);
            m.nameToWorld.put(NodeFactory.createURI(w.getName()), key);
        }
        m.nameToWorld.put(REALITY, REALITY.getURI());
        m.nameToWorld.put(Quad.defaultGraphNodeGenerated, REALITY.getURI());
        m.phaseNs.put("enumerate", System.nanoTime() - t3);
        // asserted content per world, taken from the input (DEC writes permeated triples into base graphs)
        Set<Triple> real = assertedReality(src);
        for (String key : m.full.keySet()) {
            Node n = NodeFactory.createURI(key);
            if (key.equals(REALITY.getURI())) m.asserted.put(key, real);
            else if (src.containsGraph(n)) m.asserted.put(key, toSet(src.getGraph(n)));
            else m.asserted.put(key, new HashSet<>());
        }
        Set<String> diag = new TreeSet<>();
        for (Set<Triple> s : m.full.values()) for (Triple t : s) if (isDecNode(t.getPredicate()) && !t.getPredicate().getURI().endsWith("buildTime") && !t.getPredicate().getURI().endsWith("buildVersion")) diag.add(fmt(t.getSubject()) + " " + fmt(t.getPredicate()) + " " + fmt(t.getObject()));
        dec.getDefaultGraph().find().forEachRemaining(t -> { if (isDecTriple(t)) diag.add(fmt(t.getSubject()) + " " + fmt(t.getPredicate()) + " " + fmt(t.getObject())); });
        m.decDiagnostics.addAll(diag);
        m.view = dec;
        return m;
    }

    // ---------------------------------------------------------------- queries
    static List<Quad> quadPatterns(Query q) {
        List<Quad> out = new ArrayList<>();
        Op op = Algebra.toQuadForm(Algebra.compile(q));
        OpWalker.walk(op, new OpVisitorBase() {
            @Override public void visit(OpQuadPattern qp) { out.addAll(qp.getPattern().getList()); }
            @Override public void visit(OpQuadBlock qb) { out.addAll(qb.getPattern().getList()); }
        });
        return out;
    }

    static JsonObject runQuery(String text, DatasetGraph view, Materialised m) {
        JsonObject res = new JsonObject();
        Query q = QueryFactory.create(text);
        Dataset ds = DatasetFactory.wrap(view);
        long t0 = System.nanoTime();
        List<String> rows = new ArrayList<>();
        Boolean ask = null;
        try (QueryExecution qe = QueryExecutionFactory.create(q, ds)) {
            if (q.isAskType()) ask = qe.execAsk();
            else {
                ResultSet rs = qe.execSelect();
                List<String> vars = rs.getResultVars();
                while (rs.hasNext()) {
                    QuerySolution s = rs.next();
                    StringBuilder sb = new StringBuilder();
                    for (String v : vars) sb.append(v).append('=').append(s.contains(v) ? s.get(v).toString() : "UNBOUND").append(' ');
                    rows.add(sb.toString().trim());
                }
            }
        }
        long first = System.nanoTime() - t0;
        long t1 = System.nanoTime();
        try (QueryExecution qe = QueryExecutionFactory.create(q, ds)) {
            if (q.isAskType()) qe.execAsk(); else ResultSetFormatter.consume(qe.execSelect());
        }
        long second = System.nanoTime() - t1;
        Collections.sort(rows);
        res.put("type", q.isAskType() ? "ASK" : "SELECT");
        if (ask != null) res.put("ask", ask);
        JsonArray arr = new JsonArray();
        rows.forEach(arr::add);
        res.put("rows", arr);
        res.put("n_rows", rows.size());
        res.put("query_first_ms", JsonNumber.value(first / 1e6));
        res.put("query_second_ms", JsonNumber.value(second / 1e6));
        // matched triples: instantiate the query's quad patterns with every solution of SELECT *
        Query star = QueryFactory.create(text);
        star.setQuerySelectType();
        star.setQueryResultStar(true);
        List<Quad> pats = quadPatterns(star);
        Set<String> matchedInferred = new TreeSet<>();
        Set<String> matchedAll = new TreeSet<>();
        try (QueryExecution qe = QueryExecutionFactory.create(star, ds)) {
            ResultSet rs = qe.execSelect();
            while (rs.hasNext()) {
                Binding b = rs.nextBinding();
                for (Quad p : pats) {
                    Quad inst = Substitute.substitute(p, b);
                    if (!inst.isConcrete()) continue;
                    Node g = inst.getGraph();
                    String wk = (g == null || Quad.isDefaultGraph(g)) ? m.nameToWorld.getOrDefault(REALITY, REALITY.getURI()) : m.nameToWorld.get(g);
                    if (wk == null) continue;
                    Triple t = inst.asTriple();
                    String key = wk + " | " + fmt(t.getSubject()) + " " + fmt(t.getPredicate()) + " " + fmt(t.getObject());
                    matchedAll.add(key);
                    Set<Triple> asserted = m.asserted.getOrDefault(wk, Set.of());
                    if (!asserted.contains(t)) matchedInferred.add(key);
                }
            }
        }
        res.put("matched_triples", matchedAll.size());
        res.put("matched_non_asserted_triples", matchedInferred.size());
        JsonArray mi = new JsonArray();
        matchedInferred.forEach(mi::add);
        res.put("matched_non_asserted_list", mi);
        return res;
    }

    // ---------------------------------------------------------------- accounting
    static JsonObject accounting(Materialised m) {
        JsonObject acc = new JsonObject();
        long assertedTot = 0, fullTot = 0, permeatedTot = 0, inferredTot = 0, trivialTot = 0, nontrivialTot = 0, decTot = 0, taxTot = 0;
        Set<Triple> distinct = new HashSet<>();
        JsonObject per = new JsonObject();
        for (String w : m.full.keySet()) {
            Set<Triple> a = m.asserted.getOrDefault(w, Set.of());
            Set<Triple> b = m.base.getOrDefault(w, Set.of());
            Set<Triple> f = m.full.get(w);
            Set<String> srcs = m.sources.getOrDefault(w, Set.of());
            long perm = 0, triv = 0, nontriv = 0, dect = 0, permNontriv = 0, tax = 0;
            for (Triple t : f) {
                if (a.contains(t)) continue;
                if (isDecTriple(t)) { dect++; continue; }
                boolean imported = false;
                for (String sw : srcs) { Set<Triple> sf = m.full.get(sw); if (sf != null && sf.contains(t)) { imported = true; break; } }
                if (imported) { perm++; if (!isTrivial(t)) permNontriv++; continue; }
                if (isTrivial(t)) triv++; else { nontriv++; if (isTaxonomic(t)) tax++; }
            }
            JsonObject o = new JsonObject();
            o.put("type", m.worldType.getOrDefault(w, "?"));
            o.put("asserted", a.size());
            o.put("base_after", b.size());
            o.put("permeated_in", perm);
            o.put("permeated_in_nontrivial", permNontriv);
            JsonArray sa = new JsonArray(); srcs.forEach(sa::add); o.put("receives_from", sa);
            o.put("materialised", f.size());
            o.put("inferred_trivial", triv);
            o.put("inferred_nontrivial", nontriv);
            o.put("inferred_taxonomic", tax);
            o.put("inferred_substantive", nontriv - tax);
            o.put("dec_diagnostic", dect);
            if (m.validity.containsKey(w)) o.put("valid", m.validity.get(w));
            per.put(w, o);
            assertedTot += a.size(); fullTot += f.size(); permeatedTot += perm; trivialTot += triv; nontrivialTot += nontriv; decTot += dect; taxTot += tax;
            inferredTot += triv + nontriv;
            distinct.addAll(f);
        }
        acc.put("worlds", per);
        acc.put("n_worlds", m.full.size());
        acc.put("asserted_total", assertedTot);
        acc.put("materialised_total", fullTot);
        acc.put("permeated_total", permeatedTot);
        acc.put("inferred_total", inferredTot);
        acc.put("inferred_trivial_total", trivialTot);
        acc.put("inferred_nontrivial_total", nontrivialTot);
        acc.put("inferred_taxonomic_total", taxTot);
        acc.put("inferred_substantive_total", nontrivialTot - taxTot);
        acc.put("dec_diagnostic_total", decTot);
        acc.put("distinct_triples_all_worlds", distinct.size());
        acc.put("redundancy", JsonNumber.value(distinct.isEmpty() ? 0.0 : (double) fullTot / distinct.size()));
        acc.put("inconsistency_pairs", m.pairsChecked);
        JsonArray d = new JsonArray();
        m.decDiagnostics.forEach(d::add);
        acc.put("dec_diagnostics", d);
        return acc;
    }

    static List<String> dumpLines(Materialised m) {
        List<String> lines = new ArrayList<>();
        for (Map.Entry<String, Set<Triple>> e : m.full.entrySet())
            for (Triple t : e.getValue()) {
                if (t.getPredicate().isURI() && (t.getPredicate().getURI().endsWith("buildTime") || t.getPredicate().getURI().endsWith("buildVersion"))) continue;
                if (t.getSubject().isBlank() || t.getObject().isBlank()) continue;   // blank labels are not stable across runs
                lines.add("<" + e.getKey() + "> " + fmt(t.getSubject()) + " " + fmt(t.getPredicate()) + " " + fmt(t.getObject()));
            }
        Collections.sort(lines);
        return lines;
    }

    // ---------------------------------------------------------------- main
    public static void main(String[] argv) throws Exception {
        Map<String, String> a = new HashMap<>();
        Set<String> flags = new HashSet<>();
        for (int i = 0; i < argv.length; i++) {
            if (argv[i].startsWith("--")) {
                String k = argv[i].substring(2);
                if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) a.put(k, argv[++i]); else flags.add(k);
            }
        }
        String data = a.get("data"), queryFile = a.get("query"), config = a.getOrDefault("config", "dec");
        int warm = Integer.parseInt(a.getOrDefault("warmup", "1")), reps = Integer.parseInt(a.getOrDefault("reps", "10"));
        int timeoutMs = Integer.parseInt(a.getOrDefault("timeout-ms", "120000"));
        boolean instrument = flags.contains("instrument");
        PROBE_SECOND_CALL = flags.contains("probe-second-call");
        String queryText = queryFile == null ? null : Files.readString(Path.of(queryFile));

        Reasoner r = ReasonerRegistry.getOWLReasoner();
        ThreadMXBean tmx = ManagementFactory.getThreadMXBean();
        long tp = System.nanoTime();
        DatasetGraph src = load(data);
        long parseNs = System.nanoTime() - tp;

        JsonObject out = new JsonObject();
        out.put("data", data);
        out.put("query", queryFile == null ? "" : queryFile);
        out.put("config", config);
        out.put("instrumented", instrument);
        out.put("parse_ms", JsonNumber.value(parseNs / 1e6));
        out.put("input_quads", src.stream().count());
        out.put("jvm", System.getProperty("java.vm.name") + " " + System.getProperty("java.version"));
        out.put("max_heap_mb", Runtime.getRuntime().maxMemory() / (1024 * 1024));
        out.put("reasoner", r.getClass().getName());
        JsonArray runs = new JsonArray();
        Materialised last = null;
        JsonObject lastQuery = null;
        for (int i = 0; i < warm + reps; i++) {
            System.gc();
            long heapBefore = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
            long gcCount0 = 0, gcTime0 = 0;
            for (GarbageCollectorMXBean g : ManagementFactory.getGarbageCollectorMXBeans()) { gcCount0 += g.getCollectionCount(); gcTime0 += g.getCollectionTime(); }
            long cpu0 = tmx.getCurrentThreadCpuTime();
            long w0 = System.nanoTime();
            Materialised m = switch (config) {
                case "asserted" -> runAsserted(src, r);
                case "flat" -> runFlat(src, r);
                case "ctx" -> runCtx(src, r);
                case "dec" -> runDec(src, r, instrument, timeoutMs);
                default -> throw new IllegalArgumentException("config " + config);
            };
            long matNs = System.nanoTime() - w0;
            long cpuNs = tmx.getCurrentThreadCpuTime() - cpu0;
            long gcCount1 = 0, gcTime1 = 0;
            for (GarbageCollectorMXBean g : ManagementFactory.getGarbageCollectorMXBeans()) { gcCount1 += g.getCollectionCount(); gcTime1 += g.getCollectionTime(); }
            long heapAfter = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
            JsonObject run = new JsonObject();
            run.put("rep", i - warm);
            run.put("warmup", i < warm);
            run.put("materialise_total_ms", JsonNumber.value(matNs / 1e6));
            run.put("cpu_ms", JsonNumber.value(cpuNs / 1e6));
            run.put("gc_count", gcCount1 - gcCount0);
            run.put("gc_ms", gcTime1 - gcTime0);
            run.put("heap_delta_mb", JsonNumber.value((heapAfter - heapBefore) / (1024.0 * 1024.0)));
            JsonObject ph = new JsonObject();
            m.phaseNs.forEach((k, v) -> ph.put(k + "_ms", JsonNumber.value(v / 1e6)));
            run.put("phases", ph);
            JsonObject pw = new JsonObject();
            m.perWorldNs.forEach((k, v) -> pw.put(k, JsonNumber.value(v / 1e6)));
            run.put("per_world_ms", pw);
            if (queryText != null) {
                JsonObject qr = runQuery(queryText, m.view, m);
                run.put("query_first_ms", qr.get("query_first_ms"));
                run.put("query_second_ms", qr.get("query_second_ms"));
                lastQuery = qr;
            }
            runs.add(run);
            last = m;
        }
        out.put("runs", runs);
        out.put("accounting", accounting(last));
        if (lastQuery != null) out.put("query_result", lastQuery);
        List<String> lines = dumpLines(last);
        out.put("materialised_sha256", sha256(lines));
        if (a.containsKey("dump")) Files.write(Path.of(a.get("dump")), lines, StandardCharsets.UTF_8);
        Files.writeString(Path.of(a.get("out")), JSON.toString(out), StandardCharsets.UTF_8);
        System.err.println("OK " + config + " " + new File(data).getName() + " -> " + a.get("out"));
    }
}
