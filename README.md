# LexThority

LexThority is pre-alpha research into consequence boundaries for agent work. It
is not an orchestrator, sandbox, IAM broker, credential vault, LLM reviewer, or
swarm runtime.

The current thesis:

```text
Containment grants freedom.
Consequence contracts describe boundaries.
Evidence proves what was possible or attempted.
Receipts preserve what happened.
```

LexThority should be mostly invisible during normal work. It should appear only
when an agent, tool, or run is about to consume authority outside its bounded
workspace.

The current proof harness provides a small effect contract:

- `ThorityEnvelope`: what this run may attempt
- `EffectRequest`: what an agent or adapter is about to do
- `ThorityDecision`: `allow`, `escalate`, or `deny`
- `EffectReceipt`: what was decided, what happened, and what the operator needs next

See [docs/consequence-boundary-model.md](./docs/consequence-boundary-model.md)
for the current research model.

See [docs/rfcs/effect-based-authority-control.md](./docs/rfcs/effect-based-authority-control.md)
for the draft RFC that expands the model into schemas, reducer behavior,
authority grants, drift findings, and MVP scope.

See [docs/operational-contract.md](./docs/operational-contract.md) for the draft
agent-facing contract and stack boundary. That document reflects the current
proof harness and is expected to evolve toward consequence-centered envelopes.

Direct section: [What It's Like To Be An Agent In Your Stack](./docs/operational-contract.md#what-its-like-to-be-an-agent-in-your-stack).

## Stack Boundary

```text
LexSona      = posture, duty, default caution, role-like context
LexThority   = consequence-boundary contract and receipts
AXF          = workspace bearings, capability declarations, consequence hints
Adapters     = wrappers around git/gh/gcloud/cloudflare/orchestrators
Containment  = sandbox, filesystem, network, credential, and runtime limits
Lex          = receipts, memory, denials, fallbacks, learned access reality
```

LexThority starts boring on purpose. The first proof is a CLI that can classify
and gate an effect like `git push`, but that CLI is a reference implementation
and test harness, not the intended daily workflow for agents.

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

If LexThority starts scheduling agents, managing swarms, owning credentials,
modeling every SOP, or forcing every local command through paperwork, it is
drifting.

## License

This repository is **source-available**, not open source.

You may view, fork, modify, and run this project for personal, non-commercial use under the [SmarterGPT Source-Available Personal Use License](./LICENSE.md).

Commercial use, organizational use, employer/client use, production use, hosted-service use, redistribution, sublicensing, or embedding in another product or platform requires a separate written license from Joseph Gustavson / Guffawaffle / SmarterGPT.

Public visibility on GitHub does not grant open-source rights or business-use rights.
