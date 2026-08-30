// NEED TO CREATE MY PATH  ENDPOINTS

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { updateReadStatus } from "../../../services/user_read.js";
import { READ_STATUSES } from "@shelf-watch/shared";
 
const updateUserReadStatusBody = z.object({
  userId: z.int().min(1),
  bookId: z.int().min(1),
  status: z.enum(READ_STATUSES)
});


/**
 * Autoloaded at /api/users from this file's directory path — the route paths
 * below are relative to that prefix. Do not add a `prefix` option here, and do
 * not wrap this in fastify-plugin: route files keep their own scope.
 */
const userReadRoutes: FastifyPluginAsync = async (app) => {

  app.patch("/", async (req, reply) => {
    const parsed = updateUserReadStatusBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    const userRead = await updateReadStatus(parsed.data);
    if (!userRead) {
        return reply.status(404).send
            ({ error: `User ${parsed.data.userId} did not read book ${parsed.data.bookId}` });
    }
    return reply.status(200).send(userRead);
  });

};

export default userReadRoutes;
