import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guard";
import { SmsDeliveryError } from "@/lib/sms";
import { log } from "@/lib/env";

/**
 * Uniform JSON responses for API routes.
 *
 * Every route returns through these helpers so clients see one error shape and
 * internal failure detail never leaks: unexpected errors become a generic 500
 * and are logged server-side with a correlation id.
 */

export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Per-field messages, present only for validation failures. */
    fields?: Record<string, string>;
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data as object, { status: 201 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status },
  );
}

export function badRequest(
  message: string,
  fields?: Record<string, string>,
): NextResponse<ApiError> {
  return fail(400, "bad_request", message, fields);
}

export function unauthorized(message = "Sign in to continue"): NextResponse<ApiError> {
  return fail(401, "unauthenticated", message);
}

export function notFound(message = "Not found"): NextResponse<ApiError> {
  return fail(404, "not_found", message);
}

/**
 * Wraps a route handler so every thrown error becomes a well-formed response.
 *
 * Domain errors (`AuthError`, `SmsDeliveryError`, `ZodError`) are mapped to
 * their intended status. Everything else is an unexpected fault: it is logged
 * with a generated id and reported as an opaque 500, so an internal message
 * such as a database constraint name is never returned to a caller.
 */
export function handleRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return fail(error.status, error.code, error.message);
      }

      if (error instanceof SmsDeliveryError) {
        return fail(
          503,
          "sms_unavailable",
          "We could not send a verification code right now. Please try again.",
        );
      }

      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const key = issue.path.join(".") || "_";
          if (!(key in fields)) fields[key] = issue.message;
        }
        return badRequest("Check the highlighted fields", fields);
      }

      const correlationId = crypto.randomUUID();
      log("error", "unhandled route error", {
        correlationId,
        path:
          typeof args[0] === "object" && args[0] && "url" in (args[0] as object)
            ? String((args[0] as { url: string }).url)
            : "unknown",
        reason: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return fail(
        500,
        "internal_error",
        "Something went wrong on our side. Please try again.",
      );
    }
  };
}
