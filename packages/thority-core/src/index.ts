import { createHash, randomUUID } from "node:crypto";
import type {
  DataClass,
  EffectClass,
  EffectReceipt,
  EffectRequest,
  OperatorAsk,
  ThorityDecision,
  ThorityDecisionResult,
  ThorityEnvelope,
} from "@smartergpt/thority-contracts";

export function decideThority(
  envelope: ThorityEnvelope,
  request: EffectRequest
): ThorityDecisionResult {
  const reasons: string[] = [];
  const scopeDecision = decideScope(envelope, request);
  if (scopeDecision) {
    return {
      decision: "deny",
      reasons: [scopeDecision],
      operatorAsk: renderOperatorAsk(request, "deny"),
    };
  }

  if (request.effect === "unknown" || request.dataClass === "unknown") {
    const decision = envelope.unknownEffectPolicy[envelope.environment] ?? "escalate";
    reasons.push(
      `Unknown effect or data class in ${envelope.environment} environment maps to ${decision}`
    );
    return {
      decision,
      reasons,
      operatorAsk: decision === "allow" ? undefined : renderOperatorAsk(request, decision),
    };
  }

  const ambientDecision = decideAmbientCredentials(envelope, request);
  if (ambientDecision) {
    return ambientDecision;
  }

  if (envelope.deny.includes(request.effect)) {
    reasons.push(`Effect ${request.effect} is explicitly denied`);
    return { decision: "deny", reasons, operatorAsk: renderOperatorAsk(request, "deny") };
  }

  if (envelope.dataDeny.includes(request.dataClass)) {
    reasons.push(`Data class ${request.dataClass} is explicitly denied`);
    return { decision: "deny", reasons, operatorAsk: renderOperatorAsk(request, "deny") };
  }

  if (envelope.escalate.includes(request.effect)) {
    reasons.push(`Effect ${request.effect} requires escalation`);
    return { decision: "escalate", reasons, operatorAsk: renderOperatorAsk(request, "escalate") };
  }

  if (envelope.dataEscalate.includes(request.dataClass)) {
    reasons.push(`Data class ${request.dataClass} requires escalation`);
    return { decision: "escalate", reasons, operatorAsk: renderOperatorAsk(request, "escalate") };
  }

  if (envelope.allow.includes(request.effect) && envelope.dataAllow.includes(request.dataClass)) {
    reasons.push(`Effect ${request.effect} and data class ${request.dataClass} are allowed`);
    return { decision: "allow", reasons };
  }

  reasons.push("No explicit allow matched; defaulting to escalation");
  return { decision: "escalate", reasons, operatorAsk: renderOperatorAsk(request, "escalate") };
}

export function classifyCommand(command: string[]): EffectRequest {
  if (command.length === 0) {
    return unknownRequest(command, "No command provided");
  }

  const [bin, ...args] = command;
  if (bin === "git") {
    return classifyGit(args, command);
  }
  if (bin === "gh") {
    return classifyGh(args, command);
  }
  if (bin === "gcloud") {
    return classifyGcloud(args, command);
  }
  if (bin === "wrangler") {
    return classifyWrangler(args, command);
  }

  return unknownRequest(command, `No classifier for command ${bin}`);
}

