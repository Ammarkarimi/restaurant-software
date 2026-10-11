// Build script used by Vercel (and `npm run build`).
//
// - Production builds apply database migrations, so the live database is
//   always up to date with the code being deployed.
// - Preview builds (pull requests / branches) never touch the database: a
//   branch must not change the production schema, and previews often have no
//   DATABASE_URL at all. They only compile the app.
// - A production build without DATABASE_URL stops with a clear explanation
//   instead of a cryptic Prisma error.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined (not on Vercel)
const isPreview = vercelEnv === "preview" || vercelEnv === "development";
// Prisma also reads a local .env file. Only check it for DATABASE_URL: loading the
// whole file could leak values such as NODE_ENV=development into `next build`.
const envFileHasDatabase = existsSync(".env") && /^\s*DATABASE_URL\s*=\s*["']?[^"'\s]/m.test(readFileSync(".env", "utf8"));
const hasDatabase = Boolean(process.env.DATABASE_URL) || envFileHasDatabase;

run("prisma generate");

if (isPreview) {
  console.log(`\n▶ Vercel ${vercelEnv} build: skipping database migrations.\n`);
} else if (hasDatabase) {
  run("prisma migrate deploy");
} else {
  console.error(`
✖ DATABASE_URL is not set, so the database cannot be prepared.

  On Vercel: open this project → Storage → connect a Postgres database (e.g. Neon),
  or add DATABASE_URL under Settings → Environment Variables for Production,
  then redeploy. Also add JWT_SECRET (any long random text).
`);
  process.exit(1);
}

run("next build");
