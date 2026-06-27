# LexThority Operational Contract

Status: draft v0.1, pre-alpha research

This is not a legal license. It is the working contract between agents, runners,
tool adapters, memory, and operators.

LexThority is being shaped around consequence boundaries, not command
blacklists. The current proof harness answers one question at an effect
boundary:

```text
Given this run envelope and this intended effect, may the agent attempt it now?
```

The next direction is documented in
[consequence-boundary-model.md](./consequence-boundary-model.md): containment
grants freedom, consequence contracts describe boundaries, evidence proves what
was possible or attempted, and receipts preserve what happened.

It should stay small enough for an agent to use without spending its whole
context budget on policy interpretation.

## Short Version

LexThority is a consequence-boundary layer, not an authority source.

An agent keeps its autonomy inside the workspace it has been given. When it is
about to cross a meaningful boundary, such as pushing code, creating a pull
request, writing to an issue tracker, reading a secret, deploying a service, or
touching production data, it sends a compact `EffectRequest` plus the current
`ThorityEnvelope`.

LexThority returns one of three answers:

- `allow`: the requested attempt is inside the envelope.
- `escalate`: the request may be reasonable, but the current envelope or
  credential posture is not enough.
- `deny`: the request is outside the envelope and must stop.

Every non-trivial decision can produce an `EffectReceipt` so future agents,
operators, and memory systems can see what happened without replaying the whole
conversation.

## What It's Like To Be An Agent In Your Stack

An agent in this stack should feel trusted inside a bounded workspace, not
micromanaged by a policy script.

The agent receives context, a task, tools, and a run envelope. Inside that
workspace, it can explore, read, reason, edit, test, and recover without asking
permission for every move. The boundary appears when the agent is about to do
something that affects shared state, sensitive data, production systems,
credentials, money, or another person's workflow.

At that boundary, the agent does not stop being a reasoning partner. It creates
a compact `EffectRequest`, asks LexThority for a decision, and keeps the operator
ask narrow:

```text
I am trying to push this branch because the local tests pass and the site update
is ready for review. This run envelope does not allow repo.push with ambient git
credentials. Minimum unlock: approve repo.push for this branch for this run, or
run the prepared push command yourself. Safe fallback: keep the local commit and
export a patch.
```

That is the intended posture:

- autonomous within the assigned workspace
- explicit at effect boundaries
- clear about what failed and why
- specific about the minimum unlock needed
- careful not to leak secrets or regulated data
- able to leave receipts for future agents and humans

LexThority should make the agent easier to trust without making it less useful.
If the agent spends more time negotiating policy than doing the work, the
contract is too heavy.

## What LexThority Promises

LexThority can promise:

1. A small shared vocabulary for agent-visible effects.
2. A deterministic decision from a concrete envelope and concrete request.
3. A clear operator ask when the answer is `escalate` or `deny`.
4. A receipt shape that records the decision, outcome, reason, envelope hash,
   and safe fallback.
5. A boundary language between agent intent, containment, evidence, and external
   authority systems.

LexThority does not promise that the attempted action will succeed. A returned
`allow` means the request is inside the current authority envelope. The actual
tool, IAM system, OAuth provider, repository host, cloud API, network, or human
approval path can still reject the action.

When that happens, the agent should turn the failure into an operator-readable
access gap:

```text
I was allowed to attempt repo.push for this run, but the git remote rejected the
credential. Minimum unlock: grant push access for this branch or have an
authorized operator run the prepared push command. Safe fallback: keep the local
commit and export a patch.
```

## What LexThority Refuses To Own

LexThority should not become:

- an IAM provider
- an OAuth broker
- a credential vault
- a swarm runtime
- a scheduler
- a full SOP engine
- a persona engine
- a static blacklist or command allowlist
- a universal capability ontology
- a replacement for human approval
- proof that an external action succeeded

Existing enterprise infrastructure should remain the source of truth for
identity, credential issuance, credential lifetime, audit controls, revocation,
and compliance policy. LexThority describes whether an agent should attempt an
effect under the current envelope; it does not mint the authority itself.

