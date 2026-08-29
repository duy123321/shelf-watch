import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify from "fastify";
import { env } from "./config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds a fully-loaded Fastify instance without binding a port.
 *
 * Kept separate from server.ts so tests can drive it with `app.inject()`.
 */
export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : env.NODE_ENV === "production"
          ? true
          : { transport: { target: "pino-pretty" } },
  });

  // Cross-cutting concerns. Every file here is wrapped in fastify-plugin so
  // its decorators escape encapsulation and are visible to the routes below.
  await app.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Directory structure becomes the URL prefix:
  //   routes/health/index.ts    -> /health
  //   routes/api/users/index.ts -> /api/users
  await app.register(autoload, {
    dir: path.join(__dirname, "routes"),
    dirNameRoutePrefix: true,
  });

  await app.ready();
  return app;
}
