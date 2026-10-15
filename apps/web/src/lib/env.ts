import "server-only";
import { z } from "zod";

/**
 * Central, validated view of the environment.
 *
 * Every value the server depends on is read through this module so a missing or
 * malformed variable fails loudly at boot instead of at the first request that
 * happens to need it. Nothing here is imported from a Client Component — the
 * `server-only` guard makes that a build error rather than a runtime leak.
 */

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
        "DATABASE_URL must be a PostgreSQL connection string",
      ),

    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),

    APP_URL: z
      .string()
      .url("APP_URL must be an absolute URL")
      .default("http://localhost:3000"),

    SMS_PROVIDER: z.enum(["twilio", "msg91", "console"]).default("console"),

    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),

    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_SENDER_ID: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),

    ML_SERVICE_URL: z.url("ML_SERVICE_URL must be a URL").default("http://localhost:8000"),
    ML_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),

    CLIMATIQ_API_KEY: z.string().optional(),
    CLIMATIQ_API_URL: z
      .url()
      .default("https://api.climatiq.io/v1/estimate"),
    CLIMATIQ_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),

    DEFAULT_LOCALE: z.enum(["en", "hi", "kn"]).default("en"),
    SUPPORTED_LOCALES: z.string().default("en,hi,kn"),

    SEED_ADMIN_PHONE: z.string().optional(),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    /**
     * Set to "1" by the `build` script in package.json.
     *
     * `next build` evaluates route modules with NODE_ENV=production on a
     * machine that has no environment configured at all — the production image
     * is hermetic. Detecting that reliably from inside the module is fragile,
     * so the build script declares it explicitly and {@link load} fills in
     * inert placeholders for the two values a build cannot proceed without.
     *
     * It deliberately disables no check that runs at request time: the SMS
     * configuration is enforced by `assertSmsConfigured()` when an OTP is
     * actually sent, not here and not at boot.
     */
    NEXT_BUILDING: z.string().optional(),
  });

/**
 * True while `next build` is collecting page data.
 *
 * Driven by the explicit `NEXT_BUILDING=1` that the build script sets. An
 * indirect detection would be worse than none here: guessing wrong in the
 * permissive direction would let a production server start without SMS
 * credentials, which is exactly the failure this guard exists to prevent.
 */
function isProductionBuild(value: { NEXT_BUILDING?: string }): boolean {
  return value.NEXT_BUILDING === "1";
}

export type Env = z.infer<typeof schema>;

/**
 * Inert values used only while `next build` evaluates server modules.
 *
 * `next build` imports every route to collect page data on a machine that, in
 * the container case, has no `.env` and no environment variables at all — the
 * build is hermetic by design. Supplying these lets configuration validation
 * run unchanged everywhere else while a build that never opens a connection and
 * never signs a token still completes.
 *
 * They replace nothing: a real value in the environment wins. And they cannot
 * mask a production misconfiguration, because `NEXT_BUILDING` is set only by
 * the `build` script — the production server runs `node server.js` and goes
 * through the schema with no placeholders and full enforcement.
 */
const BUILD_PLACEHOLDERS: Record<string, string> = {
  DATABASE_URL: "postgresql://build:build@127.0.0.1:5432/build?schema=public",
  APP_SECRET: "build-time-placeholder-value-not-a-secret-and-never-used",
};

function load(): Env {
  const source: Record<string, string | undefined> = { ...process.env };

  if (isProductionBuild(source)) {
    for (const [key, placeholder] of Object.entries(BUILD_PLACEHOLDERS)) {
      source[key] ??= placeholder;
    }
  }

  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        "Copy apps/web/.env.example to apps/web/.env and fill in the required values.",
    );
  }

  return parsed.data;
}

let cached: Env | undefined;

/**
 * The validated environment. Cached so repeated reads are free; call
 * {@link resetEnvCache} in tests that mutate `process.env`.
 */
export function env(): Env {
  cached ??= load();
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}

/** Configured app origin, guaranteed to have no trailing slash. */
export function appUrl(): string {
  return env().APP_URL.replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

/**
 * Enforces the OTP transport configuration at the moment an OTP is about to be
 * sent.
 *
 * This is the single enforcement point, and it is deliberately here rather than
 * at boot. A deployment with no SMS credentials must still serve accounts,
 * balances and password sign-in — everything that does not send a message. The
 * one feature that cannot work without a provider fails with a clear 503 the
 * moment it is used, and there is no fallback transport: an OTP is either
 * delivered by a real provider or not delivered at all.
 *
 * Called by `deliverOtp()` in src/lib/sms, the choke point every OTP passes
 * through.
 */
export function assertSmsConfigured(): void {
  const config = env();

  if (config.NODE_ENV !== "production") return;

  if (config.SMS_PROVIDER === "console") {
    throw new Error(
      "Refusing to send an OTP: SMS_PROVIDER=console is not permitted in production. " +
        "Set SMS_PROVIDER to twilio or msg91 and supply the matching credentials.",
    );
  }

  if (
    config.SMS_PROVIDER === "twilio" &&
    !(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_FROM_NUMBER)
  ) {
    throw new Error(
      "Refusing to send an OTP: SMS_PROVIDER=twilio but the Twilio credentials are incomplete.",
    );
  }

  if (config.SMS_PROVIDER === "msg91" && !config.MSG91_AUTH_KEY) {
    throw new Error(
      "Refusing to send an OTP: SMS_PROVIDER=msg91 but MSG91_AUTH_KEY is not set.",
    );
  }
}

/** Locales the interface ships translations for. */
export function supportedLocales(): Array<"en" | "hi" | "kn"> {
  const raw = env().SUPPORTED_LOCALES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const valid = raw.filter(
    (s): s is "en" | "hi" | "kn" => s === "en" || s === "hi" || s === "kn",
  );

  return valid.length ? valid : ["en"];
}

/** Minimal structured logger. Secrets are never passed into it by callers. */
export function log(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
) {
  const configured = env().LOG_LEVEL;
  const order = { debug: 10, info: 20, warn: 30, error: 40 } as const;
  if (order[level] < order[configured]) return;

  const entry = {
    level,
    message,
    ...(context ?? {}),
    time: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
