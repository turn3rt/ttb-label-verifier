/**
 * Pre-commit verification for ttb-label-verifier gaps.
 * Run: npx tsx scripts/verify-checks.ts
 */
import { readFileSync } from "fs";
import path from "path";
import {
  compareFields,
  checkGovernmentWarning,
  fuzzyEqual,
  normalizeNet,
  STANDARD_WARNING_BODY,
} from "../lib/match";
import { resolveFixture, sha256Hex, FIXTURES } from "../lib/fixtures";
import type { ApplicationFields, ExtractedFields } from "../lib/types";

const STANDARD_FULL = `GOVERNMENT WARNING: ${STANDARD_WARNING_BODY}`;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function fieldPass(fields: ReturnType<typeof compareFields>, name: string) {
  const f = fields.find((x) => x.field === name);
  return !!f?.pass;
}

async function main() {
  let failed = 0;
  const run = (title: string, fn: () => void) => {
    console.log(`\n=== ${title} ===`);
    try {
      fn();
    } catch (e) {
      failed++;
      console.error(e instanceof Error ? e.message : e);
    }
  };

  run("1a. Sample pass-bourbon → Pass", () => {
    const t0 = Date.now();
    const fx = FIXTURES.find((f) => f.id === "pass-bourbon")!;
    const fields = compareFields(fx.application, fx.labelExtracted);
    const overall = fields.every((f) => f.pass);
    const ms = Date.now() - t0;
    assert(overall, `overall Pass (got ${overall})`);
    assert(ms < 5000, `under 5s (${ms}ms)`);
  });

  run("1b. fail-warning-titlecase → Fail on header", () => {
    const t0 = Date.now();
    const fx = FIXTURES.find((f) => f.id === "fail-warning-titlecase")!;
    const fields = compareFields(fx.application, fx.labelExtracted);
    const overall = fields.every((f) => f.pass);
    const warn = fields.find((f) => f.field === "governmentWarning")!;
    const ms = Date.now() - t0;
    assert(!overall, "overall Fail");
    assert(!warn.pass, "warning field fails");
    assert(
      /title case|all-caps|Header/i.test(warn.detail || ""),
      `detail mentions header: ${warn.detail}`,
    );
    assert(ms < 5000, `under 5s (${ms}ms)`);
  });

  run("1c. pass-fuzzy-brand → Pass (Stone's Throw / 45% / 750 mL)", () => {
    const t0 = Date.now();
    const fx = FIXTURES.find((f) => f.id === "pass-fuzzy-brand")!;
    const fields = compareFields(fx.application, fx.labelExtracted);
    const overall = fields.every((f) => f.pass);
    const ms = Date.now() - t0;
    assert(overall, "overall Pass");
    assert(fieldPass(fields, "brand"), "brand matches");
    assert(fieldPass(fields, "abv"), "abv matches");
    assert(fieldPass(fields, "netContents"), "net matches");
    assert(ms < 5000, `under 5s (${ms}ms)`);
  });

  run('2. Brand "NOT THE BRAND" on bourbon → fails only brand', () => {
    const fx = FIXTURES.find((f) => f.id === "pass-bourbon")!;
    const app: ApplicationFields = {
      ...fx.application,
      brand: "NOT THE BRAND",
    };
    const fields = compareFields(app, fx.labelExtracted);
    assert(!fieldPass(fields, "brand"), "brand fails");
    assert(fieldPass(fields, "classType"), "class passes");
    assert(fieldPass(fields, "abv"), "abv passes");
    assert(fieldPass(fields, "netContents"), "net passes");
    assert(fieldPass(fields, "governmentWarning"), "warning passes");
    assert(!fields.every((f) => f.pass), "overall Fail");
  });

  run("3. Wrong app warning body vs Old Tom label → warning FAILS", () => {
    const fx = FIXTURES.find((f) => f.id === "pass-bourbon")!;
    const app: ApplicationFields = {
      ...fx.application,
      governmentWarning:
        "GOVERNMENT WARNING: (1) Drink responsibly. (2) Do not drive.",
    };
    const fields = compareFields(app, fx.labelExtracted);
    assert(!fieldPass(fields, "governmentWarning"), "warning fails");
    assert(fieldPass(fields, "brand"), "brand still passes");
  });

  run("4. Filename-only tiny buffer named pass-bourbon.png → null", () => {
    const tiny = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const byHash = resolveFixture({ bytes: tiny });
    assert(byHash === null, "tiny bytes do not resolve");
    const byId = resolveFixture({ fixtureId: "pass-bourbon" });
    assert(byId !== null && byId.id === "pass-bourbon", "fixtureId still works");
    const real = readFileSync(
      path.join(process.cwd(), "fixtures", "pass-bourbon.png"),
    );
    const byReal = resolveFixture({ bytes: real });
    assert(byReal !== null && byReal.id === "pass-bourbon", "hash match works");
    assert(
      resolveFixture({ bytes: Buffer.from("not a png named pass-bourbon.png") }) ===
        null,
      "wrong bytes named pass-bourbon.png do not resolve",
    );
  });

  run('5. normalizeNet / fuzzyEqual: "0.75 L" matches "750 mL"', () => {
    assert(
      normalizeNet("0.75 L") === normalizeNet("750 mL"),
      `normalizeNet equal (${normalizeNet("0.75 L")} vs ${normalizeNet("750 mL")})`,
    );
    assert(fuzzyEqual("0.75 L", "750 mL", "net"), "fuzzyEqual net");
  });

  run("6. Title-case app header + all-caps label + matching body + bold → PASS", () => {
    const appWarn =
      "Government Warning: " + STANDARD_WARNING_BODY;
    const labelWarn = STANDARD_FULL;
    const r = checkGovernmentWarning(appWarn, labelWarn, true);
    assert(r.pass, `warning passes: ${r.detail}`);
    const fields = compareFields(
      {
        brand: "X",
        classType: "Y",
        abv: "40%",
        netContents: "750 mL",
        governmentWarning: appWarn,
      },
      {
        brand: "X",
        classType: "Y",
        abv: "40%",
        netContents: "750 mL",
        governmentWarning: labelWarn,
        warningHeaderBold: true,
      },
    );
    assert(fieldPass(fields, "governmentWarning"), "compareFields warning passes");
  });

  run("7. warningHeaderBold false or missing → warning FAILS", () => {
    const labelWarn = STANDARD_FULL;
    const rFalse = checkGovernmentWarning(STANDARD_FULL, labelWarn, false);
    assert(!rFalse.pass, "bold false fails");
    const rMissing = checkGovernmentWarning(STANDARD_FULL, labelWarn, undefined);
    assert(!rMissing.pass, "bold missing fails");
    const extractedMissing: ExtractedFields = {
      brand: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      abv: "45%",
      netContents: "750 mL",
      governmentWarning: labelWarn,
    };
    const fx = FIXTURES.find((f) => f.id === "pass-bourbon")!;
    const fields = compareFields(fx.application, extractedMissing);
    assert(!fieldPass(fields, "governmentWarning"), "missing bold fails in compareFields");
  });

  run("Extra: fixtures all have warningHeaderBold true", () => {
    for (const fx of FIXTURES) {
      assert(
        fx.labelExtracted.warningHeaderBold === true,
        `${fx.id} has warningHeaderBold true`,
      );
    }
  });

  run("Extra: sha256 of PNGs match fixture JSON", () => {
    for (const fx of FIXTURES) {
      const buf = readFileSync(path.join(process.cwd(), "fixtures", fx.image));
      assert(sha256Hex(buf) === fx.sha256, `${fx.id} sha256 matches`);
    }
  });

  console.log("\n==============================");
  if (failed) {
    console.error(`${failed} check group(s) failed`);
    process.exit(1);
  }
  console.log("All required checks passed");
}

main();
