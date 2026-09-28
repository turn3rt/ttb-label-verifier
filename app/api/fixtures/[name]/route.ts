import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { FIXTURES } from "@/lib/fixtures";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const allowed = new Set(FIXTURES.map((f) => f.image));
  if (!allowed.has(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "fixtures", name);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Missing file" }, { status: 404 });
  }
  const buf = readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
