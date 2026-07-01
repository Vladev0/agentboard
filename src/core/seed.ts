import { createProject } from "./project.js";
import { createTask, createSubtask, updateStatus, addComment } from "./task.js";
import { getVaultRoot } from "./vault.js";

function seed(): void {
  const vaultRoot = getVaultRoot();
  const project = createProject(vaultRoot, "AgentBoard Demo", { key: "DEMO" });

  const t1 = createTask(vaultRoot, project.slug, {
    title: "Настроить структуру vault",
    description: "Создать core-модуль: парсинг frontmatter, атомарная запись, генерация ID.",
    priority: "high",
  });
  updateStatus(vaultRoot, project.slug, t1.id, "done");
  addComment(vaultRoot, project.slug, t1.id, "Отличная работа, едем дальше.", "human");

  const t2 = createTask(vaultRoot, project.slug, {
    title: "Собрать REST API и live-обновления",
    description: "Fastify + watcher + WebSocket.",
    priority: "high",
    order: 20,
  });
  updateStatus(vaultRoot, project.slug, t2.id, "in_progress");

  createSubtask(vaultRoot, project.slug, t2.id, {
    title: "Роуты проектов",
    order: 21,
  });
  createSubtask(vaultRoot, project.slug, t2.id, {
    title: "Роуты задач",
    order: 22,
  });

  createTask(vaultRoot, project.slug, {
    title: "Собрать фронтенд (Kanban + детали задачи)",
    description: "React + Vite + Tailwind, слева проекты, справа доска.",
    priority: "medium",
    order: 30,
  });

  console.log(`Seeded project "${project.name}" (${project.slug}) at ${vaultRoot}`);
}

seed();
