import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ============================================================
// ROLE PERMISSIONS
// ============================================================
const CAN = {
  editMembers:   ["admin", "creator", "leader", "elder"],
  deleteMembers: ["admin", "creator", "leader"],
  killBoss:      ["admin", "creator", "leader", "elder", "member"],
  editBoss:      ["admin", "creator", "leader", "elder"],
  uploadImage:   ["admin", "creator", "leader", "elder", "member"],
  addAuction:    ["admin", "creator", "leader", "elder"],
  editAuction:   ["admin", "creator", "leader", "elder"],
  placeBid:      ["admin", "creator", "leader", "elder", "member"],
  manageUsers:   ["admin", "creator"],
  markAttendance: ["admin", "creator", "leader"],
  manageWinners: ["admin", "creator", "leader", "elder"],
  addPoints:     ["admin", "creator", "leader", "elder"],
};
const can = (role, action) => CAN[action]?.includes(role);

// ============================================================
// CONSTANTS
// ============================================================
const CLASSES   = ["Berserker", "Skald", "Warlord", "Volva", "Archer", "RuneFighter"];
const POSITIONS = ["Leader", "Elder", "Member", "Rookie"];

// Position sort order for members table
const POSITION_ORDER = { Leader: 0, Elder: 1, Member: 2, Rookie: 3 };

const BOSSES_DEFAULT = [
  { id: 1, name: "Lv. 66 Cruel Outlaw Gand - Kings Tomb 1F",         color: "#4a90d9", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 1 },
  { id: 2, name: "Lv. 67 Eternal Gatekeeper Amot - Kings Tomb 1F",   color: "#d94a4a", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 1 },
  { id: 3, name: "Lv. 68 Ruthless Destroyer Hawler - Kings Tomb 1F", color: "#4ad94a", respawnMin: 45,  respawnMax: 90,  lastKilled: null, windowDuration: 30, channel: 1 },
  { id: 4, name: "Lv. 69 Assulter of Tombs Laudd - Kings Tomb 1F",   color: "#d9a44a", respawnMin: 60,  respawnMax: 120, lastKilled: null, windowDuration: 30, channel: 1 },
  { id: 5, name: "Lv. 66 Cruel Outlaw Gand - Kings Tomb 1F",         color: "#4a90d9", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 2 },
  { id: 6, name: "Lv. 67 Ethernal Destroyer Amot - Kings Tomb 1F",   color: "#4a90d9", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 2 },
  { id: 7, name: "Lv. 68 Ruthless Destroyer Hawler - Kings Tomb 1F", color: "#4a90d9", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 2 },
  { id: 8, name: "Lv. 69 Assulter of Tombs Laudd - Kings Tomb 1F",   color: "#4a90d9", respawnMin: 30,  respawnMax: 60,  lastKilled: null, windowDuration: 30, channel: 2 },
];

// ============================================================
// THEME — Dark Fantasy / Forge aesthetic
// ============================================================
const T = {
  // Backgrounds
  bg0:       "#07080f",   // deepest bg
  bg1:       "#0c0e1a",   // main bg
  bg2:       "#111422",   // card bg
  bg3:       "#161926",   // elevated
  bg4:       "#1c2030",   // border-adjacent

  // Borders
  border:    "#252a3d",
  borderHi:  "#2d3452",

  // Text
  text:      "#e8eaf0",
  textSub:   "#8892a4",
  textMuted: "#4a5168",

  // Accent palette — ember gold + steel blue + blood red
  gold:      "#c9973a",
  goldHi:    "#e8b84b",
  goldGlow:  "#c9973a33",
  blue:      "#4a7fd4",
  blueHi:    "#6a9fe4",
  blueGlow:  "#4a7fd433",
  red:       "#c03a3a",
  redHi:     "#e05555",
  green:     "#2e7d50",
  greenHi:   "#3da866",
  greenGlow: "#2e7d5033",
  purple:    "#6e3fad",
  purpleHi:  "#8b5fd0",
};

const inputStyle = {
  width: "100%", padding: "9px 12px",
  background: T.bg0, border: `1px solid ${T.border}`,
  borderRadius: "7px", color: T.text, fontSize: "13px",
  boxSizing: "border-box", outline: "none",
  transition: "border-color 0.2s",
};
const labelStyle = { display: "flex", flexDirection: "column", gap: "5px" };

const btn = (variant = "blue") => {
  const map = {
    blue:   { bg: "#1a2f5c", border: T.blue,   color: T.blueHi },
    gold:   { bg: "#3a2510", border: T.gold,   color: T.goldHi },
    red:    { bg: "#3a1212", border: T.red,    color: T.redHi  },
    green:  { bg: "#0d2e1e", border: T.green,  color: T.greenHi},
    gray:   { bg: T.bg3,    border: T.border,  color: T.textSub},
    purple: { bg: "#281545", border: T.purple, color: T.purpleHi},
  };
  const v = map[variant] || map.blue;
  return {
    background: v.bg, border: `1px solid ${v.border}44`, color: v.color,
    padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
    fontSize: "13px", fontWeight: "600",
    transition: "all 0.15s", whiteSpace: "nowrap",
  };
};

const positionColors = {
  Leader:  { bg: "#3a2003", text: "#e8a93a", border: "#c9973a55" },
  Elder:   { bg: "#3a0a0a", text: "#e05555", border: "#c0404055" },
  Member:  { bg: T.bg3,     text: T.textSub,  border: T.border     },
  Rookie:  { bg: "#1a0d3a", text: "#9b7fe8", border: "#6e3fad55"  },
  Recruit: { bg: "#1a0d3a", text: "#9b7fe8", border: "#6e3fad55"  }, // legacy alias
};
const activityColors = {
  Active:   { bg: "#0a2718", text: "#3da866", dot: "#3da866" },
  Inactive: { bg: T.bg3,    text: T.textMuted, dot: T.textMuted },
};
const roleColors = {
  admin:   { bg: "#3a0a0a", text: "#fca5a5", label: "🛠️ Admin"     },
  creator: { bg: "#4a0a2a", text: "#f9a8d4", label: "👑 Creator"   },
  leader:  { bg: "#3a2003", text: "#fcd34d", label: "👑️ Leader"   },
  elder:   { bg: "#0d1f3a", text: "#60a5fa", label: "⚔️ Elder"     },
  member:  { bg: T.bg3,    text: T.textSub,  label: "👤 Member"   },
  pending: { bg: T.bg3,    text: T.textMuted, label: "⏳ Pending"  },
};

// Decorative divider line
const Divider = () => (
  <div style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${T.borderHi}, transparent)`, margin: "16px 0" }} />
);

function formatTime(ms) {
  if (ms <= 0) return "00:00:00";
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function formatCountdown(endsAt) {
  const diff = endsAt - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}
function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Modal({ children, onClose, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div style={{ background: T.bg2, border: `1px solid ${T.borderHi}`, borderRadius: "14px", padding: "28px", width: "100%", maxWidth: wide ? "720px" : "520px", position: "relative", maxHeight: "90vh", overflowY: "auto",
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${T.border}` }}>
        <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", color: T.textSub, cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>✕</button>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================
