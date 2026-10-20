#!/usr/bin/env node
/**
 * Deploy contracts/build/Beacon.bundled.py to GenLayer Studio Next (chain
 * 61997) through the `genlayer` CLI's unlocked keystore. On success it records
 * the address in deploy/deployments.json and appends any superseded address to
 * the ledger with the reason it was replaced.
 *
 * Why we drive the CLI's JS entry directly instead of shelling out:
 *   1. A spawn with an argv array (no shell) delivers the bare, unquoted
 *      treasury address verbatim. `'"0xADDR"'` embeds literal quote characters
 *      that `Address()` rejects.
 *   2. Consensus v0.6 rejects a zero/missing fee distribution with
 *      FeeValueMustBeNonZero(1) CLIENT-SIDE -- before broadcast, though the
 *      error reads like an on-chain revert. The fee object below is the proven,
 *      complete distribution used by a real successful deploy and live write
 *      on this network. Passing it as JSON through a shell is exactly the kind
 *      of quoting that breaks.
 *
 * Run `node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py`
 * (free, no gas) first. This script is a real, funds-moving action.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CONTRACT_PATH = join(REPO_ROOT, "contracts", "build", "Beacon.bundled.py");
const DEPLOYMENTS_PATH = join(__dirname, "deployments.json");

const CLI =
  process.env.GENLAYER_CLI ?? "C:/Users/HP/nodejs/node_modules/genlayer/dist/index.js";
const RPC = "https://studio-dev.genlayer.com/api";

const TREASURY = "0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537";

// Complete, non-zero fee distribution for consensus v0.6. A bare or partial
// distribution fails client-side with FeeValueMustBeNonZero(1).
const FEES = {
  distribution: {
    rotations: [3],
    appealRounds: 0,
    totalMessageFees: 0,
    executionConsumed: 0,
    receiptFeeMaxGasPrice: "300000000",
    storageFeeMaxGasPrice: "300000000",
    maxPriceGenPerTimeUnit: "2",
    executionBudgetPerRound: "25000000000000000",
    leaderTimeunitsAllocation: "100",
    validatorTimeunitsAllocation: "200",
  },
  feeValue: "100000000000010352",
};

if (!existsSync(CONTRACT_PATH)) {
  console.error(`${CONTRACT_PATH} not found -- run "python contracts/build_bundle.py" first`);
  process.exit(1);
}

const bundle = readFileSync(CONTRACT_PATH);
const sha256 = createHash("sha256").update(bundle).digest("hex");

const args = [
  CLI,
  "deploy",
  "--contract",
  CONTRACT_PATH,
  "--rpc",
  RPC,
  "--fees",
  JSON.stringify(FEES),
  "--args",
  TREASURY,
];

console.log("Deploying BEACON to Studio Next (chain 61997)...");
console.log(`Treasury: ${TREASURY}`);
console.log(`Bundle: ${CONTRACT_PATH} (${bundle.length} bytes, sha256 ${sha256})`);
const proc = spawnSync(process.execPath, args, { encoding: "utf-8" });
const out = (proc.stdout ?? "") + (proc.stderr ?? "");
console.log(out);

if (proc.status !== 0) {
  console.error(`genlayer CLI exited with status ${proc.status}`);
  process.exit(proc.status ?? 1);
}

// The CLI echoes the args (including the treasury address) before the result,
// so prefer an explicit "deploy"/"contract" mention; fall back to the last
// 40-hex address in the output.
const matches = [...out.matchAll(/0x[0-9a-fA-F]{40}/g)].map((m) => m[0]);
const labelled =
  out.match(/deployed(?:\s+at| to)?\s*:?\s*(0x[0-9a-fA-F]{40})/i)?.[1] ??
  out.match(/contract(?:\s+address)?\s*:?\s*(0x[0-9a-fA-F]{40})/i)?.[1];
const address = labelled ?? matches[matches.length - 1];
const txHash = out.match(/Transaction Hash'?:?\s*'?(0x[0-9a-fA-F]{64})/i)?.[1] ?? "";

if (!address) {
  console.error("Could not read the deployed contract address from the CLI output.");
  process.exit(1);
}

console.log(`\nDeployed at: ${address}`);

const doc = existsSync(DEPLOYMENTS_PATH)
  ? JSON.parse(readFileSync(DEPLOYMENTS_PATH, "utf-8"))
  : { studio_next: { superseded: [] } };
const net = (doc.studio_next ??= { superseded: [] });
const previous = net.address;
if (previous && previous.toLowerCase() !== address.toLowerCase()) {
  net.superseded = Array.isArray(net.superseded) ? net.superseded : [];
  net.superseded.unshift({
    address: previous,
    tx: net.deploy_tx ?? "",
    deployed_at: net.deployed_at ?? "",
    reason:
      process.env.SUPERSEDE_REASON ??
      "Superseded by a redeploy; see docs/STATUS.md for the change that required it.",
  });
}
net.address = address;
net.deploy_tx = txHash;
net.treasury = TREASURY;
net.owner = TREASURY;
net.deployed_at = new Date().toISOString();
net.bundled_file = "contracts/build/Beacon.bundled.py";
net.bundled_sha256 = sha256;
net.bundled_bytes = bundle.length;
writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${DEPLOYMENTS_PATH}`);
console.log("Now run: node deploy/verify.mjs");
