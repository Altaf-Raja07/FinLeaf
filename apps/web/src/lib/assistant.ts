import "server-only";
import { prisma } from "@/lib/db";
import { formatMoney, formatCo2e, formatDate } from "@/lib/i18n";
import { sustainabilityScore, monthlyCarbon } from "@/lib/sustainability";
import { loanEligibility } from "@/lib/trust";
import type { Locale } from "@/lib/i18n";

/**
 * Financial-literacy assistant.
 *
 * A **rule-based** matcher over the user's own account data, not an LLM. That is
 * a deliberate choice, stated in the interface: a model answering "how much do
 * I owe" from text alone would be able to make the number up, and a user cannot
 * verify it. Every answer here is computed from rows in the database at the
 * moment it is returned.
 *
 * The matching is intent-keyword based, which is deliberately shallow. A bank
 * question that does not match falls back to a clear list of what the assistant
 * *can* answer, rather than guessing — a confident wrong answer is the single
 * worst thing this feature could produce.
 */

export interface AssistantAnswer {
  intent: string;
  text: string;
  /** True when the answer came from the account rather than general knowledge. */
  fromAccount: boolean;
}

interface Intent {
  id: string;
  /** Any of these matches. Order matters: the first match wins, so more
   *  specific intents are listed where they will be reached first. */
  patterns: RegExp[];
  /** Matched before the keyword pass when the question needs live data. */
  answer: (input: AnswerInput) => Promise<AssistantAnswer>;
}

interface AnswerInput {
  userId: string;
  locale: Locale;
  question: string;
}

// ---------------------------------------------------------------------------
// General-knowledge intents. These do not read the account.
// ---------------------------------------------------------------------------

