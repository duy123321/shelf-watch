import type { FastifyPluginAsync } from "fastify";

/**
 * Autoloaded at /health from this file's directory name. Used as the platform
 * health check on Railway and Render.
 */
const health: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ status: "ok" }));
};

export default health;
