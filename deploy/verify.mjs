#!/usr/bin/env node
/**
 * Post-deploy verification. Reads deploy/deployments.json and confirms, over
 * the RPC, that the address is a live contract, that its frozen constants are
 * what we expect, and that the recorded bundle digest still matches the
 * committed artifact. Free (no gas). Fails closed: any mismatch exits 1.
 */
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const doc = JSON.parse(readFileSync(join(__dirname, "deployments.json"), "utf-8"));
const net = doc.studio_next ?? doc;
const address = net.address;
if (!address) {
  console.error("No address recorded in deploy/deployments.json");
  process.exit(1);
}

const client = createClient({ chain: studioDevnet });

console.log(`Verifying ${address} on chain ${studioDevnet.id}...`);
const schema = await client.getContractSchema(address);
const methodNames = Object.keys(schema?.methods ?? {}).sort();
console.log(`Schema OK: ${methodNames.length} methods`);
console.log(methodNames.join(", "));

const readJson = async (fn, args = []) =>
  JSON.parse(String(await client.readContract({ address, functionName: fn, args })));

const cfg = await readJson("get_config");
const policyIds = await readJson("get_policy_ids");
const board = await readJson("get_board", [5]);

const expectedMethods = [
  "cancel_stale",
  "claim_fees",
  "create_policy",
  "evaluate",
  "get_board",
  "get_config",
  "get_evaluation",
  "get_fee_claimable",
  "get_policy",
  "get_policy_ids",
  "request_evaluation",
];

const checks = [
  [methodNames.length === 11, `11 methods (got ${methodNames.length})`],
  [
    expectedMethods.every((m) => methodNames.includes(m)),
    `all expected methods present (got ${methodNames.join(", ")})`,
  ],
  [Number(cfg.max_attempts) === 5, `max_attempts == 5 (got ${cfg.max_attempts})`],
  [
    Number(cfg.stale_timeout_seconds) === 86400,
    `stale_timeout_seconds == 86400 (got ${cfg.stale_timeout_seconds})`,
  ],
  [
    Number(cfg.max_evidence_urls) === 5,
    `max_evidence_urls == 5 (got ${cfg.max_evidence_urls})`,
  ],
  [
    String(cfg.treasury).toLowerCase() === String(net.treasury).toLowerCase(),
    `treasury matches deployments.json (got ${cfg.treasury})`,
  ],
  [
    String(cfg.owner).toLowerCase() === String(net.owner ?? net.treasury).toLowerCase(),
    `owner matches deployments.json (got ${cfg.owner})`,
  ],
  [Array.isArray(policyIds), `get_policy_ids is a JSON list (got ${JSON.stringify(policyIds)})`],
  [Array.isArray(board), `get_board is a JSON list (got ${Array.isArray(board) ? "list" : typeof board})`],
];

if (net.bundled_file) {
  const bundlePath = join(REPO_ROOT, net.bundled_file);
  if (!existsSync(bundlePath)) {
    checks.push([false, `bundle exists at ${net.bundled_file}`]);
  } else {
    const bytes = readFileSync(bundlePath);
    const sha = createHash("sha256").update(bytes).digest("hex");
    checks.push([bytes.length === net.bundled_bytes, `bundle bytes == ${net.bundled_bytes} (got ${bytes.length})`]);
    checks.push([sha === net.bundled_sha256, `bundle sha256 == ${net.bundled_sha256} (got ${sha})`]);
  }
}

let ok = true;
console.log("\nChecks:");
for (const [pass, label] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) ok = false;
}

console.log("\nget_config:");
console.log(JSON.stringify(cfg, null, 2));

if (!ok) {
  console.error("\nVerification FAILED.");
  process.exit(1);
}
console.log("\nVerification PASSED.");
