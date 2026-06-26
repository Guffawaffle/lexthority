#!/usr/bin/env node

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  validateEffectRequest,
  validateThorityEnvelope,
  type EffectReceipt,
  type EffectRequest,
  type ThorityEnvelope,
} from "@smartergpt/thority-contracts";
import {
  classifyCommand,
  createReceipt,
  decideThority,
} from "@smartergpt/thority-core";

type Flags = Record<string, string | boolean>;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "classify") {
    await classifyCommandCli(rest);
    return;
  }
  if (command === "check") {
    await checkCli(rest);
    return;
  }
  if (command === "exec") {
    await execCli(rest);
    return;
  }

  throw new Error(`unknown command ${command}. Run lex-thority help.`);
}

async function classifyCommandCli(tokens: string[]): Promise<void> {
  const { flags, positional } = parseFlags(stripSeparator(tokens));
  if (positional.length === 0) {
    throw new Error("classify requires a command after --");
  }
  const request = classifyCommand(positional);
  if (flags.json) {
    console.log(JSON.stringify(request, null, 2));
    return;
  }
  printRequest(request);
}

async function checkCli(tokens: string[]): Promise<void> {
  const { flags, positional } = parseFlags(tokens);
  const effectFile = positional[0];
  if (!effectFile) {
    throw new Error("check requires an effect request JSON file");
  }
  const envelopePath = requireFlag(flags, "envelope");
  const envelope = await readJson<ThorityEnvelope>(envelopePath, validateThorityEnvelope);
  const request = await readJson<EffectRequest>(effectFile, validateEffectRequest);
  const result = decideThority(envelope, request);
  const outcome: EffectReceipt["outcome"] = result.decision === "allow" ? "dry_run" : "not_executed";
  const receipt = createReceipt({ envelope, request, result, outcome });
  await maybeWriteReceipt(flags, receipt);
  printDecision(result, request, flags);
  process.exitCode = result.decision === "deny" ? 2 : result.decision === "escalate" ? 3 : 0;
}

async function execCli(tokens: string[]): Promise<void> {
  const separator = tokens.indexOf("--");
  const flagTokens = separator >= 0 ? tokens.slice(0, separator) : [];
  const commandTokens = separator >= 0 ? tokens.slice(separator + 1) : tokens;
  const { flags } = parseFlags(flagTokens);
  if (commandTokens.length === 0) {
    throw new Error("exec requires a command after --");
  }
  const envelopePath = requireFlag(flags, "envelope");
  const envelope = await readJson<ThorityEnvelope>(envelopePath, validateThorityEnvelope);
  const request = classifyCommand(commandTokens);
  const result = decideThority(envelope, request);

  if (result.decision !== "allow") {
    const receipt = createReceipt({
      envelope,
      request,
      result,
      outcome: "not_executed",
    });
    await maybeWriteReceipt(flags, receipt);
    printDecision(result, request, flags);
    process.exitCode = result.decision === "deny" ? 2 : 3;
    return;
  }

  if (flags["dry-run"]) {
    const receipt = createReceipt({ envelope, request, result, outcome: "dry_run" });
    await maybeWriteReceipt(flags, receipt);
    printDecision(result, request, flags);
    return;
  }

  const exitCode = await runCommand(commandTokens);
  const receipt = createReceipt({
    envelope,
    request,
    result,
    outcome: exitCode === 0 ? "executed" : "failed",
    exitCode,
  });
  await maybeWriteReceipt(flags, receipt);
  process.exitCode = exitCode;
}

function printHelp(): void {
  console.log(`lex-thority

Usage:
  lex-thority classify -- <command...>
  lex-thority check <effect.json> --envelope <envelope.json> [--json] [--receipt-log <path>]
  lex-thority exec --envelope <envelope.json> [--dry-run] [--json] [--receipt-log <path>] -- <command...>

Examples:
  lex-thority classify -- git push origin feature/test
  lex-thority check examples/effects/git-push.json --envelope examples/envelopes/thority.local.engineer.json
  lex-thority exec --dry-run --envelope examples/envelopes/thority.local.engineer.json -- git push origin feature/test
`);
}

function printRequest(request: EffectRequest): void {
  console.log(`Effect: ${request.effect}`);
  console.log(`Data: ${request.dataClass}`);
  console.log(`Reason: ${request.reason}`);
  console.log(`Requires credential: ${request.requiresCredential ? "yes" : "no"}`);
}

function printDecision(
  result: ReturnType<typeof decideThority>,
  request: EffectRequest,
  flags: Flags
): void {
  if (flags.json) {
    console.log(JSON.stringify({ request, result }, null, 2));
    return;
  }
  console.log(`Decision: ${result.decision}`);
  console.log("");
  console.log(`Effect: ${request.effect}`);
  console.log(`Reason: ${request.reason}`);
  if (result.reasons.length > 0) {
    console.log("");
    console.log("Decision reasons:");
    for (const reason of result.reasons) {
      console.log(`- ${reason}`);
    }
  }
  if (result.operatorAsk) {
    console.log("");
    console.log("Minimum unlock:");
    console.log(result.operatorAsk.minimumUnlock);
    console.log("");
    console.log("Safe fallbacks:");
    for (const fallback of result.operatorAsk.safeFallbacks) {
      console.log(`- ${fallback}`);
    }
  }
}

async function readJson<T>(
  filePath: string,
  validate: (value: unknown) => asserts value is T
): Promise<T> {
  const raw = await readFile(resolve(filePath), "utf8");
  const parsed: unknown = JSON.parse(raw);
  validate(parsed);
  return parsed;
}

async function maybeWriteReceipt(flags: Flags, receipt: EffectReceipt): Promise<void> {
  const receiptLog =
    typeof flags["receipt-log"] === "string" ? flags["receipt-log"] : ".lexthority/receipts.ndjson";
  await mkdir(dirname(receiptLog), { recursive: true });
  await appendFile(receiptLog, `${JSON.stringify(receipt)}\n`, "utf8");
}

function requireFlag(flags: Flags, name: string): string {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required --${name} <value>`);
  }
  return value;
}

function parseFlags(tokens: string[]): { flags: Flags; positional: string[] } {
  const flags: Flags = {};
  const positional: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("--")) {
      const name = token.slice(2);
      const next = tokens[index + 1];
      if (next && !next.startsWith("--")) {
        flags[name] = next;
        index += 1;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

function stripSeparator(tokens: string[]): string[] {
  return tokens[0] === "--" ? tokens.slice(1) : tokens;
}

async function runCommand(command: string[]): Promise<number> {
  return await new Promise((resolveRun) => {
    const child = spawn(command[0]!, command.slice(1), { stdio: "inherit" });
    child.on("close", (code) => resolveRun(code ?? 1));
  });
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`lex-thority: ${message}`);
  process.exitCode = 1;
});
