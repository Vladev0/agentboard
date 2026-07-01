import type { VaultCache } from "../core/cache.js";

declare module "fastify" {
  interface FastifyInstance {
    vaultRoot: string;
    cache: VaultCache;
  }
}
