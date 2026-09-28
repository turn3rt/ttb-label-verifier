import { NextRequest, NextResponse } from "next/server";
import { extractLabelFields } from "@/lib/extract";
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
    const files = form
      .getAll("files")
      .filter((f): f is File => typeof f !== "string" && !!f && f.size > 0);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one label image." },
        { status: 400 },
      );
    }

    const results: FileVerifyResult[] = [];
    let provider = "";

    for (const file of files) {
      const fileStart = Date.now();
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const b64 = buf.toString("base64");
        const mime = file.type || "image/png";
        const extracted = await extractLabelFields(b64, mime);
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
