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

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Offline fixture only when:
 * - explicit fixtureId from a sample button, OR
 * - uploaded bytes whose sha256 matches a known fixture.
 * Filename alone never resolves a fixture.
 */
export function resolveFixture(opts: {
  fixtureId?: string | null;
  bytes?: Buffer | null;
}): FixtureDef | null {
  if (opts.fixtureId && byId.has(opts.fixtureId)) {
    return byId.get(opts.fixtureId)!;
  }
  if (opts.bytes && opts.bytes.length > 0) {
    const h = sha256Hex(opts.bytes);
    if (byHash.has(h)) return byHash.get(h)!;
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
  "Live photo needs XAI_API_KEY or GEMINI_API_KEY on the server. Sample buttons work without a key.";
