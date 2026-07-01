import { useState } from "react";
import { LOCALES, LOCALE_NAMES, useT } from "../i18n.js";
import { useStore } from "../store.js";
import { NewProjectModal } from "./NewProjectModal.js";

export function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);
  const projects = useStore((s) => s.projects);
  const selectedSlug = useStore((s) => s.selectedSlug);
  const selectProject = useStore((s) => s.selectProject);
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const [showNewProject, setShowNewProject] = useState(false);
  const t = useT();

  return (
    <div
      className={`flex h-full shrink-0 flex-col border-r border-neutral-150 bg-neutral-50/60 transition-[width] duration-150 dark:border-neutral-800 dark:bg-neutral-900/40 ${
        collapsed ? "w-[52px]" : "w-[236px]"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3">
        {!collapsed && <span className="text-[13px] font-semibold tracking-tight">AgentBoard</span>}
        <button
          onClick={toggle}
          title={collapsed ? t.expandPanel : t.collapsePanel}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-800"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5">
        {projects.map((project) => {
          const active = project.slug === selectedSlug;
          return (
            <button
              key={project.slug}
              onClick={() => selectProject(project.slug)}
              title={project.name}
              className={`group mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                  active ? "bg-accent text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                }`}
              >
                {project.key.slice(0, 2)}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="text-[11px] text-neutral-400">{project.taskCount}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-neutral-150 p-1.5 dark:border-neutral-800">
        <button
          onClick={() => setShowNewProject(true)}
          title={t.newProject}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px] leading-none">+</span>
          {!collapsed && <span>{t.newProject}</span>}
        </button>

        {!collapsed && (
          <div className="mt-1.5 flex gap-1 px-2">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                title={LOCALE_NAMES[l]}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  l === locale
                    ? "bg-accent/10 text-accent"
                    : "text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}
