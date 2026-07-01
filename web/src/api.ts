import type { Priority, Project, Task, TaskSummary } from "./types.js";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),

  createProject: (name: string, key?: string) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name, key }) }),

  listTasks: (slug: string) => request<TaskSummary[]>(`/api/projects/${slug}/tasks`),

  getTask: (slug: string, id: string) => request<Task>(`/api/projects/${slug}/tasks/${id}`),

  createTask: (
    slug: string,
    input: {
      title: string;
      description?: string;
      parent?: string | null;
      priority?: Priority;
      labels?: string[];
    }
  ) => request<Task>(`/api/projects/${slug}/tasks`, { method: "POST", body: JSON.stringify(input) }),

  createSubtask: (slug: string, parentId: string, input: { title: string; description?: string }) =>
    request<Task>(`/api/projects/${slug}/tasks/${parentId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  setStatus: (slug: string, id: string, status: string, author = "human") =>
    request<Task>(`/api/projects/${slug}/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, author }),
    }),

  setDescription: (slug: string, id: string, description: string, summary: string, author = "human") =>
    request<Task>(`/api/projects/${slug}/tasks/${id}/description`, {
      method: "PATCH",
      body: JSON.stringify({ description, summary, author }),
    }),

  patchTask: (
    slug: string,
    id: string,
    patch: Partial<{ title: string; priority: Priority; labels: string[]; order: number }>
  ) =>
    request<Task>(`/api/projects/${slug}/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  addComment: (slug: string, id: string, text: string, author = "human") =>
    request<Task>(`/api/projects/${slug}/tasks/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text, author }),
    }),

  deleteTask: async (slug: string, id: string): Promise<void> => {
    const res = await fetch(`/api/projects/${slug}/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DELETE /api/projects/${slug}/tasks/${id} failed: ${res.status} ${body}`);
    }
  },
};