export function renderOperatorAsk(
  request: EffectRequest,
  decision: Exclude<ThorityDecision, "allow">
): OperatorAsk {
  const target = describeTarget(request);
  const action = decision === "deny" ? "blocked" : "requires approval";

  if (request.effect === "repo.push") {
    return {
      minimumUnlock: `Allow repo.push for ${target} for this run, or have an authorized operator run the prepared push command.`,
      safeFallbacks: ["keep local commit", "print exact push command", "export patch file"],
    };
  }

  if (request.effect === "issue.comment" || request.effect === "issue.create") {
    return {
      minimumUnlock: `Allow ${request.effect} for ${target} for this run, or ask an authorized operator to post the prepared text.`,
      safeFallbacks: ["write local markdown draft", "print exact gh command", "stop without remote mutation"],
    };
  }

  if (request.effect === "cloud.apply" || request.effect === "cloudflare.worker.deploy") {
    return {
      minimumUnlock: `Grant a short-lived deployment-capable credential for ${target}, scoped to this run.`,
      safeFallbacks: ["produce dry-run plan", "write deployment checklist", "stop before mutation"],
    };
  }

  if (request.effect === "secret.read") {
    return {
      minimumUnlock: `Use the client-approved secret access path for ${target}; do not expose secret values in chat or receipts.`,
      safeFallbacks: ["request redacted value", "ask operator to run command", "stop"],
    };
  }

  return {
    minimumUnlock: `${request.effect} ${action} for ${target}; issue a narrower envelope or operator approval if this should proceed.`,
    safeFallbacks: ["record access gap", "ask operator for minimum unlock", "stop before side effect"],
  };
}

export function createReceipt(input: {
  envelope: ThorityEnvelope;
  request: EffectRequest;
  result: ThorityDecisionResult;
  outcome: EffectReceipt["outcome"];
  exitCode?: number;
  outputSummary?: string;
}): EffectReceipt {
  const runId = input.request.runId ?? input.envelope.runId ?? `run_${randomUUID()}`;
  return {
    version: 1,
    receiptId: `rcpt_${randomUUID()}`,
    runId,
    timestamp: new Date().toISOString(),
    sonaId: input.envelope.sonaId,
    thorityEnvelopeId: input.envelope.id,
    thorityEnvelopeHash: hashEnvelope(input.envelope),
    request: input.request,
    decision: input.result.decision,
    outcome: input.outcome,
    reasons: input.result.reasons,
    operatorAsk: input.result.operatorAsk,
    exitCode: input.exitCode,
    outputSummary: input.outputSummary,
  };
}

export function hashEnvelope(envelope: ThorityEnvelope): string {
  return `sha256:${createHash("sha256").update(canonicalJson(envelope)).digest("hex")}`;
}

function classifyGit(args: string[], command: string[]): EffectRequest {
  const subcommand = args[0];
  if (["status", "diff", "log", "show", "remote"].includes(subcommand ?? "")) {
    return request("workspace.read", "source", command, "Git read-only repository inspection", "high");
  }
  if (
    (subcommand === "checkout" && args.includes("-b")) ||
    (subcommand === "switch" && (args.includes("-c") || args.includes("--create")))
  ) {
    return request("repo.branch", "source", command, "Create or switch to a local branch", "high");
  }
  if (["add", "commit"].includes(subcommand ?? "")) {
    return request("repo.commit", "source", command, "Stage or create local source commit", "medium");
  }
  if (subcommand === "push") {
    return request(
      "repo.push",
      "source",
      command,
      "Push mutates remote repository state",
      "medium",
      true,
      "git-remote"
    );
  }
  return unknownRequest(command, `Unknown git subcommand ${subcommand ?? "<missing>"}`);
}

function classifyGh(args: string[], command: string[]): EffectRequest {
  if (args[0] === "issue" && args[1] === "comment") {
    return request(
      "issue.comment",
      "work-internal",
      command,
      "Commenting on an issue writes to an external source of truth",
      "medium",
      true,
      "github-token"
    );
  }
  if (args[0] === "issue" && args[1] === "create") {
    return request(
      "issue.create",
      "work-internal",
      command,
      "Creating an issue writes to an external source of truth",
      "medium",
      true,
      "github-token"
    );
  }
  if (args[0] === "pr" && args[1] === "create") {
    return request(
      "repo.pr.create",
      "source",
      command,
      "Creating a PR mutates remote repository collaboration state",
      "medium",
      true,
      "github-token"
    );
  }
  return unknownRequest(command, "Unknown gh command shape");
}

