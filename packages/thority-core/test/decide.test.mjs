import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommand,
  decideThority,
} from "../dist/index.js";

const baseEnvelope = {
  id: "test-envelope",
  version: 1,
  sonaId: "engineer",
  issuedBy: "test-fixture",
  issuedAt: "2026-06-26T08:00:00.000Z",
  environment: "local",
  scope: {},
  allow: ["workspace.read", "workspace.write", "repo.branch", "repo.commit"],
  escalate: ["repo.push", "issue.comment", "cloud.read"],
  deny: ["cloud.apply", "secret.read", "unknown"],
  dataAllow: ["public", "source", "work-internal", "nonprod-log"],
  dataEscalate: ["unknown"],
  dataDeny: ["secret", "customer-data", "regulated-data", "prod-data"],
  ambientCredentialPolicy: "ignore",
  unknownEffectPolicy: {
    local: "escalate",
    ci: "deny",
    protected: "deny",
    prod: "deny",
  },
  receiptPolicy: {
    recordAllowed: true,
    recordDenied: true,
    recordFallback: true,
    requireReason: true,
  },
};

test("allows explicitly allowed workspace read", () => {
  const request = classifyCommand(["git", "status"]);
  const result = decideThority(baseEnvelope, request);
  assert.equal(result.decision, "allow");
});

test("escalates repo push", () => {
  const request = classifyCommand(["git", "push", "origin", "feature/test"]);
  const result = decideThority(baseEnvelope, request);
  assert.equal(result.decision, "escalate");
  assert.match(result.operatorAsk?.minimumUnlock ?? "", /repo\.push/);
});

test("denies cloud apply", () => {
  const request = classifyCommand(["gcloud", "run", "deploy", "api"]);
  const result = decideThority(baseEnvelope, request);
  assert.equal(result.decision, "deny");
});

test("unknown effect escalates locally", () => {
  const request = classifyCommand(["some-tool", "do", "thing"]);
  const result = decideThority(baseEnvelope, request);
  assert.equal(result.decision, "escalate");
});

test("unknown effect denies in protected contexts", () => {
  const request = classifyCommand(["some-tool", "do", "thing"]);
  const result = decideThority({ ...baseEnvelope, environment: "prod" }, request);
  assert.equal(result.decision, "deny");
});

test("ambient credential policy can deny credential use", () => {
  const request = classifyCommand(["git", "push", "origin", "feature/test"]);
  const result = decideThority(
    { ...baseEnvelope, ambientCredentialPolicy: "deny" },
    request
  );
  assert.equal(result.decision, "deny");
  assert.match(result.reasons.join("\n"), /Ambient credentials/);
});
