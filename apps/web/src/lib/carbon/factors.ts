/**
 * Static emission-factor table for spend-based carbon accounting.
 *
 * ## Method
 *
 * Factors follow GHG Protocol Scope 3.1 category-based estimation: emissions
 * are inferred from what money was spent on rather than measured directly. This
 * is the same approach used by Climatiq, Doconomy and Aspiration.
 *
 *     co2e_kg = (amount_inr / 100) * factor_per_100_inr
 *
 * ## Units
 *
 * Every factor is **kilograms of CO2-equivalent per INR 100 spent**, which keeps
 * the arithmetic auditable against the worked example in the project proposal:
 * INR 2,000 of fuel x 2.5 = 50 kg CO2e.
 *
 * ## Provenance and honest limitations
 *
 * The grid factor is based on India's Central Electricity Authority CO2
 * Baseline Database; the remaining factors are indicative order-of-magnitude
 * lifecycle estimates of the kind published for fuels and passenger travel.
 * They are **not** lab measurements and are not specific to any product: real
 * emissions depend on the exact good, the distance travelled and the energy
 * source, none of which a bank ledger records. Treat every figure this table
 * produces as an estimate and present it as one in the interface.
 *
 * Where a Climatiq API key is configured (see src/lib/carbon/index.ts) the
 * figures are looked up against a standards-aligned provider instead; this
 * table is the offline fallback and the cross-check baseline.
 */

export interface EmissionFactor {
  /** kg CO2e per INR 100 spent. Negative means carbon removed. */
  factorPer100Inr: number;
  /** Display name per locale. */
  labels: Record<string, string>;
  /**
   * True when spending in this category is a lower-carbon choice, and the
   * green points awarded for it.
   */
  greenPoints: number;
  /** Short explanation shown in the UI beneath the category's estimate. */
  note: Record<string, string>;
}