const EXPLANATIONS: Record<string, Record<Locale, string>> = {
  interest: {
    en: "Interest is the cost of using someone else's money. On a loan you pay it, and it is added to what you owe, so a missed payment makes the debt grow. On a savings deposit the bank uses your money and pays you instead.",
    hi: "ब्याज किसी और के पैसे का उपयोग करने की कीमत है। कर्ज पर आप इसे देते हैं और यह आपकी क़र्ज़ राशि में जुड़ जाता है, इसलिए भुगतान छूटने पर क़र्ज़ बढ़ जाता है। बचत में पैसा रखने पर बैंक आपको ब्याज देता है।",
    kn: "ಬಡುದು ಯಾರಾದರ ಹಣಕಾಸನ್ನಾ ಬಳಸಿದಂತಿನ ವೆಚ್ಚ. ಸಾಲದಲ್ಲಿ ನೀವುು ಅದನ್ನು ಪಾವತಿಸುತ್ತೀರಿ ಮತ್ತು ನೀವುು ಒಂದುಟ್ಟಿಗೆ ಸೇರುತ್ತದೆ, ಹಾಗಾಗಿ ಪಾವತಿ ತಪ್ಪಿದರೆ ಸಾಲ ಬೆಳೆಯುತ್ತದೆ. ಉಳಿತಾಸಿನಲ್ಲಿ ಹಣ ಹಿಡಿದರೆ ಬ್ಯಾಂಕ್ ನಿಮಗೆ ಬಡುದು ಕೊಡುತ್ತದೆ.",
  },
  saving: {
    en: "Save a fixed part of every payment before you spend anything else. Ten rupees a day is about 3,600 rupees over a year. Give the goal a name and a date — 'school fees by April' is far easier to stick to than 'save more'.",
    hi: "कुछ भी खर्च करने से पहले हर भुगतान का तय हिस्सा बचा लें। रोज़ दस रुपये साल भर में लगभग 3,600 रुपये। लक्ष्य को नाम और तारीख़ दें — 'अप्रैल तक स्कूल फ़ीस' 'और बचत' से बहुत आसान है।",
    kn: "ದಾಖಲೆಯ ಆಗಿ ಖರ್ಚು ಮಾಡುವ ಮೊದಲು ಪ್ರತಿ ಪಾವತಿಯ ನಿರ್ಧಿತ ಭಾಗವನ್ನು ಉಳಿತ್ವಾಗಿ ಇರಿಸಿ. ದಿನಕ್ಕೆ ಹತ್ತು ರೂಪಾಯಿ ವರ್ಷಕ್ಕೆ ಸುಮಾರು 3,600 ರೂಪಾಯಿ. ಗುರಿಗೆ ಹೆಸರು ಮತ್ತು ದಿನಾಂಕ ನೀಡಿ — 'ಎಪ್ರಿಲ್‌ನ ಶಾಲಾ ಶುಲ್ಕ' 'ಹೆಚ್ಚು ಉಳಿತಾಸು' ಗಿಂತ ಸುಲಭ.",
  },
  trust: {
    en: "Your trust score comes from how you actually use your account: saving regularly, paying bills on time, transacting steadily, repaying loans, and taking part in circles. It is scored by a model trained on synthetic data, so treat it as a starting point rather than a judgement.",
    hi: "आपका ट्रस्ट स्कोर यह बताता है कि आप खाते का असल में कैसे उपयोग करते हैं: नियमित बचत, समय पर बिल भुगतान, स्थिर लेन-देन, कर्ज़ चुकाना और सर्कल में भागीदारी। यह सिंटेटिक डेटा से प्रशिक्षित मॉडल से स्कोर होता है, इसलिए इसे निर्णय नहीं, प्रारंभिक बिंदु मानें।",
    kn: "ನಿಮ್ಮ ವಿಶ್ವಾಸ ಅಂಕ ನಿಮ್ಮ ಖಾತೆಯನ್ನು ನೀವುು ನಿಜವಾಗಿ ಹೇಗೆ ಬಳಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ತೋರಿಸುತ್ತದೆ: ನಿಯಮಿತ ಉಳಿತ, ಸಲುವಾಗಿ ಬಿಲ್ ಪಾವತ, ಸ್ಥಿರ ವ್ಯವಹಾರ, ಸಾಲ ಪಾವತ, ಮತ್ತು ವೃತ್ತದ ಭಾಗವಹಿಸುವಿಕೆ. ಇದು ಸಿಂಟಿಟಿಕ್ ಡೇಟಾದ ತರುಬೆขೆಟಿಕಲಾಗಿದೆ ಪಡೆದ ಮಾದರಿ, ಹಾಗಾಗಿ ತೀರ್ಪಲ್ಲ, ಆರಂಭಿಕ ಅಂಶ ಎಂಬಂತೆ ನೋಡಿ.",
  },
  fraud: {
    en: "No bank and nobody working for a bank will ever ask for your one-time code, your PIN or your password — not by phone, WhatsApp, or in person. If someone does, it is fraud. Never share it, not even with someone claiming to be from FinLeaf. Take your time: fraud relies on rushing you.",
    hi: "कोई बैंक या बैंक में काम करने वाला कभी भी आपका वन-टाइम कोड, पिन या पासवर्ड नहीं माँगेगा — न फ़ोन पर, न व्हाट्सएप पर, न सामने। अगर कोई माँगे तो वह ठगी है। किसी के साथ भी साझा न करें, फिनलीफ़ का कर्मचारी बताने वाले से भी। जल्दी मत कीजिए: ठगी आश्रय लेती है जल्दबाज़ी मजबूर करने में।",
    kn: "ಯಾವುದೇ ಬ್ಯಾಂಕ್, ಅಥವಾ ಬ್ಯಾಂಕ್‌ನಲ್ಲಿ ಕೆಲಸ ಮಾಡುವ ಯಾರೂ, ನಿಮ್ಮ ವನ್-ಟೈಮ್ ಕೋಡ್, PIN ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಎಂದಿಗೂ ಕೇಳುವುದಿಲ್ಲ — ಫೋನ್‌ನಲ್ಲೂ, ವಾಟ್ಸಾಪ್‌ನಲ್ಲೂ, ಮುಖಾಮುಖಿಯಾಗೂ ಇಲ್ಲ. ಕೇಳಿದರೆ ಅದು ವಂಚನೆ. ಯಾರಿಂದೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ, ಫಿನ್‌ಲೀಫ್ ಎಂದು ಹೇಳಿದರೂ. ತಡವಾಗಿ ಮಾಡಿ: ವಂಚನೆ ನಿಮ್ಮನ್ನು ಬಲವಂತವಾಗಿ ಕಡಿಮೆ ಸಮಯಕ್ಕೆ ತಳ್ಳಿ ಮಾಡಿ.",
  },
  carbon: {
    en: "FinLeaf estimates your carbon from spending categories: each has a factor in kilograms of CO2 per 100 rupees, and the total is a monthly sum. It is an estimate, not a measurement. Paying a bill online or travelling by public transport carries less than driving or buying electronics.",
    hi: "फिनलीफ़ खर्च श्रेणियों से कार्बन का अनुमान लगाता है: हर श्रेणी का प्रति 100 रुपये कारक किलोग्राम CO2 में होता है, और कुल मासिक जोड़ होता है। यह अनुमान है, माप नहीं। ऑनलाइन बिल भुगतान या सार्वजनिक परिवहन में कार्बन कार या इलेक्ट्रॉनिक्स ख़रीदने से कम होता है।",
    kn: "ಫಿನ್‌ಲೀಫ್ ಖರ್ಚ ವರ್ಗದಿಂದ ಕಾರ್ಬನ್ ಅಂದಾಜಿಸುತ್ತದೆ: ಪ್ರತಿ ವರ್ಗಕ್ಕೆ ಪ್ರತಿ 100 ರೂಪಾಯಿಗೆ ಕಿಲೋಗ್ರಾಂ CO2 ಪಾಲುದಾರ ಇರುತ್ತದೆ, ಮತ್ತು ಮೊತ್ತ ಮಾಸಿಕ ಮೊತ್ತ. ಇದು ಅಂದಾಜು, ಅಳತೆ ಅಲ್ಲ. ಆನ್‌ಲೈನ್ ಬಿಲ್ ಪಾವತ ಅಥವಾ ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆ ಡ್ರೈವಿಂಗ್ ಅಥವಾ ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ ಖರೀದಿಗಿಂತ ಕಡಿಮೆ ಕಾರ್ಬನ್.",
  },
  points: {
    en: "Green points come from low-carbon choices: travelling by public transport, paying a bill online, topping up a phone. They have no cash value. You can spend them on offset projects in the Carbon section, which is the only thing they are for.",
    hi: "हरित अंक कम कार्बन विकल्पों से आते हैं: सार्वजनिक परिवहन, ऑनलाइन बिल भुगतान, फ़ोन टॉप-अप। इनका नकद मूल्य नहीं है। इन्हें कार्बन अनुभाग में ऑफसेट परियोजनाओं पर खर्च किया जा सकता है, जो इनका एकमात्र उद्देश्य है।",
    kn: "ಹಸಿರು ಅಂಕಗಳು ಕಡಿಮೆ ಕಾರ್ಬನ್ ಆಯ್ಕೆಗಳಿಂದ ಬರುತ್ತವೆ: ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆ, ಆನ್‌ಲೈನ್ ಬಿಲ್ ಪಾವತ, ಫೋನ್ ಟಾಪ್-ಅಪ್. ಇವುಗಳಿಗೆ ಹಣದ ಮೌಲ್ಯ ಇಲ್ಲ. ಕಾರ್ಬನ್ ವಿಭಾಗದಲ್ಲಿ ಆಫ್‌ಸೆಟ್ ಯೋಜನೆಗಳಲ್ಲಿ ಇವುಗಳನ್ನು ಖರ್ಚು ಮಾಡಬಹುದು, ಇದೇ ಇವುಗಳ ಒಂದೇ ಉದ್ದೇಶ.",
  },
  loan: {
    en: "Your limit is set by your trust score and an explicit rate policy: the better you use your account, the more you can borrow and the lower the rate. You can have one active loan at a time, and paying it on schedule is what raises your next limit.",
    hi: "आपकी सीमा आपके ट्रस्ट स्कोर और एक स्पष्ट दर नीति से तय होती है: आप खाते का जितना अच्छा उपयोग करते हैं, उतना ज़्यादा कर्ज़ ले सकते हैं और उतनी कम दर। एक बार में एक ही सक्रिय कर्ज़ हो सकता है, और समय पर चुकाना ही आपकी अगली सीमा बढ़ाता है।",
    kn: "ನಿಮ್ಮ ಮಿತಿ ವಿಶ್ವಾಸ ಅಂಕ ಮತ್ತು ಸ್ಪಷ್ಟ ದರ ನೀತಿಯಿಂದ ನಿರ್ಧಾರಗೊಳ್ಳುತ್ತದೆ: ಖಾತೆ ಎಷ್ಟು ಒಳ್ಳೆಯದಾಗಿ ಬಳಸುತ್ತೀರಿಯೋ ಅಷ್ಟು ಸಾಲ ಪಡೆಯಬಹುದು ಮತ್ತು ಅಷ್ಟು ಕಡಿಮೆ ದರ. ಒಂದೇ ಬಾರಿಗೆ ಒಂದು ಸಕ್ರಿಯ ಸಾಲ ಇರಬಹುದು, ಸಮಯಕ್ಕೆ ಪಾವತಿಸುವುದೇ ಮುಂದಿನ ಮಿತಿ ಹెಚ್ಚಿಸುತ್ತದೆ.",
  },
};

