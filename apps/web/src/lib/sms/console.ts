import "server-only";
import { isProduction, log } from "@/lib/env";
import {
  otpMessage,
  SmsDeliveryError,
  type OtpDelivery,
  type SmsTransport,
} from "./transport";

/**
 * Development-only transport: writes the OTP to the server log.
 *
 * This is the only place a live OTP is ever printed, and it refuses to run in
 * production. `env()` rejects `SMS_PROVIDER=console` when NODE_ENV=production,
 * and this guard catches the case where the provider is flipped at runtime.
 */
export class ConsoleTransport implements SmsTransport {
  readonly name = "console";

  async sendOtp(input: OtpDelivery): Promise<void> {
    if (isProduction()) {
      throw new SmsDeliveryError(
        "The console OTP transport is not permitted in production. Configure twilio or msg91.",
        this.name,
      );
    }

    log("info", "otp delivery (console transport)", {
      to: input.phone,
      purpose: input.purpose,
      ttlMinutes: input.ttlMinutes,
      message: otpMessage(
        input.purpose,
        input.code,
        input.ttlMinutes,
        input.locale,
      ),
    });
  }
}
