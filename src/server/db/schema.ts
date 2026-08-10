/**
 * Phase 0 deliberately has no product tables.
 *
 * Keep this module as the Drizzle schema entry point so future product modules can
 * add tables without changing the database client or migration configuration.
 */
export const foundationSchema = {} as const;