function classifyGcloud(args: string[], command: string[]): EffectRequest {
  if (args[0] === "run" && args[1] === "services" && args[2] === "describe") {
    return request(
      "cloud.read",
      "work-internal",
      command,
      "Describe Cloud Run service reads cloud configuration",
      "high",
      true,
      "gcp-wif"
    );
  }
  if (args[0] === "run" && args[1] === "deploy") {
    return request(
      "cloud.apply",
      "work-internal",
      command,
      "Deploying Cloud Run mutates cloud infrastructure",
      "low",
      true,
      "gcp-wif"
    );
  }
  return unknownRequest(command, "Unknown gcloud command shape");
}

function classifyWrangler(args: string[], command: string[]): EffectRequest {
  if (args[0] === "deploy") {
    return request(
      "cloudflare.worker.deploy",
      "work-internal",
      command,
      "Deploying a Cloudflare Worker mutates remote runtime state",
      "low",
      true,
      "cloudflare-api-token"
    );
  }
  return unknownRequest(command, "Unknown wrangler command shape");
}

function request(
  effect: EffectClass,
  dataClass: DataClass,
  command: string[],
  reason: string,
  reversibility: EffectRequest["reversibility"],
  requiresCredential = false,
  credentialKind?: string
): EffectRequest {
  return {
    id: `eff_${randomUUID()}`,
    effect,
    dataClass,
    target: inferTarget(effect, command),
    reason,
    reversibility,
    requiresCredential,
    credentialKind,
    credentialContext: requiresCredential
      ? { source: "ambient", kind: credentialKind }
      : { source: "none" },
    command,
  };
}

function unknownRequest(command: string[], reason: string): EffectRequest {
  return request("unknown", "unknown", command, reason, "unknown");
}

function inferTarget(effect: EffectClass, command: string[]): EffectRequest["target"] {
  if (effect.startsWith("repo.") || effect.startsWith("issue.")) {
    return { provider: command[0] === "gh" ? "github" : "git", resource: command.join(" ") };
  }
  if (effect.startsWith("cloudflare.")) {
    return { provider: "cloudflare", resource: command.join(" ") };
  }
  if (effect.startsWith("cloud.")) {
    return { provider: "gcp", resource: command.join(" ") };
  }
  if (effect.startsWith("workspace.")) {
    return { provider: "filesystem", resource: command.join(" ") };
  }
  return { provider: command[0], resource: command.join(" ") };
}

function decideScope(envelope: ThorityEnvelope, request: EffectRequest): string | null {
  const repositories = envelope.scope.repositories ?? [];
  if (request.target.repository && repositories.length > 0) {
    if (!repositories.includes(request.target.repository)) {
      return `Target repository ${request.target.repository} is outside envelope scope`;
    }
  }
  const environments = envelope.scope.environments ?? [];
  if (request.target.environment && environments.length > 0) {
    if (!environments.includes(request.target.environment)) {
      return `Target environment ${request.target.environment} is outside envelope scope`;
    }
  }
  return null;
}

function decideAmbientCredentials(
  envelope: ThorityEnvelope,
  request: EffectRequest
): ThorityDecisionResult | null {
  if (!request.requiresCredential || request.credentialContext?.source !== "ambient") {
    return null;
  }
  if (envelope.ambientCredentialPolicy === "deny") {
    return {
      decision: "deny",
      reasons: ["Ambient credentials may not be consumed by this envelope"],
      operatorAsk: renderOperatorAsk(request, "deny"),
    };
  }
  if (envelope.ambientCredentialPolicy === "warn") {
    return {
      decision: "escalate",
      reasons: ["Ambient credentials were observed; explicit approval is required before use"],
      operatorAsk: renderOperatorAsk(request, "escalate"),
    };
  }
  return null;
}

function describeTarget(request: EffectRequest): string {
  return (
    request.target.repository ??
    request.target.project ??
    request.target.environment ??
    request.target.resource ??
    request.target.provider ??
    "the requested target"
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
