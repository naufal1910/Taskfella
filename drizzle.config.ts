import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle commands.");
}

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  strict: true,
  verbose: true,
});
