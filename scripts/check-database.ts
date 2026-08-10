import "dotenv/config";
import { checkDatabaseReadiness, closeDatabase } from "../src/server/db/client";

async function main(): Promise<void> {
  try {
    if (!(await checkDatabaseReadiness())) {
      console.error("Database is reachable, but Taskfella migrations are not applied.");
      process.exitCode = 1;
      return;
    }

    console.log("Taskfella database is reachable and migrated.");
  } catch {
    console.error("Database is unavailable. Start PostgreSQL and check DATABASE_URL.");
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
