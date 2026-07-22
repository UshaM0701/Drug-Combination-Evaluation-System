/**
 * Advanced Drug Evaluation Frontend Module
 * =========================================
 * Drop-in JS module for index.html — adds a new "Drug Evaluation" section
 * without modifying any existing UI. Uses Chart.js (radar) via CDN and
 * jsPDF + autoTable for PDF export. Vanilla JS, no build step.
 *
 * Integration (add ONCE inside <body> of index.html, at the end):
 *   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
 *   <script src="/static/evaluation_module.js"></script>
 *
 * Public API (window.DrugEval):
 *   DrugEval.mount()                     -> injects the UI panel
 *   DrugEval.evaluate(drugs, affinity)   -> runs evaluation for selected drugs
 *   DrugEval.showHistory()               -> opens history modal
 *
 * Colour tokens intentionally mirror your existing --green/--blue/--red
 * palette so the module looks native to the current app.
 */
(function () {
  "use strict";
  if (window.DrugEval) return;

  const API = {
    capabilities: "/api/eval/capabilities",
    drug:         "/api/eval/drug",
    batch:        "/api/eval/batch",
    history:      "/api/eval/history",
  };

  // ── Styles (scoped with .de- prefix) ────────────────────────────
  const css = `
  .de-wrap{max-width:1200px;margin:40px auto;padding:0 16px;font-family:var(--font-sans,system-ui);animation:fadeUp .4s ease}
  .de-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
  .de-title{font-size:22px;font-weight:700;color:var(--text,#1e2d45);letter-spacing:-.5px}
  .de-sub{font-size:12px;color:var(--dim,#64748b);letter-spacing:.5px;text-transform:uppercase}
  .de-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
  .de-btn{background:#fff;border:1.5px solid var(--border,#dde4f0);border-radius:8px;
    padding:8px 14px;font-size:12px;color:var(--text,#1e2d45);cursor:pointer;transition:.15s;
    font-weight:600;display:inline-flex;align-items:center;gap:6px}
  .de-btn:hover{border-color:var(--blue,#2563eb);color:var(--blue,#2563eb)}
  .de-btn.primary{background:var(--blue,#2563eb);color:#fff;border-color:var(--blue,#2563eb)}
  .de-btn.primary:hover{background:#1e40af;color:#fff}
  .de-select{background:#fff;border:1.5px solid var(--border,#dde4f0);border-radius:8px;
    padding:8px 12px;font-size:12px;color:var(--text,#1e2d45);cursor:pointer;font-weight:600}
  .de-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}
  .de-card{background:#fff;border:1px solid var(--border,#dde4f0);border-radius:14px;
    padding:20px;box-shadow:var(--shadow,0 2px 12px rgba(30,45,80,.08));position:relative;overflow:hidden}
  .de-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--card-c,#2563eb)}
  .de-drug{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .de-drug-name{font-size:17px;font-weight:700;color:var(--text,#1e2d45)}
  .de-drug-meta{font-size:11px;color:var(--dim,#64748b);font-family:var(--font-mono,monospace)}
  .de-rank{background:var(--card-c,#2563eb);color:#fff;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
  .de-overall{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px dashed var(--border,#dde4f0);margin-bottom:12px}
  .de-gauge{width:70px;height:70px;position:relative;flex-shrink:0}
  .de-gauge svg{transform:rotate(-90deg)}
  .de-gauge-val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:18px}
  .de-gauge-lbl{font-size:8px;color:var(--dim);font-weight:600;letter-spacing:.5px}
  .de-grade{flex:1}
  .de-grade-t{font-size:13px;font-weight:700}
  .de-grade-s{font-size:11px;color:var(--dim,#64748b);margin-top:2px}
  .de-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:14px}
  .de-metric{display:flex;flex-direction:column;gap:4px}
  .de-metric-l{font-size:10px;color:var(--dim,#64748b);letter-spacing:.4px;text-transform:uppercase;font-weight:600}
  .de-bar{background:#eef2f7;border-radius:6px;height:8px;overflow:hidden}
  .de-bar>div{height:100%;border-radius:6px;transition:width .6s ease}
  .de-metric-v{font-size:11px;font-weight:600;color:var(--text,#1e2d45)}
  .de-risk{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .de-risk.low{background:#dcfce7;color:#166534}
  .de-risk.moderate{background:#fef3c7;color:#92400e}
  .de-risk.high{background:#fee2e2;color:#991b1b}
  .de-risk.critical{background:#450a0a;color:#fca5a5}
  .de-radar{margin:14px 0}
  .de-radar canvas{max-width:100%;height:200px!important}
  .de-xai{background:#f8fafc;border-left:3px solid var(--blue,#2563eb);padding:10px 12px;border-radius:6px;font-size:12px;line-height:1.55;color:#334155}
  .de-xai b{color:var(--text,#1e2d45)}
  .de-xai ul{margin:6px 0 0;padding-left:18px;font-size:11px}
  .de-detail{margin-top:10px;padding-top:10px;border-top:1px dashed var(--border,#dde4f0);font-size:11px;color:var(--dim,#64748b);line-height:1.55}
  .de-detail b{color:var(--text,#1e2d45)}
  .de-empty{text-align:center;padding:60px 20px;color:var(--dim,#64748b);font-size:13px}
  .de-loading{text-align:center;padding:40px;color:var(--dim,#64748b);font-size:13px}
  .de-loading::after{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--blue,#2563eb);
    border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin-left:8px;vertical-align:middle}
  .de-modal{position:fixed;inset:0;background:rgba(30,45,80,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
  .de-modal-inner{background:#fff;border-radius:14px;max-width:900px;width:100%;max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
  .de-modal-head{padding:16px 20px;border-bottom:1px solid var(--border,#dde4f0);display:flex;align-items:center;gap:10px}
  .de-modal-body{padding:16px 20px}
  .de-hist-row{padding:10px 12px;border-bottom:1px solid var(--border,#dde4f0);display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;font-size:12px}
  .de-hist-row:hover{background:#f8fafc}
  .de-cap{display:inline-flex;gap:4px;align-items:center;font-size:10px;padding:3px 7px;border-radius:99px;font-weight:600}
  .de-cap.on{background:#dcfce7;color:#166534}
  .de-cap.off{background:#f1f5f9;color:#64748b}

  /* ── Combination Dashboard ─────────────────────────────── */
  .de-cb{grid-column:1/-1;display:grid;gap:16px;padding:0;background:transparent;border:0;box-shadow:none;overflow:visible;animation:fadeUp .4s ease}
  .de-cb::before{display:none}
  .de-cb-title{display:flex;align-items:center;gap:12px;margin:4px 2px}
  .de-cb-title .t{font-size:20px;font-weight:700;color:var(--text,#1e2d45);letter-spacing:-.3px}
  .de-cb-title .s{font-size:11px;color:var(--dim,#64748b);letter-spacing:.6px;text-transform:uppercase;font-weight:600}
  .de-cb-title .bar{width:4px;height:32px;border-radius:3px;background:linear-gradient(180deg,var(--blue,#2563eb),var(--purple,#7c3aed))}

  /* Row 1 — KPI strip */
  .de-kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
  @media (max-width:1100px){.de-kpi-row{grid-template-columns:repeat(2,1fr)}}
  @media (max-width:520px){.de-kpi-row{grid-template-columns:1fr}}
  .de-kpi{position:relative;background:linear-gradient(180deg,#ffffff 0%,#fbfcfe 100%);
    border:1px solid var(--border,#dde4f0);border-radius:18px;padding:16px 16px 14px;
    box-shadow:var(--shadow,0 2px 12px rgba(30,45,80,.08));transition:.25s ease;overflow:hidden}
  .de-kpi::before{content:'';position:absolute;inset:0;border-radius:18px;padding:1px;
    background:linear-gradient(135deg,var(--kpi-c,#2563eb) 0%,transparent 55%);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.55}
  .de-kpi:hover{transform:translateY(-3px);box-shadow:var(--shadow-md,0 4px 24px rgba(30,45,80,.12))}
  .de-kpi-h{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .de-kpi-l{font-size:10.5px;color:var(--dim,#64748b);letter-spacing:.6px;text-transform:uppercase;font-weight:700}
  .de-kpi-i{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;
    font-size:16px;background:color-mix(in srgb,var(--kpi-c,#2563eb) 12%,#fff);color:var(--kpi-c,#2563eb)}
  .de-kpi-v{font-size:28px;font-weight:700;color:var(--text,#1e2d45);margin-top:8px;font-family:var(--font-mono,monospace);letter-spacing:-.5px;line-height:1}
  .de-kpi-v small{font-size:13px;color:var(--dim,#64748b);font-weight:600;margin-left:3px}
  .de-kpi-b{display:inline-block;margin-top:8px;padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.4px}
  .de-kpi-drugs{gap:4px;display:flex;flex-wrap:wrap;margin-top:8px}
  .de-kpi-drugs span{font-size:10.5px;font-weight:600;background:#f1f5f9;border:1px solid var(--border,#dde4f0);
    padding:2px 7px;border-radius:99px;color:var(--text,#1e2d45);font-family:var(--font-mono,monospace)}

  /* Row 2 & 3 shared panel */
  .de-panel{background:#fff;border:1px solid var(--border,#dde4f0);border-radius:18px;
    padding:20px 22px;box-shadow:var(--shadow,0 2px 12px rgba(30,45,80,.08));transition:.25s}
  .de-panel:hover{box-shadow:var(--shadow-md,0 4px 24px rgba(30,45,80,.12))}
  .de-p-h{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px dashed var(--border,#dde4f0)}
  .de-p-h .ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;
    background:linear-gradient(135deg,color-mix(in srgb,var(--p-c,#2563eb) 15%,#fff),color-mix(in srgb,var(--p-c,#2563eb) 5%,#fff));color:var(--p-c,#2563eb)}
  .de-p-h .t{font-size:14px;font-weight:700;color:var(--text,#1e2d45);letter-spacing:-.1px}
  .de-p-h .s{font-size:10.5px;color:var(--dim,#64748b);letter-spacing:.5px;text-transform:uppercase;font-weight:600;margin-left:auto}

  .de-row-2{display:grid;grid-template-columns:1.05fr 1fr;gap:16px}
  @media (max-width:960px){.de-row-2{grid-template-columns:1fr}}
  .de-row-2b{display:grid;grid-template-columns:1fr .8fr;gap:16px;margin-top:0}
  @media (max-width:960px){.de-row-2b{grid-template-columns:1fr}}

  /* Averages bars */
  .de-avg{display:flex;flex-direction:column;gap:14px}
  .de-avg-item{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center}
  .de-avg-l{font-size:12px;font-weight:600;color:var(--text,#1e2d45);display:flex;align-items:center;gap:6px}
  .de-avg-l .dot{width:8px;height:8px;border-radius:50%;background:var(--c,#2563eb);box-shadow:0 0 0 3px color-mix(in srgb,var(--c,#2563eb) 20%,transparent)}
  .de-avg-v{font-size:13px;font-weight:700;color:var(--c,#1e2d45);font-family:var(--font-mono,monospace)}
  .de-avg-track{grid-column:1/-1;background:#eef2f7;border-radius:99px;height:9px;overflow:hidden;position:relative}
  .de-avg-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,color-mix(in srgb,var(--c,#2563eb) 70%,#fff),var(--c,#2563eb));
    width:0;transition:width 1.1s cubic-bezier(.22,.61,.36,1)}

  /* Metric guide */
  .de-guide{display:flex;flex-direction:column;gap:10px}
  .de-guide-i{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:10px 12px;background:#f8fafc;
    border:1px solid var(--border,#dde4f0);border-radius:12px;transition:.2s}
  .de-guide-i:hover{background:#fff;border-color:color-mix(in srgb,var(--c,#2563eb) 40%,var(--border,#dde4f0));transform:translateX(2px)}
  .de-guide-i .ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;
    background:color-mix(in srgb,var(--c,#2563eb) 12%,#fff);color:var(--c,#2563eb);font-weight:700}
  .de-guide-i .tx b{font-size:12px;color:var(--text,#1e2d45);display:block;margin-bottom:1px}
  .de-guide-i .tx span{font-size:11px;color:var(--dim,#64748b);line-height:1.5}

  /* Radar panel */
  .de-radar-panel canvas{max-width:100%;height:320px!important}

  /* Row 3 */
  .de-row-3{display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:16px}
  @media (max-width:1100px){.de-row-3{grid-template-columns:1fr}}

  .de-ctss-hero{display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0}
  .de-ctss-hero .de-gauge{width:150px;height:150px}
  .de-ctss-hero .de-gauge-val{font-size:34px}
  .de-ctss-grade{font-size:15px;font-weight:700;text-align:center}
  .de-ctss-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
  .de-ctss-meta > div{background:#f8fafc;border:1px solid var(--border,#dde4f0);border-radius:12px;padding:10px 12px;text-align:center}
  .de-ctss-meta .l{font-size:10px;color:var(--dim,#64748b);letter-spacing:.5px;text-transform:uppercase;font-weight:700}
  .de-ctss-meta .v{font-size:15px;font-weight:700;margin-top:3px;font-family:var(--font-mono,monospace)}
  .de-ctss-reco{width:100%;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:1px solid #bbf7d0;
    border-left:3px solid var(--green,#16a34a);border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.55;color:#14532d}

  /* Interpretation blocks */
  .de-interp{display:flex;flex-direction:column;gap:10px}
  .de-ib{position:relative;padding:12px 14px 12px 16px;border-radius:12px;background:#fff;border:1px solid var(--border,#dde4f0);
    border-left:3px solid var(--c,#2563eb);transition:.2s}
  .de-ib:hover{background:color-mix(in srgb,var(--c,#2563eb) 4%,#fff);transform:translateX(2px)}
  .de-ib b{font-size:12px;color:var(--c,#2563eb);letter-spacing:.3px;display:flex;align-items:center;gap:6px;margin-bottom:5px;text-transform:uppercase;font-weight:700}
  .de-ib p{font-size:12px;color:#334155;line-height:1.6;margin:0}
  .de-ib p b{color:var(--text,#1e2d45);text-transform:none;letter-spacing:0;font-weight:700;font-size:12px;display:inline;margin:0;font-family:var(--font-mono,monospace)}

  /* Explainable AI checkmarks */
  .de-xai-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .de-xai-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1px solid var(--border,#dde4f0);
    border-radius:10px;font-size:12px;color:var(--text,#1e2d45);font-weight:600;transition:.2s}
  .de-xai-item:hover{background:#fff;border-color:color-mix(in srgb,var(--c,#16a34a) 40%,var(--border,#dde4f0))}
  .de-xai-item .ck{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:color-mix(in srgb,var(--c,#16a34a) 15%,#fff);color:var(--c,#16a34a);font-weight:700;font-size:12px;flex-shrink:0}
  .de-xai-item.dim{opacity:.55}
  .de-overall-reco{background:linear-gradient(135deg,#dcfce7 0%,#f0fdf4 100%);border:1px solid #86efac;border-radius:14px;
    padding:12px 14px;display:flex;gap:10px;align-items:flex-start}
  .de-overall-reco .ic{width:28px;height:28px;border-radius:50%;background:var(--green,#16a34a);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .de-overall-reco b{display:block;font-size:11px;color:#14532d;letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px}
  .de-overall-reco span{font-size:12px;color:#166534;line-height:1.55;font-weight:600}

  /* Row 4 */
  .de-row-4{display:grid;grid-template-columns:1.15fr 1fr;gap:16px}
  @media (max-width:960px){.de-row-4{grid-template-columns:1fr}}
  .de-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  @media (max-width:640px){.de-steps{grid-template-columns:1fr}}
  .de-step{position:relative;display:block;text-align:left;background:linear-gradient(180deg,#fff 0%,#fbfcfe 100%);
    border:1px solid var(--border,#dde4f0);border-radius:14px;padding:14px;cursor:pointer;transition:.25s;
    text-decoration:none;color:inherit;font:inherit}
  .de-step:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--c,#2563eb) 50%,var(--border));
    box-shadow:0 8px 24px color-mix(in srgb,var(--c,#2563eb) 15%,transparent)}
  .de-step .ic{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;
    background:color-mix(in srgb,var(--c,#2563eb) 12%,#fff);color:var(--c,#2563eb);margin-bottom:10px}
  .de-step .t{font-size:13px;font-weight:700;color:var(--text,#1e2d45);margin-bottom:3px}
  .de-step .s{font-size:11px;color:var(--dim,#64748b);line-height:1.45}
  .de-step .go{position:absolute;top:12px;right:12px;font-size:14px;color:var(--dim,#64748b);transition:.2s}
  .de-step:hover .go{color:var(--c,#2563eb);transform:translateX(3px)}

  .de-flow{display:flex;flex-direction:column;gap:6px}
  .de-flow-i{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8fafc;border:1px solid var(--border,#dde4f0);border-radius:10px;transition:.2s}
  .de-flow-i:hover{background:#fff;transform:translateX(2px)}
  .de-flow-i .n{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--blue,#2563eb),var(--purple,#7c3aed));
    color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
  .de-flow-i .t{font-size:12px;font-weight:600;color:var(--text,#1e2d45)}
  .de-flow-arrow{text-align:center;color:var(--dimmer,#94a3b8);font-size:12px;line-height:1;margin:-2px 0 -2px 10px}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const RISK_COLOR = {low:"#22c55e", moderate:"#eab308", high:"#f97316", critical:"#dc2626"};
  const state = { last: [], sortBy: "overall", capabilities: null };

  // ── Fetch helpers ──────────────────────────────────────────────
  async function post(url, body) {
    const r = await fetch(url, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(body || {})
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  async function get(url) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }

  // ── UI construction ────────────────────────────────────────────
  function mount(containerId) {
    if (document.getElementById("de-root")) return;
    const host = containerId ? document.getElementById(containerId) : document.body;
    const wrap = document.createElement("div");
    wrap.id = "de-root";
    wrap.className = "de-wrap";
    wrap.innerHTML = `
      <div class="de-header">
        <div>
          <div class="de-sub">Advanced Drug Evaluation</div>
          <div class="de-title">ADMET · Toxicity · Bioavailability · Overall Drug Score</div>
        </div>
        <div class="de-toolbar">
          <select class="de-select" id="de-sort">
            <option value="overall">Sort: Overall Score</option>
            
            <option value="toxicity">Lowest Toxicity</option>
            <option value="bioavailability">Highest Bioavailability</option>
            <option value="admet">Best ADMET</option>
            <option value="confidence">Confidence</option>
          </select>
          <button class="de-btn" id="de-hist">History</button>
          <button class="de-btn" id="de-exp-csv">CSV</button>
          <button class="de-btn" id="de-exp-json">JSON</button>
          <button class="de-btn primary" id="de-exp-pdf">Export PDF</button>
        </div>
      </div>
      <div id="de-caps" style="margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap"></div>
      <div id="de-body"><div class="de-empty">Select drugs and run the quantum affinity pipeline —
        results will appear here automatically. Or call <code>DrugEval.evaluate([...])</code>.</div></div>
    `;
    host.appendChild(wrap);

    document.getElementById("de-sort").addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      if (state.last.length) render(state.last, state.sortBy);
    });
    document.getElementById("de-hist").addEventListener("click", showHistory);
    document.getElementById("de-exp-csv").addEventListener("click", () => exportCSV(state.last));
    document.getElementById("de-exp-json").addEventListener("click", () => exportJSON(state.last));
    document.getElementById("de-exp-pdf").addEventListener("click", () => exportPDF(state.last));

    loadCapabilities();
  }

  async function loadCapabilities() {
    try {
      const { capabilities } = await get(API.capabilities);
      state.capabilities = capabilities;
      const box = document.getElementById("de-caps");
      if (!box) return;
      box.innerHTML = Object.entries(capabilities).map(([k,v]) =>
        `<span class="de-cap ${v?'on':'off'}">${v?'●':'○'} ${k}</span>`
      ).join("") + `<span class="de-cap off" title="Method">weighted ADMET + XAI</span>`;
    } catch (e) { console.warn("caps failed", e); }
  }

  // ── Evaluate ────────────────────────────────────────────────────
  async function evaluate(drugs, affinityMap, quantumAffinity = 0){
    if (!Array.isArray(drugs) || drugs.length === 0) return;
    if (!document.getElementById("de-root")) mount();
    const body = document.getElementById("de-body");
    body.innerHTML = `<div class="de-loading">Running ADMET pipeline for ${drugs.length} drug(s)</div>`;
    try {
      const res = await post(API.batch, {
    drugs,
    sort_by: state.sortBy,
    affinity_scores: affinityMap || {},
    quantum_affinity: quantumAffinity
});

      state.last = res.results;

      state.combination = res.combination;   // ⭐ Add this line

      render(res.results, state.sortBy);

      document.getElementById("de-root").scrollIntoView({
          behavior:"smooth",
          block:"start"
      });
    } catch (e) {
      body.innerHTML = `<div class="de-empty" style="color:#dc2626">Evaluation failed: ${e.message}</div>`;
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  function render(results, sortBy) {
    const body = document.getElementById("de-body");
    if (!results.length) { body.innerHTML = `<div class="de-empty">No results</div>`; return; }
    body.innerHTML = `<div class="de-grid" id="de-grid"></div>`;
    const grid = document.getElementById("de-grid");
    if (state.combination) {
    grid.appendChild(combinationCard(state.combination));
}
    function combinationCard(c) {
    const wrap = document.createElement("div");
    wrap.className = "de-cb";

    const ctssColor = c.ctss>=80?"#16a34a":c.ctss>=60?"#ea580c":"#dc2626";
    const ctssGrade = c.ctss>=85?"Excellent Synergy":c.ctss>=70?"Strong Combination":c.ctss>=55?"Moderate Combination":c.ctss>=40?"Weak Combination":"Poor Combination";
    const qaColor  = c.quantum_affinity>=80?"#16a34a":c.quantum_affinity>=60?"#ea580c":"#dc2626";
    const dciColor = c.drug_compatibility_index>=80?"#16a34a":c.drug_compatibility_index>=60?"#ea580c":"#dc2626";
    const confColor= c.confidence>=80?"#16a34a":c.confidence>=60?"#ea580c":"#dc2626";
    const riskKey = (c.risk||"").toLowerCase();
    const riskColor = riskKey==="low"?"#16a34a":riskKey==="moderate"?"#ca8a04":riskKey==="high"?"#ea580c":"#dc2626";
    const riskBg   = riskKey==="low"?"#dcfce7":riskKey==="moderate"?"#fef3c7":riskKey==="high"?"#ffedd5":"#fee2e2";
    const qaBadge  = c.quantum_affinity>=80?"STRONG":c.quantum_affinity>=60?"MODERATE":"WEAK";
    const dciBadge = c.drug_compatibility_index>=80?"OPTIMAL":c.drug_compatibility_index>=60?"ACCEPTABLE":"LOW";
    const ctssBadge= c.ctss>=80?"EXCELLENT":c.ctss>=60?"GOOD":c.ctss>=40?"MODERATE":"POOR";
    const confBadge= c.confidence>=80?"HIGH":c.confidence>=60?"MEDIUM":"LOW";
    const badgeStyle = (col) => `background:${col}20;color:${col}`;

    // ── Row 1 · KPI strip ──
    const kpi = document.createElement("div");
    kpi.className = "de-kpi-row";
    kpi.innerHTML = `
      <div class="de-kpi" style="--kpi-c:#7c3aed">
        <div class="de-kpi-h">
          <div class="de-kpi-l">Selected Drugs</div>
          <div class="de-kpi-i">💊</div>
        </div>
        <div class="de-kpi-v">${c.selected_drugs.length}<small>compounds</small></div>
        <div class="de-kpi-drugs">${c.selected_drugs.slice(0,6).map(d=>`<span>${escape(d)}</span>`).join("")}${c.selected_drugs.length>6?`<span>+${c.selected_drugs.length-6}</span>`:""}</div>
      </div>
      <div class="de-kpi" style="--kpi-c:${qaColor}">
        <div class="de-kpi-h">
          <div class="de-kpi-l">Quantum Affinity</div>
          <div class="de-kpi-i">⚛</div>
        </div>
        <div class="de-kpi-v">${c.quantum_affinity}<small>/100</small></div>
        <span class="de-kpi-b" style="${badgeStyle(qaColor)}">${qaBadge}</span>
      </div>
      <div class="de-kpi" style="--kpi-c:${dciColor}">
        <div class="de-kpi-h">
          <div class="de-kpi-l">Compatibility (DCI)</div>
          <div class="de-kpi-i">🧪</div>
        </div>
        <div class="de-kpi-v">${c.drug_compatibility_index}<small>/100</small></div>
        <span class="de-kpi-b" style="${badgeStyle(dciColor)}">${dciBadge}</span>
      </div>
      <div class="de-kpi" style="--kpi-c:${ctssColor}">
        <div class="de-kpi-h">
          <div class="de-kpi-l">CTSS</div>
          <div class="de-kpi-i">⭐</div>
        </div>
        <div class="de-kpi-v">${c.ctss}<small>/100</small></div>
        <span class="de-kpi-b" style="${badgeStyle(ctssColor)}">${ctssBadge}</span>
      </div>
      <div class="de-kpi" style="--kpi-c:${confColor}">
        <div class="de-kpi-h">
          <div class="de-kpi-l">Confidence</div>
          <div class="de-kpi-i">🎯</div>
        </div>
        <div class="de-kpi-v">${c.confidence}<small>%</small></div>
        <span class="de-kpi-b" style="${badgeStyle(confColor)}">${confBadge}</span>
      </div>
    `;

    // ── Row 2 · Averages + Radar+Guide ──
    const row2 = document.createElement("div");
    row2.className = "de-row-2";
    const avgs = [
      ["Average Drug Quality",     c.average_quality,          "#16a34a", "💊"],
      ["Average Toxicity (safe)",  c.average_toxicity,         "#f59e0b", "☣"],
      ["Average Solubility",       c.average_solubility,       "#06b6d4", "💧"],
      ["Average Bioavailability",  c.average_bioavailability,  "#0ea5e9", "🩸"],
      ["Average ADMET",            c.average_admet,            "#8b5cf6", "🧬"],
    ];
    row2.innerHTML = `
      <div class="de-panel" style="--p-c:#2563eb">
        <div class="de-p-h">
          <div class="ico">📊</div>
          <div class="t">Individual Drug Evaluation Summary</div>
          <div class="s">Averages across selection</div>
        </div>
        <div class="de-avg">
          ${avgs.map(([lbl,v,col,ic])=>`
            <div class="de-avg-item" style="--c:${col}">
              <div class="de-avg-l"><span class="dot"></span>${ic} ${lbl}</div>
              <div class="de-avg-v">${Math.round(v)}/100</div>
              <div class="de-avg-track"><div class="de-avg-fill" data-w="${clampPct(v)}"></div></div>
            </div>`).join("")}
        </div>
      </div>
      <div class="de-panel de-radar-panel" style="--p-c:#7c3aed">
        <div class="de-p-h">
          <div class="ico">🎯</div>
          <div class="t">Combination Profile Radar</div>
          <div class="s">Multi-metric view</div>
        </div>
        <canvas id="combinationRadar"></canvas>
      </div>
    `;

    // ── Row 2b · Metric Guide (full-width beside is tight; keep as its own row) ──
    const row2b = document.createElement("div");
    row2b.className = "de-panel";
    row2b.style.setProperty("--p-c","#0ea5e9");
    row2b.innerHTML = `
      <div class="de-p-h">
        <div class="ico">📖</div>
        <div class="t">Metric Guide</div>
        <div class="s">What each score means</div>
      </div>
      <div class="de-guide" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
        <div class="de-guide-i" style="--c:#7c3aed"><div class="ic">⚛</div><div class="tx"><b>Quantum Affinity</b><span>Qiskit-derived molecular interaction strength between compounds.</span></div></div>
        <div class="de-guide-i" style="--c:#2563eb"><div class="ic">🧪</div><div class="tx"><b>Compatibility Index (DCI)</b><span>Pharmacokinetic suitability across ADMET, quality & safety.</span></div></div>
        <div class="de-guide-i" style="--c:#16a34a"><div class="ic">💊</div><div class="tx"><b>Drug Quality</b><span>Composite of Lipinski, Veber & Egan rule-based drug-likeness.</span></div></div>
        <div class="de-guide-i" style="--c:#f59e0b"><div class="ic">☣</div><div class="tx"><b>Toxicity</b><span>Zhu QSAR + Brenk/PAINS alerts; higher = safer profile.</span></div></div>
        <div class="de-guide-i" style="--c:#06b6d4"><div class="ic">💧</div><div class="tx"><b>Solubility</b><span>Delaney ESOL aqueous solubility (logS, mg/mL).</span></div></div>
        <div class="de-guide-i" style="--c:#0ea5e9"><div class="ic">🩸</div><div class="tx"><b>Bioavailability</b><span>Predicted oral fraction absorbed (F ≥ 20% threshold).</span></div></div>
        <div class="de-guide-i" style="--c:#8b5cf6"><div class="ic">🧬</div><div class="tx"><b>ADMET</b><span>Absorption, Distribution, Metabolism, Excretion, Toxicity.</span></div></div>
        <div class="de-guide-i" style="--c:#db2777"><div class="ic">⭐</div><div class="tx"><b>CTSS</b><span>Combination Therapeutic Suitability — final integrated score.</span></div></div>
      </div>
    `;

    // ── Row 3 · CTSS · Interpretation · Explainable AI ──
    const row3 = document.createElement("div");
    row3.className = "de-row-3";

    const xaiPoints = [
      ["High Quantum Affinity",        c.quantum_affinity>=70],
      ["Balanced ADMET Profile",       c.average_admet>=65],
      ["Good Drug Compatibility",      c.drug_compatibility_index>=70],
      ["Acceptable Toxicity",          c.average_toxicity>=60],
      ["Strong Bioavailability",       c.average_bioavailability>=65],
      ["Reliable Confidence Level",    c.confidence>=70],
    ];

    row3.innerHTML = `
      <div class="de-panel" style="--p-c:${ctssColor}">
        <div class="de-p-h">
          <div class="ico">⭐</div>
          <div class="t">Combination Therapeutic Suitability</div>
        </div>
        <div class="de-ctss-hero">
          ${gauge(c.ctss, ctssColor)}
          <div class="de-ctss-grade" style="color:${ctssColor}">${ctssGrade}</div>
          <div class="de-ctss-meta">
            <div><div class="l">Confidence</div><div class="v" style="color:${confColor}">${c.confidence}%</div></div>
            <div><div class="l">Interaction Risk</div><div class="v" style="color:${riskColor};background:${riskBg};border-radius:6px;padding:2px 4px">${escape(c.risk||"N/A")}</div></div>
          </div>
          <div class="de-ctss-reco"><b>Recommendation.</b> ${escape(c.recommendation||"")}</div>
        </div>
      </div>

      <div class="de-panel" style="--p-c:#7c3aed">
        <div class="de-p-h">
          <div class="ico">📋</div>
          <div class="t">Scientific Interpretation</div>
        </div>
        <div class="de-interp">
          <div class="de-ib" style="--c:#7c3aed">
            <b>⚛ Quantum Compatibility</b>
            <p>Molecular compatibility scored <b>${c.quantum_affinity}</b>, quantifying predicted interaction strength between selected compounds via Qiskit fidelity.</p>
          </div>
          <div class="de-ib" style="--c:#2563eb">
            <b>🧪 Pharmacological Compatibility</b>
            <p>DCI of <b>${c.drug_compatibility_index}</b> summarises pharmacokinetic suitability across ADMET, drug quality, bioavailability, toxicity and solubility.</p>
          </div>
          <div class="de-ib" style="--c:#16a34a">
            <b>⭐ Therapeutic Suitability</b>
            <p>CTSS of <b>${c.ctss}</b> integrates molecular interaction and pharmacological compatibility into overall therapeutic potential.</p>
          </div>
        </div>
      </div>

      <div class="de-panel" style="--p-c:#16a34a">
        <div class="de-p-h">
          <div class="ico">🤖</div>
          <div class="t">Explainable AI</div>
        </div>
        <div class="de-xai-list">
          ${xaiPoints.map(([lbl,ok])=>`
            <div class="de-xai-item ${ok?'':'dim'}" style="--c:${ok?'#16a34a':'#94a3b8'}">
              <div class="ck">${ok?'✔':'–'}</div>${escape(lbl)}
            </div>`).join("")}
        </div>
        <div class="de-overall-reco">
          <div class="ic">✓</div>
          <div><b>Overall Recommendation</b><span>${escape(c.explanation||c.recommendation||"")}</span></div>
        </div>
      </div>
    `;

    // ── Row 4 · Next steps + Workflow ──
    const row4 = document.createElement("div");
    row4.className = "de-row-4";
    row4.innerHTML = `
      <div class="de-panel" style="--p-c:#2563eb">
        <div class="de-p-h">
          <div class="ico">🚀</div>
          <div class="t">Recommended Next Steps</div>
          <div class="s">Downstream pipeline</div>
        </div>
        <div class="de-steps">
          <button type="button" class="de-step" style="--c:#2563eb" data-step="docking">
            <div class="ic">🧩</div>
            <div class="t">Molecular Docking</div>
            <div class="s">Protein–ligand binding pose prediction (AutoDock Vina).</div>
            <div class="go">→</div>
          </button>
          <button type="button" class="de-step" style="--c:#7c3aed" data-step="dynamics">
            <div class="ic">🌐</div>
            <div class="t">Molecular Dynamics</div>
            <div class="s">Trajectory & stability analysis (GROMACS / OpenMM).</div>
            <div class="go">→</div>
          </button>
          <button type="button" class="de-step" style="--c:#16a34a" data-step="wetlab">
            <div class="ic">🧫</div>
            <div class="t">Wet Lab Validation</div>
            <div class="s">In-vitro assay confirmation of predicted synergy.</div>
            <div class="go">→</div>
          </button>
        </div>
      </div>
      <div class="de-panel" style="--p-c:#db2777">
        <div class="de-p-h">
          <div class="ico">🧭</div>
          <div class="t">Methodology Workflow</div>
        </div>
        <div class="de-flow">
          <div class="de-flow-i"><div class="n">1</div><div class="t">Quantum Affinity</div></div>
          <div class="de-flow-arrow">↓</div>
          <div class="de-flow-i"><div class="n">2</div><div class="t">Individual Drug Evaluation</div></div>
          <div class="de-flow-arrow">↓</div>
          <div class="de-flow-i"><div class="n">3</div><div class="t">Drug Compatibility Index</div></div>
          <div class="de-flow-arrow">↓</div>
          <div class="de-flow-i"><div class="n">4</div><div class="t">CTSS</div></div>
          <div class="de-flow-arrow">↓</div>
          <div class="de-flow-i"><div class="n">5</div><div class="t">Final Recommendation</div></div>
        </div>
      </div>
    `;

    // Section title
    const title = document.createElement("div");
    title.className = "de-cb-title";
    title.innerHTML = `<div class="bar"></div><div><div class="s">Combination Analysis</div><div class="t">🧬 Drug Combination Dashboard</div></div>`;

    wrap.appendChild(title);
    wrap.appendChild(kpi);
    wrap.appendChild(row2);
    wrap.appendChild(row2b);
    wrap.appendChild(row3);
    wrap.appendChild(row4);

    // Animate progress bars after mount
    setTimeout(()=>{
      wrap.querySelectorAll(".de-avg-fill").forEach(el=>{
        el.style.width = (el.getAttribute("data-w")||0) + "%";
      });
    }, 60);

    return wrap;
}

    results.forEach((r, idx) => grid.appendChild(cardFor(r, idx)));
    setTimeout(() => {

drawCombinationRadar(state.combination);

},100);
    // Draw radars after DOM insertion
    results.forEach((r) => drawRadar(`de-radar-${r.drug}`, r));
    
  }

  function cardFor(r, idx) {
    const card = document.createElement("div");
    const overallC = RISK_COLOR[r.overall.risk] || "#2563eb";
    card.className = "de-card";
    card.style.setProperty("--card-c", overallC);
    const bars = [
      
      ["Toxicity (safe)", r.toxicity.score,                    RISK_COLOR[r.toxicity.risk]],
      ["Bioavailability", r.bioavailability.score,             RISK_COLOR[r.bioavailability.risk]],
      ["Solubility",      r.solubility.score,                  RISK_COLOR[r.solubility.risk]],
      ["Absorption",      r.admet.absorption.score,            "#0ea5e9"],
      ["Distribution",    r.admet.distribution.score,          "#8b5cf6"],
      ["Metabolism",      r.admet.metabolism.score,            "#f59e0b"],
      ["Excretion",       r.admet.excretion.score,             "#10b981"],
    ];
    card.innerHTML = `
      <div class="de-drug">
        <div>
          <div class="de-drug-name">${escape(r.drug)}</div>
          <div class="de-drug-meta">${escape(r.descriptors.formula)} · MW ${r.descriptors.mw} · LogP ${r.descriptors.logp}</div>
        </div>
        <div class="de-rank" title="Rank by ${sortByLabel(state.sortBy)}">${r.rank || (idx+1)}</div>
      </div>
      <div class="de-overall">
        ${gauge(r.overall.overall, overallC)}
        <div class="de-grade">
          <div class="de-grade-t" style="color:${overallC}">${escape(r.overall.grade)}</div>
          <div class="de-grade-s">
            <span class="de-risk ${r.overall.risk}">${r.overall.risk.toUpperCase()}</span>
            · Confidence ${r.confidence.confidence}%
          </div>
        </div>
      </div>
      <div class="de-metrics">
        ${bars.map(([lbl,v,c]) => `
          <div class="de-metric">
            <div class="de-metric-l">${lbl}</div>
            <div class="de-bar"><div style="width:${clampPct(v)}%;background:${c}"></div></div>
            <div class="de-metric-v">${Math.round(v)}/100</div>
          </div>`).join("")}
      </div>
      <div class="de-radar"><canvas id="de-radar-${escape(r.drug)}"></canvas></div>
      <div class="de-xai">
        <b>Explainable AI:</b> ${escape(r.xai.summary)}
        ${r.xai.concerns?.length ? `<ul>${r.xai.concerns.map(c=>`<li>${escape(c)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="de-detail">
        <b>Toxicity:</b> LD50 ≈ ${r.toxicity.predicted_LD50_mg_kg} mg/kg
        ${r.toxicity.hERG_risk ? " · hERG⚠" : ""}
        ${r.toxicity.AMES_risk ? " · AMES⚠" : ""}
        ${r.toxicity.hepatotoxicity_risk ? " · Hepato⚠" : ""}<br>
        <b>Solubility:</b> logS ${r.solubility.logS_mol_L} (${escape(r.solubility.category)})<br>
        <b>Bioavailability:</b> P(F≥20%) ${r.bioavailability.probability_F_ge_20pct}
        · Lipinski violations ${r.bioavailability.lipinski_violations}
        · Veber violations ${r.bioavailability.veber_violations}<br>
        <b>Distribution:</b> Vd ${r.admet.distribution.Vd_L_per_kg} L/kg
        · PPB ${r.admet.distribution.plasma_protein_binding_pct}%
        · BBB ${r.admet.distribution.BBB_permeable ? "permeable" : "restricted"}<br>
        <b>Metabolism:</b> CYP ${r.admet.metabolism.CYP_substrates.join(", ") || "—"}
        · t½ ≈ ${r.admet.metabolism.predicted_half_life_h} h<br>
        <b>Excretion:</b> ${escape(r.admet.excretion.primary_route)}
        · CL ${r.admet.excretion.predicted_clearance_L_per_h} L/h
      </div>
    `;
    return card;
  }

  function gauge(v, color) {
    const pct = clampPct(v);
    const r = 26, C = 2 * Math.PI * r;
    const off = C * (1 - pct/100);
    return `
      <div class="de-gauge">
        <svg width="70" height="70" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r="${r}" stroke="#eef2f7" stroke-width="6" fill="none"/>
          <circle cx="35" cy="35" r="${r}" stroke="${color}" stroke-width="6" fill="none"
            stroke-dasharray="${C}" stroke-dashoffset="${off}" stroke-linecap="round"/>
        </svg>
        <div class="de-gauge-val" style="color:${color}">
          ${Math.round(v)}<span class="de-gauge-lbl">/ 100</span>
        </div>
      </div>`;
  }

  function drawRadar(id, r) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    new Chart(el, {
      type: "radar",
      data: {
        labels: ["Safety","Bioavail.","Solubility","Absorption","Distribution","Metabolism","Excretion"],
        datasets: [{
          label: r.drug,
          data: [
           r.toxicity.score, r.bioavailability.score,
            r.solubility.score, r.admet.absorption.score, r.admet.distribution.score,
            r.admet.metabolism.score, r.admet.excretion.score,
          ],
          backgroundColor: "rgba(37,99,235,.18)",
          borderColor: "#2563eb", borderWidth: 2, pointRadius: 2,
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{r:{min:0,max:100,ticks:{stepSize:25,font:{size:8}},pointLabels:{font:{size:9}}}}
      }
    });
  }

  // ── History ─────────────────────────────────────────────────────
  async function showHistory() {
    let j;
    try { j = await get(API.history); } catch (e) { alert(e.message); return; }
    const modal = document.createElement("div");
    modal.className = "de-modal";
    modal.innerHTML = `
      <div class="de-modal-inner">
        <div class="de-modal-head">
          <div class="de-title" style="font-size:16px">Prediction History (${j.count})</div>
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="de-btn" id="de-hist-clear">Clear</button>
            <button class="de-btn primary" id="de-hist-close">Close</button>
          </div>
        </div>
        <div class="de-modal-body">
          ${j.history.length ? j.history.map(h => `
            <div class="de-hist-row">
              <div><b>${escape(h.drug)}</b> <span class="de-drug-meta">${escape(h.descriptors.formula)}</span></div>
              <div class="de-risk ${h.overall.risk}">${h.overall.overall}/100</div>
              <div style="color:var(--dim);font-size:11px">${new Date(h.ts*1000).toLocaleString()}</div>
              <button class="de-btn" data-drug="${escape(h.drug)}">Re-run</button>
            </div>`).join("") : `<div class="de-empty">No history yet</div>`}
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#de-hist-close").onclick = () => modal.remove();
    modal.querySelector("#de-hist-clear").onclick = async () => {
      await fetch(API.history, {method:"DELETE"}); modal.remove();
    };
    modal.querySelectorAll("button[data-drug]").forEach(b => {
      b.onclick = () => { modal.remove(); evaluate([b.dataset.drug]); };
    });
  }

  // ── Exports ─────────────────────────────────────────────────────
  function exportJSON(data) {
    if (!data.length) return alert("Nothing to export");
    download("drug-evaluation.json", "application/json",
      JSON.stringify(data, null, 2));
  }
  function exportCSV(data) {
    if (!data.length) return alert("Nothing to export");
    const cols = ["rank","drug","overall","grade","risk","toxicity","bioavailability",
      "solubility","absorption","distribution","metabolism","excretion","confidence",
      "LD50_mg_kg","hERG","AMES","hepato","logS","F_prob","Vd","PPB_pct","BBB","CYP","t_half_h","CL_L_h"];
    const rows = data.map(r => [
      r.rank, r.drug, r.overall.overall, r.overall.grade, r.overall.risk
       , r.toxicity.score, r.bioavailability.score,
      r.solubility.score, r.admet.absorption.score, r.admet.distribution.score,
      r.admet.metabolism.score, r.admet.excretion.score, r.confidence.confidence,
      r.toxicity.predicted_LD50_mg_kg, r.toxicity.hERG_risk, r.toxicity.AMES_risk,
      r.toxicity.hepatotoxicity_risk, r.solubility.logS_mol_L,
      r.bioavailability.probability_F_ge_20pct, r.admet.distribution.Vd_L_per_kg,
      r.admet.distribution.plasma_protein_binding_pct, r.admet.distribution.BBB_permeable,
      r.admet.metabolism.CYP_substrates.join("|"),
      r.admet.metabolism.predicted_half_life_h, r.admet.excretion.predicted_clearance_L_per_h,
    ]);
    const csv = [cols.join(","), ...rows.map(r => r.map(csvCell).join(","))].join("\n");
    download("drug-evaluation.csv", "text/csv", csv);
  }
  function exportPDF(data) {
    if (!data.length) return alert("Nothing to export");
    if (!window.jspdf) return alert("jsPDF not loaded — add the CDN <script> from the integration snippet");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:"pt", format:"a4"});
    doc.setFont("helvetica","bold"); doc.setFontSize(16);
    doc.text("Advanced Drug Evaluation Report", 40, 40);
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()} · ${data.length} drug(s) · sorted by ${state.sortBy}`, 40, 56);
    doc.autoTable({
      startY: 74,
      head: [["Rank","Drug","Overall","Grade","Risk","Safety","Bioavail","Solub","Conf"]],
      body: data.map(r => [
        r.rank, r.drug, r.overall.overall, r.overall.grade, r.overall.risk
   , r.toxicity.score, r.bioavailability.score,
        r.solubility.score, r.confidence.confidence + "%",
      ]),
      styles:{fontSize:8}, headStyles:{fillColor:[37,99,235]},
    });
    let y = doc.lastAutoTable.finalY + 20;
    data.forEach(r => {
      if (y > 720) { doc.addPage(); y = 40; }
      doc.setFont("helvetica","bold"); doc.setFontSize(11);
      doc.text(`${r.rank}. ${r.drug} — ${r.overall.overall}/100 (${r.overall.grade})`, 40, y);
      y += 14;
      doc.setFont("helvetica","normal"); doc.setFontSize(8);
      const lines = doc.splitTextToSize(r.xai.summary, 515);
      doc.text(lines, 40, y); y += lines.length * 10 + 4;
      doc.text(`LD50 ${r.toxicity.predicted_LD50_mg_kg} mg/kg · logS ${r.solubility.logS_mol_L}` +
               ` · F ${r.bioavailability.probability_F_ge_20pct} · Vd ${r.admet.distribution.Vd_L_per_kg} L/kg` +
               ` · CYP ${r.admet.metabolism.CYP_substrates.join(",")||"-"}`, 40, y);
      y += 18;
    });
    doc.save("drug-evaluation.pdf");
  }

  // ── Utils ───────────────────────────────────────────────────────
  const clampPct = (v) => Math.max(0, Math.min(100, +v || 0));
  const escape = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const csvCell = (v) => {
    const s = String(v ?? ""); return /[,"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const sortByLabel = (k) => ({overall:"Overall",toxicity:"Safety",
    bioavailability:"Bioavailability",admet:"ADMET",confidence:"Confidence"}[k] || k);
  function download(name, mime, content) {
    const blob = new Blob([content], {type: mime});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
function drawCombinationRadar(c){

const canvas=document.getElementById("combinationRadar");

if(!canvas) return;

new Chart(canvas,{

type:"radar",

data:{

labels:[

"Quantum",

"DCI",

"Quality",

"Toxicity",

"Solubility",

"Bioavailability",

"ADMET"

],

datasets:[{

label:"Combination",

data:[

c.quantum_affinity,

c.drug_compatibility_index,

c.average_quality,

c.average_toxicity,

c.average_solubility,

c.average_bioavailability,

c.average_admet

],

fill:true

}]

},

options:{

responsive:false,

plugins:{

legend:{

display:false

}

},

scales:{

r:{

min:0,

max:100,

ticks:{

stepSize:20

}

}

}

}

});

}
  window.DrugEval = { mount, evaluate, showHistory };
  // Auto-mount when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
  } else {
    mount();
  }
})();
