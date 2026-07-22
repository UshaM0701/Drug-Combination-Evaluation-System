"""
Drug Molecular Affinity Analyzer — Python Backend
===================================================
Stack:  Flask · Qiskit (real quantum circuits) · OpenAI GPT-4o
Run:    python backend.py
API:    POST /api/quantum-score   { "drugs": ["Aspirin","Ibuprofen"] }
        POST /api/ai-analysis     { "drugs": [...], "aggregate": {...}, "openai_key": "sk-..." }
        GET  /api/drugs           -> full drug database JSON
        GET  /api/health          -> status check
"""
from flask import send_from_directory

import math, json, os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── Qiskit ──────────────────────────────────────────────────────────
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, state_fidelity

# ── OpenAI ──────────────────────────────────────────────────────────
from openai import OpenAI

app = Flask(__name__)
CORS(app)


# ════════════════════════════════════════════════════════════════════
# DRUG DATABASE
# ════════════════════════════════════════════════════════════════════
DRUGS: dict[str, dict] = {
    "Aspirin":       dict(formula="C9H8O4",       mw=180.2, logp=1.19,  hbd=1, hba=4,  tpsa=63.6,  rb=3,  rings=1, arom=1, charge=0, cls="NSAID",           tgt="COX-1/2",       col="#ef4444"),
    "Ibuprofen":     dict(formula="C13H18O2",      mw=206.3, logp=3.97,  hbd=1, hba=2,  tpsa=37.3,  rb=4,  rings=1, arom=1, charge=0, cls="NSAID",           tgt="COX-1/2",       col="#ef4444"),
    "Naproxen":      dict(formula="C14H14O3",      mw=230.3, logp=3.18,  hbd=1, hba=3,  tpsa=46.5,  rb=3,  rings=2, arom=2, charge=0, cls="NSAID",           tgt="COX-1/2",       col="#ef4444"),
    "Diclofenac":    dict(formula="C14H11Cl2NO2",  mw=296.1, logp=4.51,  hbd=2, hba=3,  tpsa=49.3,  rb=4,  rings=2, arom=2, charge=0, cls="NSAID",           tgt="COX-1/2",       col="#ef4444"),
    "Celecoxib":     dict(formula="C17H14F3N3O2S", mw=381.4, logp=3.57,  hbd=1, hba=4,  tpsa=78.0,  rb=3,  rings=3, arom=3, charge=0, cls="NSAID",           tgt="COX-2",         col="#f97316"),
    "Paracetamol":   dict(formula="C8H9NO2",       mw=151.2, logp=0.46,  hbd=2, hba=2,  tpsa=49.3,  rb=2,  rings=1, arom=1, charge=0, cls="Analgesic",       tgt="COX-3",         col="#84cc16"),
    "Tramadol":      dict(formula="C16H25NO2",     mw=263.4, logp=1.84,  hbd=2, hba=3,  tpsa=40.5,  rb=7,  rings=1, arom=1, charge=0, cls="Opioid",          tgt="MOR/SNRI",      col="#8b5cf6"),
    "Morphine":      dict(formula="C17H19NO3",     mw=285.3, logp=0.89,  hbd=2, hba=4,  tpsa=62.1,  rb=1,  rings=5, arom=1, charge=0, cls="Opioid",          tgt="μ-OR",          col="#8b5cf6"),
    "Codeine":       dict(formula="C18H21NO3",     mw=299.4, logp=1.19,  hbd=1, hba=4,  tpsa=52.6,  rb=2,  rings=5, arom=1, charge=0, cls="Opioid",          tgt="μ-OR",          col="#8b5cf6"),
    "Fentanyl":      dict(formula="C22H28N2O",     mw=336.5, logp=4.05,  hbd=0, hba=2,  tpsa=23.7,  rb=7,  rings=2, arom=2, charge=0, cls="Opioid",          tgt="μ-OR",          col="#8b5cf6"),
    "Amoxicillin":   dict(formula="C16H19N3O5S",   mw=365.4, logp=0.87,  hbd=4, hba=6,  tpsa=158.2, rb=6,  rings=2, arom=1, charge=0, cls="Penicillin",      tgt="PBP",           col="#06b6d4"),
    "Ciprofloxacin": dict(formula="C17H18FN3O3",   mw=331.3, logp=0.28,  hbd=2, hba=6,  tpsa=74.6,  rb=4,  rings=3, arom=2, charge=0, cls="Fluoroquinolone", tgt="DNA Gyrase",    col="#0ea5e9"),
    "Metformin":     dict(formula="C4H11N5",        mw=129.2, logp=-1.43, hbd=4, hba=5,  tpsa=91.9,  rb=2,  rings=0, arom=0, charge=0, cls="Biguanide",       tgt="AMPK",          col="#10b981"),
    "Warfarin":      dict(formula="C19H16O4",       mw=308.3, logp=2.70,  hbd=1, hba=4,  tpsa=63.2,  rb=5,  rings=2, arom=1, charge=0, cls="Anticoagulant",   tgt="VKORC1",        col="#f43f5e"),
    "Clopidogrel":   dict(formula="C16H16ClNO2S",   mw=321.8, logp=2.53,  hbd=0, hba=4,  tpsa=72.9,  rb=6,  rings=3, arom=2, charge=0, cls="Antiplatelet",    tgt="P2Y12",         col="#f43f5e"),
    "Atorvastatin":  dict(formula="C33H35FN2O5",    mw=558.6, logp=4.46,  hbd=4, hba=7,  tpsa=111.8, rb=12, rings=3, arom=2, charge=0, cls="Statin",          tgt="HMG-CoA",       col="#f59e0b"),
    "Simvastatin":   dict(formula="C25H38O5",       mw=418.6, logp=4.68,  hbd=1, hba=5,  tpsa=72.7,  rb=6,  rings=3, arom=0, charge=0, cls="Statin",          tgt="HMG-CoA",       col="#f59e0b"),
    "Amlodipine":    dict(formula="C20H25ClN2O5",   mw=408.9, logp=3.00,  hbd=3, hba=6,  tpsa=110.9, rb=9,  rings=2, arom=1, charge=0, cls="CCB",             tgt="L-VGCC",        col="#f59e0b"),
    "Metoprolol":    dict(formula="C15H25NO3",      mw=267.4, logp=1.88,  hbd=3, hba=4,  tpsa=67.3,  rb=8,  rings=1, arom=1, charge=0, cls="Beta Blocker",    tgt="β1-AR",         col="#f59e0b"),
    "Lisinopril":    dict(formula="C21H31N3O5",     mw=405.5, logp=-0.26, hbd=5, hba=6,  tpsa=118.5, rb=9,  rings=2, arom=1, charge=0, cls="ACE Inhibitor",   tgt="ACE",           col="#f59e0b"),
    "Losartan":      dict(formula="C22H23ClN6O",    mw=422.9, logp=4.01,  hbd=2, hba=6,  tpsa=93.0,  rb=7,  rings=4, arom=4, charge=0, cls="ARB",             tgt="AT1-R",         col="#f59e0b"),
    "Furosemide":    dict(formula="C12H11ClN2O5S",  mw=330.7, logp=2.03,  hbd=4, hba=6,  tpsa=126.0, rb=4,  rings=2, arom=2, charge=0, cls="Loop Diuretic",   tgt="NKCC2",         col="#f59e0b"),
    "Sildenafil":    dict(formula="C22H30N6O4S",    mw=474.6, logp=1.92,  hbd=1, hba=7,  tpsa=113.1, rb=7,  rings=4, arom=3, charge=0, cls="PDE5i",           tgt="PDE5",          col="#a855f7"),
    "Diazepam":      dict(formula="C16H13ClN2O",    mw=284.7, logp=2.82,  hbd=0, hba=2,  tpsa=32.7,  rb=2,  rings=3, arom=2, charge=0, cls="Benzodiazepine",  tgt="GABA-A",        col="#8b5cf6"),
    "Alprazolam":    dict(formula="C17H13ClN4",     mw=308.8, logp=2.12,  hbd=0, hba=2,  tpsa=39.7,  rb=0,  rings=4, arom=3, charge=0, cls="Benzodiazepine",  tgt="GABA-A",        col="#8b5cf6"),
    "Sertraline":    dict(formula="C17H17Cl2N",     mw=306.2, logp=4.72,  hbd=1, hba=1,  tpsa=29.1,  rb=3,  rings=3, arom=2, charge=0, cls="SSRI",            tgt="SERT",          col="#8b5cf6"),
    "Fluoxetine":    dict(formula="C17H18F3NO",     mw=309.3, logp=3.64,  hbd=1, hba=2,  tpsa=29.5,  rb=7,  rings=2, arom=2, charge=0, cls="SSRI",            tgt="SERT",          col="#8b5cf6"),
    "Omeprazole":    dict(formula="C17H19N3O3S",    mw=345.4, logp=2.23,  hbd=1, hba=6,  tpsa=87.7,  rb=5,  rings=2, arom=2, charge=0, cls="PPI",             tgt="H+/K+-ATPase",  col="#10b981"),
    "Phenytoin":     dict(formula="C15H12N2O2",     mw=252.3, logp=2.47,  hbd=2, hba=4,  tpsa=58.2,  rb=2,  rings=3, arom=2, charge=0, cls="Antiepileptic",   tgt="Na-channel",    col="#ec4899"),
    "Carbamazepine": dict(formula="C15H12N2O",      mw=236.3, logp=2.45,  hbd=1, hba=1,  tpsa=46.3,  rb=1,  rings=3, arom=2, charge=0, cls="Antiepileptic",   tgt="Na-channel",    col="#ec4899"),
    "Gabapentin":    dict(formula="C9H17NO2",       mw=171.2, logp=-1.10, hbd=3, hba=2,  tpsa=63.3,  rb=3,  rings=1, arom=0, charge=0, cls="Antiepileptic",   tgt="VGCC-α2δ",      col="#ec4899"),
    "Albuterol":     dict(formula="C13H21NO3",      mw=239.3, logp=0.64,  hbd=4, hba=4,  tpsa=72.7,  rb=5,  rings=1, arom=1, charge=0, cls="SABA",            tgt="β2-AR",         col="#3b82f6"),
    "Theophylline":  dict(formula="C7H8N4O2",       mw=180.2, logp=-0.02, hbd=1, hba=5,  tpsa=69.3,  rb=0,  rings=2, arom=1, charge=0, cls="Xanthine",        tgt="PDE/Adenosine", col="#3b82f6"),
    "Caffeine":      dict(formula="C8H10N4O2",      mw=194.2, logp=-0.07, hbd=0, hba=3,  tpsa=58.4,  rb=0,  rings=2, arom=1, charge=0, cls="Xanthine",        tgt="Adenosine-R",   col="#f59e0b"),
    "Prednisolone":  dict(formula="C21H28O5",       mw=360.4, logp=1.62,  hbd=3, hba=5,  tpsa=94.8,  rb=2,  rings=4, arom=0, charge=0, cls="Corticosteroid",  tgt="GR",            col="#f97316"),
    "Dexamethasone": dict(formula="C22H29FO5",      mw=392.5, logp=1.83,  hbd=3, hba=5,  tpsa=94.8,  rb=2,  rings=4, arom=0, charge=0, cls="Corticosteroid",  tgt="GR",            col="#f97316"),
    "Methotrexate":  dict(formula="C20H22N8O5",     mw=454.4, logp=-1.85, hbd=6, hba=12, tpsa=210.5, rb=8,  rings=3, arom=3, charge=0, cls="DMARD",           tgt="DHFR",          col="#f97316"),
    "Estradiol":     dict(formula="C18H24O2",       mw=272.4, logp=4.01,  hbd=2, hba=2,  tpsa=40.5,  rb=0,  rings=4, arom=1, charge=0, cls="Estrogen",        tgt="ERα/β",         col="#ec4899"),
    "Donepezil":     dict(formula="C24H29NO3",      mw=379.5, logp=3.70,  hbd=0, hba=5,  tpsa=38.3,  rb=8,  rings=3, arom=2, charge=0, cls="AChE Inhibitor",  tgt="AChE",          col="#8b5cf6"),
    "Tamoxifen":     dict(formula="C26H29NO",       mw=371.5, logp=6.30,  hbd=0, hba=2,  tpsa=12.5,  rb=8,  rings=3, arom=3, charge=0, cls="SERM",            tgt="ERα",           col="#ec4899"),
    "Melatonin":     dict(formula="C13H16N2O2",     mw=232.3, logp=1.47,  hbd=2, hba=3,  tpsa=54.0,  rb=5,  rings=2, arom=1, charge=0, cls="Melatonin Agonist", tgt="MT1/MT2",     col="#8b5cf6"),
    "Acyclovir":     dict(formula="C8H11N5O3",      mw=225.2, logp=-1.56, hbd=3, hba=6,  tpsa=119.1, rb=4,  rings=2, arom=1, charge=0, cls="Antiviral",       tgt="HSV TK/Pol",   col="#0ea5e9"),
    "Allopurinol":   dict(formula="C5H4N4O",        mw=136.1, logp=-0.56, hbd=2, hba=4,  tpsa=75.3,  rb=0,  rings=2, arom=1, charge=0, cls="Xanthine Oxidase-I", tgt="XO",         col="#10b981"),
    "Colchicine":    dict(formula="C22H25NO6",      mw=399.4, logp=1.30,  hbd=1, hba=7,  tpsa=84.7,  rb=5,  rings=3, arom=2, charge=0, cls="Anti-gout",       tgt="Tubulin",       col="#10b981"),
}

