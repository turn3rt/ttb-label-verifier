import type { ApplicationFields, ExtractedFields, FieldResult } from "./types";

/** Canonical TTB government health warning body (after the header). */
export const STANDARD_WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const REQUIRED_WARNING_HEADER = "GOVERNMENT WARNING:";

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip punctuation/case for brand & class fuzzy compare. */
export function normalizeLoose(s: string): string {
  return collapseSpace(s)
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9%./ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize ABV / proof so "45% Alc./Vol." ≈ "90 Proof" ≈ "45%".
 */
export function normalizeAbv(s: string): string {
  const t = collapseSpace(s).toLowerCase();
  const proof = t.match(/(\d+(?:\.\d+)?)\s*proof/);
  if (proof) {
    const p = parseFloat(proof[1]);
    if (!Number.isNaN(p)) return `abv:${(p / 2).toFixed(2)}`;
  }
  const pct = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    const a = parseFloat(pct[1]);
    if (!Number.isNaN(a)) return `abv:${a.toFixed(2)}`;
  }
  const bare = t.match(/(\d+(?:\.\d+)?)/);
  if (bare) {
    const n = parseFloat(bare[1]);
    if (!Number.isNaN(n)) {
      // Heuristic: values > 60 are likely proof
      if (n > 60) return `abv:${(n / 2).toFixed(2)}`;
      return `abv:${n.toFixed(2)}`;
    }
  }
  return normalizeLoose(s);
}

/**
 * Normalize net contents: "750 mL" ≈ "750ml" ≈ "750 ML" ≈ "0.75 L".
 */
export function normalizeNet(s: string): string {
  const t = collapseSpace(s).toLowerCase().replace(/,/g, "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ml|milliliters?|l|liters?|oz|fl\.?\s*oz)/i);
  if (m) {
    let n = parseFloat(m[1]);
    let unit = m[2].toLowerCase().replace(/\s+/g, "").replace(".", "");
    if (unit.startsWith("liter") || unit === "l") {
      n = n * 1000;
      unit = "ml";
    } else if (unit.startsWith("milliliter") || unit === "ml") {
      unit = "ml";
    } else if (unit.includes("oz")) {
      unit = "floz";
    }
    return `${n}${unit}`;
  }
  return normalizeLoose(s);
}

export function fuzzyEqual(
  a: string,
  b: string,
  kind: "text" | "abv" | "net",
): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (kind === "abv") return normalizeAbv(a) === normalizeAbv(b);
  if (kind === "net") return normalizeNet(a) === normalizeNet(b);
  return normalizeLoose(a) === normalizeLoose(b);
}

/**
 * Warning check:
 * - Label header must be literally GOVERNMENT WARNING: (all caps).
 * - Label header must be bold (warningHeaderBold === true).
 * - Application may use title-case header; body is compared after stripping
 *   a case-insensitive "government warning:" prefix from the application text.
 * - If application warning is blank, compare label body to STANDARD_WARNING_BODY.
 * - If application warning is filled, label body must match that application body.
 */
export function checkGovernmentWarning(
  application: string,
  extracted: string,
  warningHeaderBold?: boolean,
): { pass: boolean; detail: string } {
  const app = collapseSpace(application);
  const ext = collapseSpace(extracted);

  const headerOk = (s: string) => {
    const upperStart = s.slice(0, REQUIRED_WARNING_HEADER.length);
    return upperStart === REQUIRED_WARNING_HEADER;
  };

  if (!headerOk(ext)) {
    const titleCase =
      /^Government Warning:/i.test(ext) &&
      !ext.startsWith(REQUIRED_WARNING_HEADER);
    return {
      pass: false,
      detail: titleCase
        ? 'Header must be all-caps "GOVERNMENT WARNING:" — title case fails'
        : `Extracted warning missing exact header "${REQUIRED_WARNING_HEADER}"`,
    };
  }

  if (warningHeaderBold !== true) {
    return {
      pass: false,
      detail: "Warning header must be bold on the label",
    };
  }

  const labelBody = collapseSpace(
    ext.slice(REQUIRED_WARNING_HEADER.length),
  ).toLowerCase();

  const expectedBody = collapseSpace(STANDARD_WARNING_BODY).toLowerCase();

  let target: string;
  if (app) {
    // Strip optional header (any case) from application for body compare.
    const appBodyRaw = app.replace(/^government warning:\s*/i, "");
    target = collapseSpace(appBodyRaw).toLowerCase();
  } else {
    target = expectedBody;
  }

  if (labelBody !== target) {
    return {
      pass: false,
      detail: "Warning body text does not match the required statement",
    };
  }

  return { pass: true, detail: "Header all-caps and bold; body matches" };
}

export function compareFields(
  application: ApplicationFields,
  extracted: ExtractedFields,
): FieldResult[] {
  const brandPass = fuzzyEqual(application.brand, extracted.brand, "text");
  const classPass = fuzzyEqual(
    application.classType,
    extracted.classType,
    "text",
  );
  const abvPass = fuzzyEqual(application.abv, extracted.abv, "abv");
  const netPass = fuzzyEqual(
    application.netContents,
    extracted.netContents,
    "net",
  );
  const warn = checkGovernmentWarning(
    application.governmentWarning,
    extracted.governmentWarning,
    extracted.warningHeaderBold,
  );

  return [
    {
      field: "brand",
      rule: "fuzzy",
      pass: brandPass,
      application: application.brand,
      extracted: extracted.brand,
    },
    {
      field: "classType",
      rule: "fuzzy",
      pass: classPass,
      application: application.classType,
      extracted: extracted.classType,
    },
    {
      field: "abv",
      rule: "fuzzy",
      pass: abvPass,
      application: application.abv,
      extracted: extracted.abv,
    },
    {
      field: "netContents",
      rule: "fuzzy",
      pass: netPass,
      application: application.netContents,
      extracted: extracted.netContents,
    },
    {
      field: "governmentWarning",
      rule: "exact",
      pass: warn.pass,
      application: application.governmentWarning,
      extracted: extracted.governmentWarning,
      detail: warn.detail,
    },
  ];
}

export function overallPass(fields: FieldResult[]): boolean {
  return fields.every((f) => f.pass);
}
