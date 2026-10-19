import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";
import { performance as perfApi } from "../api/client";

export default function PerformancePage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gasReport, setGasReport] = useState(null);

  useEffect(() => {
    Promise.all([perfApi.results(), perfApi.gasReport()])
      .then(([rRes, gRes]) => {
        setResults(rRes.data.results || []);
        setGasReport(gRes.data.report);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout title="Performance Evaluation"><Spinner /></Layout>;

  // Flatten all result sets into chart data
  const allBenchmarks = results.flatMap(r => r.data?.benchmarks || []);
  const latencyData   = allBenchmarks.filter(b => b.metric === "latency");
  const throughputData = allBenchmarks.filter(b => b.metric === "throughput");
  const gasData        = allBenchmarks.filter(b => b.metric === "gas");

  const noData = !allBenchmarks.length;

  return (
    <Layout title="Performance Evaluation" subtitle="Reproducible benchmark results">

      <div className="p-3 bg-info-subtle border border-info rounded-2 mb-4 small">
        <i className="bi bi-graph-up me-2"></i>
        Run benchmark scripts: <code>node performance/benchmark.js</code><br />
        Results auto-save to <code>performance/results/</code> and display here.
        Hardhat node must be running.
      </div>

      {noData ? (
        <div className="empty-state">
          <i className="bi bi-graph-up"></i>
          <h6>No results yet</h6>
          <p className="small">Run the benchmark script to generate performance data.<br />
            <code>node performance/benchmark.js</code>
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {latencyData.length > 0 && (
            <div className="col-md-6">
              <div className="form-card">
                <h6 className="fw-bold mb-3">Transaction Latency (ms)</h6>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={latencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="workload" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="mean" stroke="#0d6efd" name="Mean" />
                    <Line type="monotone" dataKey="p95"  stroke="#dc3545" name="P95" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {throughputData.length > 0 && (
            <div className="col-md-6">
              <div className="form-card">
                <h6 className="fw-bold mb-3">Throughput (ops/sec)</h6>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="workload" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="opsPerSec" fill="#198754" name="Ops/sec" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {gasData.length > 0 && (
            <div className="col-md-12">
              <div className="form-card">
                <h6 className="fw-bold mb-3">Gas Usage per Operation</h6>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={gasData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="operation" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgGas" fill="#fd7e14" name="Avg Gas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {gasReport && (
        <div className="mt-4 form-card">
          <h6 className="fw-bold mb-3"><i className="bi bi-fire me-2 text-warning"></i>Contract Gas Report</h6>
          <pre className="small text-muted" style={{ overflowX: "auto", fontSize: "0.72rem" }}>
            {gasReport}
          </pre>
        </div>
      )}

      <div className="mt-4 p-3 bg-warning-subtle border border-warning rounded-2 small">
        <i className="bi bi-exclamation-triangle me-2"></i>
        <strong>Methodology:</strong> All measurements are from a local Hardhat EVM node on a single development machine.
        Results are NOT comparable to production blockchain or Hyperledger Fabric networks. See
        <code> docs/research-methodology.md</code> for full experiment protocol.
      </div>
    </Layout>
  );
}