RULES = [
    dict(p=["Warfarin","Aspirin"],           risk="critical", v="AVOID",   note="Synergistic anticoagulation — severe bleeding"),
    dict(p=["Warfarin","Ibuprofen"],          risk="critical", v="AVOID",   note="NSAIDs displace warfarin → INR spikes"),
    dict(p=["Morphine","Diazepam"],           risk="critical", v="AVOID",   note="CNS+respiratory depression — potentially fatal"),
    dict(p=["Morphine","Alprazolam"],         risk="critical", v="AVOID",   note="Opioid + BZD — FDA black-box"),
    dict(p=["Sertraline","Fluoxetine"],       risk="critical", v="AVOID",   note="Dual SSRI → serotonin syndrome"),
    dict(p=["Aspirin","Ibuprofen"],           risk="high",     v="CAUTION", note="Competitive COX-1 inhibition reduces aspirin cardioprotection"),
    dict(p=["Metformin","Furosemide"],        risk="high",     v="CAUTION", note="Loop diuretics raise lactic acidosis risk with metformin"),
    dict(p=["Warfarin","Diclofenac"],         risk="critical", v="AVOID",   note="NSAID+anticoagulant → GI bleed"),
    dict(p=["Fentanyl","Diazepam"],           risk="critical", v="AVOID",   note="Opioid+BZD respiratory arrest risk"),
    dict(p=["Atorvastatin","Amlodipine"],     risk="moderate", v="MONITOR", note="CYP3A4 interaction — watch for myopathy"),
    dict(p=["Lisinopril","Losartan"],         risk="high",     v="CAUTION", note="Dual RAAS blockade → hyperkalemia"),
    dict(p=["Ciprofloxacin","Theophylline"],  risk="high",     v="CAUTION", note="CYP1A2 inhibition → theophylline toxicity"),
    dict(p=["Sertraline","Tramadol"],         risk="high",     v="CAUTION", note="Serotonin syndrome risk via SNRI mechanism"),
]


