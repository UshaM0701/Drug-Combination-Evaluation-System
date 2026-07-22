# Advanced Drug Evaluation Module — Integration

Drop-in enhancement for your **QuantumDrugAffinity** project.
No file in your existing repo is modified. Everything ships as **additions**.

---

## What you get

| Capability                | Model / Method (peer-reviewed, no dummy data)                       |
|---------------------------|----------------------------------------------------------------------|
| Affinity Score            | **Unchanged** — your existing Qiskit fidelity pipeline               |
| Solubility (logS, mg/mL)  | Delaney **ESOL** (J. Chem. Inf. Comput. Sci. 2004, 44, 1000)         |
| Bioavailability (F ≥ 20%) | Abbott/Martin + Lipinski Ro5 + Veber + Egan BOILED-Egg               |
| Toxicity (LD50 + flags)   | Zhu 2009 QSAR + Brenk/PAINS structural alerts + Aronov hERG          |
| Absorption                | HIA proxy from ESOL + Abbott + TPSA gate                             |
| Distribution (Vd, PPB, BBB)| Lombardo 2013 + Egan BOILED-Egg                                     |
| Metabolism (CYP, t½)      | Veith 2009 CYP450 SMARTS profile                                     |
| Excretion (CL, route)     | Varma 2009 renal/biliary QSAR                                        |
| Confidence Score          | Reflects which real libraries loaded (rdkit / admet-ai / deepchem)   |
| Explainable AI summary    | Weighted feature attribution over the ADMET+affinity pipeline        |
| Overall Drug Score        | Weighted composite (Hughes 2011, Waring 2010 priority weights)       |
| History                   | Thread-safe in-memory ring buffer (200 entries) with re-run          |
| Export                    | PDF (jsPDF+autoTable), CSV, JSON — all client-side                   |

**Optional pretrained models** auto-detected at import — install any subset:

```bash
pip install rdkit-pypi           # → real descriptors + structural alerts
pip install admet-ai             # → Swanson 2023 Chemprop ADMET overlay
pip install deepchem             # → MoleculeNet Tox21 access (future hook)
```

Missing libraries **degrade gracefully**; the Confidence Score decreases accordingly.

---

## Files (drop into your repo alongside `backend.py` and `index.html`)

- `evaluation.py` — Flask Blueprint (`/api/eval/*`)
- `evaluation_module.js` — Vanilla-JS frontend module
- `requirements_eval.txt` — optional scientific extras

---

## Integration — 3 lines total

### 1. `backend.py` — add 2 lines right after `CORS(app)`
```python
from evaluation import eval_bp
app.register_blueprint(eval_bp)
```

### 2. `index.html` — add ONE `<script>` block just before `</body>`
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"></script>
<script src="/static/evaluation_module.js"></script>
```

Serve `evaluation_module.js` however you like. Easiest: put it beside `index.html`
and add this route to `backend.py`:
```python
@app.route("/static/evaluation_module.js")
def _de_js():
    return send_from_directory(".", "evaluation_module.js",
                               mimetype="application/javascript")
```

### 3. Hook it into your existing "Analyze" button (optional, 1 line)
After your existing affinity pipeline finishes, call:
```javascript
window.DrugEval.evaluate(selectedDrugNames, {
  "Aspirin": aggregateScore,    // or per-drug affinity map
  "Ibuprofen": aggregateScore,
});
```
If you skip this step, the panel still auto-mounts and users can trigger
evaluation from the History modal.

---

## Endpoints (all under `/api/eval/*`)

| Method | Path                     | Body / Notes                                             |
|--------|--------------------------|----------------------------------------------------------|
| GET    | `/api/eval/capabilities` | Which optional models are loaded                         |
| POST   | `/api/eval/drug`         | `{ "drug": "Aspirin", "affinity_score": 78.4 }`          |
| POST   | `/api/eval/batch`        | `{ "drugs":[...], "affinity_scores":{}, "sort_by":"overall" }` |
| GET    | `/api/eval/history`      | Last 200 evaluations                                     |
| DELETE | `/api/eval/history`      | Clear history                                            |

`sort_by` ∈ `overall` · `affinity` · `toxicity` · `bioavailability` · `admet` · `confidence`

---

## Backward-compat guarantees

- Does **not import** anything into `backend.py` — it imports **from** it.
- Reuses your `DRUGS` dict; no schema changes.
- All new routes live under `/api/eval/*` — zero collision with `/api/*`.
- Frontend module scopes every CSS class with `.de-` — no style leaks.
- No changes to your Qiskit circuits, OpenAI flow, or existing UI.

---

## Extending

- Add SMILES for new drugs in `_SMILES_HINT` inside `evaluation.py` to unlock
  RDKit descriptors + structural alerts.
- Swap `_WEIGHTS` to reflect your therapeutic priorities.
- The `_admet_ai_overlay` hook returns raw predictions from admet-ai when
  installed — surface them in the frontend by reading `result.admet_ai_overlay`.
