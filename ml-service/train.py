import csv
import json
import joblib
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix

DATASET_PATH = "dataset/stomach_symptoms_dataset.csv"

def load_data():
    with open(DATASET_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        features = [col for col in fieldnames if col != "disease"]
        
        X = []
        y = []
        for row in reader:
            X.append([int(row[col]) for col in features])
            y.append(row["disease"])
            
    return np.array(X), np.array(y), features

def main():
    print("==========================================")
    print("STOMACH HEALTH ML MODEL TRAINING & EVALUATION")
    print("==========================================\n")
    
    X, y, features = load_data()
    classes = sorted(list(set(y)))
    print(f"Total samples: {len(X)}")
    print(f"Features ({len(features)}): {features}")
    print(f"Target conditions ({len(classes)}): {classes}\n")
    
    # 80-20 Train-Test Split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train size: {len(X_train)} | Test size: {len(X_test)}\n")
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42)
    }
    
    results = {}
    
    for name, clf in models.items():
        print(f"--- Training {name} ---")
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_test)
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
        rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
        f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        
        results[name] = {
            "model": clf,
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "report": classification_report(y_test, y_pred, zero_division=0),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }
        
        print(f"Accuracy:  {acc:.4f}")
        print(f"Precision: {prec:.4f}")
        print(f"Recall:    {rec:.4f}")
        print(f"F1-Score:  {f1:.4f}\n")
    
    # Choose best model based on F1-Score
    best_name = max(results, key=lambda k: results[k]["f1_score"])
    best_info = results[best_name]
    print(f"[*] SELECTED BEST MODEL: {best_name} with F1-Score: {best_info['f1_score']:.4f}\n")
    print("Detailed Classification Report for Best Model:")
    print(best_info["report"])
    
    # Save model and metadata using joblib
    save_payload = {
        "model_name": best_name,
        "model": best_info["model"],
        "features": features,
        "classes": list(best_info["model"].classes_),
        "metrics": {
            "accuracy": round(best_info["accuracy"], 4),
            "precision": round(best_info["precision"], 4),
            "recall": round(best_info["recall"], 4),
            "f1_score": round(best_info["f1_score"], 4)
        }
    }
    
    model_output_path = "models/stomach_model.joblib"
    joblib.dump(save_payload, model_output_path)
    print(f"[OK] Saved final trained model package to {model_output_path}")
    
    # Also save JSON metadata for easy reference
    meta_output_path = "models/model_metadata.json"
    with open(meta_output_path, "w", encoding="utf-8") as f:
        json.dump({
            "model_name": best_name,
            "features": features,
            "classes": list(best_info["model"].classes_),
            "metrics": save_payload["metrics"],
            "confusion_matrix": best_info["confusion_matrix"]
        }, f, indent=2)
    print(f"[OK] Saved model metadata to {meta_output_path}")

if __name__ == "__main__":
    main()