def get_rule(n1: str, n2: str):
    for r in RULES:
        if n1 in r["p"] and n2 in r["p"]:
            return r
    return None


def get_status(score: float) -> dict:
    if score >= 75: return dict(l="HIGH AFFINITY",     c="#22c55e")
    if score >= 55: return dict(l="MODERATE AFFINITY", c="#eab308")
    if score >= 35: return dict(l="LOW AFFINITY",      c="#f97316")
    return               dict(l="INCOMPATIBLE",        c="#ef4444")


# ════════════════════════════════════════════════════════════════════
# CLASSICAL FINGERPRINT
# ════════════════════════════════════════════════════════════════════
def fingerprint(d: dict) -> set:
    b: set = set()
    for t in [100,150,200,250,300,400,500,700]:
        if d["mw"] > t: b.add(f"mw>{t}")
    for lo, hi in [(-8,-4),(-4,-2),(-2,0),(0,1),(1,2),(2,3),(3,4),(4,5),(5,8)]:
        if lo <= d["logp"] < hi: b.add(f"lp{lo}")
    b.add(f"hbd{min(d['hbd'],8)}"); b.add(f"hba{min(d['hba'],10)}")
    if not d["hbd"]: b.add("no_hbd")
    if not d["hba"]: b.add("no_hba")
    if d["hbd"] > 3: b.add("hi_hbd")
    if d["hba"] > 6: b.add("hi_hba")
    for t in [20,40,60,80,100,130,160]:
        if d["tpsa"] > t: b.add(f"tpsa>{t}")
    b.add(f"r{min(d['rings'],6)}"); b.add(f"ar{min(d['arom'],4)}")
    if not d["rings"]: b.add("acyclic")
    if d["arom"]: b.add("arom")
    for t in [0,2,4,6,8,12]:
        if d["rb"] > t: b.add(f"rb>{t}")
    b.add(f"ch{d['charge']}"); b.add(f"cls_{d['cls']}"); b.add(f"tgt_{d['tgt']}")
    lip = (1 if d["mw"]<=500 else 0)+(1 if d["logp"]<=5 else 0)+(1 if d["hbd"]<=5 else 0)+(1 if d["hba"]<=10 else 0)
    b.add(f"lip{lip}")
    return b