const FALLBACK: Record<Locale, string> = {
  en: "I can answer questions about your balance, recent payments, loans, savings goals, green points and carbon estimate, and explain saving, interest, trust scores, fraud and green points. Try asking one of those.",
  hi: "मैं आपके बैलेंस, हाल के भुगतान, कर्ज़, बचत लक्ष्य, हरित अंक और कार्बन अनुमान के बारे में बता सकता हूँ, और बचत, ब्याज, ट्रस्ट स्कोर, ठगी और हरित अंक समझा सकता हूँ। इनमें से कुछ पूछें।",
  kn: "ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್, ಇತ್ತೀಚಿನ ಪಾವತಿ, ಸಾಲ, ಉಳಿತದ ಗುರಿ, ಹಸಿರು ಅಂಕ ಮತ್ತು ಕಾರ್ಬನ್ ಅಂದಾಜಿನ ಬಗ್ಗೆ ಉತ್ತರಿಸಬಲ್ಲೆ, ಮತ್ತು ಉಳಿತ, ಬಡುದು, ವಿಶ್ವಾಸ ಅಂಕ, ವಂಚನೆ ಹಾಗೂ ಹಸಿರು ಅಂಕಗಳನ್ನು ವಿವರಿಸಬಲ್ಲೆ. ಇವುಗಳಲ್ಲಿ ಒಂದನ್ನು ಕೇಳಿ.",
};

