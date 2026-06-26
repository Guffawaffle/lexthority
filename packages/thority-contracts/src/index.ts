export const EFFECT_CLASSES = [
  "workspace.read",
  "workspace.write",
  "repo.branch",
  "repo.commit",
  "repo.push",
  "repo.pr.create",
  "issue.comment",
  "issue.create",
  "ci.read",
  "ci.run",
  "cloud.read",
  "cloud.plan",
  "cloud.apply",
  "cloudflare.zone.read",
  "cloudflare.dns.read",
  "cloudflare.dns.edit",
  "cloudflare.worker.deploy",
  "secret.read",
  "prod.read",
  "prod.write",
  "external.write",
  "spend",
  "unknown",
] as const;

export type EffectClass = (typeof EFFECT_CLASSES)[number];

export const DATA_CLASSES = [
  "public",
  "source",
  "work-internal",
  "nonprod-log",
  "secret",
  "customer-data",
  "regulated-data",
  "prod-data",
  "unknown",
] as const;

export type DataClass = (typeof DATA_CLASSES)[number];

export type ThorityDecision = "allow" | "escalate" | "deny";
export type ThorityEnvironment = "local" | "ci" | "protected" | "prod";
export type ThorityIssuer =
  | "operator"
  | "workspace-policy"
  | "org-policy"
  | "workflow"
  | "test-fixture";

export type AmbientCredentialPolicy = "ignore" | "warn" | "deny";
export type CredentialSource = "none" | "ambient" | "explicit" | "brokered";

export interface CredentialIntent {
  provider: string;
  actions: string[];
  maxTtl?: string;
  approval?: "none" | "human-required" | "policy-required";
}

export interface CredentialContext {
  source: CredentialSource;
  kind?: string;
  id?: string;
}

export interface ThorityScope {
  workspace?: string;
  repositories?: string[];
  projects?: string[];
  cloudProjects?: string[];
  zones?: string[];
  environments?: string[];
}

export interface UnknownEffectPolicy {
  local: ThorityDecision;
  ci: ThorityDecision;
  protected: ThorityDecision;
  prod: ThorityDecision;
}

export interface ReceiptPolicy {
  recordAllowed: boolean;
  recordDenied: boolean;
  recordFallback: boolean;
  requireReason: boolean;
}

export interface ThorityEnvelope {
  id: string;
  version: 1;
  runId?: string;
  sonaId: string;
  issuedBy: ThorityIssuer;
  issuerRef?: string;
  issuedAt: string;
  expiresAt?: string;
  environment: ThorityEnvironment;
  scope: ThorityScope;
  allow: EffectClass[];
  escalate: EffectClass[];
  deny: EffectClass[];
  dataAllow: DataClass[];
  dataEscalate: DataClass[];
  dataDeny: DataClass[];
  credentialIntent?: CredentialIntent[];
  receiptPolicy: ReceiptPolicy;
  ambientCredentialPolicy: AmbientCredentialPolicy;
  unknownEffectPolicy: UnknownEffectPolicy;
}

export interface EffectTarget {
  provider?: string;
  repository?: string;
  project?: string;
  environment?: string;
  resource?: string;
}

export type Reversibility = "high" | "medium" | "low" | "irreversible" | "unknown";

export interface EffectRequest {
  id: string;
  runId?: string;
  effect: EffectClass;
  dataClass: DataClass;
  target: EffectTarget;
  reason: string;
  reversibility: Reversibility;
  requiresCredential?: boolean;
  credentialKind?: string;
  credentialContext?: CredentialContext;
  command?: string[];
}

export interface OperatorAsk {
  minimumUnlock: string;
  safeFallbacks: string[];
}

export interface ThorityDecisionResult {
  decision: ThorityDecision;
  reasons: string[];
  operatorAsk?: OperatorAsk;
}

export type EffectOutcome =
  | "executed"
  | "not_executed"
  | "dry_run"
  | "failed"
  | "fallback_recorded";

export interface EffectReceipt {
  version: 1;
  receiptId: string;
  runId: string;
  timestamp: string;
  sonaId: string;
  thorityEnvelopeId: string;
  thorityEnvelopeHash: string;
  request: EffectRequest;
  decision: ThorityDecision;
  outcome: EffectOutcome;
  reasons: string[];
  operatorAsk?: OperatorAsk;
  exitCode?: number;
  outputSummary?: string;
}

export function isEffectClass(value: unknown): value is EffectClass {
  return typeof value === "string" && EFFECT_CLASSES.includes(value as EffectClass);
}

export function isDataClass(value: unknown): value is DataClass {
  return typeof value === "string" && DATA_CLASSES.includes(value as DataClass);
}

export function validateThorityEnvelope(value: unknown): asserts value is ThorityEnvelope {
  const envelope = asRecord(value, "ThorityEnvelope");
  requireString(envelope.id, "id");
  if (envelope.version !== 1) {
    throw new Error("ThorityEnvelope.version must be 1");
  }
  requireString(envelope.sonaId, "sonaId");
  requireString(envelope.issuedBy, "issuedBy");
  requireString(envelope.issuedAt, "issuedAt");
  requireString(envelope.environment, "environment");
  requireArray(envelope.allow, "allow").forEach((effect) => requireEffect(effect, "allow"));
  requireArray(envelope.escalate, "escalate").forEach((effect) =>
    requireEffect(effect, "escalate")
  );
  requireArray(envelope.deny, "deny").forEach((effect) => requireEffect(effect, "deny"));
  requireArray(envelope.dataAllow, "dataAllow").forEach((dataClass) =>
    requireDataClass(dataClass, "dataAllow")
  );
  requireArray(envelope.dataEscalate, "dataEscalate").forEach((dataClass) =>
    requireDataClass(dataClass, "dataEscalate")
  );
  requireArray(envelope.dataDeny, "dataDeny").forEach((dataClass) =>
    requireDataClass(dataClass, "dataDeny")
  );
  asRecord(envelope.scope, "scope");
  asRecord(envelope.receiptPolicy, "receiptPolicy");
  asRecord(envelope.unknownEffectPolicy, "unknownEffectPolicy");
}

export function validateEffectRequest(value: unknown): asserts value is EffectRequest {
  const request = asRecord(value, "EffectRequest");
  requireString(request.id, "id");
  requireEffect(request.effect, "effect");
  requireDataClass(request.dataClass, "dataClass");
  asRecord(request.target, "target");
  requireString(request.reason, "reason");
  requireString(request.reversibility, "reversibility");
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  return value;
}

function requireEffect(value: unknown, field: string): EffectClass {
  if (!isEffectClass(value)) {
    throw new Error(`${field} contains unknown effect class: ${String(value)}`);
  }
  return value;
}

function requireDataClass(value: unknown, field: string): DataClass {
  if (!isDataClass(value)) {
    throw new Error(`${field} contains unknown data class: ${String(value)}`);
  }
  return value;
}