def tanimoto(b1: set, b2: set) -> float:
    n = len(b1 & b2)
    return n / (len(b1) + len(b2) - n) if (len(b1) + len(b2) - n) > 0 else 0.0


# ════════════════════════════════════════════════════════════════════
# QISKIT QUANTUM CIRCUITS
# ════════════════════════════════════════════════════════════════════
def _angle(v: float, lo: float, hi: float) -> float:
    """Map molecular property → Bloch-sphere RY angle in [0, π]."""
    return max(0.0, min(math.pi, (v - lo) / (hi - lo) * math.pi))


def _drug_angles(d: dict) -> list[float]:
    """6 rotation angles encoding the drug's physicochemical fingerprint."""
    return [
        _angle(d["mw"],   80,  800),
        _angle(d["logp"], -8,    8),
        _angle(d["hbd"],   0,   10),
        _angle(d["hba"],   0,   14),
        _angle(d["tpsa"],  0,  300),
        _angle(d["rb"],    0,   18),
    ]


def quantum_fidelity(d1: dict, d2: dict) -> float:
    """
    Build two independent 6-qubit product states via RY rotations.
    Each qubit i encodes one molecular property:

        |ψ_k⟩ = ⊗_i  RY(θᵢ^k)|0⟩

    Fidelity F = |⟨ψ₁|ψ₂⟩|² = ∏_i cos²((θᵢ¹ − θᵢ²)/2)
    Computed exactly via Qiskit Statevector (no shot noise).
    """
    a1 = _drug_angles(d1)
    a2 = _drug_angles(d2)
    n  = len(a1)

    qc1 = QuantumCircuit(n)
    qc2 = QuantumCircuit(n)
    for i in range(n):
        qc1.ry(a1[i], i)
        qc2.ry(a2[i], i)

    return float(state_fidelity(Statevector(qc1), Statevector(qc2)))


