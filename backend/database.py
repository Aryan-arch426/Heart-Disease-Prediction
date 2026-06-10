import sqlite3
from datetime import datetime

DB_PATH = "heart_disease.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS patient_records (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT    NOT NULL,
            timestamp    TEXT    NOT NULL,
            age REAL, sex REAL, cp REAL, trestbps REAL, chol REAL,
            fbs REAL, restecg REAL, thalach REAL, exang REAL,
            oldpeak REAL, slope REAL, ca REAL, thal REAL,
            probability  REAL,
            risk_level   TEXT,
            model_used   TEXT,
            notes        TEXT
        )
    """)
    conn.commit()
    conn.close()

def add_record(patient_name, inputs, probability, risk_level, model_used, notes=""):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO patient_records (
            patient_name, timestamp,
            age, sex, cp, trestbps, chol, fbs, restecg,
            thalach, exang, oldpeak, slope, ca, thal,
            probability, risk_level, model_used, notes
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        patient_name, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        inputs.get("age"),    inputs.get("sex"),     inputs.get("cp"),
        inputs.get("trestbps"), inputs.get("chol"),  inputs.get("fbs"),
        inputs.get("restecg"), inputs.get("thalach"), inputs.get("exang"),
        inputs.get("oldpeak"), inputs.get("slope"),  inputs.get("ca"),
        inputs.get("thal"),
        probability, risk_level, model_used, notes
    ))
    conn.commit()
    conn.close()

def get_all_records():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM patient_records ORDER BY timestamp DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_record(record_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM patient_records WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()

def get_patient_trends(patient_name):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT timestamp, probability, risk_level FROM patient_records "
        "WHERE patient_name = ? ORDER BY timestamp ASC",
        (patient_name,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
