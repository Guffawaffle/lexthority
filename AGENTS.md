# AGENTS.md - LexThority

LexThority is the authority seam around agent work.

## Hard Constraints

- Do not turn LexThority into an orchestrator.
- Do not make LexThority issue, store, or broker credentials.
- Do not bury authority envelopes inside LexSona.
- Do not model every service-specific SOP before the generic effect contract works.
- Prefer explicit `allow | escalate | deny` decisions with receipts over hidden fallback behavior.

## Project Shape

- `packages/thority-contracts` owns shared schemas and TypeScript types.
- `packages/thority-core` owns effect classification, decision logic, operator asks, and receipts.
- `packages/lex-thority-cli` owns the dogfood CLI.
- `examples/` contains envelopes and effect requests used by tests and local demos.

## Current MVP

The first useful proof is:

```bash
lex-thority exec --envelope examples/envelopes/thority.local.engineer.json -- git push origin feature/test
```

That should classify `git push` as `repo.push`, decide against the envelope, refuse/escalate when appropriate, and write a receipt.
