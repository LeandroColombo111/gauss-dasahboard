import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, Upload, Settings } from "lucide-react";

/* ============== Helpers ============== */
function normalizeKey(k) {
  if (!k) return "";
  return k
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("%", "")
    .replaceAll("-", " ")
    .replaceAll("/", " ")
    .replaceAll(":", " ")
    .replaceAll("__", "_")
    .replace(/\s+/g, "_");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  // strip currency/percent and thousands
  let s = String(v).replace(/[$,%]/g, "").replace(/\s/g, "");
  // keep last decimal separator
  s = s.replace(/(,)(?=.\d{1,2}$)/, ".").replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function mean(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return NaN;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function stddev(arr) {
  const m = mean(arr);
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return NaN;
  const variance = v.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / v.length;
  return Math.sqrt(variance);
}

function classify(value, m, s, sigma = 1) {
  if (!Number.isFinite(value) || !Number.isFinite(m) || !Number.isFinite(s) || s === 0) return "—";
  const z = (value - m) / s;
  if (z > sigma) return "📈 Very High";
  if (z < -sigma) return "📉 Very Low";
  return "✅ Normal";
}

function recommend(cpmClass, cpcClass, ctrClass) {
  if (cpmClass === "📉 Very Low" && cpcClass === "📉 Very Low" && ctrClass === "📈 Very High") {
    return "🔼 Scale budget";
  }
  if (cpmClass === "📈 Very High" || cpcClass === "📈 Very High" || ctrClass === "📉 Very Low") {
    return "🔽 Review or pause";
  }
  return "✅ Keep running";
}

function downloadCSV(rows) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gauss_insights_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============== App ============== */
export default function App() {
  const [rows, setRows] = useState([]);
  const [sigma, setSigma] = useState(1);
  const [ctrKeyPref, setCtrKeyPref] = useState("ctr_link_click_through_rate"); // fallback to ctr_all if missing

  const handleFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const mapped = res.data.map((r) => {
          const obj = {};
          for (const k in r) obj[normalizeKey(k)] = r[k];
          return obj;
        });
        setRows(mapped);
      },
    });
  };

  // Only [ON] + results > 0
  const onRows = useMemo(() => {
    // try to find a “results” key regardless of header variant
    const first = rows[0] || {};
    const candidateResultsKeys = ["results", "purchases", "conversions"];
    const resultsKey =
      candidateResultsKeys.find((k) => Object.hasOwn(first, k)) ||
      candidateResultsKeys.find((k) => rows.some((r) => Object.hasOwn(r, k))) ||
      "results";

    return rows
      .filter((r) => String(r.campaign_name || "").startsWith("[ON]"))
      .filter((r) => {
        const val = toNumber(r[resultsKey]);
        return Number.isFinite(val) && val > 0;
      })
      .map((r) => ({ ...r, __results_key: resultsKey }));
  }, [rows]);

  // Metric keys
  const amountKey = "amount_spent_usd" in (onRows[0] || {}) ? "amount_spent_usd" : "amount_spent__usd";
  const impressionsKey = "impressions";
  const clicksAllKey = "clicks_all";
  const cpcLinkKey = "cpc_cost_per_link_click_usd";
  const ctrLinkKey = ctrKeyPref;
  const ctrAllKey = "ctr_all";

  const analyzed = useMemo(() => {
    const valid = onRows
      .map((r) => {
        const spent = toNumber(r[amountKey]);
        const imps = toNumber(r[impressionsKey]);
        const clicksAll = toNumber(r[clicksAllKey]);
        const ctrLink = toNumber(r[ctrLinkKey]);
        const ctrAll = toNumber(r[ctrAllKey]);
        const cpcLink = toNumber(r[cpcLinkKey]);
        const resultsNum = toNumber(r[r.__results_key || "results"]);

        const cpm = Number.isFinite(spent) && Number.isFinite(imps) && imps > 0 ? (spent / imps) * 1000 : NaN;
        const cpc = Number.isFinite(cpcLink)
          ? cpcLink
          : Number.isFinite(spent) && Number.isFinite(clicksAll) && clicksAll > 0
          ? spent / clicksAll
          : NaN;
        const ctr = Number.isFinite(ctrLink) ? ctrLink : ctrAll;

        return { ...r, cpm, cpc, ctr, resultsNum };
      })
      .filter((r) => Number.isFinite(r.cpm) && Number.isFinite(r.cpc) && Number.isFinite(r.ctr) && Number.isFinite(r.resultsNum) && r.resultsNum > 0);

    const cpmVals = valid.map((r) => r.cpm);
    const cpcVals = valid.map((r) => r.cpc);
    const ctrVals = valid.map((r) => r.ctr);

    const m = { cpm: mean(cpmVals), cpc: mean(cpcVals), ctr: mean(ctrVals) };
    const s = { cpm: stddev(cpmVals), cpc: stddev(cpcVals), ctr: stddev(ctrVals) };

    const rows = valid.map((r) => {
      const cpmClass = classify(r.cpm, m.cpm, s.cpm, sigma);
      const cpcClass = classify(r.cpc, m.cpc, s.cpc, sigma);
      const ctrClass = classify(r.ctr, m.ctr, s.ctr, sigma);
      const action = recommend(cpmClass, cpcClass, ctrClass);
      return {
        campaign_name: r.campaign_name,
        results: r.resultsNum,
        cpm: Number(r.cpm.toFixed(2)),
        cpm_class: cpmClass,
        cpc: Number(r.cpc.toFixed(2)),
        cpc_class: cpcClass,
        ctr: Number(r.ctr.toFixed(2)),
        ctr_class: ctrClass,
        action,
      };
    });

    return { rows, m, s };
  }, [onRows, sigma, ctrKeyPref]);

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">Gauss Campaign Dashboard</h1>
            <p className="muted">Upload a Meta campaigns CSV. Only campaigns starting with <b>[ON]</b> and with <b>results &gt; 0</b> will be analyzed.</p>
          </div>
          <label className="btn btn-white">
            <Upload size={18} />
            <span>Upload CSV</span>
            <input type="file" accept=".csv" className="hidden-input" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </header>

        {/* Controls */}
        <div className="grid">
          <div className="card">
            <div className="card-title"><Settings size={16} /><span>Sigma (z-threshold)</span></div>
            <input type="range" min={0.5} max={2} step={0.1} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} className="range" />
            <div className="muted">Current: <b>{sigma.toFixed(1)}σ</b></div>
          </div>
          <div className="card">
            <div className="card-title">CTR column</div>
            <select value={ctrKeyPref} onChange={(e) => setCtrKeyPref(e.target.value)} className="select">
              <option value="ctr_link_click_through_rate">CTR (link)</option>
              <option value="ctr_all">CTR (all)</option>
            </select>
            <p className="tiny">If the selected column is missing, we’ll try the other one.</p>
          </div>
          <div className="card">
            <div className="card-title">Export</div>
            <button onClick={() => downloadCSV(analyzed.rows)} className="btn btn-dark">
              Export CSV <Download size={14} style={{ marginLeft: 8 }} />
            </button>
            <p className="tiny">Download the table with gaussian classes and suggested action.</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid">
          <div className="card stat"><div className="muted">[ON] campaigns analyzed</div><div className="stat-value">{analyzed.rows.length}</div></div>
          <div className="card">
            <div className="muted">Mean CPM / CPC / CTR</div>
            <div className="stat-inline">
              {Number.isFinite(analyzed.m.cpm) ? analyzed.m.cpm.toFixed(2) : "—"} /
              {" "}{Number.isFinite(analyzed.m.cpc) ? analyzed.m.cpc.toFixed(2) : "—"} /
              {" "}{Number.isFinite(analyzed.m.ctr) ? analyzed.m.ctr.toFixed(2) : "—"}%
            </div>
            <div className="tiny">Std dev: {Number.isFinite(analyzed.s.cpm) ? analyzed.s.cpm.toFixed(2) : "—"} / {Number.isFinite(analyzed.s.cpc) ? analyzed.s.cpc.toFixed(2) : "—"} / {Number.isFinite(analyzed.s.ctr) ? analyzed.s.ctr.toFixed(2) : "—"}</div>
          </div>
          <div className="card">
            <div className="muted">Actions (count)</div>
            <div className="actions-counts">
              <span>🔼 {analyzed.rows.filter(r=>r.action.includes("Scale")).length}</span>
              <span>✅ {analyzed.rows.filter(r=>r.action.includes("Keep")).length}</span>
              <span>🔽 {analyzed.rows.filter(r=>r.action.includes("Review")).length}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Results</th>
                <th>CPM</th>
                <th>Class</th>
                <th>CPC</th>
                <th>Class</th>
                <th>CTR (%)</th>
                <th>Class</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {analyzed.rows.map((r, i) => (
                <tr key={i}>
                  <td title={r.campaign_name} className="truncate">{r.campaign_name}</td>
                  <td>{r.results}</td>
                  <td>{r.cpm}</td>
                  <td>{r.cpm_class}</td>
                  <td>{r.cpc}</td>
                  <td>{r.cpc_class}</td>
                  <td>{r.ctr}</td>
                  <td>{r.ctr_class}</td>
                  <td className="bold">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!analyzed.rows.length && (
            <div className="empty">
              Upload a CSV to see results. Required columns: <code>Campaign name</code>, <code>Amount spent (USD)</code>, <code>Impressions</code>, <code>Clicks (all)</code>, <code>CTR (link click-through rate)</code> or <code>CTR (all)</code>, and optionally <code>CPC (cost per link click) (USD)</code>.
            </div>
          )}
        </div>

        <div className="tiny note">
          Rules: 🔼 Scale when CPM & CPC are 📉 Very Low and CTR is 📈 Very High. 🔽 Review if any metric is 📈 Very High or CTR is 📉 Very Low. Else: ✅ Keep running.
          Calculations are only for campaigns whose name starts with [ON] and have results &gt; 0.
        </div>
      </div>
    </div>
  );
}
