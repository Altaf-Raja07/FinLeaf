import { z } from "zod";

/**
 * Request validation schemas.
 *
 * Every API route parses its input through one of these before touching the
 * database. Parsing lives here rather than in the routes so the same rule is
 * enforced no matter which endpoint receives the value.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * E.164 phone number. Indian numbers in practice, but the format is not
 * restricted to +91 so the product is not silently country-locked.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number with country code, e.g. +919876543210");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long")
  // Composition rules are enforced as guidance rather than hard requirements,
  // because length matters far more than character-class rules and strict
  // composition pushes users toward predictable substitutions.
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), {
    message: "Include at least one lowercase and one uppercase or number character",
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const cuidSchema = z.string().min(1).max(64);

export const localeSchema = z.enum(["en", "hi", "kn"]);

/** Rupee amount: at least 1, at most 10 million, at most 2 decimal places. */
export const amountSchema = z
  .coerce
  .number()
  .positive("Enter an amount greater than zero")
  .max(10_000_000, "Amount is too large")
  .refine((v) => Number.isFinite(v) && Math.round(v * 100) === v * 100, {
    message: "Enter an amount with at most 2 decimal places",
  });

export const categorySchema = z.enum([
  "GROCERIES",
  "FUEL",
  "TRAVEL_PUBLIC",
  "TRAVEL_PRIVATE",
  "ELECTRICITY",
  "DINING",
  "EDUCATION",
  "HEALTHCARE",
  "ELECTRONICS",
  "CLOTHING",
  "HOUSING",
  "RENT",
  "SALARY",
  "TRANSFER",
  "BILL_PAYMENT",
  "RECHARGE",
  "LOAN",
  "SAVINGS",
  "GREEN_REWARD",
  "OFFSET",
  "OTHER",
]);

export const localeMapSchema = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(["REGISTRATION", "LOGIN", "PASSWORD_RESET", "PHONE_CHANGE"]),
  locale: localeSchema.default("en"),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(["REGISTRATION", "LOGIN", "PASSWORD_RESET", "PHONE_CHANGE"]),
  code: otpCodeSchema,
  locale: localeSchema.default("en"),
});

/**
 * Registration payload.
 *
 * A user is created in PENDING_VERIFICATION and only becomes ACTIVE once the
 * phone number has been proven by OTP; the password is set at the same moment
 * so there is never an account without a credential.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: phoneSchema,
  village: z.string().trim().min(2, "Enter your village or town").max(80),
  preferredLang: localeSchema.default("en"),
  password: passwordSchema,
  otpCode: otpCodeSchema,
  locale: localeSchema.default("en"),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
});

/**
 * Sign-in, with the method chosen by the caller.
 *
 * `password` is the standard path; `otp` is the mobile-first path for a user
 * who has never set a password. Both are proven server-side — the method is not
 * a hint that bypasses anything.
 */
export const loginWithMethodSchema = z
  .object({
    phone: phoneSchema,
    password: passwordSchema.optional(),
    method: z.enum(["password", "otp"]).default("password"),
    otpCode: otpCodeSchema.optional(),
    locale: localeSchema.default("en"),
  })
  .superRefine((value, ctx) => {
    if (value.method === "password" && !value.password) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Enter your password",
      });
    }
    if (value.method === "otp" && !value.otpCode) {
      ctx.addIssue({
        code: "custom",
        path: ["otpCode"],
        message: "Enter the 6-digit code",
      });
    }
  });

export const requestPasswordResetSchema = z.object({
  phone: phoneSchema,
  locale: localeSchema.default("en"),
});

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  otpCode: otpCodeSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Banking
// ---------------------------------------------------------------------------

export const transferSchema = z.object({
  /** Recipient's account number or registered phone number. */
  to: z
    .string()
    .trim()
    .min(4, "Enter an account number or phone number")
    .max(20),
  amount: amountSchema,
  note: z.string().trim().max(120).optional(),
  /**
   * Client-supplied idempotency key. A retried request carrying the same key
   * returns the original transaction instead of moving money twice.
   */
  reference: z.string().trim().min(8).max(64),
});

export const depositSchema = z.object({
  amount: amountSchema,
  note: z.string().trim().max(120).optional(),
  reference: z.string().trim().min(8).max(64),
});

export const billPaymentSchema = z.object({
  billerSlug: z.string().trim().min(1).max(64),
  amount: amountSchema,
  /** Customer identifier such as a meter or consumer number. */
  customerRef: z.string().trim().max(64).optional(),
  reference: z.string().trim().min(8).max(64),
});

export const transactionFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: categorySchema.optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

// ---------------------------------------------------------------------------
// Inclusion
// ---------------------------------------------------------------------------

export const loanApplySchema = z.object({
  amount: amountSchema,
  termMonths: z.coerce.number().int().min(1).max(60),
});

export const loanRepaySchema = z.object({
  loanId: cuidSchema,
  amount: amountSchema,
  reference: z.string().trim().min(8).max(64),
});

export const savingsGoalSchema = z.object({
  title: z.string().trim().min(2, "Give the goal a name").max(80),
  target: amountSchema,
  dueDate: z.coerce.date().optional(),
});

export const savingsContributionSchema = z.object({
  goalId: cuidSchema,
  amount: amountSchema,
  reference: z.string().trim().min(8).max(64),
});

export const quizAttemptSchema = z.object({
  quizId: cuidSchema,
  /** Selected option index per question id. */
  answers: z.record(z.string(), z.coerce.number().int().min(0).max(9)),
});

export const familyCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const familyInviteSchema = z.object({
  groupId: cuidSchema,
  phone: phoneSchema,
  canSpend: z.boolean().default(false),
  locale: localeSchema.default("en"),
});

export const familyAcceptSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

/**
 * Owner-only change to a member's spending permission.
 *
 * `groupId` and `memberId` are validated as ids here and re-checked against the
 * database in the action: an id from a form is not evidence of ownership, so
 * the group must be read back and confirmed to belong to the caller.
 */
export const familyToggleSpendSchema = z.object({
  groupId: cuidSchema,
  memberId: cuidSchema,
  canSpend: z.boolean(),
});

/** Owner-only removal of a member. Same re-check as above. */
export const familyRemoveMemberSchema = z.object({
  groupId: cuidSchema,
  memberId: cuidSchema,
});

/** A non-owner leaving a group they were invited into. */
export const familyLeaveSchema = z.object({
  groupId: cuidSchema,
});

export const circleCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  village: z.string().trim().min(2).max(80),
});

export const circleJoinSchema = z.object({
  circleId: cuidSchema,
});

export const vouchSchema = z.object({
  circleId: cuidSchema,
  toUserId: cuidSchema,
  weight: z.coerce.number().int().min(1).max(5).default(1),
  note: z.string().trim().max(200).optional(),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(500),
  locale: localeSchema.default("en"),
});

// ---------------------------------------------------------------------------
// Sustainability
// ---------------------------------------------------------------------------

export const offsetContributeSchema = z.object({
  projectId: cuidSchema,
  units: z.coerce.number().int().min(1).max(1000),
  reference: z.string().trim().min(8).max(64),
});

export const redeemVoucherSchema = z.object({
  voucherId: cuidSchema,
});

export const anomalyResolveSchema = z.object({
  flagId: cuidSchema,
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    village: z.string().trim().min(2).max(80).optional(),
    preferredLang: localeSchema.optional(),
    email: z.email("Enter a valid email address").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to update",
  });

export const adminUserUpdateSchema = z.object({
  userId: cuidSchema,
  status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  village: z.string().trim().min(2).max(80).optional(),
});

/** Flattens a Zod error into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
