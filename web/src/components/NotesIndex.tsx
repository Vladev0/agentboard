import { useEffect } from "react";
import { useT } from "../i18n.js";
import { useStore } from "../store.js";

const DATE_LOCALES: Record<string, string> = { en: "en-US", es: "es-ES", ru: "ru-RU" };

/**
 * The generated memory index: one row per knowledge note. Nothing here is maintained
 * by hand — it's computed from the note files' frontmatter.
 */
export function NotesIndex() {
  const project = useStore((s) => s.projects.find((p) => p.slug === s.selectedSlug));
  const notes = useStore((s) => s.notes);
  const locale = useStore((s) => s.locale);
  const closeMemory = useStore((s) => s.closeMemory);
  const openNote = useStore((s) => s.openNote);
  const t = useT();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMemory();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMemory]);

  if (!project) return null;
  const loading = notes === null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-150 px-5 py-2.5 dark:border-neutral-800">
        <nav className="flex min-w-0 items-center gap-1.5 text-[12px] text-neutral-400">
          <button
            onClick={closeMemory}
            title={t.backToBoardTooltip}
            className="max-w-[200px] shrink-0 truncate rounded px-1 py-0.5 font-medium hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            {project.name}
          </button>
          <span className="shrink-0 text-neutral-300 dark:text-neutral-700">/</span>
          <span className="shrink-0 font-medium text-neutral-600 dark:text-neutral-200">{t.memoryTitle}</span>
        </nav>
        <button
          onClick={closeMemory}
          title={t.backToBoardTooltip}
          className="rounded px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-[780px]">
          <h1 className="mb-1 text-[24px] font-semibold leading-tight tracking-[-0.01em]">{t.memoryTitle}</h1>
          <p className="mb-6 text-[12px] text-neutral-400">
            {t.memoryHint}
            {notes && notes.length > 0 ? ` · ${t.noteCount(notes.length)}` : ""}
          </p>

          {loading ? (
            <p className="text-[12px] text-neutral-300">…</p>
          ) : notes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-[13.5px] leading-relaxed text-neutral-400 dark:border-neutral-800">
              {t.memoryEmptyText}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNote(n.id)}
                  className="group flex flex-col gap-0.5 rounded-md border border-transparent px-3 py-2.5 text-left hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-medium text-neutral-800 dark:text-neutral-100">
                      {n.title}
                    </span>
                    <span className="rounded bg-accent/10 px-1 py-0.5 text-[10.5px] font-medium text-accent">
                      [[{n.id}]]
                    </span>
                  </div>
                  {n.hook && (
                    <span className="truncate text-[12.5px] text-neutral-500 dark:text-neutral-400">{n.hook}</span>
                  )}
                  <span className="text-[11px] text-neutral-400">
                    v{n.version} ·{" "}
                    {new Date(n.updated).toLocaleDateString(DATE_LOCALES[locale] ?? "en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                    {n.sources.length > 0 ? ` · ${n.sources.join(", ")}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
