import cors from "@fastify/cors";
import fp from "fastify-plugin";
import { corsOrigins } from "../config/env.js";

/**
 * The frontend is served from a different origin than the API on both Railway
 * and Render, so this is a real cross-origin setup rather than a formality.
 */
export default fp(
  async (app) => {
    await app.register(cors, {
      origin: corsOrigins,
      credentials: true,
    });
  },
  { name: "cors" },
);
