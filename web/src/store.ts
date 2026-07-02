import { create } from "zustand";
import { api } from "./api.js";
import type { Locale, Project, Task, TaskSummary, VaultChangeEvent } from "./types.js";

function detectDefaultLocale(): Locale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("es")) return "es";
  return "en";
}

/** How many tasks, across all projects, are flagged as waiting on a human. */
export function needsAttentionCount(projects: Project[]): number {
  return projects.reduce((sum, p) => sum + p.blockedCount, 0);
}

/** Per-project version of the same count, for a dot next to each project row. */
export function projectNeedsAttentionCount(project: Project): number {
  return project.blockedCount;
}

interface State {
  projects: Project[];
  selectedSlug: string | null;
  tasksBySlug: Record<string, TaskSummary[]>;
  selectedTaskId: string | null;
  selectedTask: Task | null;
  sidebarCollapsed: boolean;
  loadingTasks: boolean;
  locale: Locale;
  /** Set when the API is unreachable — distinct from "no projects exist yet" in the UI. */
  apiError: string | null;

  init: () => Promise<void>;
  selectProject: (slug: string) => Promise<void>;
  reloadTasks: (slug: string) => Promise<void>;
  reloadProjects: () => Promise<void>;
  openTask: (id: string) => Promise<void>;
  closeTask: () => void;
  toggleSidebar: () => void;
  setLocale: (locale: Locale) => void;
  onVaultEvent: (event: VaultChangeEvent) => void;

  createProject: (name: string, key?: string) => Promise<void>;
  deleteProject: (slug: string) => Promise<void>;
  createTask: (title: string, description?: string, priority?: Task["priority"]) => Promise<void>;
  createSubtask: (parentId: string, title: string) => Promise<void>;
  setStatus: (id: string, status: string) => Promise<void>;
  setBlocked: (id: string, blocked: boolean) => Promise<void>;
  setDescription: (id: string, description: string, summary: string) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

const SIDEBAR_KEY = "agentboard.sidebarCollapsed";
const LOCALE_KEY = "agentboard.locale";

function loadStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY);
  return stored === "en" || stored === "es" || stored === "ru" ? stored : detectDefaultLocale();
}

export const useStore = create<State>((set, get) => ({
  projects: [],
  selectedSlug: null,
  tasksBySlug: {},
  selectedTaskId: null,
  selectedTask: null,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === "1",
  loadingTasks: false,
  locale: loadStoredLocale(),
  apiError: null,

  init: async () => {
    try {
      const projects = await api.listProjects();
      set({ projects, apiError: null });
      if (projects[0] && !get().selectedSlug) {
        await get().selectProject(projects[0].slug);
      }
    } catch (err) {
      set({ apiError: err instanceof Error ? err.message : String(err) });
    }
  },

  selectProject: async (slug) => {
    set({ selectedSlug: slug, selectedTaskId: null, selectedTask: null });
    await get().reloadTasks(slug);
  },

  reloadTasks: async (slug) => {
    set({ loadingTasks: true });
    const tasks = await api.listTasks(slug);
    set((s) => ({ tasksBySlug: { ...s.tasksBySlug, [slug]: tasks }, loadingTasks: false }));
  },

  reloadProjects: async () => {
    try {
      const projects = await api.listProjects();
      set({ projects, apiError: null });
    } catch (err) {
      set({ apiError: err instanceof Error ? err.message : String(err) });
    }
  },

  openTask: async (id) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    set({ selectedTaskId: id });
    const task = await api.getTask(slug, id);
    set({ selectedTask: task });
  },

  closeTask: () => set({ selectedTaskId: null, selectedTask: null }),

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return { sidebarCollapsed: next };
    }),

  setLocale: (locale) => {
    localStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },

  onVaultEvent: (event) => {
    const { selectedSlug, selectedTaskId } = get();
    if (event.slug === selectedSlug) {
      get().reloadTasks(event.slug);
      if (selectedTaskId) get().openTask(selectedTaskId);
    }
    get().reloadProjects();
  },

  createProject: async (name, key) => {
    const project = await api.createProject(name, key);
    await get().reloadProjects();
    await get().selectProject(project.slug);
  },

  deleteProject: async (slug) => {
    await api.deleteProject(slug);
    const wasSelected = get().selectedSlug === slug;
    set((s) => {
      const tasksBySlug = { ...s.tasksBySlug };
      delete tasksBySlug[slug];
      return { tasksBySlug };
    });
    await get().reloadProjects();
    if (wasSelected) {
      const next = get().projects.find((p) => p.slug !== slug);
      if (next) await get().selectProject(next.slug);
      else set({ selectedSlug: null, selectedTaskId: null, selectedTask: null });
    }
  },

  createTask: async (title, description, priority) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.createTask(slug, { title, description, priority });
    await get().reloadTasks(slug);
    await get().reloadProjects();
  },

  createSubtask: async (parentId, title) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.createSubtask(slug, parentId, { title });
    await get().reloadTasks(slug);
    if (get().selectedTaskId) await get().openTask(get().selectedTaskId!);
  },

  setStatus: async (id, status) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.setStatus(slug, id, status);
    await get().reloadTasks(slug);
    // Reload the open task even if a *subtask* of it changed, so its subtask list stays current.
    if (get().selectedTaskId) await get().openTask(get().selectedTaskId!);
  },

  setBlocked: async (id, blocked) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.setBlocked(slug, id, blocked);
    await get().reloadTasks(slug);
    await get().reloadProjects();
    if (get().selectedTaskId) await get().openTask(get().selectedTaskId!);
  },

  setDescription: async (id, description, summary) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.setDescription(slug, id, description, summary);
    if (get().selectedTaskId === id) await get().openTask(id);
  },

  addComment: async (id, text) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    await api.addComment(slug, id, text);
    if (get().selectedTaskId === id) await get().openTask(id);
  },

  deleteTask: async (id) => {
    const slug = get().selectedSlug;
    if (!slug) return;
    const wasSelected = get().selectedTaskId === id;
    const parentId = wasSelected
      ? (get().selectedTask?.parent ?? null)
      : (get().tasksBySlug[slug]?.find((t) => t.id === id)?.parent ?? null);

    await api.deleteTask(slug, id);
    await get().reloadTasks(slug);
    await get().reloadProjects();

    if (wasSelected) {
      if (parentId) await get().openTask(parentId);
      else get().closeTask();
    } else if (get().selectedTaskId) {
      // A subtask of the currently open task was removed — refresh its subtask list.
      await get().openTask(get().selectedTaskId!);
    }
  },
}));