/** Where a match was recognised but the account had nothing to say. */
const EMPTY: Record<Locale, Record<string, string>> = {
  en: {
    transactions: "You have not made any transactions yet. Start by sending money or paying a bill.",
    loans: "You have no loans. Your profile shows how much you are eligible for.",
    savings: "You have no savings goals yet. Create one from the Savings page.",
  },
  hi: {
    transactions: "आपने अभी कोई लेन-देन नहीं किया है। पैसा भेजने या बिल भरने से शुरू करें।",
    loans: "आपके पास कोई कर्ज़ नहीं है। आपकी प्रोफ़ाइल दिखाती है कि आप कितने के योग्य हैं।",
    savings: "आपका कोई बचत लक्ष्य नहीं है। बचत पृष्ठ से एक बनाएँ।",
  },
  kn: {
    transactions: "ನೀವುು ಇನ್ನೂ ಯಾವ ವ್ಯವಹಾರ ಮಾಡಿಲ್ಲ. ಹಣ ಕಳಿಸುವುದು ಅಥವಾ ಬಿಲ್ ಪಾವತಿಸುವುದರಿಂದ ಆರಂಭಿಸಿ.",
    loans: "ನಿಮಗೆ ಹಿೋ ಸಾಲ ത್ದ್ದೇನೆ. ನೀವುು ಎಷ್ಟದರ ಆಸ್ಪದ ಹೊಂದಿದ್ದೀರಿ ಎಂದು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ತೋರಿಸುತ್ತದೆ.",
    savings: "ನಿಮಗೆ ಇನ್ನೂ ಉಳಿತದ ಗುರಿ ಇಲ್ಲ. ಉಳಿತಾದ ಪುಟದಿಂದ ಒಂದನ್ನು ರಚಿಸಿ.",
  },
};

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