LexThority should also not become an access-request department. Approvals are
exceptional. Receipts are normal.

## When It Is Necessary

LexThority is useful when an agent crosses a side-effect boundary.

Good fits:

- remote repository mutation
- issue, ticket, chat, or document writes
- CI trigger or deployment
- cloud resource change
- secret or regulated data access
- production data read or write
- money, quota, or spend
- agent swarm promotion from isolated work to shared state

Poor fits:

- thinking
- local search
- reading public docs
- formatting a local file
- running local tests without external mutation
- every small command inside a trusted sandbox

The efficient rule is: check effects, not thoughts. Use LexThority at boundaries
where an action would change shared state, consume sensitive credentials, expose
data, spend money, or affect another person or system.

## Stack Contract

| Piece | Owns | Does Not Own |
| --- | --- | --- |
| Lex | Durable memory, receipts, lineage, contradiction, validation state, and learned access reality. | Credential issuance or runtime containment. |
| AXF | Workspace bearings, capability declarations, command classifiers, consequence hints, and adapter wrappers. | Final authority, containment, or long-lived memory. |
| LexSona | Posture, duty lens, caution defaults, and role-like context for an agent. | Credential grants, secret material, or runtime containment. |
| LexRunner | Run lifecycle, task flow, isolated work environments, swarm coordination, and promotion points. | Identity provider behavior or direct credential brokering. |
| LexThority | Consequence-boundary contract, effect request, decision, evidence references, and receipt. | Planning, scheduling, persona design, IAM, OAuth, vaulting, runtime containment, or execution success. |
| IAM / OAuth / brokers | Actual identity, credential issuance, revocation, audit, and time limits. | Agent reasoning or workspace memory. |

The intended flow is:

```text
LexSona informs posture
        |
LexRunner issues or receives a bounded run envelope and containment context
        |
AXF/tool adapter classifies the intended command and consequence
        |
LexThority compares consequence, evidence, and envelope
        |
Tool attempts only if the boundary is satisfied
        |
Lex records receipts, evidence, failures, access gaps, and learned reality
```

## Contract Objects

### `ThorityEnvelope`

The bounded context for one run, task, agent, workspace, or isolated
environment.

The current TypeScript shape is effect-class based. The next model should
describe an acceptable consequence envelope: locality, persistence, visibility,
data class, reversibility, privilege, cost, and blast radius.

Required meaning:

- `id`: stable envelope id.
- `version`: contract version.
- `sonaId`: the posture or duty lens associated with the run.
- `issuedBy`: operator, workspace policy, org policy, workflow, or test fixture.
- `issuedAt` and optional `expiresAt`: authority lifetime.
- `environment`: local, CI, protected, or production.
- `scope`: bounded repositories, projects, zones, or environments.
- `allow`, `escalate`, `deny`: current proof-harness effect classes.
- `dataAllow`, `dataEscalate`, `dataDeny`: data classes.
- `ambientCredentialPolicy`: whether ambient credentials are ignored, escalated,
  or denied.
- `unknownEffectPolicy`: how unknown work is handled per environment.
- `receiptPolicy`: when decisions and fallbacks are recorded.
- `credentialIntent`: optional description of expected credential paths without
  embedding secret values.

Envelope rule: an agent may request a stronger or different envelope, but it may
not silently self-issue stronger authority.

### `EffectRequest`

The compact description of the action an agent or adapter is about to attempt.

The current TypeScript shape centers on effect classes. Future versions should
carry a compact consequence summary and evidence references.

Required meaning:

- `id`: stable request id.
- `runId`: optional run correlation id.
- `effect`: normalized effect class such as `repo.push`, `issue.comment`,
  `cloud.apply`, `secret.read`, or `unknown`.
- `dataClass`: public, source, work-internal, secret, customer-data,
  regulated-data, prod-data, or unknown.
- `target`: repository, project, environment, provider, or resource.
- `reason`: why the action matters.
- `reversibility`: high, medium, low, irreversible, or unknown.
- `requiresCredential`: whether the effect needs external authority.
- `credentialKind` and `credentialContext`: kind and source, never the credential
  value.
