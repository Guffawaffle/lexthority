# RFC: LexThority Effect-Based Authority Control

**Status:** Draft / Request for Comment
**Submitted by:** Joseph Gustavson
**Role:** Steward / accountable submitter
**Development provenance:** This RFC was developed collaboratively through iterative review and refinement by Joseph Gustavson, Lex, Gem, and AITB / Codex GPT-5.5. Joseph Gustavson is submitting the RFC and taking responsibility for its contents, but the ideas, language, and architecture are the product of a multi-agent collaborative process.
**Scope:** Agent authority, tool execution boundaries, audit receipts, and autonomous runtime safety

## 1. Summary

This RFC proposes **LexThority** as an authority seam for agentic work.

LexThority is not an orchestrator, IAM broker, prompt-policy layer, or command blacklist. It is a runtime boundary that evaluates what an agent or tool is attempting to **change**, whether that attempted effect fits inside the current authority envelope, and what actually happened after execution.

The central shift is:

> Syntax is evidence, not policy.
> Intent is context, not authority.
> Effects are the unit of permission.

Instead of asking whether a command such as `python script.py`, `git push`, or `terraform apply` is allowed in isolation, LexThority asks:

> What observable state change is being attempted, where, with what persistence, using what privilege, against what data, with what reversibility, visibility, cost, and blast radius?

This makes the security boundary computable, auditable, and extensible across tools, agents, workspaces, and orchestrators.

## 2. Problem

Current agent safety patterns often rely on weak boundaries:

1. **Prompt-as-policy**
   The model is instructed not to do unsafe things, then trusted to police itself.

2. **Syntax-based blocking**
   Systems blacklist command strings, tool names, URL patterns, or shell fragments.

3. **Opaque approval prompts**
   Humans are asked to approve actions without a structured explanation of likely consequence.

4. **Raw transcript audit logs**
   Logs preserve keystrokes and tool calls, but not the semantic effect, authority basis, or actual state change.

These approaches are brittle for non-deterministic actors. They confuse text with authority, intent with permission, and command logs with meaningful audit.

LexThority addresses this by making **attempted effects** the unit of authorization.

## 3. Design Principle

LexThority grants bounded autonomy.

An agent should be free to operate inside a constrained world when containment, capability metadata, and preflight evidence show that the requested effect fits inside the active authority envelope.

When an attempted effect exceeds the envelope, the system should escalate, deny, or ask for a narrower fallback.

The guiding rule is:

> Ambiguity narrows authority.

If the system cannot classify an effect with sufficient evidence, it should not default to “probably fine.” It should escalate or deny.

## 4. Goals

LexThority should:

1. Classify attempted work by observable effect, not command syntax.
2. Compare requested effects against a bounded authority envelope.
3. Prefer deterministic evidence before LLM judgment.
4. Treat containment as the first security boundary.
5. Generate semantic receipts describing what changed and why it was allowed.
6. Detect drift between predicted effects and observed effects.
7. Provide structured fallback asks when authority is insufficient.
8. Work around existing agents, orchestrators, tools, and workspaces rather than replacing them.

## 5. Non-Goals

LexThority is not:

1. A replacement for OS sandboxing, IAM, Kubernetes RBAC, cloud permissions, or network policy.
2. A custom IAM broker.
3. A general-purpose orchestrator.
4. A command blacklist.
5. A prompt-only safety system.
6. A guarantee that real-world safety can be mathematically proven.
7. A bypass mechanism where human approval overrides all policy.

Human approval should grant a bounded authority envelope, not act as an unstructured escape hatch.

## 6. Core Concepts

### 6.1 ThorityEnvelope

A **ThorityEnvelope** describes what a run, persona, workspace, or operator-granted session may attempt.

Example:

```json
{
  "id": "env.workspace-dev.readwrite",
  "allowedEffects": [
    "workspace.read",
    "workspace.write",
    "git.diff",
    "test.run"
  ],
  "deniedEffects": [
    "secret.read",
    "network.egress",
    "remote.write",
    "production.mutate",
    "public.publish",
    "money.spend"
  ],
  "constraints": {
    "localityMax": "workspace",
    "persistenceMax": "file",
    "visibilityMax": "private",
    "blastRadiusMax": "repo",
    "requiresEscalationOnAmbiguity": true
  }
}
```

### 6.2 EffectRequest

