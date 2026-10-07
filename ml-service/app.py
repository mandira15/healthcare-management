import os
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# Load serialized model package
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "stomach_model.joblib")
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Trained model not found at {MODEL_PATH}. Run train.py first.")

payload = joblib.load(MODEL_PATH)
model = payload["model"]
features = payload["features"]
classes = payload["classes"]
metrics = payload.get("metrics", {})
model_name = payload.get("model_name", "ML Classifier")

app = FastAPI(
    title="Stomach Health ML Inference Service",
    description="Dedicated Machine Learning prediction microservice for stomach & digestive health triage.",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of recognized symptom tokens")
    duration: Optional[str] = Field(None, description="Reported duration of symptoms")
    severity: Optional[str] = Field(None, description="Severity: mild, moderate, severe")

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    probabilities: Dict[str, float]
    model_name: str
    feature_count: int
    matched_symptoms: List[str]

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "stomach-health-ml",
        "model_name": model_name,
        "features_supported": len(features),
        "classes": classes,
        "metrics": metrics
    }

@app.get("/features")
def get_features():
    return {
        "features": features,
        "classes": classes
    }

@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    if not req.symptoms:
        raise HTTPException(status_code=400, detail="At least one symptom must be provided.")

    # Normalize symptoms input (lowercase, replace spaces/hyphens with underscore)
    normalized_input = [s.strip().lower().replace(" ", "_").replace("-", "_") for s in req.symptoms]
    
    # Construct binary feature vector
    x_vec = np.zeros(len(features), dtype=int)
    matched = []
    
    for idx, feat in enumerate(features):
        if feat in normalized_input:
            x_vec[idx] = 1
            matched.append(feat)

    if sum(x_vec) == 0:
        raise HTTPException(
            status_code=400, 
            detail="None of the submitted symptoms match recognized features in the stomach model."
        )

    # Predict using trained classifier
    x_2d = x_vec.reshape(1, -1)
    probabilities_raw = model.predict_proba(x_2d)[0]
    
    prob_dict = {
        cls_name: round(float(prob), 4)
        for cls_name, prob in zip(classes, probabilities_raw)
    }
    
    # Sort probabilities descending
    sorted_probs = dict(sorted(prob_dict.items(), key=lambda item: item[1], reverse=True))
    
    top_prediction = max(prob_dict, key=prob_dict.get)
    confidence = prob_dict[top_prediction]

    return PredictionResponse(
        prediction=top_prediction,
        confidence=confidence,
        probabilities=sorted_probs,
        model_name=model_name,
        feature_count=len(features),
        matched_symptoms=matched
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
