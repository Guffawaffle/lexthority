# LexThority Consequence Boundary Model

Status: pre-alpha research

Expanded RFC: [rfcs/effect-based-authority-control.md](./rfcs/effect-based-authority-control.md)

LexThority is not a sandbox, credential broker, IAM provider, or LLM reviewer.

LexThority is the consequence-boundary contract that lets sandboxes, tool
adapters, credential systems, runners, agents, and memory speak the same
language about consequential work.

## Manifesto

```text
Containment grants freedom.
Consequence contracts describe boundaries.
Evidence proves what was possible or attempted.
Receipts preserve what happened.
```

The goal is not to ask permission for every command. The goal is to let agents
work freely inside a bounded workspace while making boundary crossings explicit,
observable, and recoverable.

## Why Not Blacklists

Blacklists and service-specific allowlists do not scale for agent work.

Agents can write scripts, chain generic tools, call undocumented APIs, use
`curl`, run generated code, and discover paths the policy author did not
enumerate. A stale list of forbidden commands becomes a paperwork sink and a
false sense of safety.

LexThority should reason over consequence classes instead of command strings.

The question is not:

```text
Is aws rds delete-db-instance on the forbidden list?
```

The question is:

```text
What kind of consequence could this action create, and is that consequence
inside the current workspace envelope?
```

## Consequence Axes

The axes are intentionally overlapping. They are not a perfect ontology. They
are a shared vocabulary for describing the shape of an action.

| Axis | Example Values | Meaning |
| --- | --- | --- |
| `locality` | `local`, `workspace`, `remote`, `prod` | Where the consequence can occur. |
| `persistence` | `ephemeral`, `file`, `commit`, `external-record`, `infrastructure` | How long the consequence can last. |
| `visibility` | `private`, `team-visible`, `customer-visible`, `public` | Who can observe the consequence. |
| `data` | `public`, `source`, `internal`, `secret`, `customer-data`, `regulated-data`, `prod-data` | What data class may be touched. |
| `reversibility` | `high`, `medium`, `low`, `irreversible`, `unknown` | How easily the action can be undone. |
| `privilege` | `none`, `ambient`, `delegated`, `elevated` | What authority is consumed. |
| `cost` | `none`, `quota`, `money` | Whether scarce resources are consumed. |
| `blastRadius` | `self`, `repo`, `team`, `org`, `customer`, `prod` | Who or what can be affected if it goes wrong. |

This is the boundary language. A run envelope should describe acceptable
consequences, not a brittle list of every command the agent may or may not run.

## Layered Architecture

LexThority should not rely on an LLM as the primary security boundary.

The intended architecture is layered:

1. Containment first.
2. Capability metadata second.
3. Tool-native planning third.
4. Runtime observation fourth.
5. LLM classification last.

### 1. Containment First

Actual safety starts with physical or platform controls:

- no network by default
- no secrets by default
- read-only mounts where possible
- scoped filesystem access
- temporary workspaces
- short-lived credentials
- isolated execution environments

If a sandbox has no network and no credentials, many remote consequences are
physically impossible. The agent can be freer inside that sandbox because the
environment already constrains the maximum consequence.

LexThority must not pretend text policy is containment.

### 2. Capability Metadata Second

AXF capabilities, MCP tools, and adapters can declare their expected consequence
shape:

```json
{
  "capability": "repo.push",
  "consequence": {
    "locality": "remote",
    "persistence": "commit",
    "visibility": "team-visible",
    "data": "source",
    "reversibility": "medium",
    "privilege": "ambient",
    "cost": "none",
    "blastRadius": "repo"
  }
}
```

This is not a static blacklist. It is a semantic contract between a capability
and the run envelope.

### 3. Tool-Native Planning Third

Whenever a tool can describe its own consequences before mutation, LexThority
should prefer that evidence over guessing.

Examples:

- `git diff`, `git status`, and branch comparison before repository mutation
- `terraform plan` before `terraform apply`
- `kubectl diff` before `kubectl apply`
- cloud dry-runs and preview deployments
- database `EXPLAIN` or migration previews
- package manager dry-runs

Tool-native plans act as deterministic consequence evidence. They bridge the
gap between broad metadata and uncertain LLM classification.

### 4. Runtime Observation Fourth

Runtime observation records what was attempted or what became possible.

Early implementations can use lightweight evidence:

- command wrappers
- filesystem change summaries
- network enabled/disabled proof
- credential source and scope summaries
- sandbox configuration summaries
- tool dry-run outputs
- cloud or git provider audit events

