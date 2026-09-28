# TTB Label Verifier

Prototype for AI-assisted alcohol label verification (Treasury take-home). Standalone — not integrated with COLA.

## What it does

1. Enter application fields: brand, class/type, ABV, net contents, government warning.
2. Upload one or many label images.
3. Server extracts fields via cloud vision (xAI or Gemini) and compares:
   - **Fuzzy:** brand, class/type, ABV, net contents (e.g. `STONE'S THROW` ≈ `Stone's Throw`, `45%` ≈ `90 Proof`, `750 mL` ≈ `750ml`)
   - **Exact:** government warning header must be `GOVERNMENT WARNING:` (all caps). Title case fails.
4. Results table shows per-file overall Pass/Fail, per-field Pass/Fail, and elapsed ms.

Batch = multi-file upload + results table (not a background job queue).

## Setup

```bash
npm install
cp .env.example .env.local
# Set ONE of: XAI_API_KEY or GEMINI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `XAI_API_KEY` | one of | xAI API key (Vercel env / `.env.local` only) |
| `GEMINI_API_KEY` | one of | Google Gemini API key |
| `VERIFY_PROVIDER` | no | Force `xai` or `gemini` |

Never commit real keys. `.env*` is gitignored (`.env.example` is safe).

## Assumptions & trade-offs

- Public prototype uses cloud APIs for speed/quality. A production gov network that blocks outbound ML endpoints would need an on-prem path (e.g. Tesseract + local model); noted here only — not implemented in v1.
- Glare / odd camera angles are out of scope for v1.
- Warning body compared whitespace-normalized against the application text (or the standard TTB statement); header capitalization is strict.
- Fixture buttons fill application fields only; sample label images are added in a later phase.

## License

Prototype for evaluation only.
