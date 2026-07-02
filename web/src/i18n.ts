import { useStore } from "./store.js";
import type { Locale, Priority } from "./types.js";

export const LOCALES: Locale[] = ["en", "es", "ru"];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ru: "Русский",
};

export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

interface Dictionary {
  expandPanel: string;
  collapsePanel: string;
  newProject: string;
  deleteProjectTooltip: string;
  confirmDeleteProject: (name: string) => string;
  needsAttentionTooltip: (n: number) => string;
  noProjectsYet: string;
  connectionErrorTitle: string;
  connectionErrorBody: string;
  retryButton: string;
  genericErrorPrefix: string;
  taskCount: (n: number) => string;
  newTaskButton: string;
  emptyColumn: string;

  newProjectModalTitle: string;
  projectNamePlaceholder: string;
  projectKeyPlaceholder: string;
  createProjectButton: string;

  newTaskModalTitle: string;
  taskNamePlaceholder: string;
  taskDescPlaceholder: string;
  createTaskButton: string;

  priorityLow: string;
  priorityMedium: string;
  priorityHigh: string;
  priorityUrgent: string;

  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
  sinceLastUpdate: (comments: number, actions: number) => string | null;

  confirmDeleteSubtask: (title: string) => string;
  confirmDeleteTask: (title: string, isSubtask: boolean, subtaskCount: number) => string;

  backToParentTitle: string;
  subtaskBadge: string;
  deleteTaskTooltip: string;
  closeTooltip: string;
  maximizeTooltip: string;
  restoreSizeTooltip: string;
  needsInputFlag: string;
  markNeedsInputButton: string;
  markNeedsInputTooltip: string;
  unmarkNeedsInputTooltip: string;

  roleAgent: string;
  roleHuman: string;
  roleYou: string;

  updatedAgo: (relative: string, role: string, version: number) => string;
  tabOverview: string;
  tabUpdates: (n: number) => string;

  descriptionPlaceholder: string;
  summaryPlaceholder: string;
  saveAsUpdateButton: string;
  cancelButton: string;

  subtasksHeading: (done: number, total: number) => string;
  deleteSubtaskTooltip: string;
  addSubtaskPlaceholder: string;

  commentsHeading: string;
  noCommentsYet: string;

  versionSnapshotLabel: string;
  emptyPlaceholder: string;
  activityHeading: (n: number) => string;
  noActivityYet: string;

  commentInputPlaceholder: string;
  sendButton: string;

  // Translated labels for the built-in default statuses only — a custom status a human
  // typed themselves (e.g. "Waiting on legal") is project data, not app chrome, and can't
  // be auto-translated. Keyed by the status `id` from DEFAULT_STATUSES.
  statusLabels: Record<string, string>;
}