function SectionHeader({ icon, title, sub, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px" }}>{icon}</span>
        <div>
          <div style={{ color: T.text, fontWeight: "700", fontSize: "16px", letterSpacing: "0.03em" }}>{title}</div>
          {sub && <div style={{ color: T.textMuted, fontSize: "12px", marginTop: "1px" }}>{sub}</div>}
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

// ============================================================
// STAT BADGE
// ============================================================
function StatBadge({ label, value, color }) {
  return (
    <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "10px 16px", textAlign: "center" }}>
      <div style={{ color: color || T.goldHi, fontWeight: "700", fontSize: "20px" }}>{value}</div>
      <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================
// ── CAPTCHA challenge pool ────────────────────────────────────
const CAPTCHA_CHALLENGES = [
  { prompt: "Select all SHIELDS", target: "shield", tiles: ["🛡️","🛡️","⚔️","🏹","🛡️","🧪","⚔️","🛡️","🏹"] },
  { prompt: "Select all SWORDS",  target: "sword",  tiles: ["⚔️","🛡️","⚔️","🧪","⚔️","🏹","🛡️","⚔️","💎"] },
  { prompt: "Select all POTIONS", target: "potion", tiles: ["🧪","⚔️","🧪","🛡️","🧪","💎","🏹","🧪","⚔️"] },
  { prompt: "Select all BOWS",    target: "bow",    tiles: ["🏹","🛡️","🏹","⚔️","🏹","🧪","🏹","💎","⚔️"] },
  { prompt: "Select all GEMS",    target: "gem",    tiles: ["💎","⚔️","💎","🏹","🛡️","💎","🧪","💎","⚔️"] },
];
const TARGET_EMOJI = { shield:"🛡️", sword:"⚔️", potion:"🧪", bow:"🏹", gem:"💎" };

function CaptchaWidget({ onVerified }) {
  const [challenge, setChallenge] = useState(() => {
    const c = CAPTCHA_CHALLENGES[Math.floor(Math.random() * CAPTCHA_CHALLENGES.length)];
    return { ...c, tiles: [...c.tiles].sort(() => Math.random() - 0.5) };
  });
  const [selected, setSelected]   = useState(new Set());
  const [status, setStatus]       = useState("idle"); // idle | wrong | verified
  const [shake, setShake]         = useState(false);

  const toggle = (i) => {
    if (status === "verified") return;
    setStatus("idle");
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  };

  const verify = () => {
    const correct = challenge.tiles
      .map((t, i) => t === TARGET_EMOJI[challenge.target] ? i : -1)
      .filter(i => i !== -1);
    const sel = [...selected];
    const ok = correct.length === sel.length && correct.every(i => selected.has(i));
    if (ok) { setStatus("verified"); setTimeout(() => onVerified(), 600); }
    else {
      setStatus("wrong"); setShake(true);
      setTimeout(() => {
        setShake(false);
        const c = CAPTCHA_CHALLENGES[Math.floor(Math.random() * CAPTCHA_CHALLENGES.length)];
        setChallenge({ ...c, tiles: [...c.tiles].sort(() => Math.random() - 0.5) });
        setSelected(new Set()); setStatus("idle");
      }, 900);
    }
  };

  const refresh = () => {
    const c = CAPTCHA_CHALLENGES[Math.floor(Math.random() * CAPTCHA_CHALLENGES.length)];
    setChallenge({ ...c, tiles: [...c.tiles].sort(() => Math.random() - 0.5) });
    setSelected(new Set()); setStatus("idle");
  };

  return (
    <div style={{ border: `1px solid ${status === "verified" ? T.green+"88" : status === "wrong" ? T.red+"88" : T.border}`, borderRadius: "10px", overflow: "hidden", transition: "border-color 0.3s", animation: shake ? "captchaShake 0.4s ease" : "none" }}>
      <style>{`@keyframes captchaShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`}</style>
      {/* Header */}
      <div style={{ background: T.bg3, borderBottom: `1px solid ${T.border}`, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: T.textSub, fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em" }}>🤖 HUMAN VERIFICATION</span>
        <button onClick={refresh} title="New challenge" style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: "15px", lineHeight: 1, padding: "2px 4px" }}>🔄</button>
      </div>
      {/* Prompt */}
      <div style={{ padding: "10px 12px 6px", background: T.bg0 }}>
        <div style={{ color: T.text, fontSize: "13px", fontWeight: "600" }}>{challenge.prompt}</div>
        <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "2px" }}>Click all matching tiles then press Verify</div>
      </div>
      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px", padding: "6px 10px", background: T.bg0 }}>
        {challenge.tiles.map((emoji, i) => {
          const isSel = selected.has(i);
          return (
            <button key={i} onClick={() => toggle(i)} style={{ background: isSel ? (status === "wrong" ? "#3a1212" : "#0d2e1e") : T.bg3, border: `2px solid ${isSel ? (status === "wrong" ? T.red : T.green) : T.border}`, borderRadius: "8px", padding: "12px 0", fontSize: "26px", cursor: "pointer", transition: "all 0.15s", transform: isSel ? "scale(0.94)" : "scale(1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {emoji}
            </button>
          );
        })}
      </div>
      {/* Footer */}
      <div style={{ padding: "8px 10px", background: T.bg0, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: status === "verified" ? T.greenHi : status === "wrong" ? T.redHi : T.textMuted, fontWeight: "600" }}>
          {status === "verified" ? "✅ Verified!" : status === "wrong" ? "❌ Wrong — try again" : `${selected.size} selected`}
        </span>
        {status !== "verified" && (
          <button onClick={verify} disabled={selected.size === 0} style={{ ...btn("blue"), fontSize: "12px", padding: "5px 14px", opacity: selected.size === 0 ? 0.4 : 1 }}>Verify</button>
        )}
        {status === "verified" && <span style={{ fontSize: "18px" }}>🎉</span>}
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [error, setError]                 = useState("");
  const [showPass, setShowPass]           = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({ display: "", username: "", password: "" });
  const [regError, setRegError]           = useState("");
  const [regSuccess, setRegSuccess]       = useState(false);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [registering, setRegistering]     = useState(false);

  const handleRegister = async () => {
    if (!regForm.username || !regForm.password || !regForm.display) { setRegError("Please fill in all fields."); return; }
    if (!captchaPassed) { setRegError("Please complete the human verification."); return; }
    setRegistering(true);
    setRegError("");
    const { data: existing } = await supabase.from("users").select("id").eq("username", regForm.username.toLowerCase().trim()).maybeSingle();
    if (existing) { setRegError("Username already taken."); setRegistering(false); return; }
    const { error: insertErr } = await supabase.from("users").insert([{
      username: regForm.username.toLowerCase().trim(),
      password: regForm.password,
      display:  regForm.display.trim(),
      role:     "member",
    }]);
    setRegistering(false);
    if (insertErr) setRegError("Registration failed: " + insertErr.message);
    else { setRegSuccess(true); setIsRegistering(false); }
  };

  const handleLogin = async () => {
    setError("");
    const { data: user } = await supabase.from("users").select("*").eq("username", username.toLowerCase().trim()).eq("password", password).maybeSingle();
    if (!user) { setError("❌ Invalid username or password!"); return; }
    if (user.role === "pending") { setError("⏳ Your account is awaiting admin approval."); return; }
    onLogin(user);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif",
      backgroundImage: "radial-gradient(ellipse at 30% 20%, #1a1f3a44 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, #2a150a33 0%, transparent 60%)" }}>
      <div style={{ background: T.bg2, border: `1px solid ${T.borderHi}`, borderRadius: "18px", padding: "44px", width: "100%", maxWidth: "400px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <img src="https://mbalsusqtkbtoxuawjau.supabase.co/storage/v1/object/public/asset/RAMPAGE%20FOR%20APP.png" alt="Rampage" style={{ width: "80px", height: "80px", objectFit: "contain", marginBottom: "12px" }} onError={e => { e.target.style.display = "none"; }} />
          <h1 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: "800", letterSpacing: "0.08em",
            background: `linear-gradient(135deg, ${T.goldHi}, ${T.blueHi})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RAMPAGE TRACKER</h1>
          <p style={{ color: T.textMuted, fontSize: "13px", margin: 0 }}>
            {isRegistering ? "Create a new account" : "Sign in to your guild account"}
          </p>
        </div>

        {regSuccess && (
          <div style={{ background: T.greenGlow, border: `1px solid ${T.green}55`, borderRadius: "8px", color: T.greenHi, fontSize: "13px", padding: "10px 14px", marginBottom: "16px", textAlign: "center" }}>
            ✅ Account created! You can now log in.
          </div>
        )}

        {!isRegistering ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>Username</span>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Enter username" style={inputStyle} autoFocus />
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</span>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Enter password" style={{ ...inputStyle, paddingRight: "40px" }} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textSub, cursor: "pointer", fontSize: "16px" }}>{showPass ? "🙈" : "👁️"}</button>
              </div>
            </label>
            {error && <div style={{ color: error.startsWith("⏳") ? T.goldHi : T.redHi, fontSize: "13px", textAlign: "center" }}>{error}</div>}
            <button onClick={handleLogin} style={{ ...btn("blue"), width: "100%", padding: "12px", fontSize: "15px" }}>Login</button>
            <button onClick={() => { setIsRegistering(true); setError(""); setRegSuccess(false); setCaptchaPassed(false); }} style={{ background: "none", border: "none", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>Register new account</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input placeholder="Display Name (character name)" value={regForm.display} onChange={e => setRegForm({ ...regForm, display: e.target.value })} style={inputStyle} autoFocus />
            <input placeholder="Username (for login)" value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })} style={inputStyle} />
            <input type="password" placeholder="Password" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} style={inputStyle} />
            {!captchaPassed
              ? <CaptchaWidget onVerified={() => setCaptchaPassed(true)} />
              : <div style={{ background: T.greenGlow, border: `1px solid ${T.green}66`, borderRadius: "10px", padding: "10px 14px", color: T.greenHi, fontSize: "13px", fontWeight: "600", textAlign: "center" }}>✅ Human verification passed!</div>
            }
            {regError && <div style={{ color: T.redHi, fontSize: "13px" }}>{regError}</div>}
            <button onClick={handleRegister} disabled={registering || !captchaPassed} style={{ ...btn("blue"), width: "100%", padding: "12px", fontSize: "15px", opacity: (!captchaPassed || registering) ? 0.45 : 1, cursor: (!captchaPassed || registering) ? "not-allowed" : "pointer" }}>
              {registering ? "Creating account…" : "Register"}
            </button>
            <button onClick={() => { setIsRegistering(false); setRegError(""); setCaptchaPassed(false); }} style={{ background: "none", border: "none", color: T.textMuted, fontSize: "13px", cursor: "pointer" }}>← Back to Login</button>
          </div>
        )}

        <Divider />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {Object.entries(roleColors).filter(([r]) => r !== "pending").map(([role, c]) => (
            <div key={role} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: c.bg, color: c.text, padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "700", minWidth: "90px", textAlign: "center", border: `1px solid ${c.text}33` }}>{c.label}</span>
              <span style={{ color: "#e8eaf0", fontSize: "13px", fontWeight: "700", letterSpacing: "0.04em" }}>
                {role === "admin"  && <strong style={{ color: "#fca5a5" }}>xILOVEHER</strong>}
                {role === "leader" && <strong style={{ color: "#fcd34d" }}>VALIANT</strong>}
                {role === "elder"  && <strong style={{ color: "#fca5a5" }}>xJINN, CHMB, xLUCYPEARL, YUJIRO</strong>}
                {role === "member" && <strong style={{ color: "#fca5a5" }}>RAMPAGE</strong>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MANAGE USERS TAB
// ============================================================
function UsersTab({ currentUser }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm]         = useState({ username: "", password: "", role: "member", display: "" });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("users").select("*").order("created_at", { ascending: true });
      if (data) setUsers(data);
      setLoading(false);
    };
    load();
    const channel = supabase.channel("users-manage")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const pending  = users.filter(u => u.role === "pending");
  const approved = users.filter(u => u.role !== "pending");

  const approveUser = async (u, role) => { await supabase.from("users").update({ role }).eq("id", u.id); };
  const rejectUser  = async (u) => {
    if (window.confirm(`Reject & delete account for "${u.display}"?`)) await supabase.from("users").delete().eq("id", u.id);
  };

  const openAdd  = () => { setEditUser(null); setForm({ username: "", password: "", role: "member", display: "" }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ username: u.username, password: u.password, role: u.role, display: u.display }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.username || !form.password || !form.display) return;
    if (editUser) {
      await supabase.from("users").update({ username: form.username, password: form.password, role: form.role, display: form.display }).eq("id", editUser.id);
    } else {
      await supabase.from("users").insert([{ username: form.username, password: form.password, role: form.role, display: form.display }]);
    }
    setShowModal(false);
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser.id) return alert("Cannot delete your own account!");
    if (window.confirm(`Delete user "${u.display}"?`)) await supabase.from("users").delete().eq("id", u.id);
  };

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading users…</div>;

  return (
    <div>
      <SectionHeader icon="🔐" title="Manage Users" sub={`${approved.length} approved · ${pending.length} pending`} actions={[
        <button key="add" onClick={openAdd} style={btn("blue")}>+ Add User</button>
      ]} />

      {pending.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ color: T.goldHi, fontWeight: "700", fontSize: "14px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: T.goldGlow, border: `1px solid ${T.gold}55`, padding: "3px 10px", borderRadius: "20px" }}>⏳ Pending Approvals ({pending.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pending.map(u => (
              <div key={u.id} style={{ background: T.goldGlow, border: `1px solid ${T.gold}33`, borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.text, fontWeight: "600" }}>{u.display}</div>
                  <div style={{ color: T.textMuted, fontSize: "12px", fontFamily: "monospace" }}>{u.username}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["leader", "elder", "member"].map(r => (
                    <button key={r} onClick={() => approveUser(u, r)} style={{ ...btn(r === "leader" ? "gold" : r === "elder" ? "blue" : "gray"), fontSize: "12px", padding: "5px 12px" }}>
                      Approve as {r}
                    </button>
                  ))}
                  <button onClick={() => rejectUser(u)} style={{ ...btn("red"), fontSize: "12px", padding: "5px 12px" }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.borderHi}`, background: T.bg3 }}>
              {["Display Name", "Username", "Password", "Role", "Action"].map(h => (
                <th key={h} style={{ padding: "12px 16px", color: T.textSub, fontWeight: "600", textAlign: "left", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {approved.map((u, i) => {
              const rc = roleColors[u.role] || roleColors.member;
              return (
                <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "12px 16px", color: T.text, fontWeight: "600" }}>{u.display}</td>
                  <td style={{ padding: "12px 16px", color: T.blue, fontFamily: "monospace" }}>{u.username}</td>
                  <td style={{ padding: "12px 16px", color: T.textMuted, fontFamily: "monospace" }}>{"•".repeat(Math.min(u.password?.length || 0, 12))}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ background: rc.bg, color: rc.text, padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>{rc.label}</span></td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => openEdit(u)} style={{ background: "none", border: "none", color: T.blueHi, cursor: "pointer", marginRight: "10px" }}>Edit</button>
                    <button onClick={() => handleDelete(u)} style={{ background: "none", border: "none", color: T.redHi, cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>{editUser ? "Edit User" : "Add User"}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={labelStyle}><span style={{ color: T.textSub, fontSize: "12px" }}>Display Name</span><input type="text" value={form.display} onChange={e => setForm({ ...form, display: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}><span style={{ color: T.textSub, fontSize: "12px" }}>Username</span><input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Password</span>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ ...inputStyle, paddingRight: "40px" }} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textSub, cursor: "pointer" }}>{showPass ? "🙈" : "👁️"}</button>
              </div>
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Role</span>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                {["admin", "creator", "leader", "elder", "member"].map(r => <option key={r} value={r}>{roleColors[r].label} — {r}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowModal(false)} style={btn("gray")}>Cancel</button>
            <button onClick={handleSave} style={btn("blue")}>Save</button>
          </div>
        </Modal>
      )}
   </div>
  );
}

// ============================================================
function MembersTab({ role }) {
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm]           = useState({ name: "", class: "Archer", position: "Member", growthPower: "", multiplier: "", activity: "Active", comment: "" });
  const [sortBy, setSortBy]       = useState("growthPower");
  const [sortDir, setSortDir]     = useState("desc");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const loadMembers = async () => {
    const { data: membersData, error } = await supabase.from("members").select("*").order("growthPower", { ascending: false });
    if (!error && membersData) {
      // Sort: Leader first, then Elder, Member, Rookie — never show raw admin entries
      const sorted = membersData
        .filter(m => m.position !== "admin")
        .sort((a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99));
      setMembers(sorted);
    } else {
      // Fallback: pull from users table, skip admin role entirely, map pending → Rookie
      const { data: usersData } = await supabase
        .from("users")
        .select("id, display, role, points")
        .neq("role", "admin")
        .order("created_at", { ascending: true });
      if (usersData) {
        const roleToPosition = { leader: "Leader", elder: "Elder", member: "Member", pending: "Rookie" };
        const mapped = usersData.map(u => ({
          id: u.id, name: u.display, class: "—",
          position: roleToPosition[u.role] || "Member",
          growthPower: 0, multiplier: 1,
          points: u.points || 0, activity: u.role === "pending" ? "Inactive" : "Active", comment: "",
        }));
        mapped.sort((a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99));
        setMembers(mapped);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
    const ch1 = supabase.channel("members-rt").on("postgres_changes", { event: "*", schema: "public", table: "members" }, loadMembers).subscribe();
    const ch2 = supabase.channel("users-points-rt").on("postgres_changes", { event: "*", schema: "public", table: "users" }, loadMembers).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const resetPoints = async (member) => {
    await supabase.from("users").update({ points: 0 }).eq("display", member.name);
    await supabase.from("members").update({ points: 0 }).eq("id", member.id);
    loadMembers();
  };
const addPoints = async (member, amount) => {
  const current = member.points || 0;
  const newPoints = Math.max(0, current + amount);
  await supabase.from("users").update({ points: newPoints }).eq("display", member.name);
  await supabase.from("members").update({ points: newPoints }).eq("id", member.id);
  loadMembers();
};
  const openAdd  = () => { setEditMember(null); setForm({ name: "", class: "Archer", position: "Member", growthPower: "", multiplier: "", activity: "Active", comment: "" }); setShowModal(true); };
  const openEdit = (m) => { setEditMember(m); setForm({ name: m.name, class: m.class, position: m.position, growthPower: m.growthPower, multiplier: m.multiplier, activity: m.activity, comment: m.comment || "" }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return;
    const payload = { name: form.name, class: form.class, position: form.position, growthPower: +form.growthPower || 0, multiplier: +form.multiplier || 1, activity: form.activity, comment: form.comment };
    if (editMember) await supabase.from("members").update(payload).eq("id", editMember.id);
    else await supabase.from("members").insert([{ ...payload, points: 0 }]);
    setShowModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Remove this member from the roster?")) await supabase.from("members").delete().eq("id", id);
  };

  const handleSort = (col) => { if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("desc"); } };
  const sorted = [...members].sort((a, b) => {
    // Position order always takes primary precedence unless user explicitly sorted by position
    if (sortBy !== "position") {
      const posA = POSITION_ORDER[a.position] ?? 99;
      const posB = POSITION_ORDER[b.position] ?? 99;
      if (posA !== posB) return posA - posB;
    }
    const v = sortDir === "asc" ? 1 : -1;
    const av = a[sortBy], bv = b[sortBy];
    return typeof av === "number" ? (av - bv) * v : String(av ?? "").localeCompare(String(bv ?? "")) * v;
  });

  const handleImport = async () => {
    const lines = importText.trim().split("\n").filter(Boolean);
    const rows = lines.map(line => {
      const c = line.split(/\t|,/);
      return { name: c[0]?.trim() || "Unknown", class: c[1]?.trim() || "Archer", position: c[2]?.trim() || "Member", growthPower: parseFloat(c[3]) || 0, multiplier: parseFloat(c[4]) || 1, points: parseFloat(c[5]) || 0, activity: c[6]?.trim() || "Active", comment: c[7]?.trim() || "" };
    });
    await supabase.from("members").insert(rows);
    setImportText(""); setShowImport(false);
  };

  const exportCSV = () => {
    const blob = new Blob(["Name,Class,Position,Growth Power,Multiplier,Points,Activity,Comment\n" + members.map(m => `${m.name},${m.class},${m.position},${m.growthPower},${m.multiplier},${m.points || 0},${m.activity},${m.comment || ""}`).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "guild_members.csv"; a.click();
  };

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading members…</div>;

  return (
    <div>
      <SectionHeader icon="👥" title="Members Roster" sub={`${members.length} members`} actions={[
        <button key="exp" onClick={exportCSV} style={btn("blue")}>📤 Export CSV</button>,
        can(role, "editMembers") && <button key="imp" onClick={() => setShowImport(true)} style={btn("blue")}>📥 Import</button>,
        can(role, "editMembers") && <button key="add" onClick={openAdd} style={btn("gold")}>+ Add Member</button>,
      ].filter(Boolean)} />

      <div style={{ overflowX: "auto", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.borderHi}`, background: T.bg3 }}>
              {[["#", null], ["Character Name", "name"], ["Class", "class"], ["Position", "position"], ["Growth Power", "growthPower"], ["Multiplier", "multiplier"], ["Points", "points"], ["Activity", "activity"], ["Comment", "comment"], ...(can(role, "editMembers") ? [["Action", null]] : [])].map(([label, col]) => (
                <th key={label} onClick={() => col && handleSort(col)} style={{ padding: "11px 10px", color: T.textSub, fontWeight: "600", textAlign: "left", cursor: col ? "pointer" : "default", whiteSpace: "nowrap", userSelect: "none", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label} {col && sortBy === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const pc = positionColors[m.position] || positionColors.Member;
              const ac = activityColors[m.activity]  || activityColors.Inactive;
              return (
                <tr key={m.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "10px 10px", color: T.textMuted }}>{i + 1}</td>
                  <td style={{ padding: "10px 10px", color: T.text, fontWeight: "600" }}>{m.name}</td>
                  <td style={{ padding: "10px 10px", color: T.textSub }}>{m.class}</td>
                  <td style={{ padding: "10px 10px" }}><span style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>{m.position}</span></td>
                  <td style={{ padding: "10px 10px", color: T.text }}>{(m.growthPower || 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 10px", color: T.goldHi }}>x{(m.multiplier || 1).toFixed(2)}</td>
                  <td style={{ padding: "10px 10px", color: T.text, fontWeight: "700" }}>
                    {m.points || 0}
                    {can(role, "addPoints") && (
                      <button onClick={() => resetPoints(m)} style={{ background: "none", border: "none", color: T.redHi, cursor: "pointer", fontSize: "11px", marginLeft: "6px" }} title="Reset points">↺</button>
                    )}
                    {can(role, "addPoints") && (
                      <button onClick={() => { const v = prompt("Add or remove points (e.g. 50 or -50):"); if (v !== null) addPoints(m, parseInt(v) || 0); }} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: "11px", marginLeft: "4px" }} title="Add/Remove points">✎</button>
                    )}
                  </td>
                  <td style={{ padding: "10px 10px" }}><span style={{ background: ac.bg, color: ac.text, padding: "3px 10px", borderRadius: "20px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: ac.dot }}></span>{m.activity}</span></td>
                  <td style={{ padding: "10px 10px", color: T.textSub, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.comment || "—"}</td>
                  {can(role, "editMembers") && (
                    <td style={{ padding: "10px 10px" }}>
                      <button onClick={() => openEdit(m)} style={{ background: "none", border: "none", color: T.blueHi, cursor: "pointer", marginRight: "8px" }}>Edit</button>
                      {can(role, "deleteMembers") && <button onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", color: T.redHi, cursor: "pointer" }}>Delete</button>}
                    </td>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={10} style={{ padding: "40px", color: T.textMuted, textAlign: "center" }}>No members yet. Add members manually or ask admin to approve registrations.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && can(role, "editMembers") && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>{editMember ? "Edit Member" : "Add Member"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[["Character Name", "name", "text"], ["Growth Power", "growthPower", "number"], ["Multiplier", "multiplier", "number"]].map(([label, key, type]) => (
              <label key={key} style={labelStyle}><span style={{ color: T.textSub, fontSize: "12px" }}>{label}</span><input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} /></label>
            ))}
            {[["Class", "class", CLASSES], ["Position", "position", POSITIONS], ["Activity", "activity", ["Active", "Inactive"]]].map(([label, key, opts]) => (
              <label key={key} style={labelStyle}><span style={{ color: T.textSub, fontSize: "12px" }}>{label}</span><select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle}>{opts.map(o => <option key={o}>{o}</option>)}</select></label>
            ))}
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}><span style={{ color: T.textSub, fontSize: "12px" }}>Comment</span><input type="text" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} style={inputStyle} /></label>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowModal(false)} style={btn("gray")}>Cancel</button>
            <button onClick={handleSave} style={btn("gold")}>Save</button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>📥 Import Members</h2>
          <p style={{ color: T.textSub, fontSize: "13px" }}>Paste CSV or tab-separated rows:<br /><code style={{ color: T.blueHi }}>Name, Class, Position, GrowthPower, Multiplier, Points, Activity, Comment</code></p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={8} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px", resize: "vertical" }} />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowImport(false)} style={btn("gray")}>Cancel</button>
            <button onClick={handleImport} style={btn("green")}>Import</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// BOSS TIMER TAB — Supabase-backed so all users see changes
// ============================================================
// Requires Supabase table: bosses
//   id (int8 pk), name (text), color (text), respawn_min (int4),
//   respawn_max (int4), window_duration (int4), channel (int4),
//   last_killed (int8 nullable), image_url (text nullable)
function BossTimerTab({ role }) {
  const [bosses, setBosses]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [now, setNow]             = useState(Date.now());
  const [showModal, setShowModal] = useState(false);
  const [editBoss, setEditBoss]   = useState(null);
  const [form, setForm]           = useState({ name: "", respawn_min: 30, respawn_max: 60, window_duration: 30, channel: 1, color: "#4a90d9", image_url: "" });
  const [channel, setChannel]     = useState(1);
  const [killModal, setKillModal] = useState(null);
  const [killOffset, setKillOffset] = useState(0);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saveErr, setSaveErr]     = useState("");
  const bossImgRef                = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const loadBosses = async () => {
    const { data, error } = await supabase.from("bosses").select("*").order("channel").order("id");
    if (!error && data) {
      setBosses(data.map(b => ({
        ...b,
        respawnMin:     b.respawn_min     ?? b.respawnMin     ?? 30,
        respawnMax:     b.respawn_max     ?? b.respawnMax     ?? 60,
        windowDuration: b.window_duration ?? b.windowDuration ?? 30,
        lastKilled:     b.last_killed     ?? b.lastKilled     ?? null,
        imageUrl:       b.image_url       ?? b.imageUrl       ?? "",
      })));
    } else {
      // Fallback to BOSSES_DEFAULT if table doesn't exist yet
      setBosses(BOSSES_DEFAULT);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBosses();
    const ch = supabase.channel("bosses-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bosses" }, loadBosses)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const getBossState = (boss) => {
    if (!boss.lastKilled) return { state: "unknown", label: "No Data — waiting for first kill" };
    const elapsed     = now - boss.lastKilled;
    const respawnMs   = boss.respawnMin * 60000;
    const maxMs       = 80 * 60000; // hard cap 1hr 20min
    const fiveMin     = 5 * 60000;
    // After respawnMin, extend window in 5-min chunks until boss is killed (max 80min total)
    // Calculate current window end: respawnMin + ceiling-to-next-5min chunk, capped at maxMs
    let windowEnd = respawnMs + fiveMin;
    while (windowEnd < elapsed && windowEnd < maxMs) windowEnd += fiveMin;
    if (elapsed < respawnMs) return { state: "waiting", label: `Spawn window in ${formatTime(respawnMs - elapsed)}` };
    if (elapsed < maxMs) {
      const remaining = windowEnd - elapsed;
      const chunkLabel = remaining > 0 ? `+5min check in ${formatTime(remaining)}` : "Checking…";
      return { state: "spawning", label: `🟢 SPAWN WINDOW — ${chunkLabel}` };
    }
    return { state: "overdue", label: "⚠️ Overdue (1h 20m+) — boss likely spawned. Mark it killed!" };
  };

  const stateColors = { unknown: T.bg3, waiting: "#0d1f3a", spawning: "#0a2718", overdue: "#3a1212" };
  const stateDots   = { unknown: T.textMuted, waiting: T.blueHi, spawning: T.greenHi, overdue: T.redHi };
  const filtered    = bosses.filter(b => b.channel === channel);

  const openAdd  = () => { setSaveErr(""); setEditBoss(null); setForm({ name: "", respawn_min: 30, respawn_max: 60, window_duration: 30, channel, color: "#4a90d9", image_url: "" }); setShowModal(true); };
  const openEdit = (b) => { setSaveErr(""); setEditBoss(b); setForm({ name: b.name, respawn_min: b.respawnMin, respawn_max: b.respawnMax, window_duration: b.windowDuration, channel: b.channel, color: b.color, image_url: b.imageUrl || "" }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return;
    const payload = {
      name: form.name, color: form.color, channel: +form.channel,
      respawn_min: +form.respawn_min, respawn_max: +form.respawn_max,
      window_duration: +form.window_duration,
      image_url: form.image_url || null,
    };
    let res;
    if (editBoss) {
      res = await supabase.from("bosses").update(payload).eq("id", editBoss.id).select();
    } else {
      res = await supabase.from("bosses").insert([{ ...payload, last_killed: null }]).select();
    }
    if (res.error) { setSaveErr("Save failed: " + res.error.message); return; }
    setShowModal(false);
    loadBosses();
  };

  const confirmKill = async () => {
    const killedAt = Date.now() - killOffset * 60000;
    await supabase.from("bosses").update({ last_killed: killedAt }).eq("id", killModal.id);
    setKillModal(null);
    loadBosses();
  };

  const uploadBossImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    const ext = file.name.split(".").pop();
    const filename = `boss_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("boss-images").upload(filename, file, { upsert: true, contentType: file.type });
    setUploadingImg(false);
    if (upErr) { setSaveErr("Upload failed: " + upErr.message); return; }
    const { data: urlData } = supabase.storage.from("boss-images").getPublicUrl(filename);
    if (urlData?.publicUrl) setForm(f => ({ ...f, image_url: urlData.publicUrl }));
  };

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading bosses…</div>;

  return (
    <div>
      <SectionHeader icon="👹" title="Boss Timers" sub="Real-time spawn tracking" actions={[
        <div key="ch" style={{ display: "flex", gap: "6px" }}>
          {[1, 2].map(ch => <button key={ch} onClick={() => setChannel(ch)} style={{ padding: "7px 18px", borderRadius: "8px", border: "none", cursor: "pointer", background: channel === ch ? T.blue : T.bg3, color: channel === ch ? "#fff" : T.textSub, fontWeight: "600", fontSize: "13px" }}>Ch {ch}</button>)}
        </div>,
        can(role, "editBoss") && <button key="add" onClick={openAdd} style={btn("blue")}>+ Add Boss</button>,
      ].filter(Boolean)} />

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(boss => {
          const { state, label } = getBossState(boss);
          return (
            <div key={boss.id} style={{ background: stateColors[state], border: `1px solid ${stateDots[state]}44`, borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: boss.color + "22", border: `2px solid ${boss.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0, overflow: "hidden" }}>
                {boss.imageUrl
                  ? <img src={boss.imageUrl} alt="boss" style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "50%" }} />
                  : "👹"
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ color: T.text, fontWeight: "700", fontSize: "16px" }}>{boss.name}</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: stateDots[state], flexShrink: 0 }}></span>
                </div>
                <div style={{ color: state === "spawning" ? T.greenHi : state === "overdue" ? T.redHi : T.textSub, fontSize: "14px" }}>{label}</div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                  {[boss.respawnMin, boss.respawnMax].map(t => <span key={t} style={{ background: T.bg0, color: T.textSub, border: `1px solid ${T.border}`, padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>{t}m</span>)}
                  <span style={{ background: T.bg0, color: T.textSub, border: `1px solid ${T.border}`, padding: "2px 10px", borderRadius: "20px", fontSize: "12px" }}>Window: {boss.windowDuration}m</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {can(role, "editBoss") && <button onClick={() => openEdit(boss)} style={btn("gray")}>Edit</button>}
                {can(role, "killBoss") && <button onClick={() => { setKillModal(boss); setKillOffset(0); }} style={btn("red")}>⚔️ Kill Boss</button>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>No bosses for Channel {channel}.{can(role, "editBoss") ? ' Click "+ Add Boss" to add one.' : ""}</div>}
      </div>

      {/* Kill Boss Modal */}
      {killModal && (
        <Modal onClose={() => setKillModal(null)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>⚔️ Boss Killed: {killModal.name}</h2>
          <p style={{ color: T.textSub, fontSize: "14px" }}>Adjust if you killed it a few minutes ago.</p>
          <label style={labelStyle}>
            <span style={{ color: T.textSub, fontSize: "13px" }}>Minutes ago: {killOffset}m</span>
            <input type="range" min={0} max={80} step={1} value={killOffset} onChange={e => setKillOffset(+e.target.value)} style={{ width: "100%", marginTop: "8px", accentColor: T.red }} />
          </label>
          <p style={{ color: T.blueHi, fontSize: "13px" }}>Kill time: {killOffset === 0 ? "Right now" : `${killOffset} minute(s) ago`}</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setKillModal(null)} style={btn("gray")}>Cancel</button>
            <button onClick={confirmKill} style={btn("red")}>Confirm Kill</button>
          </div>
        </Modal>
      )}

      {/* Add / Edit Boss Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>{editBoss ? "✏️ Edit Boss" : "➕ Add Boss"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Boss Name</span>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Lv. 66 Cruel Outlaw Gand" />
            </label>
            {[["Min Respawn (min)", "respawn_min"], ["Max Respawn (min)", "respawn_max"], ["Window Duration (min)", "window_duration"], ["Channel", "channel"]].map(([lbl, key]) => (
              <label key={key} style={labelStyle}>
                <span style={{ color: T.textSub, fontSize: "12px" }}>{lbl}</span>
                <input type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
              </label>
            ))}
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Icon Ring Color</span>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ ...inputStyle, height: "40px", cursor: "pointer", padding: "4px" }} />
            </label>

            {/* Boss Image Upload */}
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={{ color: T.textSub, fontSize: "12px" }}>Boss Image (replaces 👹 icon — 78×78px recommended)</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  {/* Preview circle */}
                  <div style={{ width: "78px", height: "78px", borderRadius: "50%", border: `2px solid ${form.color}88`, background: form.color + "22", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {form.image_url
                      ? <img src={form.image_url} alt="preview" style={{ width: "78px", height: "78px", objectFit: "cover" }} />
                      : <span style={{ fontSize: "28px" }}>👹</span>
                    }
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input ref={bossImgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadBossImage} style={{ display: "none" }} />
                    <button type="button" onClick={() => bossImgRef.current?.click()} disabled={uploadingImg}
                      style={{ ...btn("blue"), width: "100%" }}>
                      {uploadingImg ? "⏳ Uploading…" : "📷 Upload Boss Image"}
                    </button>
                    <input
                      type="text"
                      value={form.image_url}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="Or paste image URL here"
                      style={{ ...inputStyle, fontSize: "11px" }}
                    />
                    {form.image_url
                      ? <button type="button" onClick={() => setForm(f => ({ ...f, image_url: "" }))} style={{ ...btn("red"), width: "100%", fontSize: "12px", padding: "6px" }}>✕ Remove Image (use 👹)</button>
                      : <span style={{ color: T.textMuted, fontSize: "11px" }}>Upload file or paste image URL above</span>
                    }
                  </div>
                </div>
              </label>
          </div>
          {saveErr && <div style={{ background: "#3a121222", border: `1px solid ${T.red}44`, borderRadius: "6px", color: T.redHi, fontSize: "12px", padding: "8px 12px", marginTop: "10px" }}>{saveErr}</div>}
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowModal(false)} style={btn("gray")}>Cancel</button>
            <button onClick={handleSave} disabled={uploadingImg} style={{ ...btn("blue"), opacity: uploadingImg ? 0.6 : 1 }}>
              {uploadingImg ? "Uploading…" : "Save Boss"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// ATTENDANCE TAB — real-time, member check-in + admin mark
// ============================================================
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function AttendanceTab({ role, currentUser }) {
  const [sessions, setSessions]           = useState([]);
  const [records, setRecords]             = useState([]);
  const [members, setMembers]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [codeInput, setCodeInput]         = useState("");
  const [codeError, setCodeError]         = useState("");
  const [codeSuccess, setCodeSuccess]     = useState(false);
  const [copied, setCopied]               = useState(false);

  const loadAll = async () => {
    const [{ data: sData }, { data: rData }, { data: mData }] = await Promise.all([
      supabase.from("attendance_sessions").select("*").order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("*"),
      supabase.from("members").select("id, name").order("name"),
    ]);
    if (sData) {
      setSessions(sData);
      const active = sData.find(s => s.is_active);
      setActiveSession(active || null);
      if (!selectedSession && sData.length > 0) setSelectedSession(sData[0].id);
    }
    if (rData) setRecords(rData);
    if (mData) setMembers(mData);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("attendance-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_sessions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, loadAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const createSession = async () => {
    if (!newSessionName.trim()) return;
    if (activeSession) {
      await supabase.from("attendance_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", activeSession.id);
    }
    const code = generateCode();
    const { data } = await supabase.from("attendance_sessions").insert([{
      name: newSessionName.trim(),
      is_active: true,
      created_by: currentUser.display,
      session_code: code,
    }]).select().single();
    setNewSessionName("");
    setShowNewSession(false);
    if (data) setSelectedSession(data.id);
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm("Delete this session permanently?")) return;
    await supabase.from("attendance_records").delete().eq("session_id", sessionId);
    await supabase.from("attendance_sessions").delete().eq("id", sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (selectedSession === sessionId) setSelectedSession(null);
  };

  const closeSession = async (sessionId) => {
    if (!window.confirm("Close this attendance session?")) return;
    await supabase.from("attendance_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", sessionId);
  };

  const checkIn = async (memberName, sessionId, markedBy) => {
    const sid = sessionId || activeSession?.id;
    if (!sid) return alert("No active session to check in to.");
    const existing = records.find(r => r.session_id === sid && r.member_name === memberName);
    if (existing) return;
    await supabase.from("attendance_records").insert([{
      session_id: sid,
      member_name: memberName,
      checked_in_at: new Date().toISOString(),
      marked_by: markedBy || currentUser.display,
    }]);
  };

  const removeRecord = async (recordId) => {
    await supabase.from("attendance_records").delete().eq("id", recordId);
  };

  // Code-based self check-in
  const submitCode = async () => {
    setCodeError("");
    if (!codeInput.trim()) { setCodeError("Please enter the session code."); return; }
    if (!activeSession) { setCodeError("No active session right now."); return; }
    const entered = codeInput.trim().toUpperCase();
    const correct = activeSession.session_code?.toUpperCase();
    if (entered !== correct) {
      setCodeError("❌ Wrong code. Ask your leader for the correct code.");
      setCodeInput("");
      return;
    }
    const existing = records.find(r => r.session_id === activeSession.id && r.member_name === currentUser.display);
    if (existing) { setCodeError("You're already checked in!"); return; }
    await supabase.from("attendance_records").insert([{
      session_id: activeSession.id,
      member_name: currentUser.display,
      checked_in_at: new Date().toISOString(),
      marked_by: currentUser.display,
    }]);
    setCodeSuccess(true);
    setCodeInput("");
  };

  const copyCode = () => {
    if (activeSession?.session_code) {
      navigator.clipboard.writeText(activeSession.session_code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const sessionRecords    = records.filter(r => r.session_id === selectedSession);
  const sessionMemberNames = new Set(sessionRecords.map(r => r.member_name));
  const presentCount      = sessionRecords.length;
  const absentCount       = members.length - presentCount;
  const selectedSess      = sessions.find(s => s.id === selectedSession);
  const totalSessions     = sessions.filter(s => !s.is_active).length;
  const myCheckIns        = records.filter(r => r.member_name === currentUser.display).length;
  const isAlreadyCheckedIn = activeSession && records.some(r => r.session_id === activeSession.id && r.member_name === currentUser.display);
  const isLeader          = can(role, "markAttendance");

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading attendance…</div>;

  return (
    <div>
      <SectionHeader icon="📋" title="Attendance" sub="Session code check-in system" actions={[
        isLeader && <button key="new" onClick={() => setShowNewSession(true)} style={btn("gold")}>+ New Session</button>,
        activeSession && isLeader && <button key="close" onClick={() => closeSession(activeSession.id)} style={btn("red")}>🔒 Close Session</button>,
      ].filter(Boolean)} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginBottom: "24px" }}>
        <StatBadge label="Total Sessions" value={sessions.length} color={T.blueHi} />
        <StatBadge label="Completed" value={totalSessions} color={T.textSub} />
        <StatBadge label="My Check-ins" value={myCheckIns} color={T.greenHi} />
        {selectedSess && <StatBadge label="Present" value={presentCount} color={T.greenHi} />}
        {selectedSess && <StatBadge label="Absent" value={Math.max(0, absentCount)} color={T.redHi} />}
      </div>

      {/* Active session block */}
      {activeSession ? (
        <div style={{ marginBottom: "20px" }}>

          {/* LEADER view — show the code prominently */}
          {isLeader && (
            <div style={{ background: "#0d2e1e", border: `1px solid ${T.green}55`, borderRadius: "12px", padding: "16px 20px", marginBottom: "12px" }}>
              <div style={{ color: T.greenHi, fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>🟢 Active: {activeSession.name}</div>
              <div style={{ color: T.textSub, fontSize: "12px", marginBottom: "14px" }}>Started by {activeSession.created_by} · {formatDate(activeSession.created_at)}</div>
              <div style={{ color: T.textSub, fontSize: "12px", fontWeight: "600", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>📢 Share this code with members:</div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ background: T.bg0, border: `2px solid ${T.gold}88`, borderRadius: "10px", padding: "10px 24px", letterSpacing: "0.3em", fontSize: "28px", fontWeight: "900", color: T.goldHi, fontFamily: "monospace" }}>
                  {activeSession.session_code || "——"}
                </div>
                <button onClick={copyCode} style={{ ...btn(copied ? "green" : "gold"), fontSize: "13px", padding: "8px 18px" }}>
                  {copied ? "✅ Copied!" : "📋 Copy Code"}
                </button>
              </div>
              <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "10px" }}>Share this in Discord or in-game chat. Only members who see it can check in.</div>
            </div>
          )}

          {/* MEMBER view — code input box */}
          {!isAlreadyCheckedIn && !codeSuccess ? (
            <div style={{ background: T.bg2, border: `1px solid ${T.borderHi}`, borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ color: T.text, fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>🟢 Session Active: {activeSession.name}</div>
              <div style={{ color: T.textMuted, fontSize: "12px", marginBottom: "14px" }}>Enter the code shared by your leader to mark yourself present.</div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(""); }}
                  onKeyDown={e => e.key === "Enter" && submitCode()}
                  maxLength={6}
                  placeholder="Enter code e.g. WOLF47"
                  style={{ ...inputStyle, width: "180px", letterSpacing: "0.2em", fontSize: "18px", fontWeight: "700", fontFamily: "monospace", textTransform: "uppercase" }}
                />
                <button onClick={submitCode} style={{ ...btn("green"), fontSize: "14px", padding: "9px 22px" }}>✅ Check In</button>
              </div>
              {codeError && <div style={{ color: T.redHi, fontSize: "13px", marginTop: "8px" }}>{codeError}</div>}
            </div>
          ) : (
            <div style={{ background: T.greenGlow, border: `1px solid ${T.green}55`, borderRadius: "12px", padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>✅</span>
              <div>
                <div style={{ color: T.greenHi, fontWeight: "700", fontSize: "14px" }}>You're checked in for: {activeSession.name}</div>
                <div style={{ color: T.textSub, fontSize: "12px", marginTop: "2px" }}>Your attendance has been recorded.</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", color: T.textMuted, fontSize: "14px" }}>
          ⚪ No active session. {isLeader ? 'Click "+ New Session" to start one.' : "Wait for your leader to open a session."}
        </div>
      )}

      {/* Session selector */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: T.textSub, fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>View Session Records</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {sessions.map(s => (
              <button key={s.id} onClick={() => setSelectedSession(s.id)} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${selectedSession === s.id ? T.blue : T.border}`, cursor: "pointer", background: selectedSession === s.id ? "#1a2f5c" : T.bg3, color: selectedSession === s.id ? T.blueHi : T.textSub, fontSize: "12px", fontWeight: selectedSession === s.id ? "700" : "400", display: "flex", alignItems: "center", gap: "6px" }}>
                {s.is_active && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.greenHi, display: "inline-block" }}></span>}
                {s.name}
                {isLeader && (
                  <span onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} style={{ color: T.redHi, marginLeft: "4px", cursor: "pointer", fontSize: "10px" }}>✕</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attendance table */}
      {selectedSess && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
            <div style={{ color: T.text, fontWeight: "600" }}>{selectedSess.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {selectedSess.session_code && isLeader && (
                <span style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "6px", padding: "3px 10px", color: T.gold, fontFamily: "monospace", fontSize: "13px", fontWeight: "700", letterSpacing: "0.15em" }}>
                  Code: {selectedSess.session_code}
                </span>
              )}
              <div style={{ color: T.textMuted, fontSize: "12px" }}>{formatDate(selectedSess.created_at)}{!selectedSess.is_active && selectedSess.ended_at ? ` — ${formatDate(selectedSess.ended_at)}` : ""}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
            {/* Present */}
            <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ background: T.greenGlow, borderBottom: `1px solid ${T.green}44`, padding: "10px 14px", color: T.greenHi, fontWeight: "700", fontSize: "13px" }}>✅ Present ({presentCount})</div>
              <div style={{ padding: "8px" }}>
                {sessionRecords.length === 0 && <div style={{ color: T.textMuted, padding: "12px", fontSize: "13px" }}>No check-ins yet.</div>}
                {sessionRecords.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>
                    <div>
                      <div style={{ color: T.text, fontSize: "13px", fontWeight: "600" }}>{r.member_name}</div>
                      <div style={{ color: T.textMuted, fontSize: "11px" }}>
                        {formatDate(r.checked_in_at)}
                        {r.marked_by && r.marked_by !== r.member_name && ` · by ${r.marked_by}`}
                      </div>
                    </div>
                    {isLeader && (
                      <button onClick={() => removeRecord(r.id)} style={{ background: "none", border: "none", color: T.redHi, cursor: "pointer", fontSize: "16px", padding: "4px 6px" }} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Absent */}
            <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ background: "#3a121222", borderBottom: `1px solid ${T.red}33`, padding: "10px 14px", color: T.redHi, fontWeight: "700", fontSize: "13px" }}>❌ Absent ({Math.max(0, members.length - presentCount)})</div>
              <div style={{ padding: "8px" }}>
                {members.filter(m => !sessionMemberNames.has(m.name)).length === 0 && (
                  <div style={{ color: T.textMuted, padding: "12px", fontSize: "13px" }}>Everyone is present! 🎉</div>
                )}
                {members.filter(m => !sessionMemberNames.has(m.name)).map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ color: T.textSub, fontSize: "13px" }}>{m.name}</div>
                    {isLeader && activeSession && (
                      <button onClick={() => checkIn(m.name, activeSession.id, currentUser.display)} style={{ ...btn("green"), fontSize: "11px", padding: "4px 10px" }}>Mark Present</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>No sessions yet. {isLeader ? 'Click "+ New Session" to create one.' : ""}</div>
      )}

      {showNewSession && (
        <Modal onClose={() => setShowNewSession(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>📋 New Attendance Session</h2>
          <label style={labelStyle}>
            <span style={{ color: T.textSub, fontSize: "12px" }}>Session Name</span>
            <input type="text" value={newSessionName} onChange={e => setNewSessionName(e.target.value)} onKeyDown={e => e.key === "Enter" && createSession()} style={inputStyle} autoFocus placeholder="e.g. Weekly Raid - May 14" />
          </label>
          <div style={{ marginTop: "12px", background: T.blueGlow, border: `1px solid ${T.blue}44`, borderRadius: "8px", color: T.blueHi, fontSize: "12px", padding: "10px 14px" }}>
            🔑 A random 6-character code will be generated automatically. Share it with members in Discord or in-game chat to let them check in.
          </div>
          {activeSession && (
            <div style={{ marginTop: "10px", background: T.goldGlow, border: `1px solid ${T.gold}44`, borderRadius: "8px", color: T.gold, fontSize: "12px", padding: "10px 14px" }}>
              ⚠️ This will close the current active session: <strong>{activeSession.name}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowNewSession(false)} style={btn("gray")}>Cancel</button>
            <button onClick={createSession} style={btn("green")}>Start Session</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// AUCTION TAB — with real-time point deduction / refund
// ============================================================
function AuctionTab({ role, currentUser }) {
  const [auctions, setAuctions]         = useState([]);
  const [declaredItemIds, setDeclaredItemIds] = useState(new Set());
  const [loading, setLoading]           = useState(true);
  const [now, setNow]                   = useState(Date.now());
  const [filter, setFilter]             = useState("All");
  const [showModal, setShowModal]       = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [form, setForm]                 = useState({ name: "", type: "Equipment", highestBid: 0, bidder: "-", hoursLeft: 48, durationUnit: "hours", imageUrl: "" });
  const [bidModal, setBidModal]         = useState(null);
  const [bidForm, setBidForm]           = useState({ amount: "", bidder: "" });
  const [saveError, setSaveError]       = useState("");
  const [bidError, setBidError]         = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [declareModal, setDeclareModal] = useState(null);
  const [declareForm, setDeclareForm]   = useState({ winnerName: "", amount: "" });
  const colFormat = useRef(null);
  const auctionImgRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Auto-create winner when timer hits 0 and there is a valid bidder
  useEffect(() => {
    const checkEnded = async () => {
      const ended = auctions.filter(a =>
        a.endsAt < Date.now() &&
        a.bidder &&
        a.bidder !== "-" &&
        a.highestBid > 0
      );
      for (const item of ended) {
        const { data: existing } = await supabase
          .from("auction_winners")
          .select("id")
          .eq("item_id", item.id)
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase.from("auction_winners").insert([{
            item_id:   item.id,
            item_name: item.name,
            bidder:    item.bidder,
            amount:    item.highestBid,
            claimed:   false,
          }]);
          if (error) console.error("Auto-winner insert failed:", error.message);
        }
      }
    };
    if (auctions.length > 0) checkEnded();
  }, [auctions, now]);

  const loadAuctions = async () => {
    const { data, error } = await supabase.from("auction_items").select("*").order("created_at", { ascending: true });
    if (error) { setLoading(false); return; }
    if (data && data.length > 0) {
      const first = data[0];
      if ("highestBid" in first) colFormat.current = "camel";
      else if ("highest_bid" in first) colFormat.current = "snake";
    }
    if (data) {
      setAuctions(data.map(row => ({
        id:         row.id,
        name:       row.name,
        type:       row.type || "Equipment",
        imageEmoji: row.imageEmoji || row.image_emoji || "⚔️",
        imageUrl:   row.imageUrl || row.image_url || "",
        highestBid: row.highestBid ?? row.highest_bid ?? 0,
        bidder:     row.bidder ?? "-",
        endsAt:     row.endsAt || row.ends_at ? new Date(row.endsAt ?? row.ends_at).getTime() : Date.now() + 3600000 * 48,
      })));
    }
    // Load which item_ids already have a declared winner
    const { data: winnerRows } = await supabase.from("auction_winners").select("item_id");
    if (winnerRows) setDeclaredItemIds(new Set(winnerRows.map(w => w.item_id)));
    setLoading(false);
  };

  useEffect(() => {
    loadAuctions();
    const ch1 = supabase.channel("auctions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_items" }, loadAuctions)
      .subscribe();
    const ch2 = supabase.channel("auction-winners-rt-auction")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_winners" }, loadAuctions)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const buildPayload = (fields) => {
    if (colFormat.current === "camel") return { name: fields.name, type: fields.type, imageEmoji: fields.emoji, imageUrl: fields.imageUrl, highestBid: fields.highestBid, bidder: fields.bidder, endsAt: fields.endsAt };
    return { name: fields.name, type: fields.type, image_emoji: fields.emoji, image_url: fields.imageUrl, highest_bid: fields.highestBid, bidder: fields.bidder, ends_at: fields.endsAt };
  };

  const EMOJIS = { Equipment: "⚔️", Material: "💎", Consumable: "🧪", Currency: "💰" };
  const types  = ["All", "Equipment", "Material", "Consumable", "Currency"];
  const filtered = auctions.filter(a => filter === "All" || a.type === filter);

  const openAdd  = () => { setSaveError(""); setEditItem(null); setForm({ name: "", type: "Equipment", highestBid: 0, bidder: "-", hoursLeft: 48, durationUnit: "hours", imageUrl: "" }); setShowModal(true); };
  const openEdit = (a) => { setSaveError(""); setEditItem(a); setForm({ ...a, hoursLeft: Math.max(0, Math.round((a.endsAt - Date.now()) / 3600000)), durationUnit: "hours", imageUrl: a.imageUrl || "" }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaveError("");
    const unitMs = form.durationUnit === "seconds" ? 1000 : form.durationUnit === "minutes" ? 60000 : 3600000;
    const endsAt  = new Date(Date.now() + +form.hoursLeft * unitMs).toISOString();
    const payload = buildPayload({ name: form.name, type: form.type, emoji: EMOJIS[form.type] || "⚔️", imageUrl: form.imageUrl || "", highestBid: +form.highestBid, bidder: form.bidder || "-", endsAt });
    let result;
    if (editItem) result = await supabase.from("auction_items").update(payload).eq("id", editItem.id).select();
    else result = await supabase.from("auction_items").insert([payload]).select();
    if (result.error) { setSaveError(`❌ ${result.error.message}`); return; }
    setShowModal(false);
    loadAuctions();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this auction item?")) {
      await supabase.from("auction_items").delete().eq("id", id);
    }
  };

  const openDeclare = (item) => {
    setDeclareForm({ winnerName: item.bidder !== "-" ? item.bidder : "", amount: item.highestBid || "" });
    setDeclareModal(item);
  };

  const confirmDeclare = async () => {
    if (!declareForm.winnerName.trim()) return;
    const winnerName = declareForm.winnerName.trim();
    const winnerAmt  = +declareForm.amount || 0;

    // Upsert winner record (insert or update if already exists for this item)
    const { data: existing } = await supabase
      .from("auction_winners")
      .select("id")
      .eq("item_id", declareModal.id)
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from("auction_winners")
        .update({ bidder: winnerName, amount: winnerAmt, claimed: false })
        .eq("item_id", declareModal.id);
      if (upErr) {
        console.error("Winner update failed:", upErr.message, upErr.details, upErr.hint);
        alert("Failed to update winner: " + upErr.message + (upErr.hint ? "\nHint: " + upErr.hint : ""));
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from("auction_winners")
        .insert([{ item_id: declareModal.id, item_name: declareModal.name, bidder: winnerName, amount: winnerAmt, claimed: false }]);
      if (insErr) {
        console.error("Winner insert failed:", insErr.message, insErr.details, insErr.hint);
        alert("Failed to insert winner: " + insErr.message + (insErr.hint ? "\nHint: " + insErr.hint : ""));
        return;
      }
    }

    // Update auction card with correct column format
    const itemPayload = colFormat.current === "camel"
      ? { highestBid: winnerAmt, bidder: winnerName }
      : { highest_bid: winnerAmt, bidder: winnerName };
    await supabase.from("auction_items").update(itemPayload).eq("id", declareModal.id);

    setDeclareModal(null);
    loadAuctions();
  };

  const openBid = (item) => {
    setBidError("");
    setBidModal(item);
    setBidForm({ amount: item.highestBid + 10, bidder: currentUser.display });
  };

  // ── Real-time bidding with point deduction & refund ──
  const confirmBid = async () => {
    setBidError("");
    const newBid     = +bidForm.amount;
    const bidderName = bidForm.bidder || currentUser.display;

    if (newBid <= bidModal.highestBid) { setBidError("Bid must be higher than current bid!"); return; }

    // Get bidder's current points from users table
    const { data: bidderUser } = await supabase.from("users").select("id, points, display").eq("display", bidderName).maybeSingle();
    if (!bidderUser) { setBidError("Could not find your user account."); return; }
    if ((bidderUser.points || 0) < newBid) { setBidError(`Not enough points! You have ${bidderUser.points || 0} PTS but need ${newBid} PTS.`); return; }

    // Refund previous bidder if not the same person
    const prevBidder = bidModal.bidder;
    const prevAmount = bidModal.highestBid;
    if (prevBidder && prevBidder !== "-" && prevBidder !== bidderName && prevAmount > 0) {
      const { data: prevUser } = await supabase.from("users").select("id, points").eq("display", prevBidder).maybeSingle();
      if (prevUser) {
        await supabase.from("users").update({ points: (prevUser.points || 0) + prevAmount }).eq("id", prevUser.id);
      }
    }

    // Deduct points from new bidder
    await supabase.from("users").update({ points: (bidderUser.points || 0) - newBid }).eq("id", bidderUser.id);

    // Update the auction item
    const bidPayload = colFormat.current === "camel"
      ? { highestBid: newBid, bidder: bidderName }
      : { highest_bid: newBid, bidder: bidderName };
    const { error } = await supabase.from("auction_items").update(bidPayload).eq("id", bidModal.id);
    if (error) { setBidError("Bid failed: " + error.message); return; }

    setBidModal(null);
  };

  // Upload image to Supabase storage and return public URL
  const uploadImage = async (file, bucket = "auction-item") => {
    if (!file) return "";
    setUploadingImg(true);
    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(filename, file, { upsert: true, contentType: file.type });
    setUploadingImg(false);
    if (upErr) { setSaveError("Image upload failed: " + upErr.message); return ""; }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
    return urlData?.publicUrl || "";
  };

  const handleAuctionImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "auction-images");
    if (url) setForm(f => ({ ...f, imageUrl: url }));
  };

  const getTimeColor = (endsAt) => { const diff = endsAt - now; if (diff < 3600000) return T.redHi; if (diff < 86400000) return T.goldHi; return T.textSub; };

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading auctions…</div>;

  return (
    <div>
      <SectionHeader icon="🏆" title="Auction House" sub="Bid with guild points — real-time deduction & refund" actions={[
        can(role, "addAuction") && <button key="add" onClick={openAdd} style={btn("gold")}>+ Add Item</button>,
      ].filter(Boolean)} />

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
        {types.map(t => <button key={t} onClick={() => setFilter(t)} style={{ padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", background: filter === t ? T.gold : T.bg3, color: filter === t ? "#fff" : T.textSub, fontSize: "13px", fontWeight: filter === t ? "700" : "400" }}>{t}</button>)}
      </div>

      {auctions.length === 0 && <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>No auction items yet.{can(role, "addAuction") ? " Click \"+ Add Item\" to create one." : ""}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
        {filtered.map(item => {
          const ended = item.endsAt < now;
          return (
            <div key={item.id} style={{ background: T.bg2, border: `1px solid ${ended ? T.border : T.borderHi}`, borderRadius: "14px", overflow: "hidden", opacity: ended ? 0.65 : 1, transition: "transform 0.15s" }}>
              <div style={{ background: T.bg3, padding: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "52px", position: "relative", height: "100px" }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} style={{ width: "78px", height: "78px", objectFit: "cover", borderRadius: "8px" }} />
                  : <span style={{ fontSize: "52px" }}>{item.imageEmoji}</span>
                }
                <span style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", background: ended ? T.bg0 : T.goldGlow, color: ended ? T.textMuted : T.goldHi, border: `1px solid ${ended ? T.border : T.gold}55`, fontSize: "10px", padding: "2px 10px", borderRadius: "20px", whiteSpace: "nowrap", fontWeight: "700", letterSpacing: "0.06em" }}>{ended ? "ENDED" : "LIVE"}</span>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ color: getTimeColor(item.endsAt), fontSize: "11px", marginBottom: "4px" }}>⏱ {ended ? "Ended" : formatCountdown(item.endsAt)}</div>
                <div style={{ color: T.text, fontWeight: "700", fontSize: "15px", marginBottom: "8px" }}>{item.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span style={{ color: T.textMuted, fontSize: "12px" }}>Highest Bid</span><span style={{ color: item.highestBid > 0 ? T.goldHi : T.text, fontWeight: "700" }}>{item.highestBid} PTS</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}><span style={{ color: T.textMuted, fontSize: "12px" }}>Bidder</span><span style={{ color: T.textSub, fontSize: "13px" }}>{item.bidder}</span></div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {declaredItemIds.has(item.id)
                    ? <div style={{ flex: 1, background: T.greenGlow, border: `1px solid ${T.green}55`, borderRadius: "8px", padding: "6px", textAlign: "center", color: T.greenHi, fontSize: "12px", fontWeight: "700" }}>🏆 Winner Declared</div>
                    : (!ended && can(role, "placeBid") && <button onClick={() => openBid(item)} style={{ flex: 1, ...btn("gold"), padding: "6px", justifyContent: "center", textAlign: "center" }}>Place Bid</button>)
                  }
                  {can(role, "editAuction") && <button onClick={() => openEdit(item)} style={{ ...btn("gray"), padding: "6px 10px" }}>Edit</button>}
                  {can(role, "editAuction") && <button onClick={() => handleDelete(item.id)} style={{ ...btn("red"), padding: "6px 10px" }}>✕</button>}
                  {can(role, "editAuction") && !declaredItemIds.has(item.id) && <button onClick={() => openDeclare(item)} style={{ ...btn("green"), padding: "6px 10px", fontSize: "11px" }} title="Declare Winner manually">🏆</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>{editItem ? "✏️ Edit Auction Item" : "➕ Add Auction Item"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Item Name</span>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Kari Helmet" />
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Type</span>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                {["Equipment", "Material", "Consumable", "Currency"].map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Duration</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <input type="number" min="0" step="1" value={form.hoursLeft} onChange={e => setForm({ ...form, hoursLeft: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="e.g. 48" />
                <select value={form.durationUnit} onChange={e => setForm({ ...form, durationUnit: e.target.value })} style={{ ...inputStyle, width: "110px", flex: "none" }}>
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Starting / Min Bid (PTS)</span>
              <input type="number" min="0" value={form.highestBid} onChange={e => setForm({ ...form, highestBid: e.target.value })} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Starting Bidder</span>
              <input type="text" value={form.bidder} onChange={e => setForm({ ...form, bidder: e.target.value })} style={inputStyle} placeholder="-" />
            </label>
            {/* Image upload — admin/leader/elder only */}
            {can(role, "uploadImage") && (
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={{ color: T.textSub, fontSize: "12px" }}>Item Image (78×78 px recommended — replaces emoji)</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <div style={{ width: "78px", height: "78px", borderRadius: "10px", border: `1px dashed ${T.borderHi}`, background: T.bg0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {form.imageUrl
                      ? <img src={form.imageUrl} alt="preview" style={{ width: "78px", height: "78px", objectFit: "cover", borderRadius: "10px" }} />
                      : <span style={{ fontSize: "36px" }}>{EMOJIS[form.type] || "⚔️"}</span>
                    }
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input ref={auctionImgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAuctionImageUpload} style={{ display: "none" }} />
                    <button type="button" onClick={() => auctionImgRef.current?.click()} disabled={uploadingImg}
                      style={{ ...btn("blue"), width: "100%" }}>
                      {uploadingImg ? "⏳ Uploading…" : "📷 Upload Item Image"}
                    </button>
                    {form.imageUrl
                      ? <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: "" }))} style={{ ...btn("red"), width: "100%", fontSize: "12px", padding: "6px" }}>✕ Remove Image (use emoji)</button>
                      : <span style={{ color: T.textMuted, fontSize: "11px" }}>PNG / JPG / WebP — stored in Supabase "auction-images" bucket</span>
                    }
                  </div>
                </div>
              </label>
            )}
          </div>
          {saveError && <div style={{ background: "#3a121222", border: `1px solid ${T.red}44`, borderRadius: "6px", color: T.redHi, fontSize: "12px", padding: "8px 12px", marginTop: "10px" }}>{saveError}</div>}
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowModal(false)} style={btn("gray")}>Cancel</button>
            <button onClick={handleSave} disabled={uploadingImg} style={{ ...btn("gold"), opacity: uploadingImg ? 0.6 : 1 }}>
              {uploadingImg ? "Uploading…" : "Save Item"}
            </button>
          </div>
        </Modal>
      )}

      {bidModal && (
        <Modal onClose={() => setBidModal(null)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>🏆 Place Bid — {bidModal.name}</h2>
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: T.textSub, fontSize: "13px" }}>Current Highest</span>
              <span style={{ color: T.goldHi, fontWeight: "700" }}>{bidModal.highestBid} PTS — {bidModal.bidder}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textSub, fontSize: "13px" }}>Your Points</span>
              <span style={{ color: T.blueHi, fontWeight: "700" }}>— (loaded from DB)</span>
            </div>
          </div>
          <div style={{ background: T.blueGlow, border: `1px solid ${T.blue}44`, borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", color: T.blueHi, fontSize: "12px" }}>
            💡 Your bid is <strong>deducted immediately</strong>. If you get outbid, your points are <strong>refunded automatically</strong>.
          </div>
          <label style={labelStyle}><span style={{ color: T.textSub, fontSize: "12px" }}>Your Bid (PTS)</span><input type="number" value={bidForm.amount} onChange={e => setBidForm({ ...bidForm, amount: e.target.value })} style={inputStyle} /></label>
          <label style={{ ...labelStyle, marginTop: "10px" }}><span style={{ color: T.textSub, fontSize: "12px" }}>Your Character Name</span><input type="text" value={bidForm.bidder} onChange={e => setBidForm({ ...bidForm, bidder: e.target.value })} style={inputStyle} /></label>
          {bidError && <p style={{ color: T.redHi, fontSize: "12px", marginTop: "8px" }}>⚠️ {bidError}</p>}
          {+bidForm.amount <= bidModal.highestBid && !bidError && <p style={{ color: T.redHi, fontSize: "12px" }}>⚠️ Bid must be higher than current bid!</p>}
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setBidModal(null)} style={btn("gray")}>Cancel</button>
            <button onClick={confirmBid} disabled={+bidForm.amount <= bidModal.highestBid} style={{ ...btn("gold"), opacity: +bidForm.amount <= bidModal.highestBid ? 0.5 : 1 }}>Confirm Bid</button>
          </div>
        </Modal>
      )}
      {declareModal && (
        <Modal onClose={() => setDeclareModal(null)}>
          <h2 style={{ color: T.text, marginTop: 0 }}>🏆 Declare Winner — {declareModal.name}</h2>
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ color: T.textSub, fontSize: "13px", marginBottom: "4px" }}>Current highest bid: <strong style={{ color: T.goldHi }}>{declareModal.highestBid} PTS — {declareModal.bidder}</strong></div>
            <div style={{ color: T.textMuted, fontSize: "12px" }}>You can override the winner name and amount below (e.g. if no bids were placed).</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Winner Name (character name)</span>
              <input type="text" value={declareForm.winnerName} onChange={e => setDeclareForm({ ...declareForm, winnerName: e.target.value })} style={inputStyle} placeholder="Enter winner's character name" autoFocus />
            </label>
            <label style={labelStyle}>
              <span style={{ color: T.textSub, fontSize: "12px" }}>Final Amount (PTS)</span>
              <input type="number" min="0" value={declareForm.amount} onChange={e => setDeclareForm({ ...declareForm, amount: e.target.value })} style={inputStyle} placeholder="0" />
            </label>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px", justifyContent: "flex-end" }}>
            <button onClick={() => setDeclareModal(null)} style={btn("gray")}>Cancel</button>
            <button onClick={confirmDeclare} disabled={!declareForm.winnerName.trim()} style={{ ...btn("green"), opacity: !declareForm.winnerName.trim() ? 0.5 : 1 }}>✅ Declare Winner</button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ============================================================
// AUCTION WINNERS TAB — history log, claimed/unclaimed
// ============================================================
function WinnersTab({ role, currentUser }) {
  const [winners, setWinners]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterClaim, setFilterClaim] = useState("All");
  const [detailModal, setDetailModal] = useState(null);
  const [loadError, setLoadError] = useState("");

  const loadWinners = async () => {
    setLoadError("");
    const { data, error } = await supabase
      .from("auction_winners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Winners load error:", error.message, error.details, error.hint);
      setLoadError("⚠️ Could not load winners: " + error.message + (error.hint ? " — " + error.hint : ""));
    }
    if (data) setWinners(data);
    setLoading(false);
  };

  useEffect(() => {
    loadWinners();
    const ch = supabase.channel("winners-rt-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_winners" }, () => loadWinners())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const toggleClaim = async (w) => {
    const newClaimed = !w.claimed;
    await supabase.from("auction_winners").update({
      claimed: newClaimed,
      claimed_at: newClaimed ? new Date().toISOString() : null,
      claimed_by: newClaimed ? currentUser.display : null,
    }).eq("id", w.id);
  };

  const deleteWinner = async (id) => {
    if (window.confirm("Remove this winner record?")) {
      await supabase.from("auction_winners").delete().eq("id", id);
    }
  };

  const filtered = winners.filter(w => {
    if (filterClaim === "Claimed")   return w.claimed;
    if (filterClaim === "Unclaimed") return !w.claimed;
    return true;
  });

  const totalSpent     = winners.reduce((s, w) => s + (w.amount || 0), 0);
  const totalClaimed   = winners.filter(w => w.claimed).length;
  const totalUnclaimed = winners.filter(w => !w.claimed).length;

  const exportToExcel = () => {
    if (winners.length === 0) { alert("No winner records to export."); return; }
    // Build rows for main sheet
    const rows = winners.map((w, i) => ({
      "#":            i + 1,
      "Item Name":    w.item_name || "Unknown Item",
      "Winner":       w.bidder || "—",
      "Points Spent": w.amount || 0,
      "Status":       w.claimed ? "Claimed" : "Unclaimed",
      "Claimed By":   w.claimed_by || "—",
      "Claimed At":   w.claimed_at ? new Date(w.claimed_at).toLocaleString("en-PH") : "—",
      "Won At":       w.created_at ? new Date(w.created_at).toLocaleString("en-PH") : "—",
    }));

    // Build summary sheet per member
    const summary = Object.entries(
      winners.reduce((acc, w) => {
        if (!acc[w.bidder]) acc[w.bidder] = { wins: 0, spent: 0, claimed: 0, unclaimed: 0 };
        acc[w.bidder].wins++;
        acc[w.bidder].spent += w.amount || 0;
        if (w.claimed) acc[w.bidder].claimed++; else acc[w.bidder].unclaimed++;
        return acc;
      }, {})
    ).sort((a, b) => b[1].spent - a[1].spent)
     .map(([name, s], i) => ({
       "#": i + 1,
       "Member":        name,
       "Total Wins":    s.wins,
       "Points Spent":  s.spent,
       "Claimed":       s.claimed,
       "Unclaimed":     s.unclaimed,
     }));

    import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs").then(XLSX => {
      const wb = XLSX.utils.book_new();

      // Sheet 1 — All Winners
      const ws1 = XLSX.utils.json_to_sheet(rows);
      ws1["!cols"] = [
        { wch: 4 }, { wch: 28 }, { wch: 18 }, { wch: 14 },
        { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "All Winners");

      // Sheet 2 — Member Summary
      const ws2 = XLSX.utils.json_to_sheet(summary);
      ws2["!cols"] = [{ wch: 4 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Member Summary");

      // Sheet 3 — Unclaimed only (for follow-up)
      const unclaimed = rows.filter(r => r["Status"] === "Unclaimed");
      if (unclaimed.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(unclaimed);
        ws3["!cols"] = ws1["!cols"];
        XLSX.utils.book_append_sheet(wb, ws3, "Unclaimed Items");
      }

      const date = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      XLSX.writeFile(wb, `Rampage_Auction_Winners_${date}.xlsx`);
    }).catch(() => alert("Export failed — please check your internet connection."));
  };

  if (loading) return <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>Loading winners…</div>;

  return (
    <div>
      <SectionHeader icon="🥇" title="Auction Winners" sub="History log · claimed & unclaimed items" actions={[
        <button key="export" onClick={exportToExcel} style={{ ...btn("green"), fontSize: "12px", padding: "6px 14px" }}>📥 Export Excel</button>,
        <button key="refresh" onClick={loadWinners} style={{ ...btn("gray"), fontSize: "12px", padding: "6px 12px" }}>🔄 Refresh</button>,
      ]} />

      {loadError && (
        <div style={{ background: "#3a121222", border: `1px solid ${T.redHi}44`, borderRadius: "8px", color: T.redHi, fontSize: "13px", padding: "10px 14px", marginBottom: "16px" }}>
          {loadError}
          <div style={{ color: T.textMuted, fontSize: "11px", marginTop: "4px" }}>Check your Supabase RLS policies on the <code>auction_winners</code> table — make sure authenticated users can SELECT and INSERT.</div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginBottom: "24px" }}>
        <StatBadge label="Total Won" value={winners.length} color={T.goldHi} />
        <StatBadge label="Claimed" value={totalClaimed} color={T.greenHi} />
        <StatBadge label="Unclaimed" value={totalUnclaimed} color={T.redHi} />
        <StatBadge label="Points Spent" value={totalSpent} color={T.blueHi} />
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {["All", "Unclaimed", "Claimed"].map(f => (
          <button key={f} onClick={() => setFilterClaim(f)} style={{ padding: "6px 16px", borderRadius: "20px", border: "none", cursor: "pointer", background: filterClaim === f ? (f === "Claimed" ? T.green : f === "Unclaimed" ? T.red : T.blue) : T.bg3, color: filterClaim === f ? "#fff" : T.textSub, fontSize: "13px", fontWeight: filterClaim === f ? "700" : "400" }}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ color: T.textMuted, textAlign: "center", padding: "40px" }}>No winner records yet. Winners appear here when declared or when an auction ends.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(w => (
          <div key={w.id} style={{ background: T.bg2, border: `1px solid ${w.claimed ? T.green + "44" : T.border}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* Status dot */}
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: w.claimed ? T.greenHi : T.redHi, flexShrink: 0 }}></div>

            {/* Item info */}
            <div style={{ flex: 1, minWidth: "180px" }}>
              <div style={{ color: T.text, fontWeight: "700", fontSize: "14px" }}>{w.item_name || "Unknown Item"}</div>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap" }}>
                <span style={{ color: T.textSub, fontSize: "12px" }}>🏆 Won by <strong style={{ color: T.goldHi }}>{w.bidder}</strong></span>
                <span style={{ color: T.textSub, fontSize: "12px" }}>💰 <strong style={{ color: T.goldHi }}>{w.amount} PTS</strong></span>
                <span style={{ color: T.textMuted, fontSize: "12px" }}>📅 {formatDate(w.created_at)}</span>
              </div>
              {w.claimed && w.claimed_at && (
                <div style={{ color: T.greenHi, fontSize: "11px", marginTop: "4px" }}>
                  ✅ Claimed on {formatDate(w.claimed_at)}{w.claimed_by ? ` by ${w.claimed_by}` : ""}
                </div>
              )}
            </div>

            {/* Status badge */}
            <span style={{ background: w.claimed ? T.greenGlow : "#3a121222", border: `1px solid ${w.claimed ? T.green + "66" : T.red + "55"}`, color: w.claimed ? T.greenHi : T.redHi, padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>
              {w.claimed ? "✅ Claimed" : "⏳ Unclaimed"}
            </span>

            {/* Actions */}
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              {(can(role, "manageWinners") || w.bidder === currentUser?.display) && (
                <button onClick={() => toggleClaim(w)} style={{ ...btn(w.claimed ? "gray" : "green"), fontSize: "12px", padding: "6px 12px" }}>
                  {w.claimed ? "Unmark" : "Mark Claimed"}
                </button>
              )}
              {can(role, "manageWinners") && (
                <button onClick={() => deleteWinner(w.id)} style={{ ...btn("red"), fontSize: "12px", padding: "6px 10px" }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Per-member summary */}
      {winners.length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <div style={{ color: T.textSub, fontWeight: "700", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Per-Member Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
            {Object.entries(winners.reduce((acc, w) => {
              if (!acc[w.bidder]) acc[w.bidder] = { wins: 0, spent: 0, claimed: 0 };
              acc[w.bidder].wins++;
              acc[w.bidder].spent += w.amount || 0;
              if (w.claimed) acc[w.bidder].claimed++;
              return acc;
            }, {})).sort((a, b) => b[1].spent - a[1].spent).map(([name, stats]) => (
              <div key={name} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ color: T.text, fontWeight: "700", fontSize: "13px", marginBottom: "8px" }}>{name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: T.textMuted, fontSize: "12px" }}>Wins</span>
                  <span style={{ color: T.goldHi, fontSize: "12px", fontWeight: "700" }}>{stats.wins}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: T.textMuted, fontSize: "12px" }}>Total Spent</span>
                  <span style={{ color: T.blueHi, fontSize: "12px", fontWeight: "700" }}>{stats.spent} PTS</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: T.textMuted, fontSize: "12px" }}>Claimed</span>
                  <span style={{ color: T.greenHi, fontSize: "12px", fontWeight: "700" }}>{stats.claimed}/{stats.wins}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function GuildTracker() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { const saved = localStorage.getItem("guild_user"); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [tab, setTab] = useState("members");

  useEffect(() => {
    if (!currentUser) return;
    supabase.from("users").select("*").eq("id", currentUser.id).maybeSingle().then(({ data }) => {
      if (!data || data.role === "pending") {
        setCurrentUser(null); localStorage.removeItem("guild_user");
      } else if (data.role !== currentUser.role) {
        const updated = { ...currentUser, ...data };
        setCurrentUser(updated); localStorage.setItem("guild_user", JSON.stringify(updated));
      }
    });
  }, []);

  if (!currentUser) {
    return <LoginPage onLogin={(user) => { setCurrentUser(user); localStorage.setItem("guild_user", JSON.stringify(user)); }} />;
  }

  const role = currentUser.role;
  const rc   = roleColors[role] || roleColors.member;

  const tabs = [
    { id: "members",    label: "👥 Members"      },
    { id: "attendance", label: "📋 Attendance"    },
    { id: "bosses",     label: "👹 Boss Timer"    },
    { id: "auction",    label: "🏺 Auction House" },
    { id: "winners",    label: "🥇 Winners"       },
    ...(can(role, "manageUsers") ? [{ id: "users", label: "🔐 Manage Users" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg0, fontFamily: "'Segoe UI', system-ui, sans-serif", color: T.text,
      backgroundImage: "radial-gradient(ellipse at 10% 0%, #1a1f3a22 0%, transparent 50%), radial-gradient(ellipse at 90% 100%, #2a150a18 0%, transparent 50%)" }}>

      {/* ── Header ── */}
      <div style={{ background: T.bg1, borderBottom: `1px solid ${T.borderHi}`, padding: "0 24px",
        boxShadow: `0 2px 20px rgba(0,0,0,0.4)` }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 0", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img src="https://mbalsusqtkbtoxuawjau.supabase.co/storage/v1/object/public/asset/RAMPAGE%20FOR%20APP.png" alt="Rampage" style={{ width: "68px", height: "68px", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
              <div>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", letterSpacing: "0.1em",
                  background: `linear-gradient(135deg, ${T.goldHi} 0%, ${T.blueHi} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RAMPAGE TRACKER</h1>
                <p style={{ margin: "2px 0 0", color: T.textMuted, fontSize: "12px", letterSpacing: "0.04em" }}>Attendance · Boss Timers · Auction House · Winners</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: T.text, fontWeight: "600", fontSize: "14px" }}>{currentUser.display}</div>
                <span style={{ background: rc.bg, color: rc.text, padding: "2px 10px", borderRadius: "20px", fontSize: "11px" }}>{rc.label}</span>
              </div>
              <button onClick={() => { setCurrentUser(null); localStorage.removeItem("guild_user"); }} style={{ ...btn("red"), fontSize: "13px" }}>Logout</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "2px", marginTop: "14px", flexWrap: "wrap", overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 18px", background: tab === t.id ? T.bg3 : "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? T.gold : "transparent"}`, color: tab === t.id ? T.text : T.textMuted, cursor: "pointer", fontSize: "13px", fontWeight: tab === t.id ? "700" : "400", borderRadius: "6px 6px 0 0", whiteSpace: "nowrap", transition: "color 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "28px 24px" }}>
        {tab === "members"    && <MembersTab role={role} />}
        {tab === "attendance" && <AttendanceTab role={role} currentUser={currentUser} />}
        {tab === "bosses"     && <BossTimerTab role={role} />}
        {tab === "auction"    && <AuctionTab role={role} currentUser={currentUser} />}
        {tab === "winners"    && <WinnersTab role={role} currentUser={currentUser} />}
        {tab === "users"      && can(role, "manageUsers") && <UsersTab currentUser={currentUser} />}
      </div>
    </div>
  );
}
