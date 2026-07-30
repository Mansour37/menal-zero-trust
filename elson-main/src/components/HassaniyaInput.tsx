"use client";

/**
 * Hassaniya input field with writing assistance ("Hassaniya Grammarly"):
 *  - underlines in red the words not in the validated lexicon (overlay aligned on the textarea)
 *  - autocompletion of the current word (known words, by frequency)
 *  - clickable correction suggestions (edit distance ≤ 2)
 * The lexicon = words already used by the community (loaded once, cached).
 * Controlled: value + onChange (validation stays with the parent).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { getHassaniyaLexicon } from "@/lib/api";

const TASH = /[ً-ْٰـ]/g;          // tashkeel + tatweel
const reArab = /[؀-ۿݐ-ݿ]/;
const norm = (s: string) => s.replace(TASH, "");
const isArab = (w: string) => reArab.test(w);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function lev(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length; let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1; prev = cur;
  }
  return prev[n];
}

// styles shared EXACTLY between backdrop and textarea (perfect alignment)
const shared: React.CSSProperties = {
  fontFamily: "'Cairo', sans-serif", fontSize: "1.05rem", lineHeight: 1.9, direction: "rtl",
  textAlign: "right", padding: "14px 16px", whiteSpace: "pre-wrap", wordWrap: "break-word",
  letterSpacing: 0, margin: 0, border: 0, width: "100%", boxSizing: "border-box",
};

export function HassaniyaInput({ value, onChange, placeholder, minHeight = 100 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<number | null>(null);
  const [lex, setLex] = useState<{ set: Set<string>; words: [string, number][] }>({ set: new Set(), words: [] });
  const [acWord, setAcWord] = useState("");
  const [pop, setPop] = useState<{ word: string; top: number; left: number } | null>(null);

  useEffect(() => { getHassaniyaLexicon().then((words) => setLex({ set: new Set(words.map((w) => w[0])), words })); }, []);

  // Reposition the caret after a controlled change (replacement / autocompletion).
  useEffect(() => { if (caretRef.current != null && taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(caretRef.current, caretRef.current); caretRef.current = null; } }, [value]);

  const known = (w: string) => lex.set.size === 0 || lex.set.has(norm(w)); // no lexicon → underline nothing
  const tokens = (t: string) => t.split(/(\s+|[^؀-ۿ\s]+)/).filter((x) => x !== undefined && x !== "");

  // Backdrop: unknown words wrapped in <mark>.
  const html = useMemo(() => {
    if (lex.set.size === 0) return esc(value) + "\n";
    let h = "";
    for (const tk of tokens(value)) h += (isArab(tk) && !known(tk)) ? `<mark data-w="${esc(tk)}">${esc(tk)}</mark>` : esc(tk);
    return h + "\n";
  }, [value, lex]);

  // Suggestions for a word (edit distance ≤ 2, sorted by frequency).
  const suggest = (w: string) => {
    const nw = norm(w);
    return lex.words.map(([k, f]) => ({ k, d: lev(nw, k, 2), f })).filter((x) => x.d > 0 && x.d <= 2).sort((a, b) => a.d - b.d || b.f - a.f).slice(0, 4).map((x) => x.k);
  };

  const acList = useMemo(() => {
    const p = norm(acWord); if (!p || p.length < 2 || lex.words.length === 0) return [];
    return lex.words.filter(([k]) => k.startsWith(p) && k !== p).slice(0, 6).map(([k]) => k);
  }, [acWord, lex]);

  const updateAc = () => {
    const ta = taRef.current; if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart ?? 0);
    const m = before.match(/[؀-ۿ]+$/);
    setAcWord(m ? m[0] : "");
  };

  const replaceWord = (from: string, to: string) => {
    const re = new RegExp(`(^|[^\\u0600-\\u06FF])(${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})($|[^\\u0600-\\u06FF])`, "g");
    onChange(value.replace(re, (_m, a, _w, b) => a + to + b));
  };
  const pickAc = (w: string) => {
    const ta = taRef.current; if (!ta) return;
    const pos = ta.selectionStart ?? value.length;
    const before = value.slice(0, pos).replace(/[؀-ۿ]+$/, w);
    const after = value.slice(pos).replace(/^\s+/, "");
    caretRef.current = before.length + 1;
    onChange(before + " " + after);
    setAcWord("");
  };
  const ignoreWord = (w: string) => setLex((l) => ({ set: new Set([...l.set, norm(w)]), words: l.words }));

  // Click on an underlined word → suggestions popover anchored to it (Grammarly style).
  const onContainerClick = (e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.tagName === "MARK") {
      const w = tgt.getAttribute("data-w") || "";
      const cont = containerRef.current; if (!cont) return;
      const r = tgt.getBoundingClientRect(); const cr = cont.getBoundingClientRect();
      setPop({ word: w, top: r.bottom - cr.top + 6, left: Math.max(6, Math.min(r.left - cr.left, cr.width - 236)) });
    } else { setPop(null); }
  };

  return (
    <div>
      <div ref={containerRef} onClick={onContainerClick} style={{ position: "relative", borderRadius: 14, background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <style>{`.hsa-backdrop{pointer-events:none}.hsa-backdrop mark{pointer-events:auto;cursor:pointer;background:transparent;color:transparent;text-decoration:underline;text-decoration-style:wavy;text-decoration-color:var(--danger);text-decoration-thickness:2px;text-underline-offset:3px;}`}</style>
        <div aria-hidden className="hsa-backdrop" style={{ ...shared, position: "absolute", inset: 0, color: "transparent", overflow: "hidden", zIndex: 2 }}
          dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={taRef} dir="rtl" placeholder={placeholder} value={value} spellCheck={false}
          onChange={(e) => { onChange(e.target.value); updateAc(); }}
          onClick={updateAc} onKeyUp={updateAc}
          onScroll={(e) => { const b = e.currentTarget.previousElementSibling as HTMLElement; if (b) { b.scrollTop = e.currentTarget.scrollTop; b.scrollLeft = e.currentTarget.scrollLeft; } }}
          style={{ ...shared, position: "relative", background: "transparent", color: "var(--text-primary)", outline: "none", resize: "vertical", minHeight, caretColor: "var(--accent-green)" }}
        />

        {/* Suggestions popover anchored to the word (Grammarly style) */}
        {pop && (() => {
          const sugs = suggest(pop.word);
          return (
            <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: pop.top, insetInlineStart: pop.left, zIndex: 30, minWidth: 168, maxWidth: 240, background: "var(--bg-card, var(--surface-2))", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 14px 38px rgba(0,0,0,.5)", padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.6rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
                <span>Suggestions</span>
                <button type="button" onClick={() => setPop(null)} style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", lineHeight: 1 }}>✕</button>
              </div>
              {sugs.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sugs.map((s) => (
                    <button key={s} type="button" onClick={() => { replaceWord(pop.word, s); setPop(null); }} style={{ fontFamily: "'Cairo',sans-serif", fontSize: "1.05rem", fontWeight: 700, textAlign: "right", direction: "rtl", padding: "8px 11px", borderRadius: 9, border: "none", cursor: "pointer", background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>{s}</button>
                  ))}
                </div>
              ) : <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontStyle: "italic", padding: "2px 2px 6px" }}>Aucune suggestion proche.</div>}
              <button type="button" onClick={() => { ignoreWord(pop.word); setPop(null); }} style={{ marginTop: 6, width: "100%", fontSize: "0.68rem", fontWeight: 700, padding: "6px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>Ignorer ce mot</button>
            </div>
          );
        })()}
      </div>

      {/* Autocompletion (current word) */}
      {acList.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>⌨︎</span>
          {acList.map((w) => (
            <button key={w} type="button" onClick={() => pickAc(w)} style={acBtn}>{w}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const acBtn: React.CSSProperties = { fontFamily: "'Cairo',sans-serif", fontSize: "0.92rem", fontWeight: 600, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--accent-green)" };
