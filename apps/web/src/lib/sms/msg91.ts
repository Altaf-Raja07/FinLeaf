import "server-only";
import { env } from "@/lib/env";
import {
  otpMessage,
  SmsDeliveryError,
  type OtpDelivery,
  type SmsTransport,
} from "./transport";

/**
 * MSG91 transactional SMS transport (Indian carrier, DLT-registered sender ids).
 *
 * The free developer tier uses template-based sends, so the message body is
 * passed as a fully-rendered string alongside the template id.
 */
export class Msg91Transport implements SmsTransport {
  readonly name = "msg91";

  async sendOtp(input: OtpDelivery): Promise<void> {
    const { MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID } = env();

    if (!MSG91_AUTH_KEY) {
      throw new SmsDeliveryError("MSG91_AUTH_KEY is not set", this.name);
    }

    const body = JSON.stringify({
      sender: MSG91_SENDER_ID ?? "FINLEA",
      route: "transactional",
      country: "91",
      sms: {
        message: otpMessage(
          input.purpose,
          input.code,
          input.ttlMinutes,
          input.locale,
        ),
        template_id: MSG91_TEMPLATE_ID || undefined,
      },
      recipients: [
        {
          number: input.phone.replace(/^\+/, "").slice(-10),
        },
      ],
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: MSG91_AUTH_KEY,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      throw new SmsDeliveryError("MSG91 request failed", this.name, error);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new SmsDeliveryError(
        `MSG91 responded ${response.status}: ${detail.slice(0, 300)}`,
        this.name,
      );
    }
  }
}