- `command`: optional argv-style command for local CLI adapters.

Request rule: the request should summarize intent and target. It should not
embed raw secrets, full logs, PHI, customer data, or large artifacts.

### `ThorityDecisionResult`

The decision returned by LexThority.

Required meaning:

- `decision`: `allow`, `escalate`, or `deny`.
- `reasons`: short, stable reason strings.
- `operatorAsk`: present when the agent needs a human, broker, or narrower
  envelope to proceed.

Decision rule: `escalate` is not failure. It is the structured path from agent
intent to the minimum safe unlock.

### `EffectReceipt`

The durable event record.

Required meaning:

- `receiptId`: stable receipt id.
- `runId`: run correlation id.
- `timestamp`: decision or execution time.
- `sonaId`: posture associated with the run.
- `thorityEnvelopeId` and `thorityEnvelopeHash`: authority context used.
- `request`: the compact effect request.
- `decision`: `allow`, `escalate`, or `deny`.
- `outcome`: executed, not executed, dry run, failed, or fallback recorded.
- `reasons`: decision reasons.
- `operatorAsk`: minimum unlock and safe fallbacks when relevant.
- `exitCode` and `outputSummary`: optional sanitized execution result.

Receipt rule: receipts are evidence pointers and summaries, not data dumps.

## Agent Behavior Contract

An agent using LexThority should:

1. Work normally inside the local workspace and assigned run context.
2. Classify intended side effects before attempting them.
3. Ask LexThority only at meaningful boundaries.
4. Treat `allow` as boundary-satisfied for this attempt, not proof of success.
5. Treat `escalate` as a request for minimum unlock or safe fallback.
6. Treat `deny` as a hard stop for that effect.
7. Record receipts for allowed, denied, escalated, and failed effects according
   to the envelope policy.
8. Convert real tool failures into concise access gaps.
9. Avoid placing secrets, raw credentials, customer data, PHI, or full logs in
   requests and receipts.

## Operator Ask Contract

When the agent cannot proceed, the operator ask should contain:

- the minimum unlock needed
- the exact target or scope
- the intended safe action
- a short time or run bound when known
- safe fallbacks that preserve progress without crossing the boundary

Good operator ask:

```text
Minimum unlock: allow repo.push for Guff/example on branch feature/site-refresh
for this run, or have an authorized operator run the prepared push command.
Safe fallbacks: keep the local commit, export a patch, or open a local PR draft.
```

Poor operator ask:

```text
Need GitHub access.
```

## Swarm Boundary

LexThority can support swarm behavior without becoming the swarm runtime.

For a multi-agent run, LexRunner or another orchestrator should create bounded
work environments and assign each agent an envelope. LexThority should gate
promotion points where isolated work attempts to affect shared state:

- merge isolated changes into a shared branch
- push a branch
- open or update a pull request
- deploy a preview
- write to tickets or documentation
- request secrets
- touch production or regulated data

This lets agents explore freely inside their assigned environment while making
shared-state changes explicit and auditable.

## Token Discipline

LexThority becomes inefficient if every decision requires a giant policy prompt.

The contract should stay compact:

- Use stable ids and enums.
- Send summaries, not transcripts.
- Send command argv, not terminal scrollback.
- Send evidence references, not large artifacts.
- Store receipts as line-delimited records.
- Let Lex remember historical receipts and access gaps instead of re-explaining
  them in every prompt.

The target shape is a small preflight object, a small decision object, and a
small receipt object.

## Open Design Questions

These are intentionally unresolved:

- How should production envelopes be issued and signed?
- How should child envelopes work for agent swarms?
- How much LexSona posture belongs directly in an envelope?
- What is the smallest useful vocabulary for effects before it becomes
  bureaucracy?
- How should external IAM denials be normalized into access-gap receipts?
- Which adapters should live in AXF versus LexThority?
- How should receipts reference evidence without leaking sensitive context?

The current answer is to keep LexThority narrow and let real usage decide which
fields earn their way into the contract.
