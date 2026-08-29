import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Source uses NodeNext-style ".js" specifiers that point at ".ts" files.
      // Node and tsx resolve those natively; Vite does not, so strip the
      // extension from relative imports and let Vite pick up the .ts.
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" },
    ],
  },
  test: {
    // The suite runs against the local Postgres from docker-compose.yml and
    // expects the seed data. Run: npm run db:reset && npm test
    include: ["test/**/*.test.ts"],
    server: {
      deps: {
        // @fastify/autoload discovers route files with a native dynamic
        // import, which would skip Vite's transform and the alias above.
        // Inlining it puts those imports back under Vitest's resolver.
        inline: ["@fastify/autoload"],
      },
    },
    // Route tests share one Fastify instance and one database; running files
    // in parallel would race on the POST fixtures.
    fileParallelism: false,
    env: { NODE_ENV: "test" },
  },
});
