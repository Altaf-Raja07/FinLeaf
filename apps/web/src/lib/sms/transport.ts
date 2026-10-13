import "server-only";
import type { OtpPurpose } from "@/generated/prisma/enums";

/**
 * OTP delivery contract. Every transport implements this so swapping providers
 * is a configuration change, never a code change.
 */
export interface OtpDelivery {
  phone: string;
  code: string;
  purpose: OtpPurpose;
  ttlMinutes: number;
  /** BCP-47-ish locale used to pick the message body. */
  locale: string;
}

export interface SmsTransport {
  readonly name: string;
  sendOtp(input: OtpDelivery): Promise<void>;
}

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SmsDeliveryError";
  }
}

/**
 * Localised OTP message bodies. `%code%` and `%minutes%` are substituted by the
 * transport. These are the only strings an end user receives by SMS, so they
 * deliberately contain no amount, link or account detail.
 */
export function otpMessage(
  purpose: OtpPurpose,
  code: string,
  ttlMinutes: number,
  locale: string,
): string {
  const l = locale.toLowerCase();
  const en: Record<OtpPurpose, string> = {
    REGISTRATION: `Welcome to FinLeaf. Your verification code is ${code}. It expires in ${ttlMinutes} minutes. Never share this code with anyone.`,
    LOGIN: `Your FinLeaf login code is ${code}. It expires in ${ttlMinutes} minutes. Never share this code with anyone.`,
    PASSWORD_RESET: `Use code ${code} to reset your FinLeaf password. It expires in ${ttlMinutes} minutes. FinLeaf support will never ask for it.`,
    PHONE_CHANGE: `Use code ${code} to change the phone number on your FinLeaf account. It expires in ${ttlMinutes} minutes.`,
  };
  const hi: Record<OtpPurpose, string> = {
    REGISTRATION: `फिनलीफ़ में आपका स्वागत है। आपका सत्यापन कोड ${code} है। यह ${ttlMinutes} मिनट में समाप्त हो जाएगा। किसी के साथ साझा न करें।`,
    LOGIN: `आपका फिनलीफ़ लॉगिन कोड ${code} है। यह ${ttlMinutes} मिनट में समाप्त हो जाएगा। किसी के साथ साझा न करें।`,
    PASSWORD_RESET: `फिनलीफ़ पासवर्ड बदलने के लिए कोड ${code} का उपयोग करें। यह ${ttlMinutes} मिनट में समाप्त हो जाएगा।`,
    PHONE_CHANGE: `फिनलीफ़ खाते में फ़ोन नंबर बदलने के लिए कोड ${code} का उपयोग करें। यह ${ttlMinutes} मिनट में समाप्त हो जाएगा।`,
  };
  const kn: Record<OtpPurpose, string> = {
    REGISTRATION: `ಫಿನ್‌ಲೀಫ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಪರಿಶೀಲನಾ ಕೋಡ್ ${code}. ಇದು ${ttlMinutes} ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿಯಾಗುತ್ತದೆ. ಯಾರಿಂದೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.`,
    LOGIN: `ನಿಮ್ಮ ಫಿನ್‌ಲೀಫ್ ಲಾಗಿನ್ ಕೋಡ್ ${code}. ಇದು ${ttlMinutes} ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿಯಾಗುತ್ತದೆ. ಯಾರಿಂದೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.`,
    PASSWORD_RESET: `ಫಿನ್‌ಲೀಫ್ ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಯಿಸಲು ಕೋಡ್ ${code} ಬಳಸಿ. ಇದು ${ttlMinutes} ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿಯಾಗುತ್ತದೆ.`,
    PHONE_CHANGE: `ಫಿನ್‌ಲೀಫ್ ಖಾತೆಯ ಫೋನ್ ಸಂಖ್ಯೆ ಬದಲಾಯಿಸಲು ಕೋಡ್ ${code} ಬಳಸಿ. ಇದು ${ttlMinutes} ನಿಮಿಷಗಳಲ್ಲಿ ಅವಧಿಯಾಗುತ್ತದೆ.`,
  };

  if (l === "hi") return hi[purpose];
  if (l === "kn") return kn[purpose];
  return en[purpose];
}
