# QuantumDrugAI: Drug Combination Evaluation & Therapeutic Suitability Prediction

QuantumDrugAI is an AI-assisted drug evaluation and decision-support system that combines **Quantum Computing (Qiskit)**, **Artificial Intelligence**, and **pharmacological analysis** to evaluate individual drugs and drug combinations.

The system predicts quantum affinity between selected drugs, evaluates important pharmaceutical properties, computes compatibility scores, and provides explainable AI recommendations through an interactive dashboard.

---

## Features

### Quantum Drug Affinity Analysis
- Quantum circuit simulation using Qiskit
- Pair-wise drug affinity calculation
- Aggregate affinity analysis
- Quantum state fidelity
- Entanglement-based interaction analysis
- AI-generated interaction explanation

---

### Individual Drug Evaluation
Each selected drug is evaluated for:

- Drug Quality
- Toxicity
- Solubility
- Bioavailability
- ADMET Properties
  - Absorption
  - Distribution
  - Metabolism
  - Excretion
  - Toxicity
- Confidence Score

Visualization includes:
- Progress bars
- Radar chart
- Risk indicators
- Scientific explanations

---

### Combination Drug Evaluation

The system evaluates the selected drug combination by calculating:

- Quantum Affinity
- Drug Compatibility Index (DCI)
- Combination Therapeutic Suitability Score (CTSS)
- Average Drug Quality
- Average Toxicity
- Average Solubility
- Average Bioavailability
- Average ADMET
- Confidence Score
- Risk Assessment

---

### Explainable AI

Generates human-readable interpretations including:

- Molecular compatibility
- Pharmacological compatibility
- Therapeutic suitability
- Final recommendation

---

### Interactive Dashboard

Modern pharmaceutical dashboard featuring:

- KPI Cards
- Drug Summary
- CTSS Gauge
- Radar Visualization
- Scientific Interpretation
- Explainable AI
- Methodology Workflow
- Recommended Next Steps

---

## Project Workflow

```
Drug Selection
        │
        ▼
Quantum Drug Affinity Analysis
        │
        ▼
Individual Drug Evaluation
        │
        ▼
Combination Drug Evaluation
        │
        ▼
Drug Compatibility Index (DCI)
        │
        ▼
Combination Therapeutic Suitability Score (CTSS)
        │
        ▼
Explainable AI
        │
        ▼
Interactive Dashboard
```

---

## Technologies Used

### Backend

- Python
- Flask
- Flask-CORS
- OpenAI API
- Qiskit

### Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js

### AI & Drug Evaluation

- Quantum Statevector Simulation
- Molecular Fingerprinting
- Drug Compatibility Index
- ADMET Evaluation
- Explainable AI

---

## Installation

Clone the repository

```bash
git clone https://github.com/UshaM0701/Drug-Combination-Evaluation-System.git
cd Drug-Combination-Evaluation-System
```

Create a virtual environment

```bash
python -m venv myenv
```

Activate the virtual environment

Windows

```bash
myenv\Scripts\activate
```

Linux/macOS

```bash
source myenv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

(Optional)

```bash
pip install -r requirements_eval.txt
```

Run the application

```bash
python backend.py
```

Open your browser

```
http://127.0.0.1:5000
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| / | GET | Home Page |
| /api/health | GET | Health Check |
| /api/drugs | GET | Drug Database |
| /api/quantum-score | POST | Quantum Affinity Analysis |
| /api/pair-score | POST | Pair-wise Drug Analysis |
| /api/ai-analysis | POST | AI Analysis |
| /api/evaluation | POST | Advanced Drug Evaluation |

---

## Input

Select two or more drugs from the available drug database.

Example:

- Aspirin
- Ibuprofen
- Metformin

---

## Output

The system provides:

- Quantum Affinity Score
- Pair-wise Analysis
- Drug Quality
- Solubility
- Toxicity
- Bioavailability
- ADMET Analysis
- Drug Compatibility Index (DCI)
- Combination Therapeutic Suitability Score (CTSS)
- Scientific Interpretation
- Explainable AI Recommendation

---

## Project Structure

```
Drug-Combination-Evaluation-System/
│
├── backend.py
├── evaluation.py
├── evaluation_module.js
├── index.html
├── requirements.txt
├── requirements_eval.txt
├── README.md
├── Procfile
└── .gitignore
```

---

## Future Enhancements

- Protein target integration
- Molecular docking
- Molecular dynamics simulation
- Clinical interaction database
- Deep learning-based toxicity prediction
- Drug recommendation engine
- PDF report generation
- Multi-user authentication

---

## Author

**Usha M**

Computer Science Engineering Student

GitHub:
https://github.com/UshaM0701

---

## Disclaimer

This project is intended for educational and research purposes only.

The generated predictions should not be used for clinical diagnosis, medical treatment, or pharmaceutical decision-making without appropriate experimental and clinical validation.

---

## License

This project is released under the MIT License.