const en: Dictionary = {
  expandPanel: "Expand panel",
  collapsePanel: "Collapse panel",
  newProject: "New project",
  deleteProjectTooltip: "Delete project",
  confirmDeleteProject: (name) => `Delete project "${name}" and all its tasks permanently?`,
  needsAttentionTooltip: (n) => `${n} ${n === 1 ? "task needs" : "tasks need"} your input`,
  noProjectsYet: "No projects yet. Create the first one in the left panel.",
  connectionErrorTitle: "Can't reach the server",
  connectionErrorBody: "The API server isn't responding. Check that it's running, then retry.",
  retryButton: "Retry",
  genericErrorPrefix: "Something went wrong:",
  taskCount: (n) => `${n} ${n === 1 ? "task" : "tasks"}`,
  newTaskButton: "+ Task",
  emptyColumn: "Empty",

  newProjectModalTitle: "New project",
  projectNamePlaceholder: "Project name",
  projectKeyPlaceholder: "Prefix (optional, e.g. WEB)",
  createProjectButton: "Create project",

  newTaskModalTitle: "New task",
  taskNamePlaceholder: "Task title",
  taskDescPlaceholder: "Description (optional)",
  createTaskButton: "Create task",

  priorityLow: "Low",
  priorityMedium: "Medium",
  priorityHigh: "High",
  priorityUrgent: "Urgent",

  justNow: "just now",
  minutesAgo: (n) => `${n} ${n === 1 ? "minute" : "minutes"} ago`,
  hoursAgo: (n) => `${n} ${n === 1 ? "hour" : "hours"} ago`,
  daysAgo: (n) => `${n} ${n === 1 ? "day" : "days"} ago`,
  sinceLastUpdate: (comments, actions) => {
    const parts: string[] = [];
    if (comments > 0) parts.push(`${comments} ${comments === 1 ? "comment" : "comments"}`);
    if (actions > 0) parts.push(`${actions} ${actions === 1 ? "action" : "actions"}`);
    return parts.length ? `since last update: ${parts.join(", ")}` : null;
  },

  confirmDeleteSubtask: (title) => `Delete subtask "${title}" permanently?`,
  confirmDeleteTask: (title, isSubtask, subtaskCount) =>
    `Delete ${isSubtask ? "subtask" : "task"} "${title}"${
      subtaskCount > 0 ? ` along with ${subtaskCount} subtask${subtaskCount === 1 ? "" : "s"}` : ""
    } permanently?`,

  backToParentTitle: "Back to parent task",
  subtaskBadge: "Subtask",
  deleteTaskTooltip: "Delete task",
  closeTooltip: "Close",
  maximizeTooltip: "Maximize",
  restoreSizeTooltip: "Restore size",
  needsInputFlag: "Needs input",
  markNeedsInputButton: "Flag for input",
  markNeedsInputTooltip: "Flag as waiting on a human decision",
  unmarkNeedsInputTooltip: "Clear the needs-input flag",

  roleAgent: "agent",
  roleHuman: "human",
  roleYou: "You",

  updatedAgo: (relative, role, version) => `Updated ${relative} · ${role} · v${version}`,
  tabOverview: "Overview",
  tabUpdates: (n) => `Updates (${n})`,

  descriptionPlaceholder: "Describe the task — from a short summary to a full spec…",
  summaryPlaceholder: "Briefly: what changed and why (optional)",
  saveAsUpdateButton: "Save as update",
  cancelButton: "Cancel",

  subtasksHeading: (done, total) => `Subtasks${total > 0 ? ` (${done}/${total})` : ""}`,
  deleteSubtaskTooltip: "Delete subtask",
  addSubtaskPlaceholder: "+ subtask",

  commentsHeading: "Comments",
  noCommentsYet: "No comments yet.",

  versionSnapshotLabel: "Task text at this point:",
  emptyPlaceholder: "(empty)",
  activityHeading: (n) => `Activity (${n})`,
  noActivityYet: "No activity yet.",

  commentInputPlaceholder: "Write a comment…",
  sendButton: "Send",

  statusLabels: {
    backlog: "Backlog",
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    done: "Done",
  },
};

