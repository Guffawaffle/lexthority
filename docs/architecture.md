# LexThority Architecture

## Purpose

LexThority is moving toward one narrow question:

```text
Given this run envelope, containment state, evidence, and intended effect, does
the consequence stay inside the boundary?
```

It does not answer how agents plan, delegate, resume, or complete workflows.
Existing orchestrators and coding agents can become clients or adapters.

The current concept is documented in
[consequence-boundary-model.md](./consequence-boundary-model.md).

The fuller draft RFC is maintained at
[rfcs/effect-based-authority-control.md](./rfcs/effect-based-authority-control.md).

The working agent-facing contract is maintained in
[operational-contract.md](./operational-contract.md).

## Core Thesis

```text
Containment grants freedom.
Consequence contracts describe boundaries.
Evidence proves what was possible or attempted.
Receipts preserve what happened.
```

LexThority should not be a blacklist, an allowlist, or a paperwork workflow.
It should sit across enforcement layers and produce a shared consequence
language for agents, tools, sandboxes, operators, and memory.

## Layers

1. Containment: sandbox, filesystem, network, credentials, runtime limits.
2. Capability metadata: AXF, MCP, and adapters declare expected consequences.
3. Tool-native planning: `git diff`, `terraform plan`, dry-runs, previews.
4. Runtime observation: wrappers, broker logs, filesystem/network evidence.
5. LLM classification: advisory last resort for ambiguous work.

## Primitives

### ThorityEnvelope

A concrete run object issued by an operator, workspace policy, org policy,
workflow, or test fixture. Today this is effect-class based. The next direction
is a consequence envelope that describes acceptable locality, persistence,
visibility, data class, reversibility, privilege, cost, and blast radius.

An agent may request an envelope. It may not silently self-issue stronger authority.

### EffectRequest

A normalized description of a meaningful action boundary, such as `repo.push`,
`issue.comment`, `cloud.apply`, `secret.read`, or `unknown`.

Future requests should carry a consequence summary and evidence references, not
just a command label.

### ThorityDecision

One of:

- `allow`
- `escalate`
- `deny`

Unknown effects are envelope-controlled. The recommended policy is `escalate` for local work and `deny` for CI, protected, or production contexts.

### EffectReceipt

A minimal event record capturing the request, envelope hash, decision, outcome,
operator ask, consequence summary, and evidence references. Receipts must not
contain secret values, raw tokens, full environment dumps, or unsafe command
output by default.

## Ambient Credentials

Ambient credentials may be observed. They must not be silently consumed across an effect boundary.

For early local dogfood, `warn` maps to escalation with a clear operator ask. Protected environments should use `deny`.