def quantum_entanglement_probe(d1: dict, d2: dict) -> float:
    """
    Probe drug-drug entanglement via a 6-qubit circuit:
    - Qubits 0-2: Drug 1 (first 3 params)
    - Qubits 3-5: Drug 2 (first 3 params)
    - CNOT layer: cx(i, i+3) for i in 0..2

    Compare entangled vs product state fidelity to detect
    whether the drugs' molecular spaces are correlated.
    """
    a1 = _drug_angles(d1)[:3]
    a2 = _drug_angles(d2)[:3]

    # Entangled circuit
    qc_ent = QuantumCircuit(6)
    for i, a in enumerate(a1): qc_ent.ry(a, i)
    for i, a in enumerate(a2): qc_ent.ry(a, i + 3)
    for i in range(3): qc_ent.cx(i, i + 3)

    # Product reference (no entanglement)
    qc_ref = QuantumCircuit(6)
    for i, a in enumerate(a1): qc_ref.ry(a, i)
    for i, a in enumerate(a2): qc_ref.ry(a, i + 3)

    return float(state_fidelity(Statevector(qc_ent), Statevector(qc_ref)))


def pair_score(n1: str, n2: str) -> dict:
    """Full pairwise score: Tanimoto + Qiskit fidelity + entanglement probe."""
    d1, d2 = DRUGS[n1], DRUGS[n2]
    tan = tanimoto(fingerprint(d1), fingerprint(d2))
    fid = quantum_fidelity(d1, d2)
    ent = quantum_entanglement_probe(d1, d2)
    mod = 0.15 if d1["cls"] == d2["cls"] else (0.06 if d1["tgt"] == d2["tgt"] else 0.0)
    ent_delta = abs(ent - fid)       # high delta = entanglement deviation
    raw  = (tan * 0.45 + fid * 0.30 + mod + (1 - ent_delta) * 0.10) * 118
    score = round(min(raw, 100) * 10) / 10
    return {
        "n1": n1, "n2": n2,
        "score": score,
        "tanimoto": round(tan, 4),
        "quantum_fidelity": round(fid, 4),
        "entanglement_probe": round(ent, 4),
        "entanglement_delta": round(ent_delta, 4),
        "same_class": d1["cls"] == d2["cls"],
        "rule": get_rule(n1, n2),
        "status": get_status(score),
    }


