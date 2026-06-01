import { useState, useRef, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA7iqZC7pr20-trETujBQpEPO7btlzyUKQ",
  authDomain: "younsu2026.firebaseapp.com",
  projectId: "younsu2026",
  storageBucket: "younsu2026.firebasestorage.app",
  messagingSenderId: "555663311080",
  appId: "1:555663311080:web:be44ef2275764b7d70895d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DOC_REF = doc(db, "app", "data");

function initData() {
  return { adminPw: "admin1234", totalBudget: 0, teachers: {}, submissions: {}, notices: [] };
}

// ─── Utils ───────────────────────────────────────────────────
function fmt(n) { return (Number(n) || 0).toLocaleString("ko-KR") + "원"; }
function parseNum(s) { const n = parseInt(String(s).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? 0 : n; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── Download helpers ─────────────────────────────────────────
// data URI → Blob → object URL → invisible <a> click → revoke
// This works in sandboxed iframes where direct data: href navigation is blocked.
function dataUriToBlob(dataUri) {
  const [header, b64] = dataUri.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function getExt(dataUri) {
  if (dataUri.startsWith("data:application/pdf")) return "pdf";
  if (dataUri.startsWith("data:image/png"))  return "png";
  if (dataUri.startsWith("data:image/gif"))  return "gif";
  if (dataUri.startsWith("data:image/webp")) return "webp";
  return "jpg";
}

function downloadImg(src, filename) {
  try {
    const blob = dataUriToBlob(src);
    const url  = URL.createObjectURL(blob);
    const ext  = getExt(src);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename.endsWith("." + ext) ? filename : filename + "." + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e) {
    console.error("download failed", e);
  }
}

async function downloadAllAsZip(teacherName, rows) {
  if (!window.JSZip) {
    // JSZip not yet loaded — show inline message handled by caller
    return false;
  }
  const zip = new window.JSZip();
  rows.forEach((r, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const safeName = r.trainingName.replace(/[\/:*?"<>|]/g, "_");
    if (r.certImg) {
      const ext  = getExt(r.certImg);
      const b64  = r.certImg.split(",")[1];
      zip.file(`${idx}_${safeName}_이수증.${ext}`, b64, { base64: true });
    }
    if (r.receiptImg) {
      const ext  = getExt(r.receiptImg);
      const b64  = r.receiptImg.split(",")[1];
      zip.file(`${idx}_${safeName}_영수증.${ext}`, b64, { base64: true });
    }
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${teacherName}_연수서류.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ─── CSS ─────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
:root {
  --navy:#1B2B4B; --navy2:#253A62; --sky:#4A90C4; --sky-l:#EBF4FC;
  --green:#27855A; --green-l:#E6F5EE; --amber:#D4820A; --amber-l:#FEF5E6;
  --red:#C0392B; --red-l:#FDECEA; --ink:#1A1A2E; --muted:#7A7A8C;
  --border:#E2DDD6; --bg:#F4F1EC; --sur:#FFFFFF;
  --serif:'DM Serif Display',serif; --sans:'Noto Sans KR',sans-serif;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);font-family:var(--sans);color:var(--ink);}
input,textarea,select,button{font-family:var(--sans);}
button{cursor:pointer;}
.fade{animation:fadeUp .35s ease both;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pop{animation:pop .25s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes pop{from{opacity:0;transform:scale(.92);}to{opacity:1;transform:scale(1);}}
.rowin{animation:ri .28s ease both;}
@keyframes ri{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
.tab-btn{border:none;background:none;padding:10px 20px;font-size:13px;font-weight:600;color:var(--muted);border-bottom:3px solid transparent;cursor:pointer;transition:all .2s;white-space:nowrap;}
.tab-btn.on{color:var(--navy);border-bottom-color:var(--sky);}
.tab-btn:hover:not(.on){color:var(--ink);}
.inp{width:100%;border:1.5px solid var(--border);border-radius:9px;padding:9px 13px;font-size:13px;outline:none;background:var(--sur);transition:border-color .2s;}
.inp:focus{border-color:var(--sky);}
.btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:9px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s,transform .12s;}
.btn:hover{opacity:.87;}.btn:active{transform:scale(.96);}
.btn-navy{background:var(--navy);color:#fff;}
.btn-sky{background:var(--sky);color:#fff;}
.btn-ghost{background:var(--sur);color:var(--ink);border:1.5px solid var(--border);}
.btn-green{background:var(--green);color:#fff;}
.btn-red{background:var(--red);color:#fff;}
.btn-amber{background:var(--amber);color:#fff;}
.btn-sm{padding:6px 13px;font-size:12px;border-radius:7px;}
.btn-lg{padding:12px 28px;font-size:14px;border-radius:10px;}
.btn:disabled{opacity:.45;cursor:not-allowed;pointer-events:none;}
.card{background:var(--sur);border:1px solid var(--border);border-radius:14px;padding:22px;}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.bg-green{background:var(--green-l);color:var(--green);}
.bg-amber{background:var(--amber-l);color:var(--amber);}
.bg-red{background:var(--red-l);color:var(--red);}
.bg-sky{background:var(--sky-l);color:var(--sky);}
.bg-navy{background:#E8EEF7;color:var(--navy);}
.mbg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);}
.mbox{background:var(--sur);border-radius:16px;padding:28px;width:min(460px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.22);}
.pt{height:7px;background:var(--border);border-radius:4px;overflow:hidden;}
.pf{height:100%;border-radius:4px;transition:width .5s ease;}
table{width:100%;border-collapse:collapse;}
th{background:var(--bg);font-size:11px;font-weight:700;color:var(--muted);text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);}
td{padding:12px 14px;font-size:13px;border-bottom:1px solid #F0EBE3;vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#FAFAF8;}
.ub{width:100%;padding:10px 8px;border-radius:8px;border:1.5px dashed var(--border);background:var(--bg);color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;text-align:center;}
.ub:hover{border-color:var(--sky);color:var(--sky);background:var(--sky-l);}
.ub.done{border-color:var(--green);color:var(--green);background:var(--green-l);border-style:solid;}

/* ── 인쇄 스타일 ── */
@media print {
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .print-root { display: block !important; }
  .print-page { page-break-after: always; padding: 20mm 18mm; font-family: 'Noto Sans KR', sans-serif; }
  .print-page:last-child { page-break-after: avoid; }
  .print-header { border-bottom: 2px solid #1B2B4B; padding-bottom: 10px; margin-bottom: 16px; }
  .print-title { font-size: 18pt; font-weight: 800; color: #1B2B4B; }
  .print-sub { font-size: 10pt; color: #555; margin-top: 3px; }
  .print-info-row { display: flex; gap: 24px; margin-bottom: 14px; font-size: 10pt; }
  .print-info-box { background: #F4F1EC; border-radius: 6px; padding: 6px 14px; }
  .print-info-label { font-size: 8pt; color: #888; }
  .print-info-val { font-weight: 800; font-size: 12pt; color: #1B2B4B; }
  .print-doc-title { font-size: 11pt; font-weight: 700; color: #333; margin-bottom: 6px; border-left: 3px solid #4A90C4; padding-left: 8px; }
  .print-row { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .print-row-header { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
  .print-row-name { font-size: 12pt; font-weight: 800; }
  .print-row-amount { font-size: 13pt; font-weight: 800; color: #4A90C4; }
  .print-row-date { font-size: 8pt; color: #888; }
  .print-imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .print-img-wrap { text-align: center; }
  .print-img-label { font-size: 8pt; color: #666; font-weight: 700; margin-bottom: 4px; }
  .print-img-wrap img { max-width: 100%; max-height: 180px; object-fit: contain; border: 1px solid #ddd; border-radius: 6px; }
  .print-no-img { height: 80px; border: 1px dashed #ccc; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 9pt; }
  .print-summary-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8px; }
  .print-summary-table th { background: #1B2B4B; color: #fff; padding: 7px 10px; text-align: left; font-size: 9pt; }
  .print-summary-table td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  .print-summary-table tr:last-child td { border-bottom: none; font-weight: 800; background: #F4F1EC; }
  .print-stamp { margin-top: 20px; text-align: right; font-size: 9pt; color: #888; }
}
@media screen { .print-root { display: none; } }
`;

// ─── Sub-components ───────────────────────────────────────────
function LB({ src, onClose }) {
  if (!src) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <img src={src} alt="" style={{maxWidth:"92vw",maxHeight:"92vh",borderRadius:10}} />
      <div style={{position:"absolute",top:20,right:24,color:"#fff",fontSize:30,cursor:"pointer",lineHeight:1}}>✕</div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="mbg" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="mbox pop">{children}</div>
    </div>
  );
}

function Bar({ pct, color }) {
  const c = color || (pct>90?"var(--red)":pct>65?"var(--amber)":"var(--green)");
  return <div className="pt"><div className="pf" style={{width:`${Math.min(100,pct)}%`,background:c}} /></div>;
}

// ─── App Root ─────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [light, setLight] = useState(null);

  // Load JSZip from CDN once
  useEffect(() => {
    if (!window.JSZip) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      document.head.appendChild(s);
    }
  }, []);

  // Firebase 실시간 연동
  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      } else {
        const init = initData();
        setDoc(DOC_REF, init);
        setData(init);
      }
    });
    return () => unsub();
  }, []);

  function update(fn) {
    setData(prev => {
      const next = fn(prev);
      setDoc(DOC_REF, next);
      return next;
    });
  }

  if (!data) return (
    <div style={{minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#1B2B4B"}}>
      <div style={{color:"#fff", fontSize:18, fontWeight:700}}>⏳ 불러오는 중...</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <LB src={light} onClose={() => setLight(null)} />
      {!session
        ? <LoginScreen data={data} onLogin={setSession} />
        : session.role === "admin"
          ? <AdminApp data={data} update={update} onLogout={() => setSession(null)} setLight={setLight} />
          : <TeacherApp data={data} update={update} session={session} onLogout={() => setSession(null)} setLight={setLight} />
      }
    </>
  );
}

// ════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════
function LoginScreen({ data, onLogin }) {
  const [mode, setMode] = useState("teacher");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const names = Object.keys(data.teachers || {});

  function login() {
    setErr("");
    if (mode === "admin") {
      if (pw === data.adminPw) onLogin({ role: "admin" });
      else setErr("비밀번호가 틀렸습니다.");
    } else {
      if (!name) { setErr("이름을 선택해주세요."); return; }
      const t = data.teachers?.[name];
      if (!t) { setErr("등록되지 않은 선생님입니다."); return; }
      if (pw !== t.pw) { setErr("비밀번호가 틀렸습니다."); return; }
      onLogin({ role: "teacher", name });
    }
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(135deg,#1B2B4B 0%,#253A62 55%,#2C5F8A 100%)",padding:20}}>
      <div style={{width:"min(400px,100%)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"var(--serif)",fontSize:36,color:"#fff",marginBottom:6}}>연수비 수합</div>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:13}}>교직원 연수비 신청 &amp; 관리 시스템</div>
        </div>
        <div className="card fade" style={{boxShadow:"0 24px 60px rgba(0,0,0,.25)"}}>
          <div style={{display:"flex",background:"var(--bg)",borderRadius:10,padding:4,marginBottom:24,gap:4}}>
            {[["teacher","👩‍🏫 선생님"],["admin","🔐 관리자"]].map(([k,lbl]) => (
              <button key={k} onClick={() => {setMode(k);setErr("");setPw("");setName("");}}
                style={{flex:1,padding:"8px",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",
                  background:mode===k?"var(--navy)":"transparent",color:mode===k?"#fff":"var(--muted)",transition:"all .2s"}}>
                {lbl}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode === "teacher" && (
              <div>
                <label style={{fontSize:12,fontWeight:700,color:"var(--muted)",display:"block",marginBottom:5}}>이름</label>
                <select className="inp" value={name} onChange={e=>setName(e.target.value)}>
                  <option value="">선생님 선택...</option>
                  {names.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{fontSize:12,fontWeight:700,color:"var(--muted)",display:"block",marginBottom:5}}>비밀번호</label>
              <input className="inp" type="password" value={pw} onChange={e=>setPw(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&login()} placeholder="비밀번호 입력" />
            </div>
            {err && <div style={{background:"var(--red-l)",color:"var(--red)",borderRadius:8,padding:"9px 12px",fontSize:13,fontWeight:600}}>{err}</div>}
            <button className="btn btn-navy btn-lg" onClick={login} style={{width:"100%",marginTop:4}}>로그인</button>
          </div>
          {mode==="teacher" && <div style={{color:"var(--muted)",fontSize:11,marginTop:14,textAlign:"center"}}>최초 비밀번호는 관리자가 설정한 초기 비밀번호입니다</div>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ADMIN APP
// ════════════════════════════════════════════════════════════
function AdminApp({ data, update, onLogout, setLight }) {
  const [tab, setTab] = useState("dash");
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <div style={{background:"var(--navy)",padding:"0 24px",height:58,display:"flex",alignItems:"center",
        justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 16px rgba(27,43,75,.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"var(--serif)",fontSize:22,color:"#fff"}}>연수비 수합</span>
          <span className="badge bg-sky">관리자</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>로그아웃</button>
      </div>
      <div style={{background:"var(--sur)",borderBottom:"1px solid var(--border)",display:"flex",padding:"0 20px",overflowX:"auto"}}>
        {[["dash","📊 대시보드"],["teachers","👩‍🏫 선생님 관리"],["subs","📋 제출 현황"],["reports","📁 교사별 서류"],["notices","📢 공지사항"]].map(([k,lbl])=>(
          <button key={k} className={`tab-btn ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{lbl}</button>
        ))}
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px"}}>
        {tab==="dash"    && <AdminDash data={data} update={update} />}
        {tab==="teachers"&& <AdminTeachers data={data} update={update} />}
        {tab==="subs"    && <AdminSubs data={data} update={update} setLight={setLight} />}
        {tab==="reports" && <AdminReports data={data} update={update} setLight={setLight} />}
        {tab==="notices" && <AdminNotices data={data} update={update} />}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
function AdminDash({ data, update }) {
  const [editing, setEditing] = useState(false);
  const [inp, setInp] = useState("");

  const teachers = data.teachers || {};
  const subs = data.submissions || {};
  const totalBudget = data.totalBudget || 0;
  const totalUsed = Object.values(subs).flat().reduce((s,r)=>s+parseNum(r.amount),0);
  const totalRemain = totalBudget - totalUsed;
  const pct = totalBudget > 0 ? (totalUsed/totalBudget)*100 : 0;

  function saveBudget() {
    update(d=>({...d,totalBudget:parseNum(inp)}));
    setEditing(false);
  }

  return (
    <div className="fade">
      {/* Total budget card */}
      <div className="card" style={{marginBottom:20,background:"var(--navy)",border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{color:"rgba(255,255,255,.7)",fontSize:13}}>연수비 예산 총액</span>
          <button onClick={()=>{setEditing(!editing);setInp(String(totalBudget));}}
            style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",
              borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {editing?"취소":"✏️ 수정"}
          </button>
        </div>
        {editing ? (
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <input className="inp" value={inp} onChange={e=>setInp(e.target.value)} type="text" inputMode="numeric"
              placeholder="예산 총액 (원)"
              style={{background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.3)",color:"#fff",flex:1}} />
            <button className="btn btn-sky" onClick={saveBudget}>저장</button>
          </div>
        ) : (
          <div style={{color:"#fff",fontSize:34,fontWeight:800,marginBottom:14}}>{fmt(totalBudget)}</div>
        )}
        <Bar pct={pct} color={pct>90?"#FFB3AB":pct>65?"#FDD98A":"#7EE8B4"} />
        <div style={{display:"flex",justifyContent:"space-between",marginTop:10,color:"rgba(255,255,255,.75)",fontSize:13}}>
          <span>사용: <b style={{color:"#FDD98A"}}>{fmt(totalUsed)}</b></span>
          <span>잔액: <b style={{color:totalRemain<0?"#FFB3AB":"#7EE8B4"}}>{fmt(totalRemain)}</b></span>
        </div>
      </div>

      {/* Stat boxes */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:14,marginBottom:24}}>
        {[
          ["등록 선생님", Object.keys(teachers).length+"명", "var(--navy)"],
          ["총 제출 건수", Object.values(subs).flat().length+"건", "var(--sky)"],
          ["총 사용액", fmt(totalUsed), "var(--amber)"],
          ["총 잔액", fmt(totalRemain), totalRemain<0?"var(--red)":"var(--green)"],
        ].map(([lbl,val,color])=>(
          <div key={lbl} style={{background:"var(--sur)",border:"1px solid var(--border)",borderRadius:12,padding:"18px 20px"}}>
            <div style={{fontSize:12,color:"var(--muted)",fontWeight:600,marginBottom:6}}>{lbl}</div>
            <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Per-teacher table */}
      <div className="card">
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>선생님별 예산 현황</div>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>선생님</th><th>배정 예산</th><th>사용액</th><th>잔액</th><th>진행률</th></tr></thead>
            <tbody>
              {Object.keys(teachers).length === 0
                ? <tr><td colSpan={5} style={{textAlign:"center",color:"var(--muted)",padding:30}}>등록된 선생님이 없습니다</td></tr>
                : Object.entries(teachers).map(([name,t])=>{
                    const used=(subs[name]||[]).reduce((s,r)=>s+parseNum(r.amount),0);
                    const rem=t.budget-used;
                    const p=t.budget>0?(used/t.budget)*100:0;
                    return (
                      <tr key={name}>
                        <td style={{fontWeight:700}}>{name}</td>
                        <td>{fmt(t.budget)}</td>
                        <td style={{color:"var(--amber)",fontWeight:600}}>{fmt(used)}</td>
                        <td style={{color:rem<0?"var(--red)":"var(--green)",fontWeight:700}}>{fmt(rem)}</td>
                        <td style={{minWidth:130}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1}}><Bar pct={p} /></div>
                            <span style={{fontSize:11,color:"var(--muted)",width:32}}>{Math.round(p)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Teachers ───────────────────────────────────────────
function AdminTeachers({ data, update }) {
  const [form, setForm] = useState({name:"",pw:"",budget:""});
  const [formErr, setFormErr] = useState("");
  const [resetModal, setResetModal] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [editBudget, setEditBudget] = useState({});

  const teachers = data.teachers || {};
  const subs = data.submissions || {};

  function add() {
    const name = form.name.trim();
    if (!name||!form.pw||!form.budget){setFormErr("모든 항목을 입력해주세요.");return;}
    if (teachers[name]){setFormErr("이미 존재하는 이름입니다.");return;}
    update(d=>({...d,teachers:{...d.teachers,[name]:{pw:form.pw,initialPw:form.pw,budget:parseNum(form.budget)}}}));
    setForm({name:"",pw:"",budget:""});setFormErr("");
  }

  function remove(name) {
    if (!window.confirm(`"${name}" 선생님을 삭제하시겠습니까?\n제출 데이터도 모두 삭제됩니다.`)) return;
    update(d=>{
      const {[name]:_,...ts}=d.teachers;
      const {[name]:__,...ss}=d.submissions||{};
      return {...d,teachers:ts,submissions:ss};
    });
  }

  function doReset() {
    if (!resetPw) return;
    update(d=>({...d,teachers:{...d.teachers,[resetModal]:{...d.teachers[resetModal],pw:resetPw,initialPw:resetPw}}}));
    setResetModal(null);setResetPw("");
  }

  function saveBudget(name) {
    const v=parseNum(editBudget[name]);
    if (!v) return;
    update(d=>({...d,teachers:{...d.teachers,[name]:{...d.teachers[name],budget:v}}}));
    setEditBudget(p=>{const n={...p};delete n[name];return n;});
  }

  return (
    <div className="fade">
      {resetModal && (
        <Modal onClose={()=>setResetModal(null)}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:6}}>🔑 비밀번호 초기화</div>
          <div style={{color:"var(--muted)",fontSize:13,marginBottom:18}}>{resetModal} 선생님의 새 초기 비밀번호를 설정합니다.</div>
          <input className="inp" value={resetPw} onChange={e=>setResetPw(e.target.value)} placeholder="새 초기 비밀번호" style={{marginBottom:14}} />
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-ghost" onClick={()=>{setResetModal(null);setResetPw("");}}>취소</button>
            <button className="btn btn-amber" onClick={doReset}>초기화</button>
          </div>
        </Modal>
      )}

      <div className="card" style={{marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>+ 선생님 등록</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
          <input className="inp" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="이름" />
          <input className="inp" value={form.pw} onChange={e=>setForm(p=>({...p,pw:e.target.value}))} placeholder="초기 비밀번호" />
          <input className="inp" value={form.budget} onChange={e=>setForm(p=>({...p,budget:e.target.value}))} placeholder="배정 예산 (원)" inputMode="numeric" />
          <button className="btn btn-navy" onClick={add}>등록</button>
        </div>
        {formErr && <div style={{color:"var(--red)",fontSize:12,marginTop:10}}>{formErr}</div>}
      </div>

      <div className="card">
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>이름</th><th>초기 비밀번호</th><th>배정 예산</th><th>제출</th><th>관리</th></tr></thead>
            <tbody>
              {Object.keys(teachers).length===0
                ? <tr><td colSpan={5} style={{textAlign:"center",color:"var(--muted)",padding:30}}>등록된 선생님이 없습니다</td></tr>
                : Object.entries(teachers).map(([name,t])=>{
                    const editing=editBudget[name]!==undefined;
                    return (
                      <tr key={name}>
                        <td style={{fontWeight:700}}>{name}</td>
                        <td>
                          <span style={{fontFamily:"monospace",background:"var(--bg)",padding:"3px 8px",borderRadius:6,fontSize:13}}>
                            {t.initialPw}
                          </span>
                        </td>
                        <td>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input value={editing?editBudget[name]:fmt(t.budget)}
                              onChange={e=>setEditBudget(p=>({...p,[name]:e.target.value}))}
                              onFocus={()=>!editing&&setEditBudget(p=>({...p,[name]:String(t.budget)}))}
                              type="text" inputMode="numeric"
                              style={{width:130,border:`1.5px solid ${editing?"var(--sky)":"var(--border)"}`,borderRadius:8,padding:"5px 9px",fontSize:13,outline:"none"}} />
                            {editing && <button className="btn btn-sky btn-sm" onClick={()=>saveBudget(name)}>저장</button>}
                          </div>
                        </td>
                        <td><span className="badge bg-navy">{(subs[name]||[]).length}건</span></td>
                        <td>
                          <div style={{display:"flex",gap:7}}>
                            <button className="btn btn-amber btn-sm" onClick={()=>{setResetModal(name);setResetPw("");}}>🔑 초기화</button>
                            <button className="btn btn-ghost btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>remove(name)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Submissions ────────────────────────────────────────
function AdminSubs({ data, update, setLight }) {
  const [filter, setFilter] = useState("all");

  const all = Object.entries(data.submissions||{}).flatMap(([teacher,rows])=>
    (rows||[]).map((r,idx)=>({...r,teacher,_idx:idx}))
  ).sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));

  const shown = filter==="all" ? all : all.filter(s=>s.teacher===filter);
  const total = shown.reduce((s,r)=>s+parseNum(r.amount),0);
  const paidTotal = shown.filter(r=>r.paid).reduce((s,r)=>s+parseNum(r.amount),0);

  function togglePaid(teacher, idx) {
    update(d => {
      const rows = [...(d.submissions?.[teacher] || [])];
      rows[idx] = { ...rows[idx], paid: !rows[idx].paid, paidAt: !rows[idx].paid ? Date.now() : null };
      return { ...d, submissions: { ...d.submissions, [teacher]: rows } };
    });
  }

  return (
    <div className="fade">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        <span style={{fontWeight:700,fontSize:15}}>📋 전체 제출 현황</span>
        <select className="inp" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:160}}>
          <option value="all">전체 선생님</option>
          {Object.keys(data.teachers||{}).map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <span className="badge bg-navy">{shown.length}건</span>
          <span className="badge bg-amber">청구 {fmt(total)}</span>
          <span className="badge bg-green">지급완료 {fmt(paidTotal)}</span>
        </div>
      </div>
      <div className="card">
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>선생님</th><th>연수명</th><th>금액</th><th>이수증</th><th>영수증</th><th>제출일시</th><th>지급상태</th></tr></thead>
            <tbody>
              {shown.length===0
                ? <tr><td colSpan={7} style={{textAlign:"center",color:"var(--muted)",padding:40}}>제출 내역이 없습니다</td></tr>
                : shown.map((r,i)=>{
                  const safeName = r.trainingName.replace(/[\\/:*?"<>|]/g,"_");
                  return (
                  <tr key={i} style={{background: r.paid ? "#F6FFF9" : ""}}>
                    <td><span className="badge bg-navy">{r.teacher}</span></td>
                    <td style={{fontWeight:600}}>{r.trainingName}</td>
                    <td style={{fontWeight:700,color:"var(--sky)"}}>{fmt(r.amount)}</td>
                    <td>
                      {r.certImg ? (
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {isPdf(r.certImg)
                            ? <span style={{fontSize:20}}>📄</span>
                            : <img src={r.certImg} alt="" onClick={()=>setLight(r.certImg)}
                                style={{height:42,width:56,objectFit:"cover",borderRadius:7,border:"1px solid var(--border)",cursor:"zoom-in"}} />}
                          <button className="btn btn-ghost btn-sm" title="다운로드"
                            onClick={()=>downloadImg(r.certImg,`${r.teacher}_${safeName}_이수증`)}
                            style={{padding:"4px 8px",fontSize:14}}>⬇</button>
                        </div>
                      ) : <span style={{color:"var(--muted)",fontSize:12}}>없음</span>}
                    </td>
                    <td>
                      {r.receiptImg ? (
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          {isPdf(r.receiptImg)
                            ? <span style={{fontSize:20}}>📄</span>
                            : <img src={r.receiptImg} alt="" onClick={()=>setLight(r.receiptImg)}
                                style={{height:42,width:56,objectFit:"cover",borderRadius:7,border:"1px solid var(--border)",cursor:"zoom-in"}} />}
                          <button className="btn btn-ghost btn-sm" title="다운로드"
                            onClick={()=>downloadImg(r.receiptImg,`${r.teacher}_${safeName}_영수증`)}
                            style={{padding:"4px 8px",fontSize:14}}>⬇</button>
                        </div>
                      ) : <span style={{color:"var(--muted)",fontSize:12}}>없음</span>}
                    </td>
                    <td style={{color:"var(--muted)",fontSize:12}}>{r.submittedAt?new Date(r.submittedAt).toLocaleString("ko-KR"):"-"}</td>
                    <td>
                      <button
                        onClick={()=>togglePaid(r.teacher, r._idx)}
                        style={{
                          border:"none", borderRadius:20, padding:"5px 13px", fontSize:12, fontWeight:700, cursor:"pointer",
                          background: r.paid ? "var(--green-l)" : "var(--amber-l)",
                          color: r.paid ? "var(--green)" : "var(--amber)",
                          transition:"all .2s", whiteSpace:"nowrap"
                        }}>
                        {r.paid ? "✓ 지급완료" : "지급완료 처리"}
                      </button>
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ZIP Download Button ─────────────────────────────────────
function ZipDownloadBtn({ teacherName, rows }) {
  const [state, setState] = useState("idle"); // idle | working | done | nozip

  async function go() {
    if (!rows.length) return;
    setState("working");
    if (!window.JSZip) {
      // Try loading JSZip dynamically
      await new Promise((res) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }
    const ok = await downloadAllAsZip(teacherName, rows);
    setState(ok ? "done" : "nozip");
    setTimeout(() => setState("idle"), 3000);
  }

  const labels = { idle:"⬇ 전체 서류 ZIP 다운로드", working:"⏳ 압축 중...", done:"✓ 다운로드 완료", nozip:"⚠ ZIP 라이브러리 로딩 실패" };
  const colors = { idle:"var(--sky)", working:"var(--muted)", done:"var(--green)", nozip:"var(--red)" };

  return (
    <button className="btn btn-sm" onClick={go} disabled={state==="working"}
      style={{background:colors[state], color:"#fff", border:"none"}}>
      {labels[state]}
    </button>
  );
}

// ─── Admin Reports ────────────────────────────────────────────
function AdminReports({ data, update, setLight }) {
  const [selected, setSelected] = useState(null);
  const teachers = data.teachers || {};
  const subs = data.submissions || {};
  const names = Object.keys(teachers);

  function togglePaid(teacher, idx) {
    update(d => {
      const rows = [...(d.submissions?.[teacher] || [])];
      rows[idx] = { ...rows[idx], paid: !rows[idx].paid, paidAt: !rows[idx].paid ? Date.now() : null };
      return { ...d, submissions: { ...d.submissions, [teacher]: rows } };
    });
  }

  if (!selected) return (
    <div className="fade">
      <div style={{fontWeight:700,fontSize:15,marginBottom:18}}>📁 교사별 서류 정리</div>
      {names.length===0
        ? <div style={{color:"var(--muted)",padding:40}}>등록된 선생님이 없습니다</div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
            {names.map(name=>{
              const t=teachers[name];
              const rows=subs[name]||[];
              const used=rows.reduce((s,r)=>s+parseNum(r.amount),0);
              const rem=t.budget-used;
              const p=t.budget>0?(used/t.budget)*100:0;
              return (
                <div key={name} className="card" onClick={()=>setSelected(name)}
                  style={{cursor:"pointer",transition:"box-shadow .2s"}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 6px 24px rgba(27,43,75,.12)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:16}}>{name}</div>
                      <div style={{color:"var(--muted)",fontSize:12,marginTop:2}}>{rows.length}건 제출</div>
                    </div>
                    <span className={`badge ${rem<0?"bg-red":rem<t.budget*0.2?"bg-amber":"bg-green"}`}>
                      잔액 {fmt(rem)}
                    </span>
                  </div>
                  <Bar pct={p} />
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:8,color:"var(--muted)"}}>
                    <span>사용 {fmt(used)}</span><span>총 {fmt(t.budget)}</span>
                  </div>
                  {rows.length>0 && (
                    <div style={{marginTop:12,display:"flex",gap:5,flexWrap:"wrap"}}>
                      {rows.slice(0,5).map((r,i)=>r.certImg&&(
                        <img key={i} src={r.certImg} alt="" style={{height:34,width:46,objectFit:"cover",borderRadius:5,border:"1px solid var(--border)"}} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );

  // Detail page
  const t = teachers[selected];
  const rows = subs[selected] || [];
  const used = rows.reduce((s,r)=>s+parseNum(r.amount),0);
  const rem = t.budget - used;
  const paidAmt = rows.filter(r=>r.paid).reduce((s,r)=>s+parseNum(r.amount),0);
  const overBudget = used > t.budget && t.budget > 0;

  return (
    <div className="fade">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>← 목록으로</button>
        <div style={{marginLeft:"auto"}}>
<ZipDownloadBtn teacherName={selected} rows={rows} />
        </div>
      </div>

      {/* Budget exceeded alert */}
      {overBudget && (
        <div style={{
          background:"#C0392B", color:"#fff", borderRadius:12, padding:"14px 20px",
          marginBottom:18, display:"flex", alignItems:"center", gap:12,
          boxShadow:"0 4px 20px rgba(192,57,43,.35)", animation:"fadeUp .3s ease"
        }}>
          <span style={{fontSize:24}}>⚠️</span>
          <div>
            <div style={{fontWeight:800, fontSize:15}}>예산 초과!</div>
            <div style={{fontSize:13, opacity:.9, marginTop:2}}>
              배정 예산 {fmt(t.budget)}을 {fmt(used - t.budget)} 초과했습니다.
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{marginBottom:20,background:"var(--navy)",border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,alignItems:"flex-start"}}>
          <div>
            <div style={{color:"rgba(255,255,255,.6)",fontSize:12,marginBottom:4}}>📁 서류 정리</div>
            <div style={{color:"#fff",fontSize:28,fontWeight:800,fontFamily:"var(--serif)"}}>{selected} 선생님</div>
            <div style={{color:"rgba(255,255,255,.6)",fontSize:13,marginTop:4}}>총 {rows.length}건</div>
          </div>
          <div style={{display:"flex",gap:20,flexWrap:"wrap",textAlign:"right"}}>
            <div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>청구 총액</div>
              <div style={{color:"#FDD98A",fontSize:22,fontWeight:800}}>{fmt(used)}</div>
            </div>
            <div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>지급완료</div>
              <div style={{color:"#7EE8B4",fontSize:22,fontWeight:800}}>{fmt(paidAmt)}</div>
            </div>
            <div>
              <div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>잔액</div>
              <div style={{color:rem<0?"#FFB3AB":"#fff",fontSize:22,fontWeight:800}}>{fmt(rem)}</div>
              <div style={{color:"rgba(255,255,255,.5)",fontSize:11}}>배정 {fmt(t.budget)}</div>
            </div>
          </div>
        </div>
        <div style={{marginTop:16}}><Bar pct={t.budget>0?(used/t.budget)*100:0} color={overBudget?"#FFB3AB":"#7EE8B4"} /></div>
      </div>

      {rows.length===0
        ? <div className="card" style={{textAlign:"center",color:"var(--muted)",padding:50}}>제출된 서류가 없습니다</div>
        : rows.map((r,i)=>{
          const safeName = r.trainingName.replace(/[\\/:*?"<>|]/g,"_");
          return (
          <div key={i} className="card rowin" style={{marginBottom:14, border: r.paid ? "1.5px solid var(--green)" : "1px solid var(--border)"}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>{r.trainingName}</div>
                <div style={{color:"var(--muted)",fontSize:12,marginTop:3}}>
                  {r.submittedAt?new Date(r.submittedAt).toLocaleString("ko-KR"):""}
                </div>
                {r.paid && r.paidAt && (
                  <div style={{fontSize:11,color:"var(--green)",fontWeight:600,marginTop:4}}>
                    ✓ 지급완료 · {new Date(r.paidAt).toLocaleDateString("ko-KR")}
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                <div style={{fontSize:22,fontWeight:800,color:"var(--sky)"}}>{fmt(r.amount)}</div>
                <button
                  onClick={()=>togglePaid(selected, i)}
                  style={{
                    border:"none", borderRadius:20, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer",
                    background: r.paid ? "var(--green)" : "var(--amber-l)",
                    color: r.paid ? "#fff" : "var(--amber)",
                    transition:"all .2s", whiteSpace:"nowrap"
                  }}>
                  {r.paid ? "✓ 지급완료" : "💸 지급완료 처리"}
                </button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[["📄 이수증",r.certImg,`${selected}_${safeName}_이수증`],["🧾 결제영수증",r.receiptImg,`${selected}_${safeName}_영수증`]].map(([lbl,src,dlName])=>(
                <div key={lbl} style={{textAlign:"center"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:"var(--muted)"}}>{lbl}</span>
                    {src && (
                      <button className="btn btn-ghost btn-sm" title="다운로드"
                        onClick={()=>downloadImg(src, dlName)}
                        style={{padding:"3px 9px",fontSize:12,color:"var(--sky)",borderColor:"var(--sky)"}}>
                        ⬇ 다운로드
                      </button>
                    )}
                  </div>
                  {src
                    ? <img src={src} alt={lbl} onClick={()=>setLight(src)}
                        style={{maxWidth:"100%",maxHeight:220,objectFit:"contain",borderRadius:10,
                          border:"1px solid var(--border)",cursor:"zoom-in",transition:"transform .2s"}}
                        onMouseEnter={e=>e.target.style.transform="scale(1.02)"}
                        onMouseLeave={e=>e.target.style.transform="scale(1)"} />
                    : <div style={{height:100,background:"var(--bg)",borderRadius:10,border:"1.5px dashed var(--border)",
                        display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",fontSize:13}}>
                        미첨부
                      </div>}
                </div>
              ))}
            </div>
          </div>
          );
        })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TEACHER APP
// ════════════════════════════════════════════════════════════
function TeacherApp({ data, update, session, onLogout, setLight }) {
  const [tab, setTab] = useState("submit");
  const [pwModal, setPwModal] = useState(false);
  const [pf, setPf] = useState({cur:"",next:"",next2:""});
  const [pwErr, setPwErr] = useState("");
  const [pwOk, setPwOk] = useState(false);

  const name = session.name;
  const teacher = data.teachers?.[name] || {};
  const subs = data.submissions?.[name] || [];
  const used = subs.reduce((s,r)=>s+parseNum(r.amount),0);
  const budget = teacher.budget || 0;
  const remain = budget - used;
  const pct = budget>0?(used/budget)*100:0;

  function changePw() {
    setPwErr("");
    if (pf.cur !== teacher.pw){setPwErr("현재 비밀번호가 틀렸습니다.");return;}
    if (pf.next.length<4){setPwErr("새 비밀번호는 4자 이상이어야 합니다.");return;}
    if (pf.next!==pf.next2){setPwErr("새 비밀번호가 일치하지 않습니다.");return;}
    update(d=>({...d,teachers:{...d.teachers,[name]:{...d.teachers[name],pw:pf.next}}}));
    setPwOk(true);setPf({cur:"",next:"",next2:""});
    setTimeout(()=>{setPwOk(false);setPwModal(false);},1800);
  }

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      {pwModal && (
        <Modal onClose={()=>setPwModal(false)}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>🔒 비밀번호 변경</div>
          {[["cur","현재 비밀번호"],["next","새 비밀번호"],["next2","새 비밀번호 확인"]].map(([k,ph])=>(
            <input key={k} className="inp" type="password" value={pf[k]}
              onChange={e=>setPf(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={{marginBottom:10}} />
          ))}
          {pwErr && <div style={{color:"var(--red)",fontSize:13,marginBottom:10,fontWeight:600}}>{pwErr}</div>}
          {pwOk  && <div style={{color:"var(--green)",fontSize:13,marginBottom:10,fontWeight:600}}>✅ 변경 완료!</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
            <button className="btn btn-ghost" onClick={()=>setPwModal(false)}>취소</button>
            <button className="btn btn-navy" onClick={changePw}>변경</button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div style={{background:"var(--navy)",padding:"0 24px",height:58,display:"flex",alignItems:"center",
        justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 16px rgba(27,43,75,.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"var(--serif)",fontSize:22,color:"#fff"}}>연수비 수합</span>
          <span className="badge bg-sky">{name} 선생님</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPwModal(true)}
            style={{border:"1px solid rgba(255,255,255,.3)",color:"#fff",background:"rgba(255,255,255,.1)"}}>
            🔒 비밀번호 변경
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      {/* Budget banner */}
      <div style={{background: remain < 0 ? "#8B1A0F" : "var(--navy2)", padding:"16px 24px", borderBottom:"1px solid rgba(255,255,255,.08)", transition:"background .3s"}}>
        <div style={{maxWidth:800,margin:"0 auto"}}>
          {remain < 0 && (
            <div style={{
              background:"rgba(255,255,255,.15)", borderRadius:10, padding:"10px 14px",
              marginBottom:12, display:"flex", alignItems:"center", gap:10,
              border:"1px solid rgba(255,255,255,.25)"
            }}>
              <span style={{fontSize:20}}>⚠️</span>
              <span style={{color:"#FFD0CC", fontWeight:700, fontSize:13}}>
                배정 예산 초과! {fmt(budget)} 예산 대비 {fmt(-remain)} 초과 청구되었습니다.
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:28,flexWrap:"wrap",marginBottom:10}}>
            {[["배정 예산",fmt(budget),"#fff"],["청구 총액",fmt(used),"#FDD98A"],["잔액",fmt(remain),remain<0?"#FFB3AB":"#7EE8B4"]].map(([lbl,val,color])=>(
              <div key={lbl}>
                <div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{lbl}</div>
                <div style={{color,fontWeight:800,fontSize:20}}>{val}</div>
              </div>
            ))}
          </div>
          <Bar pct={pct} color={pct>100?"#FFB3AB":pct>90?"#FFB3AB":pct>65?"#FDD98A":"#7EE8B4"} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"var(--sur)",borderBottom:"1px solid var(--border)",display:"flex",padding:"0 20px"}}>
        {[["notice","📢 공지사항"],["submit","✏️ 신청하기"],["history","📋 제출 내역"]].map(([k,lbl])=>(
          <button key={k} className={`tab-btn ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{lbl}</button>
        ))}
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"28px 20px"}}>
        {tab==="notice"  && <NoticeBoard notices={data.notices||[]} />}
        {tab==="submit"  && <TeacherSubmit name={name} data={data} update={update} remain={remain} />}
        {tab==="history" && <TeacherHistory subs={subs} budget={budget} update={update} name={name} setLight={setLight} />}
      </div>
    </div>
  );
}

// ─── Notice Board (shared) ────────────────────────────────────
function NoticeBoard({ notices }) {
  const [open, setOpen] = useState(null);
  const sorted = [...(notices||[])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  if (!sorted.length) return (
    <div className="card fade" style={{textAlign:"center",color:"var(--muted)",padding:60}}>
      <div style={{fontSize:36,marginBottom:12}}>📭</div>
      등록된 공지사항이 없습니다
    </div>
  );

  return (
    <div className="fade">
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📢 공지사항</div>
      <div style={{display:"grid",gap:8}}>
        {sorted.map((n,i)=>(
          <div key={n.id}>
            <div
              onClick={()=>setOpen(open===n.id?null:n.id)}
              style={{
                background:"var(--sur)", border:"1px solid var(--border)",
                borderRadius: open===n.id ? "12px 12px 0 0" : 12,
                padding:"14px 18px", cursor:"pointer",
                display:"flex", justifyContent:"space-between", alignItems:"center",
                transition:"background .15s",
                borderBottom: open===n.id ? "none" : undefined
              }}
              onMouseEnter={e=>e.currentTarget.style.background="#F7F5F0"}
              onMouseLeave={e=>e.currentTarget.style.background="var(--sur)"}
            >
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {n.pinned && <span style={{fontSize:11,fontWeight:700,color:"var(--red)",background:"var(--red-l)",padding:"2px 7px",borderRadius:20}}>📌 중요</span>}
                <span style={{fontWeight:700,fontSize:14}}>{n.title}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                <span style={{fontSize:11,color:"var(--muted)"}}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : ""}
                </span>
                <span style={{color:"var(--muted)",fontSize:12,transition:"transform .2s",
                  transform: open===n.id?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
              </div>
            </div>
            {open===n.id && (
              <div style={{
                background:"var(--bg)", border:"1px solid var(--border)", borderTop:"none",
                borderRadius:"0 0 12px 12px", padding:"16px 18px",
                fontSize:14, lineHeight:1.7, color:"var(--ink)", whiteSpace:"pre-wrap"
              }}>
                {n.content || <span style={{color:"var(--muted)"}}>내용 없음</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Notices ────────────────────────────────────────────
function AdminNotices({ data, update }) {
  const [open, setOpen] = useState(null);   // id of expanded row
  const [editing, setEditing] = useState(null); // id being edited, "new" for new
  const [form, setForm] = useState({title:"",content:"",pinned:false});

  const notices = [...(data.notices||[])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  function startNew() {
    setForm({title:"",content:"",pinned:false});
    setEditing("new");
    setOpen(null);
  }

  function startEdit(n) {
    setForm({title:n.title,content:n.content,pinned:!!n.pinned});
    setEditing(n.id);
    setOpen(null);
  }

  function save() {
    if (!form.title.trim()) { alert("제목을 입력해주세요."); return; }
    if (editing === "new") {
      const item = {id:uid(), title:form.title.trim(), content:form.content, pinned:form.pinned, createdAt:Date.now()};
      update(d=>({...d, notices:[...(d.notices||[]), item]}));
    } else {
      update(d=>({...d, notices:(d.notices||[]).map(n=>n.id===editing?{...n,...form,title:form.title.trim()}:n)}));
    }
    setEditing(null);
  }

  function remove(id) {
    update(d=>({...d, notices:(d.notices||[]).filter(n=>n.id!==id)}));
    if (open===id) setOpen(null);
    if (editing===id) setEditing(null);
  }

  function togglePin(id) {
    update(d=>({...d, notices:(d.notices||[]).map(n=>n.id===id?{...n,pinned:!n.pinned}:n)}));
  }

  return (
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:15}}>📢 공지사항 관리</div>
        {editing!=="new" && (
          <button className="btn btn-navy btn-sm" onClick={startNew}>+ 새 공지 작성</button>
        )}
      </div>

      {/* New / Edit form */}
      {editing && (
        <div className="card" style={{marginBottom:20,border:"1.5px solid var(--sky)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--sky)",marginBottom:14}}>
            {editing==="new" ? "✏️ 새 공지 작성" : "✏️ 공지 수정"}
          </div>
          <div style={{display:"grid",gap:10}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <input className="inp" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="제목" style={{flex:1}} />
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                <input type="checkbox" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))}
                  style={{width:16,height:16,cursor:"pointer"}} />
                📌 중요
              </label>
            </div>
            <textarea className="inp" value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}
              placeholder="내용을 입력하세요..." rows={6}
              style={{resize:"vertical",lineHeight:1.6}} />
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(null)}>취소</button>
            <button className="btn btn-navy btn-sm" onClick={save}>저장</button>
          </div>
        </div>
      )}

      {/* Notice list */}
      {notices.length === 0 && !editing ? (
        <div className="card" style={{textAlign:"center",color:"var(--muted)",padding:50}}>
          <div style={{fontSize:32,marginBottom:10}}>📭</div>
          등록된 공지사항이 없습니다
        </div>
      ) : (
        <div style={{display:"grid",gap:8}}>
          {notices.map(n=>(
            <div key={n.id}>
              <div style={{
                background:"var(--sur)", border:"1px solid var(--border)",
                borderRadius: open===n.id ? "12px 12px 0 0" : 12,
                padding:"14px 18px",
                borderBottom: open===n.id ? "none" : undefined
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div
                    style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1,minWidth:0}}
                    onClick={()=>setOpen(open===n.id?null:n.id)}
                  >
                    {n.pinned && <span style={{fontSize:11,fontWeight:700,color:"var(--red)",background:"var(--red-l)",padding:"2px 7px",borderRadius:20,flexShrink:0}}>📌 중요</span>}
                    <span style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
                    <span style={{color:"var(--muted)",fontSize:11,flexShrink:0}}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : ""}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={()=>togglePin(n.id)}
                      style={{fontSize:11,padding:"4px 8px",color:n.pinned?"var(--red)":"var(--muted)"}}>
                      📌
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>startEdit(n)}
                      style={{fontSize:11,padding:"4px 8px",color:"var(--sky)",borderColor:"var(--sky)"}}>수정</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>remove(n.id)}
                      style={{fontSize:11,padding:"4px 8px",color:"var(--red)",borderColor:"var(--red)"}}>삭제</button>
                  </div>
                </div>
              </div>
              {open===n.id && (
                <div style={{
                  background:"var(--bg)", border:"1px solid var(--border)", borderTop:"none",
                  borderRadius:"0 0 12px 12px", padding:"16px 18px",
                  fontSize:14, lineHeight:1.7, whiteSpace:"pre-wrap"
                }}>
                  {n.content || <span style={{color:"var(--muted)"}}>내용 없음</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Field ──────────────────────────────────────────────
// isPdf: check by data URI prefix or stored filename hint
function isPdf(val) { return val && val.startsWith("data:application/pdf"); }

function FilePreview({ value, label }) {
  if (!value) return null;
  if (isPdf(value)) {
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
        background:"var(--red-l)",borderRadius:8,border:"1px solid #f5c6c2",marginBottom:6}}>
        <span style={{fontSize:20}}>📄</span>
        <span style={{fontSize:12,fontWeight:700,color:"var(--red)"}}>{label} PDF 첨부됨</span>
      </div>
    );
  }
  return (
    <img src={value} alt={label}
      style={{width:"100%",height:72,objectFit:"cover",borderRadius:8,
        border:"1.5px solid var(--green)",marginBottom:6}} />
  );
}

function FileField({ label, value, onChange }) {
  // key trick: change key to reset the input after file read
  const [inputKey, setInputKey] = useState(0);
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:5}}>{label}</div>
      <FilePreview value={value} label={label} />
      <input
        key={inputKey}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf"
        style={{
          display:"block", width:"100%", fontSize:12,
          border:"1.5px dashed " + (value ? "var(--green)" : "var(--border)"),
          borderRadius:8, padding:"8px",
          background: value ? "var(--green-l)" : "var(--bg)",
          color: value ? "var(--green)" : "var(--muted)"
        }}
        onChange={e => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.addEventListener("load", function() {
            onChange(reader.result);
            setInputKey(k => k + 1); // reset input so same file can be re-picked
          });
          reader.readAsDataURL(file);
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange(null)}
          style={{marginTop:4,fontSize:11,color:"var(--red)",background:"none",
            border:"none",cursor:"pointer",padding:0,display:"block"}}>
          × 첨부 삭제
        </button>
      )}
    </div>
  );
}

// ─── Teacher Submit ───────────────────────────────────────────
function mkRow() { return {id:uid(),trainingName:"",amount:"",certImg:null,receiptImg:null}; }

function TeacherSubmit({ name, data, update, remain }) {
  const [rows, setRows] = useState([mkRow()]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const newTotal = rows.reduce((s,r)=>s+parseNum(r.amount),0);
  const afterRemain = remain - newTotal;

  function setRow(id,field,val){setRows(prev=>prev.map(r=>r.id===id?{...r,[field]:val}:r));}
  function addRow(){setRows(prev=>[...prev,mkRow()]);}
  function delRow(id){if(rows.length>1)setRows(prev=>prev.filter(r=>r.id!==id));}

  function submit(){
    setErr("");
    const bad = rows.find(r => !r.trainingName.trim() || !parseNum(r.amount));
    if (bad) { setErr("모든 행에 연수명과 금액을 입력해주세요."); return; }
    const newSubs = rows.map(r => ({
      id: uid(),
      trainingName: r.trainingName.trim(),
      amount: parseNum(r.amount),
      certImg: r.certImg,
      receiptImg: r.receiptImg,
      submittedAt: Date.now()
    }));
    update(d => ({...d, submissions: {...d.submissions, [name]: [...(d.submissions?.[name]||[]), ...newSubs]}}));
    setRows([mkRow()]);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:16}}>연수비 신청</div>
        <button className="btn btn-ghost btn-sm" onClick={addRow}>+ 행 추가</button>
      </div>

      <div style={{display:"grid",gap:14}}>
        {rows.map((row,idx)=>(
          <div key={row.id} className="card rowin" style={{background:"#FAFAF8"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:11,fontWeight:700,color:"var(--muted)",background:"var(--bg)",padding:"2px 9px",borderRadius:20}}>#{idx+1}</span>
              {rows.length>1 && <button onClick={()=>delRow(row.id)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>}
            </div>
            <div style={{display:"grid",gap:12}}>
              <input className="inp" value={row.trainingName} onChange={e=>setRow(row.id,"trainingName",e.target.value)} placeholder="연수명" />
              <input className="inp" value={row.amount} onChange={e=>setRow(row.id,"amount",e.target.value)} type="text" inputMode="numeric" placeholder="결제 금액 (원)" />
              <FileField label="📄 이수증 (이미지 또는 PDF)" value={row.certImg} onChange={v=>setRow(row.id,"certImg",v)} />
              <FileField label="🧾 결제영수증 (이미지 또는 PDF)" value={row.receiptImg} onChange={v=>setRow(row.id,"receiptImg",v)} />
            </div>
          </div>
        ))}
      </div>

      {newTotal > 0 && (
        <div style={{margin:"16px 0",padding:"14px 18px",background:"var(--sky-l)",borderRadius:12,
          display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{fontWeight:700,color:"var(--sky)",fontSize:14}}>이번 신청 합계: {fmt(newTotal)}</span>
          <span style={{fontSize:13,color:afterRemain<0?"var(--red)":"var(--green)",fontWeight:700}}>제출 후 잔액: {fmt(afterRemain)}</span>
        </div>
      )}

      {err && (
        <div style={{padding:"12px 18px",background:"var(--red-l)",borderRadius:12,
          color:"var(--red)",fontWeight:700,fontSize:13,marginTop:10}}>
          ⚠️ {err}
        </div>
      )}

      {done && (
        <div style={{padding:"12px 18px",background:"var(--green-l)",borderRadius:12,
          color:"var(--green)",fontWeight:700,fontSize:14,textAlign:"center",marginTop:10}}>
          ✅ 제출 완료되었습니다!
        </div>
      )}

      <div style={{marginTop:18,display:"flex",justifyContent:"flex-end"}}>
        <button className="btn btn-navy btn-lg" onClick={submit}>제출하기</button>
      </div>
    </div>
  );
}

// ─── Teacher History ──────────────────────────────────────────
function TeacherHistory({ subs, budget, update, name, setLight }) {
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const totalClaimed = subs.reduce((s,r)=>s+parseNum(r.amount),0);
  const overBudget = budget > 0 && totalClaimed > budget;
  const indexed = subs.map((r,i)=>({...r,_i:i})).reverse();

  function startEdit(realIdx, row) {
    setEditIdx(realIdx);
    setEditForm({ trainingName: row.trainingName, amount: String(row.amount), certImg: row.certImg, receiptImg: row.receiptImg });
  }
  function cancelEdit() { setEditIdx(null); setEditForm(null); }

  function saveEdit() {
    if (!editForm.trainingName.trim() || !parseNum(editForm.amount)) {
      alert("연수명과 금액을 입력해주세요."); return;
    }
    update(d => {
      const rows = [...(d.submissions?.[name] || [])];
      rows[editIdx] = { ...rows[editIdx], trainingName: editForm.trainingName.trim(),
        amount: parseNum(editForm.amount), certImg: editForm.certImg, receiptImg: editForm.receiptImg };
      return { ...d, submissions: { ...d.submissions, [name]: rows } };
    });
    setEditIdx(null); setEditForm(null);
  }

  function deleteRow(realIdx) {
    update(d => {
      const rows = (d.submissions?.[name] || []).filter((_,i) => i !== realIdx);
      return { ...d, submissions: { ...d.submissions, [name]: rows } };
    });
    if (editIdx === realIdx) { setEditIdx(null); setEditForm(null); }
  }

  if (!subs.length) return (
    <div className="card fade" style={{textAlign:"center",color:"var(--muted)",padding:60}}>
      <div style={{fontSize:36,marginBottom:12}}>📭</div>
      제출한 내역이 없습니다
    </div>
  );

  return (
    <div className="fade">
      {overBudget && (
        <div style={{
          background:"linear-gradient(135deg,#C0392B,#E74C3C)", color:"#fff",
          borderRadius:14, padding:"18px 22px", marginBottom:20,
          boxShadow:"0 6px 28px rgba(192,57,43,.4)",
          display:"flex", alignItems:"center", gap:14
        }}>
          <span style={{fontSize:36,lineHeight:1}}>⚠️</span>
          <div>
            <div style={{fontWeight:800,fontSize:17,marginBottom:3}}>배정 예산을 초과했습니다!</div>
            <div style={{fontSize:13,opacity:.92}}>
              배정 예산 <b>{fmt(budget)}</b> 대비 <b>{fmt(totalClaimed-budget)}</b> 초과 청구되었습니다. 관리자에게 문의해 주세요.
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:15}}>내 제출 내역 ({subs.length}건)</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span className="badge bg-amber" style={{fontSize:12,padding:"5px 12px"}}>청구 총액 {fmt(totalClaimed)}</span>
          <span className={"badge " + (overBudget?"bg-red":"bg-navy")} style={{fontSize:12,padding:"5px 12px"}}>배정 예산 {fmt(budget)}</span>
        </div>
      </div>

      <div style={{display:"grid",gap:12}}>
        {indexed.map((r) => {
          const isEditing = editIdx === r._i;
          const canEdit = !r.paid;
          return (
            <div key={r._i} className="card rowin" style={{
              padding:"18px 22px",
              border: r.paid?"1.5px solid var(--green)":"1px solid var(--border)",
              background: r.paid?"#FAFFFC":"var(--sur)"
            }}>
              {isEditing ? (
                <div style={{display:"grid",gap:10}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--sky)",marginBottom:2}}>✏️ 수정 중</div>
                  <input className="inp" value={editForm.trainingName}
                    onChange={e=>setEditForm(f=>({...f,trainingName:e.target.value}))} placeholder="연수명" />
                  <input className="inp" value={editForm.amount}
                    onChange={e=>setEditForm(f=>({...f,amount:e.target.value}))}
                    type="text" inputMode="numeric" placeholder="결제 금액 (원)" />
                  <FileField label="📄 이수증" value={editForm.certImg}
                    onChange={v=>setEditForm(f=>({...f,certImg:v}))} />
                  <FileField label="🧾 결제영수증" value={editForm.receiptImg}
                    onChange={v=>setEditForm(f=>({...f,receiptImg:v}))} />
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>취소</button>
                    <button className="btn btn-navy btn-sm" onClick={saveEdit}>저장</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:16}}>{r.trainingName}</div>
                      <div style={{color:"var(--muted)",fontSize:12,marginTop:3}}>
                        {r.submittedAt?new Date(r.submittedAt).toLocaleString("ko-KR"):""}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                      <div style={{fontSize:22,fontWeight:800,color:"var(--sky)"}}>{fmt(r.amount)}</div>
                      <span style={{
                        borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,
                        background:r.paid?"var(--green)":"var(--amber-l)",
                        color:r.paid?"#fff":"var(--amber)"
                      }}>
                        {r.paid?"✓ 지급완료":"⏳ 지급 대기"}
                      </span>
                      {r.paid&&r.paidAt&&<div style={{fontSize:11,color:"var(--green)"}}>{new Date(r.paidAt).toLocaleDateString("ko-KR")} 지급</div>}
                      {r.paid && <div style={{fontSize:11,color:"var(--muted)"}}>수정/삭제 불가</div>}
                      {canEdit && (
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>{startEdit(r._i,r);setConfirmDel(null);}}
                            style={{fontSize:12,color:"var(--sky)",borderColor:"var(--sky)"}}>
                            ✏️ 수정
                          </button>
                          {confirmDel === r._i ? (
                            <>
                              <button className="btn btn-red btn-sm" onClick={()=>{deleteRow(r._i);setConfirmDel(null);}}
                                style={{fontSize:12}}>
                                삭제 확인
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDel(null)}
                                style={{fontSize:12}}>
                                취소
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDel(r._i)}
                              style={{fontSize:12,color:"var(--red)",borderColor:"var(--red)"}}>
                              🗑 삭제
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    {[["📄 이수증",r.certImg],["🧾 결제영수증",r.receiptImg]].map(([lbl,src])=>(
                      <div key={lbl}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",marginBottom:6}}>{lbl}</div>
                        {src
                          ? isPdf(src)
                            ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px",
                                background:"var(--red-l)",borderRadius:9,border:"1px solid #f5c6c2"}}>
                                <span style={{fontSize:22}}>📄</span>
                                <span style={{fontSize:12,fontWeight:700,color:"var(--red)"}}>PDF 첨부됨</span>
                              </div>
                            : <img src={src} alt={lbl} onClick={()=>setLight(src)}
                                style={{width:"100%",maxHeight:140,objectFit:"contain",borderRadius:9,
                                  border:"1px solid var(--border)",cursor:"zoom-in",background:"var(--bg)"}} />
                          : <div style={{height:60,background:"var(--bg)",borderRadius:9,border:"1.5px dashed var(--border)",
                              display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",fontSize:12}}>
                              미첨부
                            </div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
