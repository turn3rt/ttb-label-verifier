import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import type { ExtractedFields } from "./types";
import passBourbon from "@/fixtures/pass-bourbon.json";
import failWarning from "@/fixtures/fail-warning-titlecase.json";
import passFuzzy from "@/fixtures/pass-fuzzy-brand.json";

export type FixtureDef = {
  id: string;
  expectedOverall: string;
  sha256: string;
  image: string;
  application: ExtractedFields;
  labelExtracted: ExtractedFields;
};

export const FIXTURES: FixtureDef[] = [
  passBourbon as FixtureDef,
  failWarning as FixtureDef,
  passFuzzy as FixtureDef,
];

const byId = new Map(FIXTURES.map((f) => [f.id, f]));
const byHash = new Map(FIXTURES.map((f) => [f.sha256, f]));
const byImageName = new Map(
  FIXTURES.map((f) => [f.image.toLowerCase(), f]),
);

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function resolveFixture(opts: {
  fixtureId?: string | null;
  fileName?: string | null;
  bytes?: Buffer | null;
}): FixtureDef | null {
  if (opts.fixtureId && byId.has(opts.fixtureId)) {
    return byId.get(opts.fixtureId)!;
  }
  if (opts.bytes && opts.bytes.length > 0) {
    const h = sha256Hex(opts.bytes);
    if (byHash.has(h)) return byHash.get(h)!;
  }
  if (opts.fileName) {
    const base = path.basename(opts.fileName).toLowerCase();
    if (byImageName.has(base)) return byImageName.get(base)!;
  }
  return null;
}

export function readFixtureImage(fixture: FixtureDef): Buffer {
  const p = path.join(process.cwd(), "fixtures", fixture.image);
  return readFileSync(p);
}

export function hasCloudKey(): boolean {
  return !!(process.env.XAI_API_KEY || process.env.GEMINI_API_KEY);
}

export const NO_KEY_LIVE_MESSAGE =
  "Demo fixtures work offline. Live photo needs a key or browser OCR (next phase).";
