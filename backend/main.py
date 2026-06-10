import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import database

app = FastAPI(title="CardioRisk AI — Heart Disease Risk API")

# ── CORS ─────────────────────────────────────────────────────────────────────
# FRONTEND_URL is set as an environment variable on Render.
# Falls back to "*" for easy local development.
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
origins = ["*"] if FRONTEND_URL == "*" else [FRONTEND_URL, "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model ─────────────────────────────────────────────────────────────────────
MODEL_PATH = "model.pkl"
bundle: dict | None = None

def load_model():
    global bundle
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError("model.pkl not found — run: python model.py")
    bundle = joblib.load(MODEL_PATH)

@app.on_event("startup")
def startup():
    load_model()
    database.init_db()

# ── Schemas ───────────────────────────────────────────────────────────────────
class PatientInput(BaseModel):
    age: float;      sex: float;    cp: float
    trestbps: float; chol: float;   fbs: float
    restecg: float;  thalach: float; exang: float
    oldpeak: float;  slope: float;  ca: float;  thal: float
    patient_name: str = "Anonymous"
    notes: str = ""

class ChatRequest(BaseModel):
    message: str
    patient_data: dict
    probability: float
    risk_level: str

# ── Constants ─────────────────────────────────────────────────────────────────
FEATURE_NAMES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]

FEATURE_LABELS = {
    "age": "Age", "sex": "Sex", "cp": "Chest Pain Type",
    "trestbps": "Resting BP", "chol": "Cholesterol",
    "fbs": "Fasting Blood Sugar", "restecg": "Resting ECG",
    "thalach": "Max Heart Rate", "exang": "Exercise Angina",
    "oldpeak": "ST Depression", "slope": "ST Slope",
    "ca": "Major Vessels", "thal": "Thalassemia"
}

# ── Predict ───────────────────────────────────────────────────────────────────
@app.post("/predict")
def predict(patient: PatientInput):
    if bundle is None:
        raise HTTPException(503, "Model not loaded")

    model   = bundle["model"]
    scaler  = bundle["scaler"]
    medians = bundle["medians"]

    raw    = np.array([[getattr(patient, f) for f in FEATURE_NAMES]])
    scaled = scaler.transform(raw)

    prob = float(model.predict_proba(scaled)[0][1])
    pred = int(model.predict(scaled)[0])

    risk_level = "Low" if prob < 0.35 else ("Moderate" if prob < 0.65 else "High")

    # Local perturbation XAI
    features = []
    for i, feat in enumerate(FEATURE_NAMES):
        p = raw.copy()
        p[0][i] = medians[feat]
        diff = prob - float(model.predict_proba(scaler.transform(p))[0][1])
        direction = "risk" if diff > 0.005 else ("protective" if diff < -0.005 else "neutral")
        features.append({
            "feature": FEATURE_LABELS[feat], "key": feat,
            "value": float(raw[0][i]), "median": float(medians[feat]),
            "shap_value": round(diff * 100, 1), "direction": direction
        })
    features.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    # Persist
    database.add_record(
        patient_name=patient.patient_name,
        inputs={f: getattr(patient, f) for f in FEATURE_NAMES},
        probability=round(prob * 100, 1),
        risk_level=risk_level,
        model_used="RandomForest",
        notes=patient.notes
    )

    return {
        "risk_level": risk_level,
        "probability": round(prob * 100, 1),
        "prediction": pred,
        "top_features": features[:5],
        "all_features": features,
    }

# ── Patient Records ───────────────────────────────────────────────────────────
@app.get("/records")
def get_records():
    return database.get_all_records()

@app.delete("/records/{record_id}")
def delete_record(record_id: int):
    database.delete_record(record_id)
    return {"status": "success"}

@app.get("/trends/{patient_name}")
def get_trends(patient_name: str):
    return database.get_patient_trends(patient_name)

