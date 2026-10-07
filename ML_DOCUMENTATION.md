# Machine Learning Documentation: Stomach Health Assistant

## 1. Overview & Goal
The **Stomach Health Assistant** is an intelligent symptom triage and educational guidance feature built into the Healthcare Management platform. It enables patients to input digestive tract symptoms and receive:
- Most likely gastrointestinal condition match based on a trained Machine Learning model.
- Model confidence and multi-class probability distribution across all supported conditions.
- Structured self-care and lifestyle guidance.
- Advice on when to consult a medical doctor.
- Safety-first red-flag screening (prioritized before machine learning inference).
- Seamless link to find and book recommended doctors (specifically Gastroenterologists or General Physicians).

> **IMPORTANT MEDICAL NOTICE:**
> This tool provides general health information and is **NOT a medical diagnosis**. Users must consult a qualified healthcare professional for medical diagnosis and clinical treatment.

---

## 2. ML System Architecture
```
Patient (UI: /patient/stomach-health)
    │
    ▼ (POST { symptoms, redFlags, duration, severity })
Next.js API Layer (/api/stomach/analyze)
    │
    ├── 1. Red-Flag Safety Check (Severe pain, hematemesis, melena, etc.)
    │       └─ If red flag detected: Returns priority Emergency Warning immediately
    │
    ▼ 2. Forward to Python FastAPI Service (http://127.0.0.1:8000/predict)
FastAPI ML Service (ml-service/app.py)
    │
    ▼ Feature Vector Construction (18 binary symptom features)
Trained ML Classifier (Logistic Regression, serialized via joblib)
    │
    ▼ Output: Top prediction + probability distribution
Next.js API Layer
    │
    ▼ 3. Enriches output with condition description, lifestyle guidance & suggested specialty
    │
    ▼ 4. Logs audit entry to SQLite database (SymptomAnalysis model via Prisma)
Patient UI Result View
    │
    └─ "Find Recommended Doctor" ➔ /patient/doctors/nearby?specialty=Gastroenterologist
```

---

## 3. Dataset Documentation
- **Source:** Clinical gastrointestinal symptom presentation mapping derived from established digestive disease criteria (ACG, Rome IV, and clinical symptom prevalence literature).
- **File:** `ml-service/dataset/stomach_symptoms_dataset.csv`
- **Total Samples:** 700 samples (stratified 100 cases per target class).
- **Target Classes (7):**
  1. `GERD` (Gastroesophageal Reflux Disease)
  2. `Peptic Ulcer Disease`
  3. `Gastritis`
  4. `Gastroenteritis` (Stomach Infection / Flu)
  5. `Irritable Bowel Syndrome` (IBS)
  6. `Constipation`
  7. `Food Poisoning`
- **Features (18 Binary Attributes):**
  - Upper GI: `heartburn`, `acid_reflux`, `stomach_burning`, `indigestion`, `bloating`, `belching`, `early_satiety`, `nausea`, `vomiting`
  - Lower GI: `abdominal_pain`, `cramping`, `gas`, `diarrhea`, `watery_stool`, `constipation`, `hard_stool`
  - Systemic: `loss_of_appetite`, `fever`

---

## 4. Model Training & Evaluation
We evaluated three supervised machine learning algorithms using an 80/20 stratified train/test split (560 training samples, 140 testing samples):

| Model | Accuracy | Precision (Weighted) | Recall (Weighted) | F1-Score (Weighted) |
| :--- | :---: | :---: | :---: | :---: |
| **Logistic Regression (Selected)** | **87.86%** | **89.87%** | **87.86%** | **87.52%** |
| Random Forest Classifier | 86.43% | 88.06% | 86.43% | 86.32% |
| Decision Tree Classifier | 77.86% | 79.54% | 77.86% | 77.83% |

### Detailed Classification Report (Logistic Regression):
```
                          precision    recall  f1-score   support
            Constipation       0.90      0.95      0.93        20
          Food Poisoning       0.86      0.95      0.90        20
                    GERD       0.95      1.00      0.98        20
               Gastritis       1.00      0.55      0.71        20
         Gastroenteritis       0.94      0.85      0.89        20
Irritable Bowel Syndrome       0.95      0.90      0.92        20
    Peptic Ulcer Disease       0.68      0.95      0.79        20

                accuracy                           0.88       140
               macro avg       0.90      0.88      0.88       140
            weighted avg       0.90      0.88      0.88       140
```
- **Serialization:** Saved to `ml-service/models/stomach_model.joblib` alongside feature names, class labels, and metadata.

---

## 5. Running the Python ML Microservice
### Prerequisites
- Python 3.10+
- Port 8000 available

### Steps:
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```
Or with Uvicorn CLI:
```bash
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

### Endpoints:
- `GET /health`: Health check and model metadata.
- `GET /features`: Lists all 18 supported symptom tokens and 7 condition classes.
- `POST /predict`:
  ```json
  {
    "symptoms": ["heartburn", "acid_reflux", "indigestion"],
    "duration": "1-2 days",
    "severity": "mild"
  }
  ```

---

## 6. Red-Flag Safety Layer
The system scans for critical warning signs before running or presenting ML predictions:
- Blood in vomit (hematemesis)
- Black, tarry stool (melena)
- Sudden, severe, unbearable abdominal pain
- Inability to keep liquids down for > 24 hours
- Chest pain radiating to arms/jaw or shortness of breath
- Fainting, severe dizziness, or confusion

When any red flag is active, the system bypasses diagnostic probabilities and displays a high-priority alert prompting the patient to call emergency services or visit an emergency room immediately.

---

## 7. Known Limitations
1. **Not a Clinical Device:** Does not measure physical exam findings, vital signs, endoscopy results, or laboratory tests.
2. **Symptom Overlap:** Functional dyspepsia, gastritis, and peptic ulcer disease have overlapping presentations; clinical differentiation requires endoscopy or H. pylori testing.
3. **Emergency Care:** Must never be relied upon in critical emergencies.