Later enterprise implementations may add heavier observation:

- gVisor or Firecracker sandboxes
- eBPF telemetry
- network proxies
- credential brokers
- OPA or policy engines
- cloud audit logs
- IAM condition keys

These are enforcement and evidence layers. LexThority should consume their
records; it should not have to become all of them.

### 5. LLM Classification Last

An LLM can help classify ambiguous intent, but it should be the advisory layer
of last resort.

Use an LLM when:

- the action is novel
- the command is opaque
- the tool lacks metadata
- no tool-native plan exists
- the operator needs a human-readable explanation

Do not use an LLM as the only thing preventing a high-consequence action. The
security boundary should be containment, scoped credentials, tool evidence, and
runtime enforcement.

## Ambiguous Commands

`python script.py` is not inherently safe or unsafe. Its consequence depends on
the environment and evidence.

Inside a no-network, no-secret, workspace-only sandbox, its maximum consequence
may be local file changes.

Inside an environment with cloud credentials, network access, and production
routes, the same command is ambiguous and potentially high consequence unless a
wrapper, plan, or capability contract narrows it.

The decision should be based on:

```text
maximum possible consequence
declared intended consequence
tool-native evidence
runtime constraints
current run envelope
```

## Envelope Negotiation

LexThority should not create a paperwork workflow for every action.

Normal work should be pre-authorized by a generous but bounded workspace
envelope. Approvals are exceptional. Receipts are normal.

When an action exceeds the envelope:

1. Preflight should deny or escalate before execution when possible.
2. Runtime controls should block or kill attempted escape when observed.
3. The tool should return a structured semantic error.
4. A receipt should record the consequence boundary and evidence.
5. The agent may choose a safe fallback or request a new envelope.

The human override should issue a new envelope, not patch a running process in
place.

Example:

```json
{
  "ok": false,
  "code": "CONSEQUENCE_BOUNDARY_EXCEEDED",
  "message": "The command attempted network egress outside the current envelope.",
  "consequence": {
    "locality": "remote",
    "persistence": "unknown",
    "visibility": "unknown",
    "data": "unknown",
    "reversibility": "unknown",
    "privilege": "none",
    "cost": "none",
    "blastRadius": "unknown"
  },
  "evidence": ["sandbox:network-denied"],
  "nextActions": [
    "Run in a network-enabled envelope if remote access is intended.",
    "Use a declared AXF capability with an explicit target.",
    "Produce a local-only fallback."
  ]
}
```

## Consequence Receipts

Receipts should preserve consequence, not just command text.

A useful receipt lets an operator query the shape of agent work without reading
the full reasoning trace.

Example:

```json
{
  "effect": "workspace.write",
  "consequence": {
    "locality": "workspace",
    "persistence": "file",
    "visibility": "private",
    "data": "source",
    "reversibility": "high",
    "privilege": "none",
    "cost": "none",
    "blastRadius": "self"
  },
  "decision": "allow",
  "outcome": "executed",
  "evidence": ["sandbox:no-network", "fs:workspace-only"],
  "receiptSink": ".lexthority/receipts.ndjson"
}
```

This supports queries like:

```sql
SELECT *
FROM agent_runs
WHERE consequence.visibility = 'public';
```

or:

```text
Alert when blastRadius is org/prod and evidence lacks a dry-run or plan.
```

## Current Implementation Note

The current repository contains an early effect-class implementation and a CLI
proof harness. That code is useful for dogfooding the decision loop, but it is
not the final product shape.

The next model should move from command-centered authorization toward
consequence-centered envelopes and receipts.

The CLI should be treated as:

```text
a reference implementation and test harness for consequence-boundary decisions
```

not:

```text
the ceremony every agent or human must run before doing normal work
```

If LexThority makes agents ask permission for every command, it has failed AXMM.

## Relationship To Prior Art

This model borrows from older, serious systems ideas:

- sandboxing and process isolation
- capability-based security
- least privilege
- information-flow control and taint tracking
- policy-as-code
- audit logging
- plan/apply workflows
- typed effect systems
- supply-chain attestations
- SIEM-style event querying

The research claim is not that any one ingredient is new.

The useful synthesis is applying those ideas to agent work through an
AXMM-aligned contract:

- agents stay free inside real containment
- tools declare consequence instead of just syntax
- deterministic plans and runtime evidence bound ambiguous actions
- LLM classification is advisory, not the security boundary
- receipts preserve consequence shape for recall, audit, and future agents

That combination is the part worth investigating.
