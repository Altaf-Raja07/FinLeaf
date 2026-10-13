import "server-only";
import { assertSmsConfigured, env, log } from "@/lib/env";
import { ConsoleTransport } from "./console";
import { Msg91Transport } from "./msg91";
import { TwilioTransport } from "./twilio";
import { SmsDeliveryError, type SmsTransport } from "./transport";

export type { OtpDelivery, SmsTransport } from "./transport";
export { SmsDeliveryError, otpMessage } from "./transport";

/**
 * Resolves the configured OTP transport.
 *
 * Selection is driven entirely by SMS_PROVIDER, and each provider's required
 * credentials are validated at boot by `env()`, so a misconfigured deployment
 * fails before it accepts a sign-in request rather than after.
 */
export function getSmsTransport(): SmsTransport {
  switch (env().SMS_PROVIDER) {
    case "twilio":
      return new TwilioTransport();
    case "msg91":
      return new Msg91Transport();
    case "console":
      return new ConsoleTransport();
  }
}

/**
 * Sends an OTP, converting any transport failure into a single error type.
 *
 * The caller must treat every failure here as "the user did not receive a
 * code" — transport detail is logged, never returned to the client.
 */
export async function deliverOtp(input: {
  phone: string;
  code: string;
  purpose: Parameters<SmsTransport["sendOtp"]>[0]["purpose"];
  ttlMinutes: number;
  locale: string;
}): Promise<{ delivered: true; provider: string }> {
  // The real production guard. `env()` cannot enforce this during a build
  // (no credentials on the build machine), so it runs here instead, where a
  // misconfiguration becomes a 503 rather than an OTP in a production log.
  assertSmsConfigured();

  const transport = getSmsTransport();

  try {
    await transport.sendOtp(input);
    return { delivered: true, provider: transport.name };
  } catch (error) {
    log("error", "otp delivery failed", {
      provider: transport.name,
      purpose: input.purpose,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw new SmsDeliveryError(
      "Could not deliver the verification code. Please try again.",
      transport.name,
      error,
    );
  }
}
