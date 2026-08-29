import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

/**
 * One error shape for the whole API: `{ "error": string }`, matching the 404s
 * the original Next.js route handlers already returned.
 */
export default fp(
  async (app) => {
    app.setErrorHandler(
      (err: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
        if (err instanceof ZodError) {
          return reply.status(400).send({ error: "Invalid request" });
        }

        const status = err.statusCode ?? 500;

        if (status >= 500) {
          app.log.error(err);
          // Never echo an internal error message to the client.
          return reply.status(status).send({ error: "Internal server error" });
        }

        return reply.status(status).send({ error: err.message });
      },
    );

    app.setNotFoundHandler((_req, reply) => {
      reply.status(404).send({ error: "Not found" });
    });
  },
  { name: "error-handler" },
);