const INTENTS: Intent[] = [
  {
    id: "balance",
    patterns: [/\b(balance|how much|money left|मौजूदा|બેલેન્સ|available)\b/i, /ब्यालेंस|अवैल|मौजूदा|ಬ್ಯಾಲೆನ್ಸ್|ಲಭ್ಯ/i],
    answer: async ({ userId, locale }) => {
      const account = await prisma.account.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { openedAt: "asc" },
        select: { balance: true, number: true },
      });

      if (!account) {
        return { intent: "balance", text: EMPTY[locale].transactions, fromAccount: true };
      }

      return {
        intent: "balance",
        fromAccount: true,
        text:
          locale === "hi"
            ? `आपके खाते (${account.number}) में ${formatMoney(account.balance.toString())} हैं।`
            : locale === "kn"
              ? `ನಿಮ್ಮ ಖಾತೆ (${account.number}) ನಲ್ಲಿ ${formatMoney(account.balance.toString())} ಇದೆ.`
              : `Your account ${account.number} holds ${formatMoney(account.balance.toString())}.`,
      };
    },
  },
  {
    id: "recent",
    patterns: [/\b(recent|transaction|payment|spend|spent|history|paid)\b/i, /हाल|लेन|भुगतान|खर्च|ಇತ್ತೀಚಿನ|ವ್ಯವಹಾರ|ಪಾವತ|ಖರ್ಚ/i],
    answer: async ({ userId, locale }) => {
      const transactions = await prisma.transaction.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          amount: true,
          category: true,
          createdAt: true,
          fromUserId: true,
          note: true,
        },
      });

      if (transactions.length === 0) {
        return { intent: "recent", text: EMPTY[locale].transactions, fromAccount: true };
      }

      const list = transactions
        .map((t) => {
          const direction = t.fromUserId === userId ? "out" : "in";
          return `${direction === "out" ? "-" : "+"}${formatMoney(t.amount.toString())} ${t.category.toLowerCase().replace(/_/g, " ")} on ${formatDate(t.createdAt, locale)}`;
        })
        .join("\n");

      return {
        intent: "recent",
        fromAccount: true,
        text:
          locale === "hi"
            ? `आपके हाल के लेन-देन:\n${list}`
            : locale === "kn"
              ? `ನಿಮ್ಮ ಇತ್ತೀಚಿನ ವ್ಯವಹಾರಗಳು:\n${list}`
              : `Your recent transactions:\n${list}`,
      };
    },
  },
  {
    id: "loan",
    patterns: [/\b(loan|borrow|credit|eligib)\w*\b/i, /कर्ज|ऋण|लोन|ಸಾಲ|ಋಣ/i],
    answer: async ({ userId, locale }) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { trustScore: true },
      });

      const eligibility = loanEligibility(user.trustScore);

      if (!eligibility.eligible) {
        return {
          intent: "loan",
          fromAccount: true,
          text:
            locale === "hi"
              ? `आपका ट्रस्ट स्कोर ${user.trustScore} है। ${eligibility.reason} ऋण के लिए न्यूनतम स्कोर 40 है।`
              : locale === "kn"
                ? `ನಿಮ್ಮ ವಿಶ್ವಾಸ ಅಂಕ ${user.trustScore}. ${eligibility.reason} ಸಾಲಕ್ಕೆ ಕನಿಷ್ಠ ಸ್ಕೋರ್ 40.`
                : `Your trust score is ${user.trustScore}. ${eligibility.reason} The minimum for a loan is 40.`,
        };
      }

      return {
        intent: "loan",
        fromAccount: true,
        text:
          locale === "hi"
            ? `आपका ट्रस्ट स्कोर ${user.trustScore} है, जो ${formatMoney(eligibility.maxAmount.toString())} तक का ऋण और ${(eligibility.interestRate * 100).toFixed(2)}% दर खोलता है। समय पर चुकाना ही अगली सीमा बढ़ाता है।`
            : locale === "kn"
              ? `ನಿಮ್ಮ ವಿಶ್ವಾಸ ಅಂಕ ${user.trustScore}, ಇದು ${formatMoney(eligibility.maxAmount.toString())} ವರೆಗಿನ ಸಾಲ ಮತ್ತು ${(eligibility.interestRate * 100).toFixed(2)}% ದರ ತರುತ್ತದೆ. ಸಮಯಕ್ಕೆ ಪಾವತಿಸುವುದೇ ಮುಂದಿನ ಮಿತಿ ಹೆಚ್ಚಿಸುತ್ತದೆ.`
              : `Your trust score is ${user.trustScore}, which unlocks up to ${formatMoney(eligibility.maxAmount.toString())} at ${(eligibility.interestRate * 100).toFixed(2)}% total interest. Paying on schedule is what raises your next limit.`,
      };
    },
  },
  {
    id: "savings",
    patterns: [/\b(saving|goal|savings|target)\w*\b/i, /बचत|लक्ष्य|ಉಳಿತ|ಗುರಿ/i],
    answer: async ({ userId, locale }) => {
      const goals = await prisma.savingsGoal.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: { title: true, saved: true, target: true },
      });

      if (goals.length === 0) {
        return { intent: "savings", text: EMPTY[locale].savings, fromAccount: true };
      }

      const list = goals
        .map((g) => `${g.title}: ${formatMoney(g.saved.toString())} of ${formatMoney(g.target.toString())}`)
        .join("\n");

      return {
        intent: "savings",
        fromAccount: true,
        text:
          locale === "hi"
            ? `आपके बचत लक्ष्य:\n${list}\n\nरोज़ एक छोटी राशि जोड़ना सबसे आसान रास्ता है।`
            : locale === "kn"
              ? `ನಿಮ್ಮ ಉಳಿತದ ಗುರಿಗಳು:\n${list}\n\nದಿನಕ್ಕೆ ಸಣ್ಣ ಮತ್ತನೆ ಸೇರಿಸುವುದೇ ಸರಳ ದಾರಿ.`
              : `Your savings goals:\n${list}\n\nAdding a small amount every day is the easiest way to reach one.`,
      };
    },
  },
  {
    id: "green-points",
    patterns: [/\b(green points?|points|reward)\w*\b/i, /हरित अंक|प्रतिफल|ಹಸಿರು ಅಂಕ|ಪ್ರತಿಫಲ/i],
    answer: async ({ userId, locale }) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { greenPoints: true },
      });

      return {
        intent: "green-points",
        fromAccount: true,
        text:
          locale === "hi"
            ? `आपके पास ${user.greenPoints} हरित अंक हैं। ये सार्वजनिक परिवहन, ऑनलाइन बिल भुगतान या रीचार्ज से आते हैं। इनका नकद मूल्य नहीं है — कार्बन अनुभाग में ऑफसेट परियोजनाओं पर खर्च किए जा सकते हैं।`
            : locale === "kn"
              ? `ನಿಮ್ಮ ಬಳಿ ${user.greenPoints} ಹಸಿರು ಅಂಕಗಳಿವೆ. ಇವು ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆ, ಆನ್‌ಲೈನ್ ಬಿಲ್ ಪಾವತ ಅಥವಾ ರೀಚಾರ್ಜ್‌ನಿಂದ ಬರುತ್ತವೆ. ಹಣದ ಮೌಲ್ಯ ಇಲ್ಲ — ಕಾರ್ಬನ್ ವಿಭಾಗದ ಆಫ್‌ಸೆಟ್ ಯೋಜನೆಗಳಲ್ಲಿ ಖರ್ಚಿಸಬಹುದು.`
              : `You have ${user.greenPoints} green points. They come from public transport, online bill payments and recharges. They have no cash value, and can be spent on offset projects in the Carbon section.`,
      };
    },
  },
  {
    id: "carbon",
    patterns: [/\b(carbon|co2|footprint|environment|emission)\w*\b/i, /कार्बन|उत्सर्जन|ಕಾರ್ಬನ್|ಹೊರಾತ್ತುವಿಕೆ/i],
    answer: async ({ userId, locale }) => {
      const [score, months] = await Promise.all([
        sustainabilityScore(userId),
        monthlyCarbon(userId, 6),
      ]);

      const thisMonth = months[months.length - 1]?.co2eKg ?? 0;

      return {
        intent: "carbon",
        fromAccount: true,
        text:
          locale === "hi"
            ? `इस महीने आपका अनुमानित कार्बन ${formatCo2e(thisMonth, locale)} है, और सस्टेनेबलिटी स्कोर ${score}। यह खर्च श्रेणियों से अनुमानित है, मापा नहीं। कार्बन पृष्ठ पर श्रेणी-वार विवरण देखें।`
            : locale === "kn"
              ? `ಈ ತಿಂಗಳ ನಿಮ್ಮ ಅಂದಾಜಿತ ಕಾರ್ಬನ್ ${formatCo2e(thisMonth, locale)}, ಸುಸ್ಥೈರ್ಯ ಸ್ಕೋರ್ ${score}. ಇದು ಖರ್ಚ ವರ್ಗದಿಂದ ಅಂದಾಜಿಸಿದುದು, ಅಳತೆ ಅಲ್ಲ. ಕಾರ್ಬನ್ ಪುಟದಲ್ಲಿ ವರ್ಗ-ವಾರ ವಿವರ ನೋಡಿ.`
              : `Your estimated carbon this month is ${formatCo2e(thisMonth, locale)} and your sustainability score is ${score}. The figure is estimated from spending categories, not measured — the Carbon page breaks it down.`,
      };
    },
  },
];

