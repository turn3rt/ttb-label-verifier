# TTB Label Verifier

Prototype for alcohol label verification (Treasury take-home). Standalone—not integrated with COLA.

**Deployed app:** [https://ttb-label-verifier-nine.vercel.app/](https://ttb-label-verifier-nine.vercel.app/)

Treasury can open that link and use the three sample buttons. No install and no API key.

## Decision

This demo does not call a paid vision API. It is an unpaid exercise, and there is no interview yet, so the running cost stays at $0.

## Demo

The three sample buttons are the demo. They load a real label image and score it with `lib/match.ts` from text stored in `fixtures/`. No key and no network call are required; results return in well under 5 seconds.

A photo that is not one of those samples is refused on purpose. The page tells the reviewer that this is a documented limit, not a crashed deploy.

## Approach and tools

- Next.js, React, and TypeScript. Deployed on Vercel.
- The agent enters application fields and uploads one or many label images. Several images are scored against that one application in one request. That is the batch upload. It is not a background queue.
- Sample buttons load the image and score it with `lib/match.ts` using the text stored in `fixtures/`. No network call. Brand, class/type, ABV (percent or proof), and net contents (mL and L) are fuzzy. The label warning must be the exact header `GOVERNMENT WARNING:` and bold; the body must match the application, or the standard Surgeon General statement when that field is blank.
- A photo that is not one of the three samples is refused on purpose. This demo does not call a paid vision API.
- Tools: no database, no COLA integration, no paid API.

## Setup

Run the same build from this repo locally:

```bash
npm install
npm run dev
```

Keys are not required for this demo. Open [http://localhost:3000](http://localhost:3000).

## Limits

Bottler address and country of origin are out of scope. Two blank ABV fields fail. Fluid ounces are not converted. Glare and odd angles are out of scope. A government network that blocks outbound ML would need an on-prem model.

## What I would do next

The code is already sketched in `lib/extract.ts`. With a budget, set `XAI_API_KEY` or `GEMINI_API_KEY` on the server, never in git, send the image with the existing prompt, and require JSON for `brand`, `classType`, `abv`, `netContents`, `governmentWarning`, and `warningHeaderBold`. Keep capitalization exact. Pass that object to `lib/match.ts`, which already checks all-caps plus bold on the label, fuzzy brand, class/type, ABV (including proof), and net contents. Time a new label against the 5-second limit. For a network that cannot call cloud ML, keep the same JSON contract and swap in an on-prem model. Do not build that path now.

## License

Prototype for evaluation only.
