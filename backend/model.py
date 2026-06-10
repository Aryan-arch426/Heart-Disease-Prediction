import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, classification_report
)
import joblib
import os

FEATURE_NAMES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]

def download_and_prepare_data():
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
    cols = FEATURE_NAMES + ["target"]
    df = pd.read_csv(url, header=None, names=cols, na_values="?")
    df.dropna(inplace=True)
    df["target"] = (df["target"] > 0).astype(int)
    return df[FEATURE_NAMES], df["target"]

def train_and_save():
    print("Downloading UCI Heart Disease dataset...")
    X, y = download_and_prepare_data()
    print(f"Dataset loaded: {len(X)} rows, {len(FEATURE_NAMES)} features")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    medians = X_train.median().to_dict()

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    print("Training Random Forest...")
    model = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    print("\n--- Evaluation ---")
    print(f"Accuracy : {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred):.4f}")
    print(f"Recall   : {recall_score(y_test, y_pred):.4f}")
    print(f"F1 Score : {f1_score(y_test, y_pred):.4f}")
    print(f"ROC-AUC  : {roc_auc_score(y_test, y_prob):.4f}")
    print(classification_report(y_test, y_pred))

    joblib.dump({
        "model":    model,
        "scaler":   scaler,
        "features": FEATURE_NAMES,
        "medians":  medians
    }, "model.pkl")
    print("model.pkl saved.")

if __name__ == "__main__":
    train_and_save()
