import "server-only";
import { env } from "@/lib/env";
import {
  otpMessage,
  SmsDeliveryError,
  type OtpDelivery,
  type SmsTransport,
} from "./transport";

/**
 * Twilio SMS transport.
 *
 * Uses the REST API directly rather than the SDK: it is one POST, and this
 * keeps the dependency surface (and therefore the supply-chain surface) small.
 */
export class TwilioTransport implements SmsTransport {
  readonly name = "twilio";

  async sendOtp(input: OtpDelivery): Promise<void> {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env();

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new SmsDeliveryError(
        "Twilio credentials are incomplete",
        this.name,
      );
    }

    const body = new URLSearchParams({
      To: input.phone,
      From: TWILIO_FROM_NUMBER,
      Body: otpMessage(input.purpose, input.code, input.ttlMinutes, input.locale),
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
          cache: "no-store",
        },
      );
    } catch (error) {
      throw new SmsDeliveryError("Twilio request failed", this.name, error);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new SmsDeliveryError(
        `Twilio responded ${response.status}: ${detail.slice(0, 300)}`,
        this.name,
      );
    }
  }
}