const es: Dictionary = {
  expandPanel: "Expandir panel",
  collapsePanel: "Contraer panel",
  newProject: "Nuevo proyecto",
  deleteProjectTooltip: "Eliminar proyecto",
  confirmDeleteProject: (name) => `¿Eliminar el proyecto «${name}» y todas sus tareas de forma permanente?`,
  needsAttentionTooltip: (n) => `${n} ${n === 1 ? "tarea necesita" : "tareas necesitan"} tu atención`,
  noProjectsYet: "Aún no hay proyectos. Crea el primero en el panel izquierdo.",
  connectionErrorTitle: "No se puede conectar con el servidor",
  connectionErrorBody: "El servidor de la API no responde. Comprueba que esté en ejecución y vuelve a intentarlo.",
  retryButton: "Reintentar",
  genericErrorPrefix: "Algo salió mal:",
  taskCount: (n) => `${n} ${n === 1 ? "tarea" : "tareas"}`,
  newTaskButton: "+ Tarea",
  emptyColumn: "Vacío",

  newProjectModalTitle: "Nuevo proyecto",
  projectNamePlaceholder: "Nombre del proyecto",
  projectKeyPlaceholder: "Prefijo (opcional, ej. WEB)",
  createProjectButton: "Crear proyecto",

  newTaskModalTitle: "Nueva tarea",
  taskNamePlaceholder: "Título de la tarea",
  taskDescPlaceholder: "Descripción (opcional)",
  createTaskButton: "Crear tarea",

  priorityLow: "Baja",
  priorityMedium: "Media",
  priorityHigh: "Alta",
  priorityUrgent: "Urgente",

  justNow: "ahora mismo",
  minutesAgo: (n) => `hace ${n} ${n === 1 ? "minuto" : "minutos"}`,
  hoursAgo: (n) => `hace ${n} ${n === 1 ? "hora" : "horas"}`,
  daysAgo: (n) => `hace ${n} ${n === 1 ? "día" : "días"}`,
  sinceLastUpdate: (comments, actions) => {
    const parts: string[] = [];
    if (comments > 0) parts.push(`${comments} ${comments === 1 ? "comentario" : "comentarios"}`);
    if (actions > 0) parts.push(`${actions} ${actions === 1 ? "acción" : "acciones"}`);
    return parts.length ? `desde el último apdate: ${parts.join(", ")}` : null;
  },

  confirmDeleteSubtask: (title) => `¿Eliminar la subtarea «${title}» de forma permanente?`,
  confirmDeleteTask: (title, isSubtask, subtaskCount) =>
    `¿Eliminar ${isSubtask ? "la subtarea" : "la tarea"} «${title}»${
      subtaskCount > 0 ? ` junto con ${subtaskCount} subtarea${subtaskCount === 1 ? "" : "s"}` : ""
    } de forma permanente?`,

  backToParentTitle: "Volver a la tarea principal",
  subtaskBadge: "Subtarea",
  deleteTaskTooltip: "Eliminar tarea",
  closeTooltip: "Cerrar",
  maximizeTooltip: "Maximizar",
  restoreSizeTooltip: "Restaurar tamaño",
  needsInputFlag: "Necesita respuesta",
  markNeedsInputButton: "Marcar como pendiente",
  markNeedsInputTooltip: "Marcar como a la espera de una decisión humana",
  unmarkNeedsInputTooltip: "Quitar la marca de pendiente",

  roleAgent: "agente",
  roleHuman: "humano",
  roleYou: "Tú",

  updatedAgo: (relative, role, version) => `Actualizado ${relative} · ${role} · v${version}`,
  tabOverview: "Resumen",
  tabUpdates: (n) => `Apdates (${n})`,

  descriptionPlaceholder: "Describe la tarea — desde un resumen breve hasta una especificación completa…",
  summaryPlaceholder: "Breve: qué y por qué cambió (opcional)",
  saveAsUpdateButton: "Guardar como apdate",
  cancelButton: "Cancelar",

  subtasksHeading: (done, total) => `Subtareas${total > 0 ? ` (${done}/${total})` : ""}`,
  deleteSubtaskTooltip: "Eliminar subtarea",
  addSubtaskPlaceholder: "+ subtarea",

  commentsHeading: "Comentarios",
  noCommentsYet: "Aún no hay comentarios.",

  versionSnapshotLabel: "Texto de la tarea en ese momento:",
  emptyPlaceholder: "(vacío)",
  activityHeading: (n) => `Actividad (${n})`,
  noActivityYet: "Aún no hay actividad.",

  commentInputPlaceholder: "Escribe un comentario…",
  sendButton: "Enviar",

  statusLabels: {
    backlog: "Pendientes",
    todo: "Por hacer",
    in_progress: "En curso",
    in_review: "En revisión",
    done: "Hecho",
  },
};

