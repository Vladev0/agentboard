import { useState } from "react";
import { STATUS_DOT_CLASSES } from "../colors.js";
import { useStore } from "../store.js";
import { NewTaskModal } from "./NewTaskModal.js";
import { TaskCard } from "./TaskCard.js";

export function Board() {
  const project = useStore((s) => s.projects.find((p) => p.slug === s.selectedSlug));
  const tasks = useStore((s) => (s.selectedSlug ? s.tasksBySlug[s.selectedSlug] ?? [] : []));
  const setStatus = useStore((s) => s.setStatus);
  const [showNewTask, setShowNewTask] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-[13px] text-neutral-400">
        Нет ни одного проекта. Создайте первый в левой панели.
      </div>
    );
  }

  const topLevel = tasks.filter((t) => !t.parent);

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-150 px-5 py-3 dark:border-neutral-800">
        <div>
          <h1 className="text-[14px] font-semibold">{project.name}</h1>
          <p className="text-[12px] text-neutral-400">{project.taskCount} задач</p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover"
        >
          + Задача
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto px-5 py-4">
        {project.statuses.map((status) => {
          const columnTasks = topLevel.filter((t) => t.status === status.id);
          const isDragOver = dragOverStatus === status.id;
          return (
            <div
              key={status.id}
              className="flex w-[272px] shrink-0 flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(status.id);
              }}
              onDragLeave={() => setDragOverStatus((s) => (s === status.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                const id = e.dataTransfer.getData("text/agentboard-task-id");
                if (id) setStatus(id, status.id);
              }}
            >
              <div className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-medium text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[status.color] ?? "bg-neutral-400"}`} />
                <span>{status.name}</span>
                <span className="text-neutral-400">{columnTasks.length}</span>
              </div>
              <div
                className={`flex-1 overflow-y-auto rounded-md transition-colors ${
                  isDragOver ? "bg-accent/5 ring-1 ring-inset ring-accent/30" : ""
                }`}
              >
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {columnTasks.length === 0 && (
                  <div className="rounded-md border border-dashed border-neutral-200 px-2.5 py-4 text-center text-[12px] text-neutral-300 dark:border-neutral-800">
                    Пусто
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
    </div>
  );
}