export const EMISSION_FACTORS = {
  FUEL: {
    factorPer100Inr: 2.5,
    labels: { en: "Fuel", hi: "ईंधन", kn: "ಇಂಧನ" },
    greenPoints: 0,
    note: {
      en: "Direct combustion of petrol or diesel.",
      hi: "पेट्रोल या डीज़ल के सीधे जलन से।",
      kn: "ಪೆಟ್ರೋಲ್ ಅಥವಾ ಡೀಸಲ್ ನೇರ ಸುಡುವಿಕೆಯಿಂದ.",
    },
  },
  TRAVEL_PRIVATE: {
    factorPer100Inr: 1.4,
    labels: { en: "Private travel", hi: "निजी यात्रा", kn: "ಖಾಸಿ ಪ್ರಯಾಣ" },
    greenPoints: 0,
    note: {
      en: "Car, bike or taxi journeys.",
      hi: "कार, बाइक या टैक्सी की यात्राएँ।",
      kn: "ಕಾರು, ಬೈಕ್ ಅಥವಾ ಟ್ಯಾಕ್ಸಿ ಪ್ರಯಾಣಗಳು.",
    },
  },
  TRAVEL_PUBLIC: {
    factorPer100Inr: 0.35,
    labels: { en: "Public transport", hi: "सार्वजनिक परिवहन", kn: "ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆ" },
    greenPoints: 30,
    note: {
      en: "Bus and train travel carry far less carbon per rupee than a private vehicle.",
      hi: "बस और रेल की यात्रा में प्रति रुपये कार्बन बहुत कम होता है।",
      kn: "ಬಸ್ಸು ಮತ್ತು ರೈಲಿನ ಪ್ರಯಾಣದಲ್ಲಿ ಪ್ರತಿ ರೂಪಾಯಿಗೆ ಕಾರ್ಬನ್ ತುಂಬಾ ಕಡಿಮೆ.",
    },
  },
  ELECTRICITY: {
    factorPer100Inr: 1.9,
    labels: { en: "Electricity", hi: "बिजली", kn: "ವಿದ್ಯುತ್" },
    greenPoints: 0,
    note: {
      en: "Based on the Indian grid emission intensity published by the Central Electricity Authority.",
      hi: "केंद्रीय विद्युत प्राधिकरण द्वारा प्रकाशित भारतीय ग्रिड उत्सर्जन तीव्रता पर आधारित।",
      kn: "ಕೇಂದ್ರೀಯ ವಿದ್ಯುತ್ ಪ್ರಾಧಿಕರಣ ಪ್ರಕಟಿಸಿದ ಭಾರತದ ಗ್ರಿಡ್ ಹೊರಾತ್ತುವಿಕೆ ತೀವ್ರತೆಯ ಆಧಾರದ ಮೇಲೆ.",
    },
  },
  GROCERIES: {
    factorPer100Inr: 0.45,
    labels: { en: "Groceries", hi: "किराना", kn: "ದೈನಂದಿನ ಕಾರುದಾರಿ" },
    greenPoints: 15,
    note: {
      en: "Mostly local and lightly processed, so a relatively small footprint.",
      hi: "मुख्यतः स्थानीय और कम प्रसंस्कृत, इसलिए अपेक्षाकृत कम प्रभाव।",
      kn: "ಮುಖ್ಯವಾಗಿ ಸ್ಥಳೀಯ ಮತ್ತು ಸ್ವಲ್ಪ ಸಂಸ್ಕರಿಸಿದ್ದ್ದು, ಹಾಗಾಗಿ ಕಡಿಮೆ ಪಾದದ ಅಳಿವು.",
    },
  },
  DINING: {
    factorPer100Inr: 0.8,
    labels: { en: "Dining out", hi: "बाहर खाना", kn: "ಹೊರತಿನಲ್ಲಿ ಊಟ" },
    greenPoints: 0,
    note: {
      en: "Includes the energy used in cooking and cold chains.",
      hi: "खाना पकाने और शीतल शृंखला में उपयोग ऊर्जा सम्मिलित।",
      kn: "ಅಡುಗೆ ಮಾಡುವುದು ಮತ್ತು ಶೀತಲ ಸರಪಟ್ಟಿನ ಶಕ್ತಿ ಸೇರಿದೆ.",
    },
  },
  EDUCATION: {
    factorPer100Inr: 0.15,
    labels: { en: "Education", hi: "शिक्षा", kn: "ಶಿಕ್ಷಣ" },
    greenPoints: 10,
    note: {
      en: "Books and course fees; emissions are low and mostly from printing.",
      hi: "किताबें और कोर्स फीस; उत्सर्जन कम और मुख्यतः मुद्रण से।",
      kn: "ಪುಸ್ತಕ ಮತ್ತು ಕೋರ್ಸ್ ಶುಲ್ಕ; ಹೊರಾತ್ತುವಿಕೆ ಕಡಿಮೆ, ಮುಖ್ಯವಾಗಿ ಮುದ್ರಣದಿಂದ.",
    },
  },
  HEALTHCARE: {
    factorPer100Inr: 0.4,
    labels: { en: "Healthcare", hi: "स्वास्थ्य सेवा", kn: "ಆರೋಗ್ಯ ಸೇವೆ" },
    greenPoints: 0,
    note: {
      en: "Medicine and consultation, including manufacturing of pharmaceuticals.",
      hi: "दवा और परामर्श, दवा निर्माण सहित।",
      kn: "ಔಷಧಿ ಮತ್ತು ಸಲಹೆ, ಔಷಧಿ ತಯಾರಿಕೆಯನ್ನು ಒಳಗೆ.",
    },
  },
  ELECTRONICS: {
    factorPer100Inr: 2.2,
    labels: { en: "Electronics", hi: "इलेक्ट्रॉनिक्स", kn: "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್" },
    greenPoints: 0,
    note: {
      en: "Dominated by embodied manufacturing emissions rather than use.",
      hi: "मुख्यतः निर्माण से जुड़े उत्सर्जन, उपयोग से नहीं।",
      kn: "ಮುಖ್ಯವಾಗಿ ಉತ್ಪಾದನೆಯ ಹೊರಾತ್ತುವಿಕೆ, ಬಳಕೆಯಿಂದಲ್ಲ.",
    },
  },
  CLOTHING: {
    factorPer100Inr: 1.1,
    labels: { en: "Clothing", hi: "कपड़े", kn: "ಬಟ್ಟೆ" },
    greenPoints: 0,
    note: {
      en: "Dyeing and finishing dominate the footprint of a garment.",
      hi: "रंगाई और फिनिशिंग कपड़े के प्रभाव में अधिकांश योगदान करते हैं।",
      kn: "ಬಣ್ಣ ಹಾಕುವಿಕೆ ಮತ್ತು ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ ಪಾದದ ಅಳವಿಗೆ ಮುಖ್ಯ ಕೊಡುಗೆ.",
    },
  },
  HOUSING: {
    factorPer100Inr: 0.6,
    labels: { en: "Housing", hi: "आवास", kn: "ವಾಸಸ್ಥಳ" },
    greenPoints: 0,
    note: {
      en: "Construction materials and ongoing home energy use.",
      hi: "निर्माण सामग्री और घर के ऊर्जा उपयोग।",
      kn: "ಕಟ್ಟುಬಣಿ ಸಾಮಗ್ರಿ ಮತ್ತು ಮನೆಯ ಶಕ್ತಿ ಬಳಕೆ.",
    },
  },
  RENT: {
    factorPer100Inr: 0.25,
    labels: { en: "Rent", hi: "किराया", kn: "ಬಾಡಿಗೆ" },
    greenPoints: 0,
    note: {
      en: "Mostly the embodied emissions of the building being rented.",
      hi: "मुख्यतः किराए पर दी गई इमारत के निर्माण उत्सर्जन।",
      kn: "ಮುಖ್ಯವಾಗಿ ಬಾಡಿಗೆಗೆ ಪಡೆಯಲಾದ ಕಟ್ಟಣದ ಹೊರಾತ್ತುವಿಕೆ.",
    },
  },
  SALARY: {
    factorPer100Inr: 0,
    labels: { en: "Income", hi: "आय", kn: "ಆದಾಯ" },
    greenPoints: 0,
    note: {
      en: "Money received. Not counted as an emission of the account holder.",
      hi: "प्राप्त राशि। खाताधारक का उत्सर्जन नहीं माना जाता।",
      kn: "ಪಡೆದ ಹಣಕಾಸು. ಖಾತಾಧಾರಕನ ಹೊರಾತ್ತುವಿಕೆಯಾಗಿ ಎಣಿಸುವುದಿಲ್ಲ.",
    },
  },
  TRANSFER: {
    factorPer100Inr: 0,
    labels: { en: "Transfer", hi: "ट्रांसफ़र", kn: "ವರೆಗುವರೆಗು" },
    greenPoints: 0,
    note: {
      en: "Money moved between accounts. The underlying spend is counted where it happens.",
      hi: "खातों के बीच स्थानांतरित राशि। असली खर्च जहां हुआ वहीं गिना जाता है।",
      kn: "ಖಾತೆಗಳ ನಡುವೆ ಸಾಧಿಸಿದ ಹಣಕಾಸು. ನಿಜವಾದ ಖರ್ಚ ಸೂಟಲು ಎಲ್ಲಿಯಾದರೂ ಎಣಿಸಲಾಗುತ್ತದೆ.",
    },
  },
  BILL_PAYMENT: {
    factorPer100Inr: 0.2,
    labels: { en: "Bill payment", hi: "बिल भुगतान", kn: "ಬಿಲ್ ಪಾವತಿ" },
    greenPoints: 20,
    note: {
      en: "Paying a utility bill online avoids a printed statement and a branch visit.",
      hi: "बिजली का बिल ऑनलाइन भरने से प्रिंटेड विवरण और ब्रांच विज़ा से बचत होती है।",
      kn: "ಬಿಲ್ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಪಾವತಿಸಿದರೆ ಮುದ್ರಿತ ವಿವರಣೆ ಮತ್ತು ಶಾಖೆ ಭೇಟಿ ತಪ್ಪಿಸುತ್ತದೆ.",
    },
  },
  RECHARGE: {
    factorPer100Inr: 0.05,
    labels: { en: "Recharge", hi: "रीचार्ज", kn: "ರೀಚಾರ್ಜ್" },
    greenPoints: 15,
    note: {
      en: "A top-up that avoids a paper recharge receipt.",
      hi: "ऐसा रीचार्ज जिसके लिए पेपर रसीद नहीं चाहिए।",
      kn: "ಕಾಗದದ ರಿಚಾರ್ಜ್ ರಸೀದಿ ಬೇಡ ಮಾಡುವ ಟಾಪ್-ಅಪ್.",
    },
  },
  LOAN: {
    factorPer100Inr: 0,
    labels: { en: "Loan", hi: "ऋण", kn: "ಸಾಲ" },
    greenPoints: 0,
    note: {
      en: "Loan movement, not consumption.",
      hi: "ऋण संबंधी लेनदेन, उपभोग नहीं।",
      kn: "ಸಾಲದ ಚಲನವೆ, ಸಾವಿನು ಅಲ್ಲ.",
    },
  },
  SAVINGS: {
    factorPer100Inr: 0,
    labels: { en: "Savings", hi: "बचत", kn: "ಉಳಿತಾದ ಹಣಕಾಸು" },
    greenPoints: 0,
    note: {
      en: "Money moved into savings; not consumption.",
      hi: "बचत में रखा गया पैसा; उपभोग नहीं।",
      kn: "ಉಳಿತಾದದಲ್ಲಿ ಇರುವ ಹಣಕಾಸು; ಸಾವಿನು ಅಲ್ಲ.",
    },
  },
  GREEN_REWARD: {
    factorPer100Inr: 0,
    labels: { en: "Green reward", hi: "हरित पुरस्कार", kn: "ಹಸಿರು ಪ್ರತಿಫಲ" },
    greenPoints: 0,
    note: {
      en: "Reward redemption.",
      hi: "पुरस्कार का उपयोग।",
      kn: "ಪ್ರತಿಫಲ ಬಳಕೆ.",
    },
  },
  OFFSET: {
    factorPer100Inr: -1,
    labels: { en: "Carbon offset", hi: "कार्बन ऑफसेट", kn: "ಕಾರ್ಬನ್ ಆಫ್‌ಸೆಟ್" },
    greenPoints: 50,
    note: {
      en: "Negative by design: this spend funds carbon removal.",
      hi: "डिज़ाइन के अनुसार ऋणात्मक: यह खर्च कार्बन हटाने में लगता है।",
      kn: "ವಿನ್ಯಾಸದಂತೆ ಋಣಾತ್ಮಕ: ಈ ಖರ್ಚ ಕಾರ್ಬನ್ ತೆಗೆದುಹಾಕಲು ಬಳಸುತ್ತದೆ.",
    },
  },
  OTHER: {
    factorPer100Inr: 0.5,
    labels: { en: "Other", hi: "अन्य", kn: "ಇತರೆ" },
    greenPoints: 0,
    note: {
      en: "No category data, so a mid-range blended factor is applied.",
      hi: "श्रेणी डेटा नहीं, इसलिए मध्यम सामान्य कारक लागू होता है।",
      kn: "ವರ್ಗದ ಮಾಹಿತಿ ಇಲ್ಲ, ಹಾಗಾಗಿ ಮಧ್ಯಮ ಸಾಮಾನ್ಯ ಅಂಶ ಅನ್ವಯಿಸಲಾಗುತ್ತದೆ.",
    },
  },
} as const satisfies Record<string, EmissionFactor>;

