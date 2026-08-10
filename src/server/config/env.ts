import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
      message: "DATABASE_URL must use the PostgreSQL URL scheme",
    }),
  APP_URL: z
    .string()
    .url("APP_URL must be a valid URL")
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "APP_URL must use http or https",
    }),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
});

export type AppEnv = z.infer<typeof environmentSchema>;
export type EnvironmentInput = Record<string, string | undefined>;

function selectEnvironment(input: EnvironmentInput): Record<string, string | undefined> {
  return {
    NODE_ENV: input.NODE_ENV,
    DATABASE_URL: input.DATABASE_URL,
    APP_URL: input.APP_URL,
    LOG_LEVEL: input.LOG_LEVEL,
    DB_POOL_MAX: input.DB_POOL_MAX,
  };
}

/**
 * Parse only the values Taskfella owns and report variable names, never values.
 * Keeping this function pure makes startup validation straightforward to test.
 */
export function parseEnvironment(input: EnvironmentInput): AppEnv {
  const parsed = environmentSchema.safeParse(selectEnvironment(input));

  if (!parsed.success) {
    const variables = parsed.error.issues
      .map((issue) => issue.path.join(".") || "environment")
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(", ");

    throw new Error(`Invalid environment configuration: ${variables}`);
  }

  return parsed.data;
}

let cachedEnvironment: AppEnv | undefined;

export function getEnvironment(): AppEnv {
  cachedEnvironment ??= parseEnvironment(process.env);
  return cachedEnvironment;
}

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
