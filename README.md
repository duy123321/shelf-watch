A NextJS project. Share what you are reading, highlight passages you've just read and love, and reviews.

Compare reviews with friends and follow friends.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Backend

The backend runs inside Next.js itself using [Prisma](https://www.prisma.io/) as the ORM against a local SQLite database (`dev.db`, gitignored). No separate server process is needed — API routes under `app/api/` talk to the database directly.

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Client singleton: `lib/prisma.ts`
- Generated client (gitignored): `app/generated/prisma/`

### Setup

After cloning, generate the client and apply migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

`npx prisma migrate dev` creates `dev.db` if it doesn't exist yet and applies any pending migrations.

### Changing the schema

Edit `prisma/schema.prisma`, then create and apply a migration:

```bash
npx prisma migrate dev --name describe_your_change
```

This regenerates the client automatically.

### Calling the API

Current routes:

| Method | Path          | Description        |
| ------ | ------------- | ------------------- |
| GET    | `/api/users`  | List all users      |
| POST   | `/api/users`  | Create a user       |

Example with `curl` (dev server must be running):

```bash
curl http://localhost:3000/api/users

curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'
```

### Querying the database with a UI client

[Prisma Studio](https://www.prisma.io/studio) is a browser-based UI for viewing and editing the database directly — useful for inspecting data without writing SQL or calling the API:

```bash
npx prisma studio --port 5555
```

This opens a local UI at [http://localhost:5555](http://localhost:5555) where you can browse tables, run filters, and edit rows.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
