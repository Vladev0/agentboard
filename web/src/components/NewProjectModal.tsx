import { useState } from "react";
import { useT } from "../i18n.js";
import { useStore } from "../store.js";
import { Modal } from "./Modal.js";

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const createProject = useStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function submit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createProject(name.trim(), key.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t.newProjectModalTitle} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          placeholder={t.projectNamePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
        />
        <input
          placeholder={t.projectKeyPlaceholder}
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
        />
        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400">
            {t.genericErrorPrefix} {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className="mt-1 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {t.createProjectButton}
        </button>
      </div>
    </Modal>
  );
}