export type EmissionCategory = keyof typeof EMISSION_FACTORS;

export function isEmissionCategory(value: string): value is EmissionCategory {
  return Object.hasOwn(EMISSION_FACTORS, value);
}

/**
 * Estimated kg CO2e for a spend.
 *
 * Rounded to 4 decimal places — one ten-thousandth of a kilogram — which is
 * finer than the precision of the underlying factors and keeps stored values
 * stable.
 */
export function co2eFor(category: string, amountInr: number | string): number {
  const key = isEmissionCategory(category) ? category : "OTHER";
  const factor = EMISSION_FACTORS[key].factorPer100Inr;
  const amount = typeof amountInr === "string" ? Number(amountInr) : amountInr;
  return round4((amount / 100) * factor);
}

/** Green points earned for the spending choice alone, ignoring amount. */
export function greenPointsFor(category: string): number {
  const key = isEmissionCategory(category) ? category : "OTHER";
  return EMISSION_FACTORS[key].greenPoints;
}

export function labelFor(category: string, locale = "en"): string {
  const key = isEmissionCategory(category) ? category : "OTHER";
  const labels: Record<string, string> = EMISSION_FACTORS[key].labels;
  return labels[locale] ?? labels.en;
}

export function noteFor(category: string, locale = "en"): string {
  const key = isEmissionCategory(category) ? category : "OTHER";
  const notes: Record<string, string> = EMISSION_FACTORS[key].note;
  return notes[locale] ?? notes.en;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Sheets of paper avoided by going digital.
 *
 * The assumptions are stated rather than hidden, because "you saved X sheets
 * of paper" is a claim the interface makes to the user:
 *   - one statement/money order per transaction, 1 sheet;
 *   - one printed bill receipt per bill payment, 1 sheet;
 *   - one form per branch or agent visit, 2 sheets.
 * Users can revise these constants if a study of actual behaviour disagrees.
 */
export const PAPERLESS_SHEETS_PER_TRANSACTION = 1;
export const PAPERLESS_SHEETS_PER_BILL = 1;
export const PAPERLESS_SHEETS_PER_AGENT_VISIT = 2;
