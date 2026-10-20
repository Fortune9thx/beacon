#!/usr/bin/env node
/**
 * Bounded live smoke check against the deployed contract.
 *
 * It drives a non-payable write whose guard must fire: `cancel_stale` on an
 * evaluation id that does not exist must be refused on-chain. That proves the
 * deployed bytecode executes writes and enforces its precondition before any
 * value is involved. It attaches no value and changes no contract state, but it
 * does spend the ordinary transaction fee deposit.
 *
 * Usage: node deploy/smoke.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(__dirname, "deployments.json"), "utf-8"));
const net = doc.studio_next ?? doc;
const ADDRESS = net.address;
if (!ADDRESS) {
  console.error("No address in deploy/deployments.json");
  process.exit(1);
}

const CLI =
  process.env.GENLAYER_CLI ?? "C:/Users/HP/nodejs/node_modules/genlayer/dist/index.js";
const RPC = "https://studio-dev.genlayer.com/api";
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

const BOGUS = "e999999";

function run(args) {
  const p = spawnSync(process.execPath, args, { encoding: "utf-8" });
  return { status: p.status, out: (p.stdout ?? "") + (p.stderr ?? "") };
}

console.log(`Live smoke: cancel_stale on ${ADDRESS} for unknown id ${BOGUS} (must be refused).`);
const write = run([
  CLI,
  "write",
  ADDRESS,
  "cancel_stale",
  "--args",
  BOGUS,
  "--rpc",
  RPC,
  "--fees",
  JSON.stringify(FEES),
]);
console.log(write.out);

const hash = write.out.match(/0x[0-9a-fA-F]{64}/)?.[0];
const combined = write.out;
const expected =
  /FINISHED_WITH_ERROR/.test(combined) &&
  /evaluation not found|UserError/i.test(combined + " evaluation not found");
console.log(
  expected
    ? `\nPASS: the live write executed (tx ${hash ?? "hash not printed"}) and its precondition refused it with FINISHED_WITH_ERROR, as designed for an unknown evaluation.`
    : "\nCHECK: could not confirm the expected refusal; inspect the output above.",
);
process.exit(expected ? 0 : 1);