const EXPLANATION_INTENTS: Array<{ id: string; key: keyof typeof EXPLANATIONS; patterns: RegExp[] }> = [
  {
    id: "fraud",
    key: "fraud",
    patterns: [/\b(fraud|scam|otp|safe|security|phish)\w*\b/i, /ठग|धोखा|ঝু|ఫ地铁|फॉलっ|ವಂಚನೆ|ಧೋಖೆ|OTP/i],
  },
  {
    id: "interest",
    key: "interest",
    patterns: [/\b(interest|rate)\b/i, /ब्याज|ದರ|ಬ್ಯಾಜಿ|ಸಾಲದ ದರ/i],
  },
  {
    id: "saving",
    key: "saving",
    patterns: [/\b(how to save|save more|budget)\b/i, /बचat|ಉಳಿತಾಸು ಹೇಗೆ|ಉಳಿತಾಸು ಹೆಚ್ಚು/i],
  },
  {
    id: "trust",
    key: "trust",
    patterns: [/\b(trust score|score|why is my score)\b/i, /ट्रस्ट स्कोर|ವಿಶ್ವಾಸ ಅಂಕ/i],
  },
  {
    id: "carbon-explanation",
    key: "carbon",
    patterns: [/\b(how.*carbon|what.*carbon|carbon.*mean)\b/i, /कार्बन क्या|ಕಾರ್ಬನ್ ಏನು/i],
  },
  {
    id: "points-explanation",
    key: "points",
    patterns: [/\b(what.*green points|green points.*for)\b/i, /हरित अंक क्या|ಹಸಿರು ಅಂಕ ಏಂಬ敞/i],
  },
];