# ════════════════════════════════════════════════════════════════════
# AGGREGATE MIXTURE SCORING
# ════════════════════════════════════════════════════════════════════
def aggregate_score(names: list[str]) -> dict:
    if len(names) < 2:
        return {}
    drugs = [DRUGS[n] for n in names]

    centroid = {k: sum(d[k] for d in drugs) / len(drugs)
                for k in ["mw","logp","hbd","hba","tpsa","rb"]}
    centroid.update(rings=0, arom=0, charge=0, cls="mix", tgt="mix", formula="", col="#aaa")

    centroid_fids = [quantum_fidelity(d, centroid) for d in drugs]
    mean_cfid = sum(centroid_fids) / len(centroid_fids)

    pair_data:  list[dict] = []
    pair_scores: list[float] = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            ps = pair_score(names[i], names[j])
            pair_scores.append(ps["score"])
            pair_data.append(ps)

    geo_mean  = math.prod(s / 100 for s in pair_scores) ** (1 / len(pair_scores)) * 100
    min_pair  = min(pair_scores)
    mean_ps   = sum(pair_scores) / len(pair_scores)
    variance  = sum((s - mean_ps) ** 2 for s in pair_scores) / len(pair_scores)
    var_pen   = min(variance / 500, 0.25)

    unique_cls = len({DRUGS[n]["cls"] for n in names})
    cls_bonus  = min((unique_cls - 1) * 2, 10)

    raw_agg   = geo_mean * (1 - var_pen) + cls_bonus + mean_cfid * 5
    aggregate = round(min(raw_agg, 100) * 10) / 10

    params = [("mw",(80,800)),("logp",(-8,8)),("hbd",(0,10)),
              ("hba",(0,14)),("tpsa",(0,300)),("rb",(0,18))]

    def coherence(key: str, rng: tuple) -> int:
        vals = [_angle(d[key], rng[0], rng[1]) for d in drugs]
        avg  = sum(vals) / len(vals)
        spread = sum((v - avg) ** 2 for v in vals) / len(vals)
        return round((1 - min(spread * 2, 1)) * 100)

    ang_diffs = [coherence(k, r) for k, r in params]

    return {
        "aggregate": aggregate,
        "geo_mean":  round(geo_mean, 1),
        "min_pair":  min_pair,
        "mean_centroid_fidelity": round(mean_cfid, 4),
        "variance_penalty_pct":   round(var_pen * 100),
        "class_bonus":   cls_bonus,
        "unique_classes": unique_cls,
        "pair_data": pair_data,
        "status":    get_status(aggregate),
        "components": {
            "MW Coherence":       ang_diffs[0],
            "LogP Coherence":     ang_diffs[1],
            "H-Bond Coherence":   round((ang_diffs[2] + ang_diffs[3]) / 2),
            "TPSA Coherence":     ang_diffs[4],
            "Flexibility":        ang_diffs[5],
            "Class Diversity":    min(cls_bonus * 10, 100),
        },
        "formula": (
            "S_agg = GeoMean(pairs) × (1 − σ²/500) + ClassBonus + CentroidFidelity×5\n"
            "|ψ_k⟩ = ⊗_i RY(θᵢ^k)|0⟩  θᵢ = π·(xᵢ−lo)/(hi−lo)\n"
            "F(d₁,d₂) = |⟨ψ₁|ψ₂⟩|² via Qiskit StatevectorSimulator (6 qubits)\n"
            "Entanglement probe: 6-qubit CNOT layer, compares sv_ent vs sv_ref\n"
            "Tanimoto fingerprint T = |A∩B|/|A∪B| over 40-feature extended set"
        ),
    }


