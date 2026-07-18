import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useRef } from "react";
import { useT } from "../i18n.js";
import { useStore } from "../store.js";

marked.setOptions({ gfm: true, breaks: true });

// [[note-id]] and [[note-id|shown text]] — the standard wikilink subset. The tokenizer
// runs at the inline level, so links inside code spans/fences are never picked up.
marked.use({
  extensions: [
    {
      name: "wikilink",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("[[");
        return i < 0 ? undefined : i;
      },
      tokenizer(src: string) {
        const m = /^\[\[([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]\n]+))?\]\]/.exec(src);
        if (!m) return undefined;
        return { type: "wikilink", raw: m[0], id: m[1], label: m[2] ?? m[1] };
      },
      renderer(token) {
        const label = String(token.label).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<a href="#" data-note="${token.id}" class="wikilink">${label}</a>`;
      },
    },
  ],
});

// Task content is written by agents and other people's tooling — sanitize even
// though the app is local, so a stray <script> in a vault file can't run here.
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const openNote = useStore((s) => s.openNote);
  const notes = useStore((s) => s.notes);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(text, { async: false })),
    [text]
  );

  // Mark links whose target note doesn't exist (muted, non-navigating) — a broken
  // link is a state, not an error.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const known = new Set((notes ?? []).map((n) => n.id));
    root.querySelectorAll<HTMLAnchorElement>("a[data-note]").forEach((a) => {
      const exists = known.has(a.dataset.note ?? "");
      a.classList.toggle("wikilink-broken", !exists);
      a.title = exists ? `[[${a.dataset.note}]]` : t.brokenNoteTooltip;
    });
  }, [html, notes, t]);

  return (
    <div
      ref={ref}
      className={`md-prose ${className}`}
      onClick={(e) => {
        const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-note]");
        if (!link) return;
        e.preventDefault();
        if (!link.classList.contains("wikilink-broken") && link.dataset.note) {
          openNote(link.dataset.note);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
