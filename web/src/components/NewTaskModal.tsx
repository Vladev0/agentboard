import { useState } from "react";
import { priorityLabels, useT } from "../i18n.js";
import { useStore } from "../store.js";
import type { Priority } from "../types.js";
import { Modal } from "./Modal.js";

export function NewTaskModal({ onClose }: { onClose: () => void }) {
  const createTask = useStore((s) => s.createTask);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const labels = priorityLabels(t);

  async function submit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTask(title.trim(), description.trim() || undefined, priority);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t.newTaskModalTitle} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          placeholder={t.taskNamePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
        />
        <textarea
          placeholder={t.taskDescPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-md border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-accent dark:border-neutral-700"
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400">
            {t.genericErrorPrefix} {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={!title.trim() || submitting}
          className="mt-1 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {t.createTaskButton}
        </button>
      </div>
    </Modal>
  );
}
