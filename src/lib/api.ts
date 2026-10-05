import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { UnauthorizedError } from "./auth";

/**
 * Shared request/response conventions for the REST API.
 *
 * Every handler returns the same envelope, so the client never has to guess:
 *
 *   success -> { ok: true,  data: ... }
 *   failure -> { ok: false, error: { code, message, fields? } }
 *
 * Validation runs through zod. Anything that reaches a query has already been
 * parsed and constrained, so no untrusted string reaches SQL as-is.
 */

export type ApiErrorCode =
  | "validation"
  | "unauthorized"
  | "not_found"
  | "insufficient_funds"
  | "conflict"
  | "rate_limited"
  | "internal";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json(
    { ok: false as const, error: { code, message, ...(fields ? { fields } : {}) } },
    { status: statusFor(code) }
  );
}

function statusFor(code: ApiErrorCode): number {
  switch (code) {
    case "validation":
      return 400;
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "insufficient_funds":
      return 422;
    case "internal":
      return 500;
  }
}

/** Parse and validate a JSON body, returning a typed value or throwing. */
export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Send a JSON body.", {});
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Some fields need attention.", fieldErrors(result.error));
  }
  return result.data;
}

export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string>) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    // Keep the first message per field; it is the most specific one.
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Wrap a handler so every failure becomes the standard envelope.
 *
 * Unexpected errors are logged server-side and reported to the client as a
 * generic message, so internals never leak into the response body.
 */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ValidationError) {
        return fail("validation", err.message, err.fields);
      }
      if (err instanceof UnauthorizedError) {
        return fail("unauthorized", err.message);
      }
      if (err instanceof ApiError) {
        return fail(err.code, err.message, err.fields);
      }
      console.error("[api] unhandled error", err);
      return fail("internal", "Something went wrong on our side. Please try again.");
    }
  };
}

/** Throw from a handler to return a specific API failure. */
export class ApiError extends Error {
  code: ApiErrorCode;
  fields?: Record<string, string>;
  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "That record no longer exists.") {
    super("not_found", message);
    this.name = "NotFoundError";
  }
}

export class InsufficientFundsError extends ApiError {
  constructor(availablePaise: number) {
    super("insufficient_funds", `Not enough balance. You have ${(availablePaise / 100).toFixed(2)} rupees available.`);
    this.name = "InsufficientFundsError";
  }
}