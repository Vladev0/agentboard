import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ gfm: true, breaks: true });

// Task content is written by agents and other people's tooling — sanitize even
// though the app is local, so a stray <script> in a vault file can't run here.
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(text, { async: false })),
    [text]
  );
  return <div className={`md-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
