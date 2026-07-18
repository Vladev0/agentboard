import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getNote, listNotes, noteExists, upsertNote } from "../../core/notes.js";
import { createProject, deleteProject, projectExists } from "../../core/project.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1).max(6).optional(),
});

const upsertNoteSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  summary: z.string().optional(),
  sources: z.array(z.string()).optional(),
});

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/projects", async () => {
    return app.cache.getProjects().map((project) => {
      const tasks = app.cache.getTasks(project.slug);
      const counts: Record<string, number> = {};
      for (const status of project.statuses) counts[status.id] = 0;
      for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
      const blockedCount = tasks.filter((t) => t.blocked).length;
      return { ...project, taskCount: tasks.length, counts, blockedCount };
    });
  });

  app.post("/api/projects", async (req, reply) => {
    const body = createProjectSchema.parse(req.body);
    const project = createProject(app.vaultRoot, body.name, { key: body.key });
    app.cache.refreshProject(project.slug);
    reply.code(201).send(project);
  });

  app.delete<{ Params: { slug: string } }>("/api/projects/:slug", async (req, reply) => {
    deleteProject(app.vaultRoot, req.params.slug);
    app.cache.removeProject(req.params.slug);
    reply.code(204).send();
  });

  app.get<{ Params: { slug: string } }>("/api/projects/:slug/notes", async (req, reply) => {
    if (!projectExists(app.vaultRoot, req.params.slug)) {
      return reply.code(404).send({ error: "not_found" });
    }
    return listNotes(app.vaultRoot, req.params.slug);
  });

  app.get<{ Params: { slug: string; note: string } }>(
    "/api/projects/:slug/notes/:note",
    async (req, reply) => {
      if (!noteExists(app.vaultRoot, req.params.slug, req.params.note)) {
        return reply.code(404).send({ error: "not_found" });
      }
      // Human reads don't count as agent usage — no lastUsed touch here.
      return getNote(app.vaultRoot, req.params.slug, req.params.note);
    }
  );

  // Human edit path: same upsert semantics as the agent's — every change is a version.
  app.put<{ Params: { slug: string; note: string } }>(
    "/api/projects/:slug/notes/:note",
    async (req, reply) => {
      if (!projectExists(app.vaultRoot, req.params.slug)) {
        return reply.code(404).send({ error: "not_found" });
      }
      const body = upsertNoteSchema.parse(req.body);
      const { note } = upsertNote(app.vaultRoot, req.params.slug, {
        id: req.params.note,
        title: body.title,
        body: body.body,
        summary: body.summary?.trim() || "Minor edit.",
        sources: body.sources,
        author: "human",
      });
      return note;
    }
  );
}
