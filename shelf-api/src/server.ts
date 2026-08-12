import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

// 0.0.0.0 is required on Railway and Render — binding to localhost makes the
// service unreachable and the platform health check fails the deploy.
await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    // Triggers the onClose hook in plugins/db.ts, which drains the pg pool.
    await app.close();
    process.exit(0);
  });
}