An **EffectRequest** is the structured declaration of what the agent or tool is about to attempt.

Example:

```json
{
  "effect": "workspace.write",
  "target": "repo:/srv/project/docs/ADR-001.md",
  "reason": "Create an architecture decision record requested by the operator.",
  "predictedConsequence": {
    "locality": "workspace",
    "persistence": "file",
    "visibility": "private",
    "data": "source",
    "reversibility": "high",
    "privilege": "ambient",
    "cost": "none",
    "blastRadius": "repo"
  }
}
```

### 6.3 PolicyDecision

A **PolicyDecision** is the deterministic output of the policy reducer.

Recommended decision values:

```text
allow
allow_with_constraints
escalate
deny
```

`allow` means the requested effect fits the envelope.

`allow_with_constraints` means the effect is permitted only with restrictions, such as no network, read-only mode, dry-run only, or workspace-only writes.

`escalate` means the effect exceeds the current envelope but may be permitted by a new bounded authority grant.

`deny` means the effect should not proceed under this contract.

### 6.4 EffectReceipt

An **EffectReceipt** records the decision, evidence, observed effect, and drift.

Example:

```json
{
  "effect": "workspace.write",
  "target": "repo:/srv/project/docs/ADR-001.md",
  "decision": "allow",
  "consequence": {
    "locality": "workspace",
    "persistence": "file",
    "visibility": "private",
    "data": "source",
    "reversibility": "high",
    "privilege": "ambient",
    "cost": "none",
    "blastRadius": "repo"
  },
  "evidence": [
    "sandbox:no-network",
    "fs:workspace-only",
    "git:dirty-worktree-detected",
    "policy:workspace.write-allowed"
  ],
  "observedEffect": {
    "filesWritten": [
      "docs/ADR-001.md"
    ],
    "networkEgress": false,
    "secretsRead": false,
    "remoteMutation": false
  },
  "drift": {
    "detected": false,
    "details": []
  }
}
```

Minimum useful receipts should include:

```json
{
  "timestamp": "2026-06-27T11:09:00Z",
  "effectId": "eff_9f823ba",
  "requestedEffect": "workspace.write",
  "decisionBasis": {
    "envelopeId": "env.workspace-dev.readwrite",
    "ruleTriggered": "rule_local_write_allowed"
  },
  "driftDetected": false,
  "evidenceHashes": ["sha256:e3b0c442..."]
}
```

Receipts should be queryable, hash evidence references where practical, and
avoid embedding raw secrets, PHI, full terminal logs, or large artifacts.

### 6.5 DriftFinding

A **DriftFinding** records mismatch between predicted and observed effects.

Example:

```json
{
  "predictedEffect": "workspace.write",
  "observedEffects": [
    "workspace.write",
    "network.egress"
  ],
  "severity": "authority_breach",
  "interpretation": "Tool performed network access not declared in capability metadata.",
  "recommendedAction": [
    "mark_tool_metadata_suspect",
    "require_escalation_for_future_runs",
    "notify_operator"
  ]
}
```

Drift is not just an error condition. It is a learning signal for tool metadata, policy rules, sandbox design, and future agent behavior.

## 7. Consequence Vectors

Effects should be described across consequence vectors.

Recommended starting vectors:

| Vector        | Spectrum                                        |
| ------------- | ----------------------------------------------- |
| Locality      | local, workspace, remote, production            |
| Persistence   | ephemeral, file, commit, infrastructure         |
| Visibility    | private, team-visible, customer-visible, public |
| Data          | public, source, internal, secret, regulated     |
| Reversibility | high, medium, low, irreversible                 |
| Privilege     | none, ambient, delegated, elevated              |
| Cost          | none, quota, money                              |
| Blast Radius  | self, repo, team, org, prod                     |

Vector values should be strict enums in implementation, not arbitrary strings.

For MVP, the first reducer can focus on four vectors:

```text
locality
persistence
data
blastRadius
```

Visibility, reversibility, privilege, and cost should remain in the schema
direction, but the initial reducer should avoid overfitting too many dimensions
before the core policy math is proven.

These vectors are not merely a linear severity ladder. Some combinations require hard-stop rules.

For example:

```text
workspace-local + secret.read = escalate or deny
public data + production.mutate = escalate or deny
ephemeral action + money.spend = escalate
private output + regulated data = escalate or deny
irreversible action + insufficient recovery path = deny or escalate
```

