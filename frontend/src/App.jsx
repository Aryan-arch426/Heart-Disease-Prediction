import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";

// ── API base URL ──────────────────────────────────────────────────────────────
// In development Vite proxies the calls (see vite.config.js).
// In production on Vercel, set VITE_API_URL to your Render backend URL,
// e.g. https://cardiorisk-api.onrender.com
const API = import.meta.env.VITE_API_URL || "";

// ── Static config ─────────────────────────────────────────────────────────────
const INITIAL = {
  patient_name: "", notes: "",
  age: 54, sex: 1, cp: 4, trestbps: 130, chol: 240,
  fbs: 0, restecg: 0, thalach: 150, exang: 0,
  oldpeak: 1.0, slope: 2, ca: 0, thal: 3,
};

const FIELDS = [
  { key:"age",      label:"Age",                             type:"slider", min:20,  max:80,  step:1,   unit:"yrs"   },
  { key:"sex",      label:"Sex",                             type:"select", options:[{v:1,l:"Male"},{v:0,l:"Female"}] },
  { key:"cp",       label:"Chest Pain Type",                 type:"select", options:[
      {v:1,l:"Typical Angina"},{v:2,l:"Atypical Angina"},{v:3,l:"Non-anginal Pain"},{v:4,l:"Asymptomatic"}] },
  { key:"trestbps", label:"Resting Blood Pressure",          type:"slider", min:80,  max:200, step:1,   unit:"mmHg"  },
  { key:"chol",     label:"Cholesterol",                     type:"slider", min:100, max:600, step:1,   unit:"mg/dL" },
  { key:"fbs",      label:"Fasting Blood Sugar > 120 mg/dL",type:"select", options:[{v:0,l:"No"},{v:1,l:"Yes"}] },
  { key:"restecg",  label:"Resting ECG",                     type:"select", options:[
      {v:0,l:"Normal"},{v:1,l:"ST-T Abnormality"},{v:2,l:"LV Hypertrophy"}] },
  { key:"thalach",  label:"Max Heart Rate",                  type:"slider", min:60,  max:220, step:1,   unit:"bpm"   },
  { key:"exang",    label:"Exercise Induced Angina",         type:"select", options:[{v:0,l:"No"},{v:1,l:"Yes"}] },
  { key:"oldpeak",  label:"ST Depression (Oldpeak)",         type:"slider", min:0,   max:6.2, step:0.1, unit:""      },
  { key:"slope",    label:"ST Slope",                        type:"select", options:[
      {v:1,l:"Upsloping"},{v:2,l:"Flat"},{v:3,l:"Downsloping"}] },
  { key:"ca",       label:"Major Vessels (0–3)",             type:"slider", min:0,   max:3,   step:1,   unit:""      },
  { key:"thal",     label:"Thalassemia",                     type:"select", options:[
      {v:3,l:"Normal"},{v:6,l:"Fixed Defect"},{v:7,l:"Reversible Defect"}] },
];

const RISK = {
  Low:      { color:"#10b981", bg:"rgba(16,185,129,.08)",  border:"#a7f3d0", icon:"✓" },
  Moderate: { color:"#f59e0b", bg:"rgba(245,158,11,.08)",  border:"#fde68a", icon:"⚠" },
  High:     { color:"#ef4444", bg:"rgba(239,68,68,.08)",   border:"#fecaca", icon:"✕" },
};

