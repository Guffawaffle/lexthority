# LexThority

LexThority is the authority seam for agent work. It is not an orchestrator, an IAM broker, or a swarm runtime.

It provides a small contract:

- `ThorityEnvelope`: what this run may attempt
- `EffectRequest`: what an agent or adapter is about to do
- `ThorityDecision`: `allow`, `escalate`, or `deny`
- `EffectReceipt`: what was decided, what happened, and what the operator needs next

## Stack Boundary

```text
LexSona     = posture, duty, default caution, role-like context
LexThority  = concrete authority envelope + effect decision engine
AXF         = workspace bearings, capability declarations, effect hints
Adapters    = wrappers around git/gh/gcloud/cloudflare/orchestrators
Lex         = receipts, memory, denials, fallbacks, learned access reality
```

LexThority starts boring on purpose. The first proof is a CLI that can classify and gate an effect like `git push`.

## Quick Start

```bash
npm install
npm run build

npm run cli -- classify -- git push origin feature/test
npm run cli -- check examples/effects/git-push.json --envelope examples/envelopes/thority.local.engineer.json
npm run cli -- exec --dry-run --envelope examples/envelopes/thority.local.engineer.json -- git push origin feature/test
```

Receipts are written to `.lexthority/receipts.ndjson` by default.

## Anti-Drift

If LexThority starts scheduling agents, managing swarms, owning credentials, or modeling every SOP, it is drifting.

## License

LexThority is source-available under the SmarterGPT Personal Use License in [LICENSE](./LICENSE). It is not open source. Commercial, organizational, production, hosted-service, redistribution, and embedding use require a separate written license.