# ── AI Doctor Chat ────────────────────────────────────────────────────────────
@app.post("/chat")
def chat(req: ChatRequest):
    msg  = req.message.lower()
    prob = req.probability
    risk = req.risk_level
    d    = req.patient_data

    chol     = d.get("chol", 200)
    trestbps = d.get("trestbps", 120)
    thalach  = d.get("thalach", 150)
    cp       = d.get("cp", 1)
    ca       = d.get("ca", 0)
    oldpeak  = d.get("oldpeak", 0)

    factors, protective = [], []
    if chol > 240:     factors.append(f"high cholesterol ({int(chol)} mg/dL)")
    elif chol < 180:   protective.append(f"healthy cholesterol ({int(chol)} mg/dL)")
    if trestbps > 140: factors.append(f"elevated BP ({int(trestbps)} mmHg)")
    if oldpeak > 1.5:  factors.append(f"significant ST depression ({oldpeak} mm)")
    if ca > 0:         factors.append(f"calcification in {int(ca)} vessel(s)")
    if cp == 4:        factors.append("asymptomatic chest pain (statistically high-risk)")
    if thalach < 120:  factors.append(f"low max heart rate ({int(thalach)} bpm)")
    elif thalach > 160: protective.append(f"excellent cardiac capacity ({int(thalach)} bpm)")

    fs = ", ".join(factors)    or "several abnormal clinical values"
    ps = ", ".join(protective) or "no notable protective factors"

    if any(k in msg for k in ["why", "reason", "cause", "factor", "explain", "contribut"]):
        if risk == "High":
            r = f"The risk is **HIGH** ({prob}%). Primary drivers: {fs}. Immediate cardiology consultation is strongly advised."
        elif risk == "Moderate":
            r = f"The risk is **MODERATE** ({prob}%). Concerns: {fs}. Protective elements: {ps}. Preventive lifestyle changes are recommended."
        else:
            r = f"The risk is **LOW** ({prob}%). Healthy indicators: {ps}. Maintain regular screenings and a heart-healthy lifestyle."

    elif any(k in msg for k in ["cholesterol", "chol"]):
        r = (f"Cholesterol: **{int(chol)} mg/dL** (healthy: <200). " +
             ("High cholesterol causes arterial plaque. Reduce saturated fats, increase fibre, add omega-3s, exercise regularly." if chol > 200
              else "Good — maintain a low-fat, fibre-rich diet."))

    elif any(k in msg for k in ["bp", "blood pressure", "pressure"]):
        r = (f"Resting BP: **{int(trestbps)} mmHg** (healthy: <120). " +
             ("Elevated BP strains the heart. Reduce sodium (<2g/day), follow DASH diet, manage stress, do regular cardio." if trestbps > 130
              else "Healthy range. Continue annual monitoring."))

    elif any(k in msg for k in ["chest pain", "angina", "cp"]):
        r = ("Asymptomatic chest pain (Type 4) is high-risk as silent ischemia often goes undetected. Regular ECG and vascular checks are essential."
             if cp == 4 else
             f"Chest pain type {int(cp)} may indicate transient ischemia. Seek consultation if you experience tightness during exertion.")

    elif any(k in msg for k in ["recommend", "prevent", "lower", "diet", "lifestyle", "do"]):
        r = ("Key cardioprotective strategies:\n\n"
             "1. **Nutrition** — Mediterranean diet: vegetables, whole grains, nuts, fish. Limit sodium, refined sugars, saturated fats.\n"
             "2. **Exercise** — 150+ min/week aerobic activity + 2× strength training.\n"
             "3. **Weight** — Maintain BMI 18.5–24.9.\n"
             "4. **No smoking** — Tobacco immediately damages arterial walls.\n"
             "5. **Stress** — Chronic stress raises BP. Practice mindfulness or breathing exercises.")

    elif any(k in msg for k in ["hello", "hi", "hey", "who are you", "assistant"]):
        r = ("Hello! I'm your **AI Doctor Assistant**. I've analysed the patient's risk profile. Ask me:\n"
             "- *'Why is my risk level high?'*\n"
             "- *'How can I lower my cholesterol?'*\n"
             "- *'What lifestyle changes should I make?'*")
    else:
        r = (f"Predicted risk: **{risk}** ({prob}%). Key factors: {fs}. "
             "Ask me to explain any specific parameter or for general cardiac health advice.\n\n"
             "*Educational use only — not a substitute for clinical diagnosis.*")

    return {"response": r}

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": bundle is not None}