/**
 * Answers a question, or returns the fallback.
 *
 * Order is deliberate: account intents are checked first, because "how much do
 * I owe" needs a live answer and "how much" alone is otherwise ambiguous.
 */
export async function answerQuestion(input: AnswerInput): Promise<AssistantAnswer> {
  const { question, locale } = input;
  const q = question.trim();

  if (q.length === 0) {
    return { intent: "empty", text: FALLBACK[locale], fromAccount: false };
  }

  for (const intent of INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(q))) {
      return intent.answer(input);
    }
  }

  for (const intent of EXPLANATION_INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(q))) {
      return {
        intent: intent.id,
        text: EXPLANATIONS[intent.key][locale],
        fromAccount: false,
      };
    }
  }

  return { intent: "unmatched", text: FALLBACK[locale], fromAccount: false };
}

/** Sample questions offered by the interface. */
export const SUGGESTED_QUESTIONS: Record<Locale, string[]> = {
  en: [
    "What is my balance?",
    "What did I spend recently?",
    "Can I take a loan?",
    "How do I save more?",
    "What are green points?",
    "What is my carbon footprint?",
    "How do I stay safe from fraud?",
  ],
  hi: [
    "मेरा बैलेंस कितना है?",
    "मैंने हाल में कितना खर्च किया?",
    "क्या मैं कर्ज़ ले सकता हूँ?",
    "मैं और बचत कैसे करूँ?",
    "हरित अंक क्या हैं?",
    "मेरा कार्बन प्रभाव क्या है?",
    "ठगी से कैसे बचूँ?",
  ],
  kn: [
    "ನನ್ನ ಬ್ಯಾಲೆನ್ಸ್ ಎಷ್ಟು?",
    "ನಾನೇನು ಇತ್ತೀಚಿಗೆ ಖರ್ಚು ಮಾಡಿದ್ದೇನೆ?",
    "ನಾನು ಸಾಲ ಪಡೆಯಬಹುದೇ?",
    "ಹೆಚ್ಚು ಉಳಿತಾಸು ಹೇಗೆ?",
    "ಹಸಿರು ಅಂಕಗಳೇನು?",
    "ನನ್ನ ಕಾರ್ಬನ್ ಪಾದ ಏನು?",
    "ವಂಚನೆಯಿಂದ ಹೇಗೆ ಕಾಪಾಡಿಕೊಳ್ಳುವೆ?",
  ],
};
