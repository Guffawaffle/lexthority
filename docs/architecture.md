# LexThority Architecture

## Purpose

LexThority answers one narrow question:

```text
Given this run envelope and this intended effect, may the agent proceed?
```

It does not answer how agents plan, delegate, resume, or complete workflows. Existing orchestrators and coding agents can become clients or adapters.

## Primitives

### ThorityEnvelope

A concrete run authority object issued by an operator, workspace policy, org policy, workflow, or test fixture.

An agent may request an envelope. It may not silently self-issue stronger authority.

### EffectRequest

A normalized description of a meaningful action boundary, such as `repo.push`, `issue.comment`, `cloud.apply`, `secret.read`, or `unknown`.

### ThorityDecision

One of:

- `allow`
- `escalate`
- `deny`

Unknown effects are envelope-controlled. The recommended policy is `escalate` for local work and `deny` for CI, protected, or production contexts.

### EffectReceipt

A minimal event record capturing the request, envelope hash, decision, outcome, and operator ask. Receipts must not contain secret values, raw tokens, full environment dumps, or unsafe command output by default.

## Ambient Credentials

Ambient credentials may be observed. They must not be silently consumed across an effect boundary.

For early local dogfood, `warn` maps to escalation with a clear operator ask. Protected environments should use `deny`.