# ════════════════════════════════════════════════════════════════════
# OPENAI AI ANALYSIS
# ════════════════════════════════════════════════════════════════════
def run_openai_analysis(names: list[str], agg: dict, api_key: str) -> dict:
    client = OpenAI(api_key=api_key)
    info = "\n".join(
        f"• {n}: {DRUGS[n]['cls']}, target={DRUGS[n]['tgt']}, "
        f"MW={DRUGS[n]['mw']}, LogP={DRUGS[n]['logp']}, "
        f"TPSA={DRUGS[n]['tpsa']}, HBD={DRUGS[n]['hbd']}"
        for n in names
    )
    pair_summary = "; ".join(
        f"{p['n1']}↔{p['n2']} score={p['score']} QF={p['quantum_fidelity']} "
        f"ent={p['entanglement_probe']}"
        for p in agg.get("pair_data", [])
    )
    prompt = (
        f"You are a clinical pharmacologist. Analyze this {len(names)}-drug combination.\n"
        f"\nDRUGS:\n{info}\n"
        f"\nQUANTUM AGGREGATE SCORE: {agg['aggregate']}/100 "
        f"(geo_mean={agg['geo_mean']}, min_pair={agg['min_pair']}, "
        f"centroid_fidelity={agg['mean_centroid_fidelity']})\n"
        f"PAIRWISE (Qiskit fidelity, entanglement probe): {pair_summary}\n"
        "\nRespond ONLY with valid JSON (no markdown, no extra text):\n"
        '{"interaction_type":"synergistic|antagonistic|neutral|potentiating|contraindicated",'
        '"mechanism":"3-sentence PK/PD mechanism",'
        '"clinical_risk":"low|moderate|high|critical",'
        '"risk_factors":["max 4"],'
        '"benefits":["max 3"],'
        '"recommendation":"1 precise sentence",'
        '"combination_verdict":"SAFE|CAUTION|AVOID",'
        '"monitoring_required":true,'
        '"monitoring_parameters":["list"],'
        '"pk_note":"1 pharmacokinetics sentence",'
        '"pd_note":"1 pharmacodynamics sentence",'
        '"special_populations":"elderly/pediatric/renal/hepatic notes"}'
    )

    resp = client.chat.completions.create(
        model="gpt-4o",
        temperature=0.15,
        max_tokens=1000,
        messages=[
            {"role": "system", "content": "Clinical pharmacologist. Respond with valid JSON only."},
            {"role": "user",   "content": prompt},
        ]
    )
    text = (resp.choices[0].message.content or "").replace("```json","").replace("```","").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"recommendation": text, "combination_verdict": "CAUTION", "clinical_risk": "unknown"}


