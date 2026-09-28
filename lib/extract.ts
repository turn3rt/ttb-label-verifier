import type { ExtractedFields } from "./types";
import { STANDARD_WARNING_BODY } from "./match";

const EXTRACT_PROMPT = `You extract alcohol beverage label fields from an image.
Return ONLY a JSON object with keys:
brand, classType, abv, netContents, governmentWarning
Use empty string if a field is not visible.
For governmentWarning, copy the warning EXACTLY as printed on the label (preserve capitalization of the header).
No markdown, no commentary.`;

function pickProvider(): "xai" | "gemini" {
  const forced = (process.env.VERIFY_PROVIDER || "").toLowerCase();
  if (forced === "xai" || forced === "gemini") return forced;
  if (process.env.XAI_API_KEY) return "xai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  throw new Error(
    "No API key configured. Set XAI_API_KEY or GEMINI_API_KEY in the environment.",
  );
}

function parseJsonFields(text: string): ExtractedFields {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Model did not return JSON fields");
  }
  const raw = JSON.parse(cleaned.slice(start, end + 1)) as Record<
    string,
    unknown
  >;
  return {
    brand: String(raw.brand ?? ""),
    classType: String(raw.classType ?? raw.class_type ?? ""),
    abv: String(raw.abv ?? ""),
    netContents: String(raw.netContents ?? raw.net_contents ?? ""),
    governmentWarning: String(
      raw.governmentWarning ?? raw.government_warning ?? "",
    ),
  };
}

async function extractWithXai(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedFields> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-vision-1212",
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`xAI error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseJsonFields(content);
}

async function extractWithGemini(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedFields> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 500,
      },
      contents: [
        {
          parts: [
            { text: EXTRACT_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  return parseJsonFields(content);
}

export async function extractLabelFields(
  imageBase64: string,
  mimeType: string,
): Promise<{ fields: ExtractedFields; provider: string }> {
  const provider = pickProvider();
  const fields =
    provider === "xai"
      ? await extractWithXai(imageBase64, mimeType)
      : await extractWithGemini(imageBase64, mimeType);
  return { fields, provider };
}

export { STANDARD_WARNING_BODY };
