import { NextRequest, NextResponse } from "next/server";
import { extractLabelFields } from "@/lib/extract";
import {
  FIXTURES,
  NO_KEY_LIVE_MESSAGE,
  hasCloudKey,
  resolveFixture,
} from "@/lib/fixtures";
import { compareFields, overallPass } from "@/lib/match";
import type {
  ApplicationFields,
  FileVerifyResult,
  VerifyResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function readApplication(form: FormData): ApplicationFields {
  return {
    brand: String(form.get("brand") ?? ""),
    classType: String(form.get("classType") ?? ""),
    abv: String(form.get("abv") ?? ""),
    netContents: String(form.get("netContents") ?? ""),
    governmentWarning: String(form.get("governmentWarning") ?? ""),
  };
}

export async function POST(req: NextRequest) {
  const wallStart = Date.now();
  try {
    const form = await req.formData();
    const application = readApplication(form);
    const fixtureIdField = String(form.get("fixtureId") ?? "") || null;
    const files = form
      .getAll("files")
      .filter((f): f is File => typeof f !== "string" && !!f && f.size > 0);

    // Demo: fixtureId alone (no upload) still runs real match against labelExtracted.
    if (files.length === 0 && fixtureIdField) {
      const fx = resolveFixture({ fixtureId: fixtureIdField });
      if (!fx) {
        return NextResponse.json({ error: "Unknown fixture." }, { status: 400 });
      }
      const fields = compareFields(application, fx.labelExtracted);
      const results: FileVerifyResult[] = [
        {
          fileName: fx.image,
          overallPass: overallPass(fields),
          fields,
          extracted: fx.labelExtracted,
          elapsedMs: Date.now() - wallStart,
        },
      ];
      const body: VerifyResponse = {
        results,
        elapsedMs: Date.now() - wallStart,
        provider: "fixture-offline",
      };
      return NextResponse.json(body);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one label image, or use a sample button." },
        { status: 400 },
      );
    }

    const results: FileVerifyResult[] = [];
    let provider = "";

    for (const file of files) {
      const fileStart = Date.now();
      const buf = Buffer.from(await file.arrayBuffer());
      // fixtureId still allowed when files are uploaded; filename alone never counts.
      const fx = resolveFixture({
        fixtureId: fixtureIdField,
        bytes: buf,
      });

      if (fx) {
        const fields = compareFields(application, fx.labelExtracted);
        provider = "fixture-offline";
        results.push({
          fileName: file.name || fx.image,
          overallPass: overallPass(fields),
          fields,
          extracted: fx.labelExtracted,
          elapsedMs: Date.now() - fileStart,
        });
        continue;
      }

      if (!hasCloudKey()) {
        results.push({
          fileName: file.name || "label",
          overallPass: false,
          fields: [],
          extracted: {
            brand: "",
            classType: "",
            abv: "",
            netContents: "",
            governmentWarning: "",
          },
          error: NO_KEY_LIVE_MESSAGE,
          elapsedMs: Date.now() - fileStart,
        });
        continue;
      }

      try {
        const mime = file.type || "image/png";
        const extracted = await extractLabelFields(buf.toString("base64"), mime);
        provider = extracted.provider;
        const fields = compareFields(application, extracted.fields);
        results.push({
          fileName: file.name || "label",
          overallPass: overallPass(fields),
          fields,
          extracted: extracted.fields,
          elapsedMs: Date.now() - fileStart,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Extraction failed";
        results.push({
          fileName: file.name || "label",
          overallPass: false,
          fields: [],
          extracted: {
            brand: "",
            classType: "",
            abv: "",
            netContents: "",
            governmentWarning: "",
          },
          error: msg,
          elapsedMs: Date.now() - fileStart,
        });
      }
    }

    const body: VerifyResponse = {
      results,
      elapsedMs: Date.now() - wallStart,
      provider: provider || "none",
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verify failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    fixtures: FIXTURES.map((f) => ({
      id: f.id,
      image: f.image,
      expectedOverall: f.expectedOverall,
    })),
  });
}