## 8. Policy Reducer

The **Policy Reducer** is the deterministic decision engine.

It consumes structured inputs:

```text
EffectRequest
+ ThorityEnvelope
+ CapabilityAttestation
+ ContainmentEvidence
+ PreflightEvidence
+ PolicyRules
= PolicyDecision
```

The reducer should not rely on an LLM as the final authority. LLM classification may assist with ambiguous natural-language interpretation, but the final decision should be derived from structured policy rules.

The Policy Reducer should be a deterministic component. It must not call an LLM
inside the reducer execution path. LLM output may help construct an
EffectRequest upstream or explain an escalation downstream, but the reducer
itself must operate on structured inputs and deterministic rules.

### 8.1 Reducer Rules

Initial recommended rules:

1. If requested effect is explicitly allowed and evidence supports the classification, allow.
2. If requested effect is allowed only under constraints, allow with constraints.
3. If requested effect exceeds envelope but may be granted by operator, escalate.
4. If requested effect violates a hard-stop rule, deny.
5. If evidence is missing, stale, contradictory, or unauthenticated, escalate.
6. If actual observed effect exceeds predicted effect, record drift and reduce future authority.
7. If containment cannot physically enforce a critical boundary, require stronger evidence or escalation.
8. If the requested consequence exceeds the static capability ceiling declared
   by AXF, MCP, or adapter metadata, reject or escalate before policy evaluation.

## 9. Runtime Flow

The proposed runtime loop:

```text
1. Agent proposes an EffectRequest.
2. Tool metadata declares possible effects.
3. Containment reports physical bounds.
4. Preflight evidence predicts likely effects.
5. Policy Reducer compares predicted effects to ThorityEnvelope.
6. Decision is allow, allow_with_constraints, escalate, or deny.
7. Execution happens only if allowed.
8. Runtime observer records actual effects.
9. Receipt compares predicted effect against observed effect.
10. Drift updates trust, metadata, future policy, or operator warnings.
```

## 10. Defense Layers

LexThority should prefer deterministic and physical boundaries before model judgment.

### 10.1 Containment First

OS, container, sandbox, filesystem, network, and credential boundaries should define what is physically possible.

Examples:

```text
read-only mounts
workspace-only write mounts
no-network execution
scoped credentials
no ambient cloud tokens
no production kube context
```

Containment prevents catastrophe. Observation alone is not enough.

### 10.2 Capability Metadata

Tools should declare possible effects.

Example:

```json
{
  "tool": "git.commit",
  "effects": ["workspace.read", "git.commit"],
  "persistence": "commit",
  "network": false,
  "requiresCredential": false
}
```

Metadata is a claim, not proof. It should be verified by containment, preflight evidence, and runtime observation.

Capability metadata should act as a ceiling. A tool may request less authority
than its ceiling for a specific run, but it should not be allowed to request a
consequence outside the ceiling declared by its capability or adapter metadata.
This catches corrupted prompts, hallucinated tool behavior, and stale wrappers
before the request reaches the policy reducer.

### 10.3 Preflight Evidence

Deterministic planners and dry-runs provide evidence before mutation.

Examples:

```text
git status
git diff
terraform plan
kubectl diff
database migration dry-run
package manager lockfile diff
test discovery
```

Preflight evidence predicts consequence. It does not prove real-world safety.

### 10.4 Runtime Observation

Runtime observation verifies actual effects.

Examples:

```text
filesystem writes
network egress
process execution
secret access
remote API calls
database mutations
cloud resource changes
```

Runtime observation is receipt-grade and drift-grade. It should not be the only permission boundary for dangerous effects.

### 10.5 LLM Classification

LLM classification is last resort and advisory.

The model may help translate natural-language intent into an EffectRequest. It should not be able to override containment, hard policy, or insufficient evidence.

## 11. Human Authority Grants

Escalation should not be a vague approval prompt.

A human should grant a bounded envelope.

Bad pattern:

```text
Policy says no.
Human says proceed.
Agent proceeds without constraint.
```

Preferred pattern:

```text
Policy says requested effect exceeds envelope.
Agent asks for expanded authority.
Human grants a bounded authority envelope.
Grant records who authorized it, for what effect, for what target, for how long, and under what constraints.
Agent proceeds only inside the new envelope.
```

Example AuthorityGrant:

```json
{
  "grant": "authority.expand",
  "grantedBy": "operator",
  "allowedEffects": ["network.egress"],
  "targets": ["https://api.github.com"],
  "duration": "15m",
  "constraints": {
    "secretsRead": false,
    "remoteMutation": false,
    "receiptRequired": true
  },
  "reason": "Allow GitHub issue lookup for current task."
}
```

### 11.1 AuthorityGrant Lease Cleanup

Temporary authority is not real unless the runtime can revoke it.

An `AuthorityGrant` with a duration introduces a lease. That lease must bind to
runtime resources, not only policy text. If a grant enables network access,
credential access, mounted paths, or delegated tokens, expiration must actively
signal the runtime layer to tear down or revoke those resources.

An implementation should track, when available:

```text
grant id
issued at / expires at
allowed effects
target scope
sandbox id
process group or cgroup id
network namespace id
credential/token id
child process policy
revocation status
```

On expiration or revocation:

```text
revoke short-lived credentials
close or tear down temporary network access
remove temporary mounts
kill or quarantine descendant processes that still hold the lease
record a lease-revocation receipt
```

Human approval should issue a bounded lease, not a vague permission flag. A
background process must not continue using an expired grant simply because it was
spawned while the grant was valid.

## 12. FallbackAsk

When blocked, agents should produce structured fallback asks instead of vague failure messages.

Example:

```json
{
  "blockedEffect": "network.egress",
  "reason": "Current envelope allows workspace-only execution.",
  "neededGrant": {
    "allowedEffects": ["network.egress"],
    "targets": ["https://github.com/org/repo/issues/123"],
    "duration": "10m",
    "constraints": {
      "remoteMutation": false
    }
  },
  "safeAlternative": "Proceed using local repository context only."
}
```

## 13. Minimal Viable Implementation

A first implementation does not need eBPF, full sandbox orchestration, or universal tool coverage.

Recommended MVP:

1. Define the core schemas:

   * ThorityEnvelope
   * EffectRequest
   * PolicyDecision
   * EffectReceipt
   * DriftFinding
   * FallbackAsk
   * AuthorityGrant

2. Define a small effect taxonomy:

   * workspace.read
   * workspace.write
   * git.diff
   * git.commit
   * test.run
   * network.egress
   * secret.read
   * remote.write
   * production.mutate
   * public.publish
   * money.spend

3. Implement a deterministic policy reducer.

4. Require tools to declare basic capability metadata.

5. Add receipt generation for common local development effects.

6. Add drift checks for:

   * unexpected network access
   * writes outside workspace
   * secret access
   * remote mutation

7. Integrate with AXF/MCP-style workspace capability metadata.

8. Keep LLM classification advisory only.

9. Track authority grant leases and prove cleanup on expiration for any MVP
   feature that temporarily enables network, credential, or remote-write access.

## 14. Example Scenarios

### 14.1 Local Documentation Edit

EffectRequest:

```text
workspace.write docs/ADR-001.md
```

Envelope:

```text
workspace read/write allowed
no network
no secrets
private visibility
```

Decision:

```text
allow
```

Receipt records file write and no drift.

### 14.2 Run Tests With No Network

EffectRequest:

```text
test.run
```

Capability metadata:

```text
may execute local subprocesses
may write cache files
no declared network
```

Containment:

```text
network disabled
workspace write allowed
```

Decision:

```text
allow_with_constraints
```

Receipt records test execution, cache writes, no network.

### 14.3 Terraform Apply

EffectRequest:

```text
infrastructure.mutate
```

Envelope:

```text
workspace-only
no remote mutation
```

Decision:

```text
escalate or deny
```

FallbackAsk requests a bounded infrastructure authority grant, likely after reviewing `terraform plan`.

### 14.4 Secret Read Attempt

EffectRequest:

```text
secret.read
```

Envelope:

```text
workspace read/write only
```

Decision:

```text
deny or escalate depending on policy
```

If the requested downstream action involves exposing the secret publicly, deny.

### 14.5 Drift Detected

Predicted:

```text
workspace.write
```

Observed:

```text
workspace.write + network.egress
```

Decision after execution:

```text
drift detected
tool metadata suspect
future runs require escalation
operator notified
```

## 15. Relationship to AXF

AXF can describe workspace capabilities and operating context.

LexThority can consume that context to decide whether an attempted effect is inside the current authority envelope.

Proposed relationship:

```text
AXF describes the workspace and available capabilities.
Agents and orchestrators propose work.
LexThority classifies attempted effects and decides allow/escalate/deny.
Lex records receipts, drift, fallback asks, and authority grants.
LexSona supplies persona-duty and active authority context.
```

This keeps LexThority as a seam around agents and tools, not a replacement for them.

## 16. Risks and Open Questions

### 16.1 Tool Metadata Trust

Tool metadata can be incomplete or stale.

Mitigation:

```text
Treat metadata as a claim.
Verify with containment, preflight evidence, and observation.
Record drift when metadata is wrong.
```

### 16.2 False Sense of Proof

Preflight tools do not prove real-world safety.

Mitigation:

```text
Represent preflight as evidence, not truth.
Use stronger containment for high-risk effects.
Escalate when evidence is insufficient.
```

### 16.3 Approval Fatigue

Too many escalations can train operators to approve blindly.

Mitigation:

```text
Prefer bounded envelopes.
Use clear fallback asks.
Keep low-risk work free inside containment.
Deny rather than escalate for obviously unsafe transformations.
```

### 16.4 Policy Complexity

Effect taxonomies can become too large.

Mitigation:

```text
Start with a small taxonomy.
Allow domain-specific extensions.
Keep receipts queryable.
Review drift to discover missing categories.
```

### 16.5 Runtime Observation Timing

Observation may detect a violation after it happens.

Mitigation:

```text
Use containment as prevention.
Use observation as verification and receipt evidence.
Do not rely on observation alone for dangerous effects.
```

### 16.6 AuthorityGrant Session Leak

Temporary grants can leak through child processes, background tasks, inherited
network namespaces, mounted paths, or credentials.

Mitigation:

```text
Bind temporary grants to runtime resources.
Prefer short-lived scoped credentials over ambient credentials.
Track descendant processes.
Revoke or tear down sandbox resources on lease expiry.
Record lease cleanup in receipts.
Do not allow a long-lived background process to retain expired authority.
```

## 17. Requested Feedback

AITB feedback requested on:

1. Whether **EffectRequest** is the right core authorization primitive.

2. Whether the proposed consequence vectors are sufficient for MVP.

3. Whether the decision set should be:

   * allow
   * allow_with_constraints
   * escalate
   * deny

4. Whether **Policy Reducer** should be a standalone deterministic component.

5. How AXF capability metadata should map into LexThority capability attestations.

6. What minimum receipt schema is required for useful audit.

7. Which effects should be hard-deny versus escalatable.

8. Whether this should be prototyped first around local workspace operations, Git operations, or tool execution.

## 18. Proposed Next Step

Prototype LexThority around a local development workspace.

Initial supported effects:

```text
workspace.read
workspace.write
git.diff
test.run
network.egress
secret.read
remote.write
```

Initial authority envelope:

```text
Allow local workspace reads/writes.
Allow git diff/status.
Allow tests under no-network containment.
Deny secret reads.
Deny remote writes.
Escalate network egress.
Escalate public/team-visible output.
```

Initial receipt requirement:

```text
Every allowed effect records predicted consequence, policy decision, evidence, observed effect, and drift.
```

This would validate the core seam without requiring full infrastructure integration.

## 19. Refined Manifesto

```text
Syntax is evidence, not policy.
Intent is context, not authority.
Effects are the unit of permission.
Containment is the first boundary.
Metadata is a claim, not proof.
Preflight evidence predicts consequence.
Policy reduction decides authority.
Runtime observation verifies effect.
Drift is signal.
Receipts make autonomy auditable.
Ambiguity narrows authority.
Humans grant bounded envelopes, not magic bypasses.
```

## 20. Provenance Note

This RFC is intentionally submitted as a collaborative artifact.

Joseph Gustavson is acting as steward and accountable submitter, not sole author. The architecture, terminology, and framing were shaped through discussion among Joseph Gustavson, Lex, Gem, and AITB / Codex GPT-5.5.

The purpose of this note is not to dilute responsibility. It is to preserve accurate provenance: the RFC represents a shared refinement process, and the submitter accepts responsibility for carrying it forward.

## 21. Closing

LexThority should make agent autonomy safer by making authority explicit, bounded, and observable.

The goal is not to make agents timid.

The goal is to give them freedom inside a world whose boundaries are real, explainable, and auditable.

Bound the world first.
Then let the agent move.
Record what changed.