# ════════════════════════════════════════════════════════════════════
# FLASK ROUTES
# ════════════════════════════════════════════════════════════════════


@app.route("/", methods=["GET"])
def index():
    """Serve the frontend index.html."""
    return send_from_directory(".", "index.html")


@app.route("/favicon.ico", methods=["GET"])
def favicon():
    """Empty favicon response to avoid 404 logs."""
    return "", 204


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "qiskit": "ready", "drug_count": len(DRUGS)})


@app.route("/api/drugs", methods=["GET"])
def get_drugs():
    return jsonify({"drugs": DRUGS, "count": len(DRUGS)})


@app.route("/api/quantum-score", methods=["POST"])
def quantum_score_endpoint():
    """
    Compute aggregate mixture score using Qiskit statevector simulation.
    Body JSON: { "drugs": ["Aspirin", "Ibuprofen", ...] }
    """
    body = request.get_json(force=True)
    names: list[str] = body.get("drugs", [])
    unknown = [n for n in names if n not in DRUGS]
    if unknown:
        return jsonify({"error": f"Unknown drugs: {unknown}"}), 400
    if len(names) < 2:
        return jsonify({"error": "Need at least 2 drugs"}), 400
    try:
        result = aggregate_score(names)
        return jsonify({"success": True, "result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pair-score", methods=["POST"])
def pair_score_endpoint():
    """
    Score a single drug pair.
    Body JSON: { "drug1": "Aspirin", "drug2": "Ibuprofen" }
    """
    body = request.get_json(force=True)
    n1, n2 = body.get("drug1",""), body.get("drug2","")
    if n1 not in DRUGS or n2 not in DRUGS:
        return jsonify({"error": "Unknown drug name(s)"}), 400
    try:
        return jsonify({"success": True, "result": pair_score(n1, n2)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai-analysis", methods=["POST"])
def ai_analysis_endpoint():
    """
    GPT-4o pharmacological analysis.
    Body JSON: { "drugs": [...], "aggregate": {...}, "openai_key": "sk-..." }
    """
    body    = request.get_json(force=True)
    names   = body.get("drugs", [])
    agg     = body.get("aggregate", {})
    api_key = body.get("openai_key") or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Missing openai_key"}), 400
    unknown = [n for n in names if n not in DRUGS]
    if unknown:
        return jsonify({"error": f"Unknown drugs: {unknown}"}), 400
    try:
        analysis = run_openai_analysis(names, agg, api_key)
        return jsonify({"success": True, "analysis": analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/evaluation_module.js")
def _de_js():
    return send_from_directory(".", "evaluation_module.js",
                               mimetype="application/javascript")
from evaluation import eval_bp
app.register_blueprint(eval_bp)
# ════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("+" + "="*50 + "+")
    print("|   Drug Affinity Analyzer - Python/Qiskit/OpenAI  |")
    print("+" + "="*50 + "+")
    print(f"|  {len(DRUGS)} drugs loaded  ·  Qiskit StatevectorSim       |")
    print("+" + "="*50 + "+")
    print("|  API Endpoints:                                   |")
    print("|    GET  /                                         |")
    print("|    GET  /api/health                               |")
    print("|    GET  /api/drugs                                |")
    print("|    POST /api/quantum-score                        |")
    print("|    POST /api/pair-score                           |")
    print("|    POST /api/ai-analysis                          |")
    print("+" + "="*50 + "+")
    print()
    app.run(host="0.0.0.0", port=5000, debug=True)
