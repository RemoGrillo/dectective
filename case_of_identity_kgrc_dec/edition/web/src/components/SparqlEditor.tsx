// CodeMirror 6 editor with the SPARQL legacy mode; Ctrl/Cmd+Enter runs the query.
import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { tags as t } from "@lezer/highlight";

const deco = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword], color: "var(--red)", fontWeight: "600" },
  { tag: [t.variableName], color: "var(--ink)", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "var(--grey)" },
  { tag: [t.comment], color: "var(--grey)", fontStyle: "italic" },
  { tag: [t.atom, t.url, t.link], color: "var(--ink)", textDecoration: "underline" },
]);

export function SparqlEditor({ value, onChange, onRun, label = "SPARQL query" }: { value: string; onChange: (v: string) => void; onRun: () => void; label?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const runRef = useRef(onRun);
  const changeRef = useRef(onChange);
  runRef.current = onRun;
  changeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), history(), bracketMatching(),
          StreamLanguage.define(sparql), syntaxHighlighting(deco),
          keymap.of([{ key: "Mod-Enter", run: () => { runRef.current(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => { if (u.docChanged) changeRef.current(u.state.doc.toString()); }),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.lineWrapping,
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div className="editor" ref={host} />;
}