const RECS = {
  Low: [
    "Maintain your current healthy lifestyle.",
    "Continue regular aerobic exercise (150+ min/week).",
    "Keep cholesterol and BP in check with annual check-ups.",
    "Eat a heart-healthy diet rich in fruits, vegetables, and whole grains.",
  ],
  Moderate: [
    "Consult your physician for a full cardiovascular evaluation.",
    "Aim to reduce cholesterol through diet and, if needed, medication.",
    "Increase physical activity and reduce saturated fat intake.",
    "Monitor blood pressure regularly and manage stress.",
    "Quit smoking if applicable.",
  ],
  High: [
    "Seek immediate medical evaluation — do not delay.",
    "Share these results with your cardiologist.",
    "Medication review and possible stress test may be required.",
    "Strict dietary changes: reduce sodium, saturated fats, and processed food.",
    "Enroll in a supervised cardiac rehabilitation programme.",
  ],
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState("predictor");
  const [theme,  setTheme]  = useState("light");
  const [inputs, setInputs] = useState(INITIAL);

  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg,  setChatMsg]  = useState("");
  const [chatLog,  setChatLog]  = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef(null);

  const [records,  setRecords]  = useState([]);
  const [search,   setSearch]   = useState("");
  const [selPt,    setSelPt]    = useState("");
  const [trendData, setTrendData] = useState([]);

  useEffect(() => { fetchRecords(); }, []);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [chatLog, chatBusy]);

  const fetchRecords = async () => {
    try { const r = await fetch(`${API}/records`); if (r.ok) setRecords(await r.json()); } catch {}
  };

  const deleteRecord = async (id) => {
    if (!confirm("Delete this record?")) return;
    await fetch(`${API}/records/${id}`, { method:"DELETE" });
    fetchRecords();
    if (selPt) fetchTrend(selPt);
  };

  const fetchTrend = async (name) => {
    if (!name) return;
    try {
      const r = await fetch(`${API}/trends/${encodeURIComponent(name)}`);
      if (r.ok) { setTrendData(await r.json()); setSelPt(name); }
    } catch {}
  };

  const set = (key, val) =>
    setInputs(p => ({ ...p, [key]: key==="patient_name"||key==="notes" ? val : parseFloat(val) }));

  const submitPredict = async () => {
    setLoading(true); setError(null); setResult(null); setChatLog([]);
    try {
      const res = await fetch(`${API}/predict`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...inputs, patient_name: inputs.patient_name.trim()||"Anonymous" }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
      setChatLog([{ s:"bot", t:`Hello! I've analysed the clinical data. The assessed risk is **${data.risk_level}** (${data.probability}%). Ask me why the risk is high or low, or what lifestyle changes are recommended.` }]);
      fetchRecords();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const sendChat = async (e) => {
    e?.preventDefault();
    if (!chatMsg.trim() || chatBusy || !result) return;
    const txt = chatMsg; setChatMsg("");
    setChatLog(p => [...p, { s:"user", t:txt }]);
    setChatBusy(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:txt, patient_data:inputs, probability:result.probability, risk_level:result.risk_level }),
      });
      const d = await res.json();
      setChatLog(p => [...p, { s:"bot", t:d.response }]);
    } catch { setChatLog(p => [...p, { s:"bot", t:"Sorry, I couldn't respond. Please try again." }]); }
    finally { setChatBusy(false); }
  };

  const rCfg = result ? RISK[result.risk_level] : null;
  const filtered = records.filter(r => r.patient_name.toLowerCase().includes(search.toLowerCase()));
  const names    = [...new Set(records.map(r => r.patient_name))].filter(Boolean);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="logo-section">
            <span className="logo-icon">♥</span>
            <span className="logo-text">CardioRisk<span className="logo-accent">AI</span></span>
          </div>
          <div className="nav-tabs">
            <button className={`tab-btn ${tab==="predictor"?"active":""}`} onClick={() => setTab("predictor")}>
              Diagnostic Predictor
            </button>
            <button className={`tab-btn ${tab==="history"?"active":""}`} onClick={() => { setTab("history"); fetchRecords(); }}>
              Patient History & Trends
            </button>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(t => t==="light"?"dark":"light")}>
            {theme==="light" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>
      </header>

      <main className="main">

        {/* ═══ TAB 1: PREDICTOR ═══ */}
        {tab === "predictor" && (
          <div className="layout">

            {/* Input Panel */}
            <section className="panel inputs-panel">
              <h2 className="panel-title">Clinical Diagnostics Calculator</h2>
              <p className="panel-desc">Enter 13 UCI parameters to generate an AI-powered risk assessment.</p>

              <div className="meta-fields">
                <div className="field">
                  <label className="field-label">Patient Name or ID</label>
                  <input className="text-input" type="text" placeholder="e.g. John Doe"
                    value={inputs.patient_name} onChange={e => set("patient_name", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Clinical Notes (optional)</label>
                  <input className="text-input" type="text" placeholder="e.g. history of diabetes"
                    value={inputs.notes} onChange={e => set("notes", e.target.value)} />
                </div>
              </div>

              <div className="divider" />

              <div className="fields">
                {FIELDS.map(f => (
                  <div key={f.key} className="field">
                    <label className="field-label">
                      {f.label}
                      {f.type==="slider" && (
                        <span className="field-value">
                          {f.step < 1 ? inputs[f.key].toFixed(1) : inputs[f.key]}{f.unit && ` ${f.unit}`}
                        </span>
                      )}
                    </label>
                    {f.type==="slider" ? (
                      <div className="slider-wrap">
                        <span className="slider-bound">{f.min}</span>
                        <input type="range" min={f.min} max={f.max} step={f.step}
                          value={inputs[f.key]} onChange={e => set(f.key, e.target.value)} className="slider" />
                        <span className="slider-bound">{f.max}</span>
                      </div>
                    ) : (
                      <select value={inputs[f.key]} onChange={e => set(f.key, e.target.value)} className="select">
                        {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <button className={`predict-btn${loading?" loading":""}`} onClick={submitPredict} disabled={loading}>
                {loading ? <><span className="spinner"/> Analysing...</> : <><span>♥</span> Analyse & Predict Risk</>}
              </button>

              {error && (
                <div className="error-box">
                  <strong>Error:</strong> {error}
                  <p className="error-hint">Ensure the backend API server is running.</p>
                </div>
              )}
            </section>

            {/* Results Panel */}
            <section className="panel results-panel">
              {!result ? (
                <div className="empty-state">
                  <div className="empty-icon">🩺</div>
                  <h3>Awaiting Clinical Data</h3>
                  <p>Submit the patient's parameters to generate a risk assessment.</p>
                </div>
              ) : (
                <div className="results-wrapper">
                  <h3 className="results-heading">Risk Analysis Report</h3>

                  {/* Risk Badge */}
                  <div className="risk-card" style={{ background:rCfg.bg, borderColor:rCfg.border }}>
                    <div className="risk-icon" style={{ color:rCfg.color }}>{rCfg.icon}</div>
                    <div>
                      <div className="risk-label">Diagnostic Output</div>
                      <div className="risk-level" style={{ color:rCfg.color }}>{result.risk_level} Risk</div>
                    </div>
                    <div className="risk-prob" style={{ color:rCfg.color }}>
                      {result.probability}%
                      <div className="risk-prob-label">probability</div>
                    </div>
                  </div>

                  {/* Probability bar */}
                  <div className="prob-bar-wrap">
                    <div className="prob-bar-track">
                      <div className="prob-bar-fill" style={{ width:`${result.probability}%`, background:rCfg.color }} />
                      <div className="prob-bar-markers">
                        <span className="marker" style={{ left:"35%" }} />
                        <span className="marker" style={{ left:"65%" }} />
                      </div>
                    </div>
                    <div className="prob-bar-labels">
                      <span style={{ color:"#10b981" }}>Low (&lt;35%)</span>
                      <span style={{ color:"#f59e0b" }}>Moderate</span>
                      <span style={{ color:"#ef4444" }}>High (&gt;65%)</span>
                    </div>
                  </div>

                  {/* XAI Chart */}
                  <div className="section">
                    <h3 className="section-title">Explainable AI — Feature Risk Contribution</h3>
                    <p className="xai-desc">% shift in risk when each parameter is set to the dataset median.</p>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={result.top_features.map(f=>({name:f.feature,value:f.shap_value,dir:f.direction}))}
                        layout="vertical" margin={{ left:8, right:36, top:4, bottom:4 }}>
                        <XAxis type="number" domain={["auto","auto"]} tick={{ fontSize:11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize:11 }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v,_,p)=>[`${v>0?"+":""}${v}% risk shift`,p.payload.name]} contentStyle={{ fontSize:12, borderRadius:8 }} />
                        <Bar dataKey="value" radius={4} label={{ position:"right", fontSize:10, formatter:v=>v>0?`+${v}%`:`${v}%` }}>
                          {result.top_features.map((f,i)=>(
                            <Cell key={i} fill={f.direction==="risk"?"#ef4444":"#10b981"} fillOpacity={0.85}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="legend">
                      <span className="legend-dot" style={{ background:"#ef4444" }}/> Adds risk &nbsp;
                      <span className="legend-dot" style={{ background:"#10b981" }}/> Protective factor
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="section">
                    <h3 className="section-title">Clinical Recommendations</h3>
                    <ul className="recs">
                      {RECS[result.risk_level].map((r,i)=>(
                        <li key={i} className="rec-item">
                          <span className="rec-dot" style={{ background:rCfg.color }}/>{r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="disclaimer">
                    ⚠️ This tool is for educational and research purposes only. It does not constitute medical advice.
                    Always consult a qualified healthcare professional.
                  </p>

                  <div className="divider"/>

                  {/* AI Chat */}
                  <div className="chatbot-container">
                    <button className="chat-toggle-btn" onClick={() => setChatOpen(o=>!o)}>
                      {chatOpen ? "✕ Close AI Assistant" : "💬 Open AI Doctor Assistant"}
                    </button>
                    {chatOpen && (
                      <div className="chat-card">
                        <div className="chat-header">
                          <span className="chat-header-title"><span className="pulse-dot"/> AI Cardiologist Assistant</span>
                          <span className="chat-header-sub">Ask about this assessment</span>
                        </div>
                        <div className="chat-log">
                          {chatLog.map((m,i)=>(
                            <div key={i} className={`chat-bubble-wrap ${m.s}`}>
                              <div className="chat-sender">{m.s==="bot"?"🧑‍⚕️ AI Specialist":"Clinician"}</div>
                              <div className="chat-bubble">{m.t}</div>
                            </div>
                          ))}
                          {chatBusy && (
                            <div className="chat-bubble-wrap bot">
                              <div className="chat-sender">🧑‍⚕️ AI Specialist</div>
                              <div className="chat-bubble typing">
                                <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
                              </div>
                            </div>
                          )}
                          <div ref={chatEnd}/>
                        </div>
                        <form className="chat-input-bar" onSubmit={sendChat}>
                          <input className="chat-text-input" type="text"
                            placeholder="e.g. Why is my risk high? How to lower cholesterol?"
                            value={chatMsg} onChange={e=>setChatMsg(e.target.value)} />
                          <button type="submit" className="chat-send-btn" disabled={chatBusy}>Send</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ═══ TAB 2: HISTORY ═══ */}
        {tab === "history" && (
          <div className="history-container">
            <h2 className="tab-view-title">Patient Records & Trends</h2>
            <p className="tab-view-desc">View saved assessments, search by name, and plot risk trajectories over time.</p>

            <div className="history-layout">
              {/* Records Table */}
              <div className="panel records-panel">
                <div className="records-search-bar">
                  <input className="search-input" type="text" placeholder="🔍 Search by patient name…"
                    value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                {filtered.length===0 ? (
                  <div className="empty-table-state">No records yet — run a prediction first.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="records-table">
                      <thead><tr><th>Patient</th><th>Date & Time</th><th>Probability</th><th>Risk</th><th></th></tr></thead>
                      <tbody>
                        {filtered.map(r=>(
                          <tr key={r.id} className="record-row">
                            <td className="patient-link" onClick={()=>fetchTrend(r.patient_name)}>👤 {r.patient_name}</td>
                            <td>{r.timestamp}</td>
                            <td className="table-prob">{r.probability}%</td>
                            <td>
                              <span className="table-risk-badge" style={{
                                background: RISK[r.risk_level]?.bg,
                                color:      RISK[r.risk_level]?.color,
                                borderColor:RISK[r.risk_level]?.border,
                              }}>{r.risk_level}</span>
                            </td>
                            <td><button className="delete-btn" onClick={()=>deleteRecord(r.id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Trend Chart */}
              <div className="panel trend-panel">
                <h3 className="panel-title">Risk Trend Visualisation</h3>
                <p className="panel-desc">Click a patient name in the table, or choose below.</p>

                {!selPt ? (
                  <div className="trend-empty">
                    <div className="trend-empty-icon">📈</div>
                    <p>No patient selected.</p>
                    {names.length>0 && (
                      <select className="select" defaultValue="" onChange={e=>fetchTrend(e.target.value)}>
                        <option value="" disabled>Select patient…</option>
                        {names.map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="trend-header">
                      <span className="trend-patient-name">{selPt}</span>
                      <button className="clear-btn" onClick={()=>{setSelPt("");setTrendData([]);}}>Clear</button>
                    </div>
                    {trendData.length<2 ? (
                      <div className="trend-warn">
                        Only {trendData.length} record found for this patient. Add more predictions to see a trend line.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={trendData} margin={{ top:16, right:16, left:-10, bottom:4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="timestamp" tickFormatter={ts=>ts.split(" ")[0]} tick={{ fontSize:10 }}/>
                          <YAxis domain={[0,100]} tick={{ fontSize:10 }} unit="%"/>
                          <Tooltip formatter={v=>[`${v}%`,"Risk Probability"]}/>
                          <Line type="monotone" dataKey="probability" stroke="#ef4444" strokeWidth={3}
                            dot={{ stroke:"#ef4444", strokeWidth:2, r:4, fill:"#fff" }} activeDot={{ r:7 }}/>
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
