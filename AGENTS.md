# AGENTS.md — ttb-label-verifier

One-off Treasury take-home. Disposable bots only; no job-search work here.

## Scope
- Verify alcohol label images against application fields: brand, class/type, ABV, net contents, government warning.
- Single or multi-file upload → per-file results table (not a job queue).
- Fuzzy match: brand, class/type, ABV, net contents.
- Exact match: government warning header must be `GOVERNMENT WARNING:` (all caps). Title case fails.
- Cloud vision/LLM via `XAI_API_KEY` or `GEMINI_API_KEY` in env only. Never commit keys.
- Fast/low-reasoning on the hot path. Target ~5s.

## Out of scope
- COLA integration, glare/angle repair, inventing TTB contacts, cloning other solutions of this assignment, form Submit by bots.

## Phase gates
Stop at each Chief phase gate until the user types APPROVE.
