import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createProject, listProjects } from "../core/project.js";
import {
  addComment,
  createSubtask,
  createTask,
  deleteTask,
  getNextTask,
  listTasks,
  readTask,
  updateDescription,
  updateFields,
  updateStatus,
} from "../core/task.js";

const priority = z.enum(["low", "medium", "high", "urgent"]);

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function registerTools(server: McpServer, vaultRoot: string): void {
  server.tool(
    "list_projects",
    "Список всех проектов в vault со счётчиками задач по статусам. Не возвращает сами задачи — используйте list_tasks для этого.",
    {},
    async () => {
      const projects = listProjects(vaultRoot).map((p) => {
        const tasks = listTasks(vaultRoot, p.slug);
        const counts: Record<string, number> = {};
        for (const s of p.statuses) counts[s.id] = 0;
        for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
        return { ...p, taskCount: tasks.length, counts };
      });
      return text(projects);
    }
  );

  server.tool(
    "create_project",
    "Создать новый проект в vault. key — короткий префикс для ID задач (например WEB), генерируется из названия если не указан.",
    { name: z.string(), key: z.string().optional() },
    async ({ name, key }) => text(createProject(vaultRoot, name, { key }))
  );

  server.tool(
    "list_tasks",
    "Лёгкий список задач проекта (без описаний/истории/комментариев) — экономит контекст. Для деталей используйте get_task.",
    { project: z.string() },
    async ({ project }) => text(listTasks(vaultRoot, project))
  );

  server.tool(
    "get_task",
    "Полная карточка одной задачи: описание, версии-апдейты (эволюция сути задачи), комментарии, техническая активность, подзадачи. Запрашивайте только когда нужны детали конкретной задачи.",
    { project: z.string(), id: z.string() },
    async ({ project, id }) => text(readTask(vaultRoot, project, id))
  );

  server.tool(
    "get_next_task",
    "Рекомендует следующую задачу для работы: не заблокированную, не в терминальном статусе, с наименьшим order. Используйте это вместо ручного перебора всех задач, чтобы не терять план и не тратить лишний контекст.",
    { project: z.string(), parent: z.string().nullable().optional() },
    async ({ project, parent }) => text(getNextTask(vaultRoot, project, parent ?? null))
  );

  server.tool(
    "create_task",
    "Создать новую задачу верхнего уровня в проекте.",
    {
      project: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
    },
    async ({ project, ...input }) => text(createTask(vaultRoot, project, { ...input, author: "agent" }))
  );

  server.tool(
    "create_subtask",
    "Создать подзадачу внутри существующей задачи (для декомпозиции плана без потери контекста).",
    {
      project: z.string(),
      parentId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
    },
    async ({ project, parentId, ...input }) =>
      text(createSubtask(vaultRoot, project, parentId, { ...input, author: "agent" }))
  );

  server.tool(
    "update_status",
    "Изменить статус задачи. Это рутинное событие — попадает в техническую активность задачи, не в её версии-апдейты.",
    { project: z.string(), id: z.string(), status: z.string() },
    async ({ project, id, status }) => text(updateStatus(vaultRoot, project, id, status, "agent"))
  );

  server.tool(
    "update_task",
    "Изменить поля существующей задачи (заголовок, приоритет, метки, порядок, блокировки, исполнителя) без смены статуса и без создания апдейта — это тоже рутинное событие, попадает в техническую активность. Передавайте только те поля, которые меняете.",
    {
      project: z.string(),
      id: z.string(),
      title: z.string().optional(),
      priority: priority.optional(),
      labels: z.array(z.string()).optional(),
      order: z.number().optional(),
      blockedBy: z.array(z.string()).optional(),
      assignee: z.enum(["agent", "human"]).optional(),
    },
    async ({ project, id, ...patch }) => text(updateFields(vaultRoot, project, id, patch, "agent"))
  );

  server.tool(
    "update_description",
    "Зафиксировать 'большой апдейт' задачи: перепишите описание после того, как в комментариях/по ходу работы созрело решение, что нужно поменять. summary — обязательное краткое резюме, ЧТО и ПОЧЕМУ изменилось (как commit message). Каждый вызов создаёт новую версию с полным снимком описания — так строится история эволюции сути задачи, которую видно в UI. Не используйте это для мелких правок или обсуждения — для этого есть add_comment.",
    { project: z.string(), id: z.string(), description: z.string(), summary: z.string() },
    async ({ project, id, description, summary }) =>
      text(updateDescription(vaultRoot, project, id, description, summary, "agent"))
  );

  server.tool(
    "add_comment",
    "Оставить комментарий в задаче — обсуждение, уточняющий вопрос человеку, промежуточная реплика по ходу работы. Для реального изменения сути задачи (описания) после того как обсуждение к чему-то привело — используйте update_description, а не это.",
    { project: z.string(), id: z.string(), text: z.string() },
    async ({ project, id, text: body }) => text(addComment(vaultRoot, project, id, body, "agent"))
  );

  server.tool(
    "delete_task",
    "Полностью удалить задачу (файл и вся её история) — например, если завели дубликат или подзадача больше не нужна. Каскадно удаляет и все её подзадачи. Необратимо — не для смены статуса, для этого есть update_status.",
    { project: z.string(), id: z.string() },
    async ({ project, id }) => {
      deleteTask(vaultRoot, project, id);
      return text({ deleted: id });
    }
  );
}
