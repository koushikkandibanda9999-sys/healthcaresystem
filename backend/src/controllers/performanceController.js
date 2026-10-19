const fs   = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "../../..", "performance", "results");

async function getResults(req, res) {
  try {
    if (!fs.existsSync(RESULTS_DIR)) {
      return res.json({ results: [], message: "No performance results yet. Run: node performance/benchmark.js" });
    }
    const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith(".json"));
    const results = files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(RESULTS_DIR, f), "utf8");
        return { file: f, data: JSON.parse(raw) };
      } catch {
        return { file: f, error: "Parse error" };
      }
    });
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load performance results" });
  }
}

async function getGasReport(req, res) {
  try {
    const gasFile = path.join(__dirname, "../../..", "performance", "results", "gas-report.txt");
    if (!fs.existsSync(gasFile)) {
      return res.json({ report: null, message: "No gas report. Run: npx hardhat test" });
    }
    const report = fs.readFileSync(gasFile, "utf8");
    return res.json({ report });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load gas report" });
  }
}

module.exports = { getResults, getGasReport };
