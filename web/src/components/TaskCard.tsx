import { PRIORITY_DOT_CLASSES } from "../colors.js";
import { useT } from "../i18n.js";
import { useStore } from "../store.js";
import type { TaskSummary } from "../types.js";

export function TaskCard({ task }: { task: TaskSummary }) {
  const openTask = useStore((s) => s.openTask);
  const t = useT();

  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/agentboard-task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => openTask(task.id)}
      className={`mb-2 flex w-full cursor-grab flex-col gap-1.5 rounded-md border bg-white px-2.5 py-2 text-left shadow-sm hover:border-neutral-300 active:cursor-grabbing dark:bg-neutral-900 dark:hover:border-neutral-700 ${
        task.blocked
          ? "border-neutral-150 border-l-2 border-l-red-500 dark:border-neutral-800 dark:border-l-red-500"
          : "border-neutral-150 dark:border-neutral-800"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT_CLASSES[task.priority]}`} />
        <span>{task.id}</span>
        {task.blocked && (
          <span title={t.needsInputFlag} className="text-[10px]">
            🚩
          </span>
        )}
      </div>
      <div className="text-[13px] leading-snug text-neutral-800 dark:text-neutral-100">{task.title}</div>
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        {task.labels.map((label) => (
          <span
            key={label}
            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          >
            {label}
          </span>
        ))}
        {task.subtaskProgress.total > 0 && (
          <span className="ml-auto text-[11px] text-neutral-400">
            {task.subtaskProgress.done}/{task.subtaskProgress.total}
          </span>
        )}
      </div>
    </button>
  );
}
