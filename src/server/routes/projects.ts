import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createProject } from "../../core/project.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1).max(6).optional(),
});

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/projects", async () => {
    return app.cache.getProjects().map((project) => {
      const tasks = app.cache.getTasks(project.slug);
      const counts: Record<string, number> = {};
      for (const status of project.statuses) counts[status.id] = 0;
      for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
      return { ...project, taskCount: tasks.length, counts };
    });
  });

  app.post("/api/projects", async (req, reply) => {
    const body = createProjectSchema.parse(req.body);
    const project = createProject(app.vaultRoot, body.name, { key: body.key });
    app.cache.refreshProject(project.slug);
    reply.code(201).send(project);
  });
}