const ru: Dictionary = {
  expandPanel: "Развернуть панель",
  collapsePanel: "Свернуть панель",
  newProject: "Новый проект",
  deleteProjectTooltip: "Удалить проект",
  confirmDeleteProject: (name) => `Удалить проект «${name}» и все его задачи безвозвратно?`,
  needsAttentionTooltip: (n) =>
    `${n} ${ruPlural(n, "задача", "задачи", "задач")} ${n === 1 ? "ждёт" : "ждут"} вашего внимания`,
  noProjectsYet: "Нет ни одного проекта. Создайте первый в левой панели.",
  connectionErrorTitle: "Не удаётся подключиться к серверу",
  connectionErrorBody: "API-сервер не отвечает. Проверьте, что он запущен, и повторите попытку.",
  retryButton: "Повторить",
  genericErrorPrefix: "Что-то пошло не так:",
  taskCount: (n) => `${n} ${ruPlural(n, "задача", "задачи", "задач")}`,
  newTaskButton: "+ Задача",
  emptyColumn: "Пусто",

  newProjectModalTitle: "Новый проект",
  projectNamePlaceholder: "Название проекта",
  projectKeyPlaceholder: "Префикс (опционально, напр. WEB)",
  createProjectButton: "Создать проект",

  newTaskModalTitle: "Новая задача",
  taskNamePlaceholder: "Название задачи",
  taskDescPlaceholder: "Описание (опционально)",
  createTaskButton: "Создать задачу",

  priorityLow: "Низкий",
  priorityMedium: "Средний",
  priorityHigh: "Высокий",
  priorityUrgent: "Срочный",

  justNow: "только что",
  minutesAgo: (n) => `${n} ${ruPlural(n, "минуту", "минуты", "минут")} назад`,
  hoursAgo: (n) => `${n} ${ruPlural(n, "час", "часа", "часов")} назад`,
  daysAgo: (n) => `${n} ${ruPlural(n, "день", "дня", "дней")} назад`,
  sinceLastUpdate: (comments, actions) => {
    const parts: string[] = [];
    if (comments > 0) parts.push(`${comments} ${ruPlural(comments, "комментарий", "комментария", "комментариев")}`);
    if (actions > 0) parts.push(`${actions} ${ruPlural(actions, "действие", "действия", "действий")}`);
    return parts.length ? `с прошлого апдейта: ${parts.join(", ")}` : null;
  },

  confirmDeleteSubtask: (title) => `Удалить подзадачу «${title}» безвозвратно?`,
  confirmDeleteTask: (title, isSubtask, subtaskCount) =>
    `Удалить ${isSubtask ? "подзадачу" : "задачу"} «${title}»${
      subtaskCount > 0 ? ` вместе с ${subtaskCount} ${ruPlural(subtaskCount, "подзадачей", "подзадачами", "подзадачами")}` : ""
    } безвозвратно?`,

  backToParentTitle: "Вернуться к родительской задаче",
  subtaskBadge: "Подзадача",
  deleteTaskTooltip: "Удалить задачу",
  closeTooltip: "Закрыть",
  maximizeTooltip: "Развернуть на весь экран",
  restoreSizeTooltip: "Восстановить размер",
  needsInputFlag: "Нужен ответ",
  markNeedsInputButton: "Отметить, что нужен ответ",
  markNeedsInputTooltip: "Отметить, что задача ждёт решения человека",
  unmarkNeedsInputTooltip: "Снять отметку «нужен ответ»",

  roleAgent: "агент",
  roleHuman: "человек",
  roleYou: "Вы",

  updatedAgo: (relative, role, version) => `Обновлено ${relative} · ${role} · v${version}`,
  tabOverview: "Обзор",
  tabUpdates: (n) => `Апдейты (${n})`,

  descriptionPlaceholder: "Опишите задачу — от короткого резюме до подробной спецификации…",
  summaryPlaceholder: "Коротко: что и почему изменилось (необязательно)",
  saveAsUpdateButton: "Сохранить как апдейт",
  cancelButton: "Отмена",

  subtasksHeading: (done, total) => `Подзадачи${total > 0 ? ` (${done}/${total})` : ""}`,
  deleteSubtaskTooltip: "Удалить подзадачу",
  addSubtaskPlaceholder: "+ подзадача",

  commentsHeading: "Комментарии",
  noCommentsYet: "Пока нет комментариев.",

  versionSnapshotLabel: "Текст задачи на этот момент:",
  emptyPlaceholder: "(пусто)",
  activityHeading: (n) => `Активность (${n})`,
  noActivityYet: "Пока нет активности.",

  commentInputPlaceholder: "Написать комментарий…",
  sendButton: "Отправить",

  statusLabels: {
    backlog: "Бэклог",
    todo: "К выполнению",
    in_progress: "В работе",
    in_review: "На проверке",
    done: "Готово",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, es, ru };

export function useT(): Dictionary {
  const locale = useStore((s) => s.locale);
  return dictionaries[locale];
}

export function priorityLabels(t: Dictionary): Record<Priority, string> {
  return { low: t.priorityLow, medium: t.priorityMedium, high: t.priorityHigh, urgent: t.priorityUrgent };
}

/**
 * Translates a status name if it's one of the built-in defaults (by `id`); falls back to
 * the literal `name` for a custom status a human typed themselves, which is project data
 * and can't be auto-translated.
 */
export function statusLabel(t: Dictionary, status: { id: string; name: string }): string {
  return t.statusLabels[status.id] ?? status.name;
}
