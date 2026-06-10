# CardioRisk AI — Heart Disease Risk Predictor

An AI-powered clinical risk prediction system using the UCI Heart Disease dataset. Predict cardiovascular disease risk from 13 clinical parameters, with Explainable AI (XAI), patient history tracking, and an AI Doctor chatbot.

---

## Project Structure

```
heart-disease-predictor/
├── .gitignore
├── README.md
├── backend/                    ← FastAPI + ML (deployed on Render)
│   ├── main.py                 # REST API (/predict, /records, /trends, /chat)
│   ├── model.py                # Train & save Random Forest model
│   ├── database.py             # SQLite patient record helpers
│   ├── requirements.txt
│   ├── render.yaml             # Render deployment config
│   └── .gitignore
└── frontend/                   ← React + Vite (deployed on Vercel)
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── vercel.json             # Vercel SPA routing
    ├── .gitignore
    └── src/
        ├── main.jsx
        ├── App.jsx             # Full UI (Predictor + History tabs)
        └── App.css
```

---

## Local Development

### 1 — Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Train the model (downloads UCI dataset automatically)
python model.py

# Start API server
python -m uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

### 2 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API calls to localhost:8000)
npm run dev
```

App available at `http://localhost:5173`

---

## Deployment

### Backend → Render

1. Push this repository to GitHub.
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo.
3. Set **Root Directory** to `backend`.
4. Render will auto-detect `render.yaml`. Confirm:
   - **Build Command**: `pip install -r requirements.txt && python model.py`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. After deploy, note your Render URL (e.g. `https://cardiorisk-api.onrender.com`).

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite**.
4. Add an **Environment Variable**:
   - `VITE_API_URL` = `https://cardiorisk-api.onrender.com` ← your Render URL
5. Deploy.

### Final Step — Update CORS

In `backend/render.yaml`, update `FRONTEND_URL` with your Vercel URL:
```yaml
- key: FRONTEND_URL
  value: https://your-app.vercel.app
```
Or set it in the Render dashboard under **Environment Variables** and redeploy.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/predict` | Run risk prediction + save to DB |
| `GET`  | `/records` | Fetch all patient records |
| `DELETE` | `/records/{id}` | Delete a patient record |
| `GET`  | `/trends/{name}` | Patient risk trend history |
| `POST` | `/chat` | AI Doctor chatbot |
| `GET`  | `/health` | Health check |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | Random Forest (scikit-learn) |
| XAI | Local Perturbation Sensitivity |
| Backend | FastAPI + Uvicorn |
| Database | SQLite |
| Frontend | React 18 + Vite + Recharts |
| Backend Host | Render (Free Tier) |
| Frontend Host | Vercel |

> **⚠️ Disclaimer**: For educational and research purposes only. Not a substitute for professional medical advice.
