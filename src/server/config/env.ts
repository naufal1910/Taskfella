import { z } from "zod";

const environmentSchema = z
  .object({
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
    AUTH_TRUSTED_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    EMAIL_DELIVERY_MODE: z.enum(["local", "smtp"]).default("local"),
    EMAIL_LOCAL_CAPTURE_DIR: z.string().min(1).default(".local/mail"),
    EMAIL_SMTP_HOST: z.string().min(1).optional(),
    EMAIL_SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    EMAIL_SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    EMAIL_SMTP_USER: z.string().min(1).optional(),
    EMAIL_SMTP_PASSWORD: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z
      .string()
      .min(1)
      .max(256)
      .refine((value) => /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(value), {
        message: "GOOGLE_CLIENT_ID must be a Google OAuth client ID",
      })
      .optional(),
    GOOGLE_CLIENT_SECRET: z
      .string()
      .min(1)
      .max(512)
      .refine((value) => !/[\s\u0000-\u001f\u007f]/.test(value), {
        message: "GOOGLE_CLIENT_SECRET contains invalid characters",
      })
      .optional(),
  })
  .superRefine((value, context) => {
    let appUrl: URL;
    try {
      appUrl = new URL(value.APP_URL);
    } catch {
      return;
    }
    if (appUrl.username || appUrl.password) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must not contain credentials",
      });
    }

    const hasGoogleClientId = Boolean(value.GOOGLE_CLIENT_ID);
    const hasGoogleClientSecret = Boolean(value.GOOGLE_CLIENT_SECRET);
    if (hasGoogleClientId !== hasGoogleClientSecret) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        message: "Google OAuth client ID and secret must be supplied together",
      });
    }

    if (value.NODE_ENV !== "production") {
      return;
    }

    if (appUrl.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "production APP_URL must use HTTPS",
      });
    }
    if (!value.AUTH_TRUSTED_PROXY) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_TRUSTED_PROXY"],
        message: "production requires a trusted proxy address",
      });
    }

    if (value.EMAIL_DELIVERY_MODE !== "smtp") {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_DELIVERY_MODE"],
        message: "production requires SMTP delivery",
      });
    }
    if (!value.EMAIL_SMTP_HOST) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_SMTP_HOST"],
        message: "production requires an SMTP host",
      });
    }
    if (!value.EMAIL_FROM) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "production requires a sender address",
      });
    }
    if (
      (value.EMAIL_SMTP_USER && !value.EMAIL_SMTP_PASSWORD) ||
      (!value.EMAIL_SMTP_USER && value.EMAIL_SMTP_PASSWORD)
    ) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_SMTP_USER", "EMAIL_SMTP_PASSWORD"],
        message: "SMTP credentials must be supplied together",
      });
    }

    if (!hasGoogleClientId || !hasGoogleClientSecret) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        message: "production requires Google OAuth credentials",
      });
    }
    if (
      isGoogleOAuthPlaceholder(value.GOOGLE_CLIENT_ID) ||
      isGoogleOAuthPlaceholder(value.GOOGLE_CLIENT_SECRET)
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        message: "production Google OAuth configuration cannot use placeholders",
      });
    }
  });

export function isGoogleOAuthPlaceholder(value: string | undefined): boolean {
  return Boolean(
    value &&
    /(?:replace-with-|placeholder|local-google|(?:^|[-_.])(example|dummy|fake|sample|changeme|test)(?:$|[-_.]))/i.test(
      value,
    ),
  );
}

type ParsedEnvironment = z.infer<typeof environmentSchema>;

// Keep the foundation's small test/environment fixtures source-compatible while
// allowing Phase 1B email settings to be omitted outside the sender boundary.
export type AppEnv = Omit<
  ParsedEnvironment,
  | "AUTH_TRUSTED_PROXY"
  | "EMAIL_DELIVERY_MODE"
  | "EMAIL_LOCAL_CAPTURE_DIR"
  | "EMAIL_SMTP_PORT"
  | "EMAIL_SMTP_SECURE"
> & {
  AUTH_TRUSTED_PROXY?: ParsedEnvironment["AUTH_TRUSTED_PROXY"];
  EMAIL_DELIVERY_MODE?: ParsedEnvironment["EMAIL_DELIVERY_MODE"];
  EMAIL_LOCAL_CAPTURE_DIR?: ParsedEnvironment["EMAIL_LOCAL_CAPTURE_DIR"];
  EMAIL_SMTP_PORT?: ParsedEnvironment["EMAIL_SMTP_PORT"];
  EMAIL_SMTP_SECURE?: ParsedEnvironment["EMAIL_SMTP_SECURE"];
};
export type EnvironmentInput = Record<string, string | undefined>;

function selectEnvironment(input: EnvironmentInput): Record<string, string | undefined> {
  return {
    NODE_ENV: input.NODE_ENV,
    DATABASE_URL: input.DATABASE_URL,
    APP_URL: input.APP_URL,
    LOG_LEVEL: input.LOG_LEVEL,
    DB_POOL_MAX: input.DB_POOL_MAX,
    AUTH_TRUSTED_PROXY: input.AUTH_TRUSTED_PROXY,
    EMAIL_DELIVERY_MODE: input.EMAIL_DELIVERY_MODE,
    EMAIL_LOCAL_CAPTURE_DIR: input.EMAIL_LOCAL_CAPTURE_DIR,
    EMAIL_SMTP_HOST: input.EMAIL_SMTP_HOST,
    EMAIL_SMTP_PORT: input.EMAIL_SMTP_PORT,
    EMAIL_SMTP_SECURE: input.EMAIL_SMTP_SECURE,
    EMAIL_SMTP_USER: input.EMAIL_SMTP_USER,
    EMAIL_SMTP_PASSWORD: input.EMAIL_SMTP_PASSWORD,
    EMAIL_FROM: input.EMAIL_FROM,
    GOOGLE_CLIENT_ID: input.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: input.GOOGLE_CLIENT_SECRET,
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
