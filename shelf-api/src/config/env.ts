import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly. A missing DATABASE_URL should stop the process here,
  // not surface as a connection error 30 seconds into a deploy.
  console.error(
    "Invalid environment configuration:\n",
    z.prettifyError(parsed.error),
  );
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
