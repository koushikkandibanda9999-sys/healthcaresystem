/**
 * Healthcare Blockchain — Performance Benchmark
 *
 * Measures:
 *   - Record registration latency (on-chain)
 *   - Access request processing time
 *   - Consent grant time
 *   - Record verification time
 *   - Throughput (ops/sec)
 *   - Gas consumption per operation
 *   - Error rates
 *
 * Usage:
 *   node performance/benchmark.js
 *
 * Prerequisites:
 *   - Hardhat node running: npx hardhat node
 *   - Contract deployed and CONTRACT_ADDRESS set in ../.env
 *
 * Results are exported to:
 *   performance/results/benchmark-<timestamp>.json
 *   performance/results/benchmark-<timestamp>.csv
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { ethers } = require("ethers");
const crypto     = require("crypto");
const fs         = require("fs");
const path       = require("path");

// ── Config ────────────────────────────────────────────────────
const RPC_URL         = process.env.HARDHAT_RPC_URL     || "http://127.0.0.1:8545";
const CONTRACT_ADDR   = process.env.CONTRACT_ADDRESS    || "";
const SIGNER_KEY      = process.env.BACKEND_SIGNER_PRIVATE_KEY || "";
const WORKLOAD_SIZES  = [10, 50, 100]; // Reduce 500 for CI; add back for full eval
const TRIALS          = 3;             // Repeat each workload this many times
const RESULTS_DIR     = path.join(__dirname, "results");

// Minimal ABI for benchmarking
const ABI = [
  "function registerHospital(address, string) external",
  "function registerDoctor(address, address) external",
  "function registerRecord(bytes32, bytes32, address, address, string) external",
  "function requestAccess(bytes32, string) external",
  "function grantAccess(bytes32, address, uint256) external",
  "function revokeAccess(bytes32, address) external",
  "function checkRecordHash(bytes32, bytes32) view returns (bool)",
  "function isAccessGranted(bytes32, address) view returns (bool)",
];

function uuidToBytes32(uuid) {
  const clean = uuid.replace(/-/g, "");
  return "0x" + clean.padEnd(64, "0");
}
function sha256Bytes32(str) {
  return "0x" + crypto.createHash("sha256").update(str).digest("hex");
}
function randomUuid() {
  return crypto.randomUUID();
}

// Stats helpers
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) { return percentile(arr, 50); }

// ── Benchmark runner ──────────────────────────────────────────

async function runBenchmark() {
  console.log("=".repeat(60));
  console.log("Healthcare Blockchain — Performance Benchmark");
  console.log(`Workload sizes: ${WORKLOAD_SIZES.join(", ")} | Trials: ${TRIALS}`);
  console.log("=".repeat(60));

  if (!CONTRACT_ADDR) {
    console.error("ERROR: CONTRACT_ADDRESS not set. Deploy the contract first.");
    process.exit(1);
  }
  if (!SIGNER_KEY) {
    console.error("ERROR: BACKEND_SIGNER_PRIVATE_KEY not set.");
    process.exit(1);
  }

  const provider  = new ethers.JsonRpcProvider(RPC_URL);
  const signers   = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      (async () => {
        const acc = (await provider.send("eth_accounts", []))[i];
        return provider.getSigner(acc);
      })()
    )
  );

  const ownerSigner    = signers[0];
  const hospitalASigner = signers[1];
  const hospitalBSigner = signers[2];
  const doctorASigner   = signers[3];
  const patientSigner   = signers[5];

  const ownerContract = new ethers.Contract(CONTRACT_ADDR, ABI, ownerSigner);

  // Setup: Register hospitals and doctor (idempotent)
  console.log("\n[Setup] Registering participants…");
  const hAAddr = await hospitalASigner.getAddress();
  const hBAddr = await hospitalBSigner.getAddress();
  const dAAddr = await doctorASigner.getAddress();
  const pAddr  = await patientSigner.getAddress();

  try {
    await (await ownerContract.registerHospital(hAAddr, "Bench Hospital A")).wait();
    await (await ownerContract.registerHospital(hBAddr, "Bench Hospital B")).wait();
    console.log("  ✓ Hospitals registered");
  } catch { console.log("  (hospitals already registered)"); }

  try {
    await (await ownerContract.registerDoctor(dAAddr, hAAddr)).wait();
    console.log("  ✓ Doctor registered");
  } catch { console.log("  (doctor already registered)"); }

  const allResults = {
    environment: {
      rpcUrl: RPC_URL,
      contractAddress: CONTRACT_ADDR,
      node: process.version,
      timestamp: new Date().toISOString(),
      note: "Local Hardhat EVM node — NOT a production blockchain. Results are prototype benchmarks only.",
    },
    benchmarks: [],
    summary: [],
  };

  // ── Benchmark each workload size ─────────────────────────────
  for (const N of WORKLOAD_SIZES) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Workload: N=${N}`);

    const latencies = { registerRecord: [], requestAccess: [], grantAccess: [], revokeAccess: [], verifyHash: [] };
    const gasUsed   = { registerRecord: [], requestAccess: [], grantAccess: [], revokeAccess: [] };
    let errors = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      console.log(`  Trial ${trial + 1}/${TRIALS}…`);
      const trialRecords = [];

      // 1. Register N records
      for (let i = 0; i < N; i++) {
        const recordId   = randomUuid();
        const contentHash = sha256Bytes32(`record-${recordId}-${i}`);
        const rid  = uuidToBytes32(recordId);
        const hash = contentHash;

        const docContract = new ethers.Contract(CONTRACT_ADDR, ABI, doctorASigner);
        const t0 = Date.now();
        try {
          const tx      = await docContract.registerRecord(rid, hash, pAddr, hAAddr, "ENCOUNTER");
          const receipt = await tx.wait();
          const elapsed = Date.now() - t0;
          latencies.registerRecord.push(elapsed);
          gasUsed.registerRecord.push(Number(receipt.gasUsed));
          trialRecords.push({ recordId, rid, contentHash });
        } catch (err) {
          errors++;
        }
      }

      // 2. Request access for each record
      const accessibleRecords = trialRecords.slice(0, Math.min(N, trialRecords.length));
      for (const { rid } of accessibleRecords) {
        const hBContract = new ethers.Contract(CONTRACT_ADDR, ABI, hospitalBSigner);
        const t0 = Date.now();
        try {
          const tx      = await hBContract.requestAccess(rid, "ENCOUNTER");
          const receipt = await tx.wait();
          latencies.requestAccess.push(Date.now() - t0);
          gasUsed.requestAccess.push(Number(receipt.gasUsed));
        } catch { errors++; }
      }

      // 3. Grant access
      for (const { rid } of accessibleRecords.slice(0, Math.ceil(accessibleRecords.length / 2))) {
        const pContract = new ethers.Contract(CONTRACT_ADDR, ABI, patientSigner);
        const t0 = Date.now();
        try {
          const tx      = await pContract.grantAccess(rid, hBAddr, 0n);
          const receipt = await tx.wait();
          latencies.grantAccess.push(Date.now() - t0);
          gasUsed.grantAccess.push(Number(receipt.gasUsed));
        } catch { errors++; }
      }

      // 4. Verify hashes (off-chain timing)
      for (const { rid, contentHash } of trialRecords) {
        const readContract = new ethers.Contract(CONTRACT_ADDR, ABI, ownerSigner);
        const t0 = Date.now();
        try {
          await readContract.checkRecordHash(rid, contentHash);
          latencies.verifyHash.push(Date.now() - t0);
        } catch { errors++; }
      }

      // 5. Revoke access (subset)
      for (const { rid } of accessibleRecords.slice(0, Math.ceil(accessibleRecords.length / 4))) {
        const pContract = new ethers.Contract(CONTRACT_ADDR, ABI, patientSigner);
        const t0 = Date.now();
        try {
          const tx      = await pContract.revokeAccess(rid, hBAddr);
          const receipt = await tx.wait();
          latencies.revokeAccess.push(Date.now() - t0);
          gasUsed.revokeAccess.push(Number(receipt.gasUsed));
        } catch { errors++; }
      }
    }

    // ── Compute stats ──────────────────────────────────────────
    const totalOps = Object.values(latencies).flat().length;
    const totalTime = Object.values(latencies).flat().reduce((a, b) => a + b, 0);
    const throughput = totalTime > 0 ? (totalOps / (totalTime / 1000)).toFixed(2) : 0;

    for (const [op, lats] of Object.entries(latencies)) {
      if (!lats.length) continue;
      const entry = {
        workload: N,
        operation: op,
        metric: "latency",
        trials: TRIALS,
        count: lats.length,
        mean:   Math.round(mean(lats)),
        median: Math.round(median(lats)),
        p95:    Math.round(percentile(lats, 95)),
        min:    Math.min(...lats),
        max:    Math.max(...lats),
        avgGas: gasUsed[op]?.length ? Math.round(mean(gasUsed[op])) : null,
        errors,
      };
      allResults.benchmarks.push(entry);
      console.log(`    ${op.padEnd(20)} mean=${entry.mean}ms p95=${entry.p95}ms${entry.avgGas ? " gas=" + entry.avgGas : ""}`);
    }

    allResults.benchmarks.push({
      workload: N, operation: "overall", metric: "throughput",
      opsPerSec: parseFloat(throughput), totalOps, totalTimeMs: totalTime, errors,
    });

    allResults.summary.push({ workload: N, throughput, errors });
    console.log(`    Throughput: ${throughput} ops/sec | Errors: ${errors}`);
  }

  // ── Export results ────────────────────────────────────────────
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const ts       = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonFile = path.join(RESULTS_DIR, `benchmark-${ts}.json`);
  const csvFile  = path.join(RESULTS_DIR, `benchmark-${ts}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(allResults, null, 2));

  // CSV export
  const csvHeader = "workload,operation,metric,count,mean_ms,median_ms,p95_ms,min_ms,max_ms,avg_gas,errors\n";
  const csvRows = allResults.benchmarks
    .filter(b => b.metric === "latency")
    .map(b => `${b.workload},${b.operation},${b.metric},${b.count},${b.mean},${b.median},${b.p95},${b.min},${b.max},${b.avgGas ?? ""},${b.errors}`)
    .join("\n");
  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log("\n" + "=".repeat(60));
  console.log("Benchmark complete");
  console.log("  JSON:", jsonFile);
  console.log("  CSV: ", csvFile);
  console.log("=".repeat(60));
  console.log("\nIMPORTANT: These results are from a local Hardhat EVM node.");
  console.log("They are NOT representative of production blockchain performance.");
  console.log("Do not compare directly with production Hyperledger Fabric results.");
}

runBenchmark().catch(err => {
  console.error("Benchmark failed:", err.message);
  process.exit(1);
});
