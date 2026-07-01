import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addComment,
  createSubtask,
  createTask,
  deleteTask,
  getNextTask,
  readTask,
  updateDescription,
  updateFields,
  updateStatus,
} from "../../core/task.js";

const priority = z.enum(["low", "medium", "high", "urgent"]);
const assignee = z.enum(["agent", "human"]);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  parent: z.string().nullable().optional(),
  priority: priority.optional(),
  assignee: assignee.optional(),
  labels: z.array(z.string()).optional(),
  order: z.number().optional(),
  blockedBy: z.array(z.string()).optional(),
  author: z.string().optional(),
});

const statusSchema = z.object({ status: z.string().min(1), author: z.string().optional() });
const descriptionSchema = z.object({
  description: z.string(),
  summary: z.string().optional(),
  author: z.string().optional(),
});
const commentSchema = z.object({ text: z.string().min(1), author: z.string().min(1) });
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  priority: priority.optional(),
  labels: z.array(z.string()).optional(),
  order: z.number().optional(),
  blockedBy: z.array(z.string()).optional(),
  assignee: assignee.optional(),
});

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { slug: string } }>("/api/projects/:slug/tasks", async (req) => {
    return app.cache.getTasks(req.params.slug);
  });

  app.get<{ Params: { slug: string }; Querystring: { parent?: string } }>(
    "/api/projects/:slug/tasks/next",
    async (req) => {
      return getNextTask(app.vaultRoot, req.params.slug, req.query.parent ?? null);
    }
  );

  app.get<{ Params: { slug: string; id: string } }>("/api/projects/:slug/tasks/:id", async (req, reply) => {
    try {
      return readTask(app.vaultRoot, req.params.slug, req.params.id);
    } catch {
      reply.code(404).send({ error: "not_found" });
    }
  });

  app.post<{ Params: { slug: string } }>("/api/projects/:slug/tasks", async (req, reply) => {
    const body = createTaskSchema.parse(req.body);
    const task = createTask(app.vaultRoot, req.params.slug, body);
    app.cache.refreshProject(req.params.slug);
    reply.code(201).send(task);
  });

  app.post<{ Params: { slug: string; id: string } }>(
    "/api/projects/:slug/tasks/:id/subtasks",
    async (req, reply) => {
      const body = createTaskSchema.omit({ parent: true }).parse(req.body);
      const task = createSubtask(app.vaultRoot, req.params.slug, req.params.id, body);
      app.cache.refreshProject(req.params.slug);
      reply.code(201).send(task);
    }
  );

  app.patch<{ Params: { slug: string; id: string } }>(
    "/api/projects/:slug/tasks/:id/status",
    async (req) => {
      const body = statusSchema.parse(req.body);
      const task = updateStatus(app.vaultRoot, req.params.slug, req.params.id, body.status, body.author);
      app.cache.refreshProject(req.params.slug);
      return task;
    }
  );

  app.patch<{ Params: { slug: string; id: string } }>(
    "/api/projects/:slug/tasks/:id/description",
    async (req) => {
      const body = descriptionSchema.parse(req.body);
      const task = updateDescription(
        app.vaultRoot,
        req.params.slug,
        req.params.id,
        body.description,
        body.summary ?? "",
        body.author
      );
      app.cache.refreshProject(req.params.slug);
      return task;
    }
  );

  app.patch<{ Params: { slug: string; id: string } }>("/api/projects/:slug/tasks/:id", async (req) => {
    const body = patchSchema.parse(req.body);
    const task = updateFields(app.vaultRoot, req.params.slug, req.params.id, body);
    app.cache.refreshProject(req.params.slug);
    return task;
  });

  app.post<{ Params: { slug: string; id: string } }>(
    "/api/projects/:slug/tasks/:id/comments",
    async (req, reply) => {
      const body = commentSchema.parse(req.body);
      const task = addComment(app.vaultRoot, req.params.slug, req.params.id, body.text, body.author);
      app.cache.refreshProject(req.params.slug);
      reply.code(201).send(task);
    }
  );

  app.delete<{ Params: { slug: string; id: string } }>(
    "/api/projects/:slug/tasks/:id",
    async (req, reply) => {
      try {
        deleteTask(app.vaultRoot, req.params.slug, req.params.id);
      } catch {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      app.cache.refreshProject(req.params.slug);
      reply.code(204).send();
    }
  );
}
