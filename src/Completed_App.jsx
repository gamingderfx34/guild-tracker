import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// ── Supabase client ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mbalsusqtkbtoxuawjau.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_174MDqsta2KNe3orpEN8Ww_0yzhHYaM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Admin email (app creator/maintainer) ─────────────────────────────────────
// Set this to your real email. This user gets the "Admin" role automatically.
const ADMIN_EMAIL = ""; // e.g. "frederickcalibo1902@gmail.com"

// ── Role hierarchy ────────────────────────────────────────────────────────────
// Admin    - full access, can redesign, edit core
// Leader   - manage guild, bid, create bid items, manage members (limited)
// Elder    - same as Leader but limited (manage bid, bid for themselves)
// Member   - events, points, bid, edit boss timer
// Recruit  - events, points; CAN bid only after 7 days from account creation

const ROLES = ["Admin","Leader","Elder","Member","Recruit"];

function getEffectiveRole(user) {
  if (!user) return null;
  if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) return "Admin";
  return user.role || "Recruit";
}

function roleRank(role) {
  const idx = ROLES.indexOf(role);
  return idx === -1 ? 99 : idx; // lower = more powerful
}

// Permission helpers
function isAdmin(user)        { return getEffectiveRole(user) === "Admin"; }
function isLeader(user)       { return ["Admin","Leader"].includes(getEffectiveRole(user)); }
function isElder(user)        { return ["Admin","Leader","Elder"].includes(getEffectiveRole(user)); }
function isMember(user)       { return ["Admin","Leader","Elder","Member"].includes(getEffectiveRole(user)); }
function isRecruit(user)      { return getEffectiveRole(user) === "Recruit"; }

// Can manage bids / auction items (create, replace, manage)
function canManageBids(user)  { return ["Admin","Leader","Elder"].includes(getEffectiveRole(user)); }

// Can bid (Members always; Recruits only after 7 days)
function canBid(user, memberRecord) {
  const role = getEffectiveRole(user);
  if (["Admin","Leader","Elder","Member"].includes(role)) return true;
  if (role === "Recruit") {
    if (!memberRecord?.created_at) return false;
    const created = new Date(memberRecord.created_at).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - created >= sevenDays;
  }
  return false;
}

function daysUntilBid(memberRecord) {
  if (!memberRecord?.created_at) return 7;
  const created = new Date(memberRecord.created_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const diff = sevenDays - (Date.now() - created);
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

// Can create/manage events
function canManageEvents(user) { return ["Admin","Leader","Elder","Member"].includes(getEffectiveRole(user)); }

// Can edit boss timer
function canEditBossTimer(user) { return ["Admin","Leader","Elder","Member"].includes(getEffectiveRole(user)); }

// Can manage members (add/edit/remove/change roles)
function canManageMembers(user) { return ["Admin","Leader"].includes(getEffectiveRole(user)); }

// Can wipe all data
function canWipeData(user) { return isAdmin(user); }

// ── Email validation ──────────────────────────────────────────────────────────
// Only accept real email domains. Reject fake/game domains like @rampage.gg, @guild.gg, etc.
const BLOCKED_DOMAINS = [
  "rampage.gg","rampageguild.gg","guild.gg","game.gg","myguild.gg",
  "example.com","test.com","fake.com","noreply.com","mailinator.com",
  "throwaway.email","guerrillamail.com","trashmail.com","temp-mail.org",
];

function isRealEmail(email) {
  const trimmed = email.trim().toLowerCase();
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) return { valid: false, reason: "Invalid email format." };

  const domain = trimmed.split("@")[1];

  // Block known fake/disposable domains
  if (BLOCKED_DOMAINS.some(d => domain === d || domain.endsWith("." + d))) {
    return { valid: false, reason: `"@${domain}" is not a real email domain. Use Gmail, Yahoo, Outlook, etc.` };
  }

  // Block .gg TLD entirely (game domains) unless it's a known real provider
  if (domain.endsWith(".gg") && !["discord.gg"].includes(domain)) {
    return { valid: false, reason: `"@${domain}" is a game domain, not a real email. Use Gmail, Yahoo, Outlook, etc.` };
  }

  return { valid: true };
}

// ── Constants ───────────────────────────────────────────────────────────────
const MOCK_LOGO = "https://mbalsusqtkbtoxuawjau.supabase.co/storage/v1/object/public/asset/RAMPAGE%20FOR%20APP.png";

// ── Boss helper ──────────────────────────────────────────────────────────────
function makeBossId() { return Date.now() + Math.random(); }

const DEFAULT_LIVE4 = [
  { id:"l1a", name:"Cruel Outlaw Gand",  secs:0, elapsed:0, minR:30, maxR:90, channel:1, color:"#f59e0b", image:null, group:"live4" },
  { id:"l1b", name:"Cruel Outlaw Gand",  secs:0, elapsed:0, minR:30, maxR:90, channel:2, color:"#f59e0b", image:null, group:"live4" },
  { id:"l2a", name:"Gatekeeper Amot",    secs:0, elapsed:0, minR:30, maxR:90, channel:1, color:"#60a5fa", image:null, group:"live4" },
  { id:"l2b", name:"Gatekeeper Amot",    secs:0, elapsed:0, minR:30, maxR:90, channel:2, color:"#60a5fa", image:null, group:"live4" },
  { id:"l3a", name:"Destroyer Hawler",   secs:0, elapsed:0, minR:30, maxR:90, channel:1, color:"#34d399", image:null, group:"live4" },
  { id:"l3b", name:"Destroyer Hawler",   secs:0, elapsed:0, minR:30, maxR:90, channel:2, color:"#34d399", image:null, group:"live4" },
  { id:"l4a", name:"Assulter Laudd",     secs:0, elapsed:0, minR:30, maxR:90, channel:1, color:"#a78bfa", image:null, group:"live4" },
  { id:"l4b", name:"Assulter Laudd",     secs:0, elapsed:0, minR:30, maxR:90, channel:2, color:"#a78bfa", image:null, group:"live4" },
];

const FOLKVANG_FLOORS = ["1F","2F","3F","4F","5F"];
function mkFolkvang(type, color) {
  return FOLKVANG_FLOORS.map((fl)=>({
    id:`fv_${type}_${fl}`, name:`Folkvang ${fl}`, floor:fl, type, secs:0, elapsed:0,
    respawnSecs:6300,
    channel:1, color, image:null, group:`folkvang_${type}`,
  }));
}
const DEFAULT_FOLKVANG_NORMAL = mkFolkvang("normal","#f97316");
const DEFAULT_FOLKVANG_INTERSERVER = mkFolkvang("interserver","#e879f9");

const CANYON_BOSSES_DEF = [
  { id:"can1", name:"Lv.65 Darkening Varulf Honcho",         color:"#fb923c" },
  { id:"can2", name:"Lv.67 Darkening Ground Jotunn Captain", color:"#f59e0b" },
  { id:"can3", name:"Lv.69 Darkening Frost Jotunn Captain",  color:"#60a5fa" },
];
function mkCanyon() {
  let arr=[];
  CANYON_BOSSES_DEF.forEach(b=>{
    [1,2,3].forEach(ch=>arr.push({...b,id:`${b.id}_ch${ch}`,secs:0,elapsed:0,respawnSecs:6300,channel:ch,image:null,group:"canyon"}));
  });
  return arr;
}
const DEFAULT_CANYON = mkCanyon();

const LINDWURM_BOSSES_DEF = [
  { id:"lw1", name:"Lv.76 Fierce Parasitic Mushroom Honcho", color:"#4ade80" },
  { id:"lw2", name:"Lv.77 Elder Troll Conquering Captain",   color:"#34d399" },
  { id:"lw3", name:"Lv.78 Cruel Harpy Honcho",               color:"#2dd4bf" },
];
function mkLindwurm() {
  let arr=[];
  LINDWURM_BOSSES_DEF.forEach(b=>{
    [1,2].forEach(ch=>arr.push({...b,id:`${b.id}_ch${ch}`,secs:0,elapsed:0,respawnSecs:6300,channel:ch,image:null,group:"lindwurm"}));
  });
  return arr;
}
const DEFAULT_LINDWURM = mkLindwurm();

const DEFAULT_BOSSES = [...DEFAULT_LIVE4];

const INIT_AUCTION_ITEMS = [
  { id:1, name:"Shadowfang Blade",   rarity:"Legendary", minBid:5000, currentBid:0, highBidder:null, bids:[], locked:false, winner:null, claimed:false, image:"⚔️", endTime: Date.now() + 3600000 },
  { id:2, name:"Frostweave Mantle",  rarity:"Epic",      minBid:2000, currentBid:0, highBidder:null, bids:[], locked:false, winner:null, claimed:false, image:"🧥", endTime: Date.now() + 7200000 },
  { id:3, name:"Runebound Shield",   rarity:"Rare",      minBid:800,  currentBid:0, highBidder:null, bids:[], locked:false, winner:null, claimed:false, image:"🛡️", endTime: Date.now() + 1800000 },
  { id:4, name:"Stormbringer Staff", rarity:"Epic",      minBid:3500, currentBid:0, highBidder:null, bids:[], locked:false, winner:null, claimed:false, image:"🔱", endTime: Date.now() + 5400000 },
];

const EVENT_TYPES = [
  { id:"sindri",    label:"Sindri Battle",    icon:"⚔️",  defaultPoints:10, color:"#f59e0b" },
  { id:"server",    label:"Server Battle",    icon:"🌐",  defaultPoints:5,  color:"#60a5fa" },
  { id:"fieldboss", label:"Field Boss",       icon:"👹",  defaultPoints:5,  color:"#f87171" },
  { id:"sanctuary", label:"Guild Sanctuary",  icon:"🏛️",  defaultPoints:5,  color:"#34d399" },
  { id:"ymir",      label:"Ymir Cup",         icon:"🏆",  defaultPoints:5,  color:"#a78bfa" },
];

const FIELD_BOSS_SCHEDULE = [
  { name:"Twilight Overlord Rogvalt", map:"Canyon of the World Tree Depth", days:["Sunday","Wednesday","Saturday"], time:"21:00" },
  { name:"Nargrim",                   map:"Vale of Ragnarok",                days:["Monday","Saturday"],            time:"21:05" },
  { name:"Faded Oath Vargreif",       map:"Crossroads of Ragnarok",          days:["Wednesday","Friday"],           time:"21:10" },
  { name:"Twilight Disaster Nirva",   map:"(Inter-Server) Folkvang 5F",      days:["Sunday","Monday","Friday"],     time:"21:15" },
];

const NAV = [
  { id:"dashboard",  label:"Dashboard",     icon:"⊞"  },
  { id:"members",    label:"Members",       icon:"👥" },
  { id:"bosses",     label:"Boss Timers",   icon:"⚔️" },
  { id:"events",     label:"Events",        icon:"📅" },
  { id:"attendance", label:"Attendance",    icon:"📋" },
  { id:"auction",    label:"Auction House", icon:"🏺" },
  { id:"winners",    label:"Winners",       icon:"🥇" },
  { id:"settings",   label:"Settings",      icon:"⚙️" },
];

const ROLE_STYLE = {
  Admin:   { bg:"rgba(239,68,68,0.15)",   color:"#f87171", border:"rgba(239,68,68,0.4)"    },
  Leader:  { bg:"rgba(251,191,36,0.15)",  color:"#fbbf24", border:"rgba(251,191,36,0.35)"  },
  Elder:   { bg:"rgba(96,165,250,0.15)",  color:"#60a5fa", border:"rgba(96,165,250,0.35)"  },
  Member:  { bg:"rgba(148,163,184,0.1)",  color:"#94a3b8", border:"rgba(148,163,184,0.25)" },
  Recruit: { bg:"rgba(167,139,250,0.15)", color:"#a78bfa", border:"rgba(167,139,250,0.35)" },
};

const RARITY_STYLE = {
  Legendary: { color:"#f59e0b", glow:"rgba(245,158,11,0.3)",  bg:"rgba(245,158,11,0.1)"  },
  Epic:      { color:"#a78bfa", glow:"rgba(167,139,250,0.3)", bg:"rgba(167,139,250,0.1)" },
  Rare:      { color:"#60a5fa", glow:"rgba(96,165,250,0.3)",  bg:"rgba(96,165,250,0.1)"  },
  Common:    { color:"#94a3b8", glow:"rgba(148,163,184,0.2)", bg:"rgba(148,163,184,0.08)"},
};

const STATUS_STYLE = {
  Active:  { bg:"rgba(52,211,153,0.12)", color:"#34d399", dot:"#34d399" },
  Offline: { bg:"rgba(100,116,139,0.1)", color:"#64748b", dot:"#475569" },
};

const BOSS_STATUS_STYLE = {
  Alive:      { bg:"rgba(52,211,153,0.15)",  color:"#34d399", border:"rgba(52,211,153,0.35)"  },
  Respawning: { bg:"rgba(251,191,36,0.15)",  color:"#fbbf24", border:"rgba(251,191,36,0.35)"  },
  Waiting:    { bg:"rgba(96,165,250,0.15)",  color:"#60a5fa", border:"rgba(96,165,250,0.35)"  },
};

const MAX_ELDERS = 8;

function fmtSecs(s) {
  if (s <= 0) return "LIVE";
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function bossStatus(secs) {
  if (secs<=0) return "Alive";
  if (secs<=300) return "Respawning";
  return "Waiting";
}
function fmtCountdown(ms) {
  if (ms <= 0) return "ENDED";
  const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const today = new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const getDayName = () => new Date().toLocaleDateString("en-US",{weekday:"long"});

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const TH = {
  padding:"11px 18px", textAlign:"left", color:"#3d5070", fontSize:10,
  fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em",
  borderBottom:"1px solid rgba(255,255,255,0.05)", whiteSpace:"nowrap",
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // Auth
  const [currentUser, setCurrentUser] = useState(null);
  const [authPage, setAuthPage]       = useState("login"); // "login" | "register" | "forgot"
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [loginForm, setLoginForm]     = useState({email:"",password:""});
  const [regForm, setRegForm]         = useState({name:"",email:"",password:"",confirmPassword:"",cls:"Berserker"});
  const [forgotEmail, setForgotEmail] = useState("");

  // App state
  const [activeNav, setActiveNav]     = useState(()=>lsGet("rampageActiveNav","dashboard"));
  const [collapsed, setCollapsed]     = useState(false);
  const [logoUrl, setLogoUrl]         = useState(MOCK_LOGO);
  const [logoErr, setLogoErr]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState("");
  const [members, setMembers]         = useState([]);
  const [bosses, setBosses]           = useState(()=>lsGet("rampageBosses", DEFAULT_BOSSES));
  const [folkvangNormal, setFolkvangNormal]         = useState(()=>lsGet("rampageFolkvangN", DEFAULT_FOLKVANG_NORMAL));
  const [folkvangInterserver, setFolkvangInterserver] = useState(()=>lsGet("rampageFolkvangI", DEFAULT_FOLKVANG_INTERSERVER));
  const [canyonBosses, setCanyonBosses]             = useState(()=>lsGet("rampageCanyon", DEFAULT_CANYON));
  const [lindwurmBosses, setLindwurmBosses]         = useState(()=>lsGet("rampageLindwurm", DEFAULT_LINDWURM));
  const [bossTimerModal, setBossTimerModal]         = useState(null);
  const [timerHH, setTimerHH]   = useState("0");
  const [timerMM, setTimerMM]   = useState("0");
  const [timerSS, setTimerSS]   = useState("0");
  const [addChannelModal, setAddChannelModal]       = useState(null);
  const [attendance, setAttendance]   = useState([]);
  const [auctionItems, setAuctionItems] = useState(()=>lsGet("rampageAuction", INIT_AUCTION_ITEMS));
  const [winners, setWinners]         = useState(()=>lsGet("rampageWinners", []));
  const [search, setSearch]           = useState("");
  const [killFlash, setKillFlash]     = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editMember, setEditMember]   = useState(null);
  const [newMember, setNewMember]     = useState({name:"",role:"Member",cls:"Berserker",status:"Active",email:""});
  const [bossModal, setBossModal]     = useState(null);
  const [manualMins, setManualMins]   = useState("");
  const [bidModal, setBidModal]       = useState(null);
  const [bidAmount, setBidAmount]     = useState("");
  const [showAddAuction, setShowAddAuction] = useState(false);
  const [editAuction, setEditAuction] = useState(null);
  const [auctionForm, setAuctionForm] = useState({name:"",rarity:"Epic",minBid:1000,durationHours:24,image:null,imageUrl:""});
  const [auctionImgUploading, setAuctionImgUploading] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [now, setNow]                 = useState(Date.now());
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [discordConnected, setDiscordConnected] = useState(false);
  const [toast, setToast]             = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [bossImageModal, setBossImageModal] = useState(null);

  const [events, setEvents]           = useState(()=>lsGet("rampageEvents",[]));
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [eventForm, setEventForm]     = useState({ type:"sindri", name:"", date:today, notes:"", server:"", points:10 });
  const [markEventId, setMarkEventId] = useState(null);
  const [eventPoints, setEventPoints] = useState({});

  const fileRef    = useRef(null);
  const bossImgRef = useRef(null);
  const auctionImgRef = useRef(null);

  // ── Persist to localStorage ──────────────────────────────────────────────
  useEffect(()=>{ lsSet("rampageActiveNav", activeNav); }, [activeNav]);
  useEffect(()=>{ lsSet("rampageBosses", bosses); }, [bosses]);
  useEffect(()=>{ lsSet("rampageFolkvangN", folkvangNormal); }, [folkvangNormal]);
  useEffect(()=>{ lsSet("rampageFolkvangI", folkvangInterserver); }, [folkvangInterserver]);
  useEffect(()=>{ lsSet("rampageCanyon", canyonBosses); }, [canyonBosses]);
  useEffect(()=>{ lsSet("rampageLindwurm", lindwurmBosses); }, [lindwurmBosses]);
  useEffect(()=>{ lsSet("rampageAuction", auctionItems); }, [auctionItems]);
  useEffect(()=>{ lsSet("rampageWinners", winners); }, [winners]);
  useEffect(()=>{ lsSet("rampageEvents", events); }, [events]);

  useEffect(()=>{
    const stored = lsGet("rampageBossTimestamp", null);
    if (stored) {
      const elapsed = Math.floor((Date.now() - stored) / 1000);
      if (elapsed > 0) setBosses(prev=>prev.map(b=>({...b, secs:Math.max(0, b.secs - elapsed)})));
    }
    lsSet("rampageBossTimestamp", Date.now());
  },[]);

  useEffect(()=>{
    const t = setInterval(()=>{
      const tickBoss = b => {
        if(b.secs > 0) return {...b, secs:b.secs-1, elapsed:0};
        return {...b, secs:0, elapsed:(b.elapsed||0)+1};
      };
      setBosses(prev=>prev.map(tickBoss));
      setFolkvangNormal(prev=>prev.map(tickBoss));
      setFolkvangInterserver(prev=>prev.map(tickBoss));
      setCanyonBosses(prev=>prev.map(tickBoss));
      setLindwurmBosses(prev=>prev.map(tickBoss));
      setNow(Date.now());
      lsSet("rampageBossTimestamp", Date.now());
    },1000);
    return ()=>clearInterval(t);
  },[]);

  const [sessionRestored, setSessionRestored] = useState(false);
  useEffect(()=>{
    let mounted = true;
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const authMail = session.user.email;
          let profile = null;
          const { data: p1 } = await supabase.from("members").select("*").eq("email", authMail).single();
          if (p1) { profile = p1; }
          else {
            const prefix = authMail.split("@")[0];
            const { data: p2 } = await supabase.from("members").select("*").ilike("email", `${prefix}@%`).single();
            if (p2) profile = p2;
          }
          const role = (ADMIN_EMAIL && authMail === ADMIN_EMAIL) ? "Admin" : (profile?.role || "Recruit");
          const name = profile?.name || authMail.split("@")[0].toUpperCase();
          const displayEmail = profile?.email || authMail;
          setCurrentUser({ id: session.user.id, email: displayEmail, role, name, points: profile?.points || 0, created_at: profile?.created_at });
        }
      } catch {}
      if(mounted) setSessionRestored(true);
    };
    restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && sessionRestored) setCurrentUser(null);
    });
    return () => { mounted=false; subscription.unsubscribe(); };
  },[]);

  useEffect(()=>{ loadMembers(); },[]);
  useEffect(()=>{ loadAuctionItems(); },[]);

  useEffect(()=>{
    const auctionSub = supabase
      .channel("auction_items_rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"auction_items"},()=>{ loadAuctionItems(); })
      .subscribe();

    const membersSub = supabase
      .channel("members_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"members"},()=>{ loadMembers(); })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"members"},()=>{ loadMembers(); })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"members"},()=>{ loadMembers(); })
      .subscribe();

    return ()=>{
      supabase.removeChannel(auctionSub);
      supabase.removeChannel(membersSub);
    };
  },[]);

  const loadMembers = async()=>{
    try {
      const { data, error } = await supabase.from("members").select("*").order("points", {ascending:false});
      if (error) {
        const local = lsGet("rampageMembers", []);
        setMembers(local);
      } else {
        setMembers(data || []);
      }
    } catch {
      setMembers(lsGet("rampageMembers", []));
    }
  };

  const loadAuctionItems = async()=>{
    try {
      const { data, error } = await supabase.from("auction_items").select("*").order("created_at",{ascending:false});
      if (!error && data && data.length > 0) {
        setAuctionItems(data.map(i=>({
          ...i,
          bids: typeof i.bids === "string" ? JSON.parse(i.bids) : (i.bids||[]),
          endTime: i.end_time ? new Date(i.end_time).getTime() : (Date.now()+3600000),
        })));
      }
    } catch {}
  };

  useEffect(()=>{ if(members.length>0) lsSet("rampageMembers",members); },[members]);

  useEffect(()=>{
    if (!currentUser) return;
    auctionItems.forEach(item=>{
      if (!item.locked && item.highBidder !== currentUser.name) {
        const myBid = item.bids.find(b=>b.bidder===currentUser.name);
        if(myBid && item.currentBid > myBid.amount){
          const key = `outbid_${item.id}_${item.currentBid}`;
          setNotifications(prev=>{
            if(prev.find(n=>n.key===key)) return prev;
            return [...prev, {key, type:"outbid", item:item.name, amount:item.currentBid, id:Date.now()}];
          });
        }
      }
    });
  },[auctionItems, currentUser]);

  useEffect(()=>{
    const lastExport = lsGet("rampageLastExport", null);
    const nowTime = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (!lastExport || (nowTime - lastExport) > oneWeek) {
      if (members.length > 0 && events.length > 0) {
        lsSet("rampageLastExport", nowTime);
        setTimeout(()=>exportToExcel(true), 5000);
      }
    }
  },[members, events]);

  const showToast = useCallback((msg, type="success")=>{
    setToast({msg,type,id:Date.now()});
    setTimeout(()=>setToast(null),3500);
  },[]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = async()=>{
    setAuthLoading(true); setAuthError(""); setAuthSuccess("");
    const rawEmail = loginForm.email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: rawEmail, password: loginForm.password });
      if (error) { setAuthError("Invalid login credentials. Check your email and password."); setAuthLoading(false); return; }
      let profile = null;
      const { data: p1 } = await supabase.from("members").select("*").eq("email", rawEmail).single();
      if (p1) { profile = p1; }
      const role = (ADMIN_EMAIL && rawEmail === ADMIN_EMAIL) ? "Admin" : (profile?.role || "Recruit");
      const name = profile?.name || rawEmail.split("@")[0].toUpperCase();
      setCurrentUser({ id: data.user.id, email: rawEmail, role, name, points: profile?.points || 0, created_at: profile?.created_at });
    } catch(e) {
      const local = lsGet("rampageMembers",[]);
      const found = local.find(m=>m.email===rawEmail);
      if (found && loginForm.password.length >= 6) {
        const role = (ADMIN_EMAIL && rawEmail === ADMIN_EMAIL) ? "Admin" : found.role;
        setCurrentUser({id:found.id, email:found.email, role, name:found.name, points:found.points||0, created_at:found.created_at});
      } else {
        setAuthError("Invalid credentials. Check your email and password.");
      }
    }
    setAuthLoading(false);
  };

  const handleRegister = async()=>{
    setAuthLoading(true); setAuthError(""); setAuthSuccess("");
    if (!regForm.name.trim()) { setAuthError("Display name is required"); setAuthLoading(false); return; }

    // Validate real email
    const emailCheck = isRealEmail(regForm.email);
    if (!emailCheck.valid) { setAuthError(emailCheck.reason); setAuthLoading(false); return; }

    if (regForm.password !== regForm.confirmPassword) { setAuthError("Passwords do not match"); setAuthLoading(false); return; }
    if (regForm.password.length < 6) { setAuthError("Password must be at least 6 characters"); setAuthLoading(false); return; }

    const realEmail = regForm.email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: realEmail, password: regForm.password,
        options: { data: { display_name: regForm.name.toUpperCase(), cls: regForm.cls } }
      });
      if (error) { setAuthError(error.message); setAuthLoading(false); return; }
      const newM = {
        id: data.user?.id || String(Date.now()),
        name: regForm.name.toUpperCase(), role: "Recruit", cls: regForm.cls,
        points: 0, status: "Active", email: realEmail,
        joined: new Date().toLocaleDateString("en-US",{month:"short",year:"numeric"}),
        created_at: new Date().toISOString(),
      };
      const { error: insertErr } = await supabase.from("members").insert([newM]);
      if (insertErr) {
        setMembers(prev=>[...prev, newM]);
        lsSet("rampageMembers", [...lsGet("rampageMembers",[]), newM]);
      } else {
        setMembers(prev=>[...prev, newM]);
      }
      setCurrentUser({ id:newM.id, email:realEmail, role:"Recruit", name:newM.name, points:0, created_at:newM.created_at });
    } catch(e) {
      const newM = { id: String(Date.now()), name: regForm.name.toUpperCase(), role: "Recruit", cls: regForm.cls, points: 0, status: "Active", email: realEmail, created_at: new Date().toISOString() };
      setMembers(prev=>[...prev, newM]);
      lsSet("rampageMembers", [...lsGet("rampageMembers",[]), newM]);
      setCurrentUser({ id:newM.id, email:realEmail, role:"Recruit", name:newM.name, points:0, created_at:newM.created_at });
    }
    setAuthLoading(false);
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async()=>{
    setAuthLoading(true); setAuthError(""); setAuthSuccess("");
    const email = forgotEmail.trim().toLowerCase();
    if (!email) { setAuthError("Please enter your email address."); setAuthLoading(false); return; }

    const emailCheck = isRealEmail(email);
    if (!emailCheck.valid) { setAuthError(emailCheck.reason); setAuthLoading(false); return; }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // redirects back to the app
      });
      if (error) {
        // Don't reveal if email exists or not — security best practice
        setAuthSuccess("If that email is registered, a reset link has been sent. Check your inbox.");
      } else {
        setAuthSuccess("✅ Password reset email sent! Check your inbox and follow the link to reset your password.");
      }
    } catch {
      setAuthSuccess("If that email is registered, a reset link has been sent. Check your inbox.");
    }
    setAuthLoading(false);
  };

  const handleLogout = async()=>{
    await supabase.auth.signOut().catch(()=>{});
    setCurrentUser(null); setAuthPage("login"); setLoginForm({email:"",password:""});
  };

  // ── Admin: Wipe ALL user data ──────────────────────────────────────────────
  const handleWipeAccounts = async()=>{
    setWipeLoading(true);
    try {
      // Wipe all members
      await supabase.from("members").delete().neq("id","00000000-0000-0000-0000-000000000000"); // delete all rows
      // Wipe all auction items
      await supabase.from("auction_items").delete().neq("id","00000000-0000-0000-0000-000000000000");
      setMembers([]);
      setAuctionItems([]);
      setWinners([]);
      setEvents([]);
      lsSet("rampageMembers", []);
      lsSet("rampageAuction", []);
      lsSet("rampageWinners", []);
      lsSet("rampageEvents", []);
      showToast("🗑️ All user data wiped","warn");
    } catch {
      setMembers([]);
      setAuctionItems([]);
      setWinners([]);
      setEvents([]);
      showToast("🗑️ Data wiped (local)","warn");
    }
    setWipeLoading(false); setShowWipeConfirm(false); setShowPermissions(false);
  };

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoUpload = async(e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    setUploading(true); setUploadMsg("");
    const reader = new FileReader();
    reader.onload = ev=>setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
    setTimeout(()=>{ setUploadMsg("✅ Saved!"); setUploading(false); setTimeout(()=>setUploadMsg(""),3000); },1200);
  };

  const handleBossImageUpload = (e)=>{
    const file = e.target.files?.[0]; if(!file||!bossImageModal) return;
    handleBossImageUploadGroup(file, bossImageModal.id, bossImageModal.group);
  };

  const getSetterByGroup = (group) => {
    if(group==="folkvang_normal") return setFolkvangNormal;
    if(group==="folkvang_interserver") return setFolkvangInterserver;
    if(group==="canyon") return setCanyonBosses;
    if(group==="lindwurm") return setLindwurmBosses;
    return setBosses;
  };

  const handleMarkKilledGroup = (id, group)=>{
    setKillFlash(id); setTimeout(()=>setKillFlash(null),700);
    const setter = getSetterByGroup(group);
    setter(prev=>prev.map(b=>{
      if(b.id!==id) return b;
      const secs = b.respawnSecs != null
        ? b.respawnSecs
        : Math.floor((b.minR + Math.random()*(b.maxR-b.minR))*60);
      return {...b, secs, elapsed:0};
    }));
    if(discordConnected) showToast("📢 Discord notified: Boss killed!","info");
  };

  const handleMarkKilled = (id)=> handleMarkKilledGroup(id, "live4");

  const handleResetToZero = (id, group="live4")=>{
    setKillFlash(id); setTimeout(()=>setKillFlash(null),700);
    getSetterByGroup(group)(prev=>prev.map(b=>b.id===id?{...b,secs:0,elapsed:0}:b));
  };

  const handleSetManual = ()=>{
    const mins = parseFloat(manualMins);
    if(isNaN(mins)||mins<0) return;
    setBosses(prev=>prev.map(b=>b.id===bossModal?{...b,secs:Math.floor(mins*60),elapsed:0}:b));
    setBossModal(null); setManualMins("");
  };

  const handleSetTimerHMS = ()=>{
    if(!bossTimerModal) return;
    const {id,group} = bossTimerModal;
    const totalSecs = (parseInt(timerHH)||0)*3600 + (parseInt(timerMM)||0)*60 + (parseInt(timerSS)||0);
    getSetterByGroup(group)(prev=>prev.map(b=>b.id===id?{...b,secs:totalSecs,elapsed:0}:b));
    setBossTimerModal(null);
  };

  const handleSetRespawnTime = (id, group, secs)=>{
    getSetterByGroup(group)(prev=>prev.map(b=>b.id===id?{...b,respawnSecs:secs}:b));
  };

  const handleAddChannel = (group, bossBaseName, baseColor)=>{
    const setter = getSetterByGroup(group);
    setter(prev=>{
      const maxCh = prev.filter(b=>b.name===bossBaseName).reduce((m,b)=>Math.max(m,b.channel),0);
      const newCh = maxCh+1;
      const template = prev.find(b=>b.name===bossBaseName);
      if(!template) return prev;
      return [...prev, {...template, id:`${group}_${bossBaseName}_ch${newCh}_${Date.now()}`, channel:newCh, secs:0, elapsed:0}];
    });
    showToast(`✅ Channel ${group} added!`);
  };

  const handleRemoveChannel = (id, group)=>{
    getSetterByGroup(group)(prev=>prev.filter(b=>b.id!==id));
    showToast("🗑️ Channel removed","warn");
  };

  const handleBossImageUploadGroup = (file, id, group)=>{
    const reader = new FileReader();
    reader.onload = ev=>{
      getSetterByGroup(group)(prev=>prev.map(b=>b.id===id?{...b,image:ev.target.result}:b));
      setBossImageModal(null); showToast("🖼️ Boss image updated!");
    };
    reader.readAsDataURL(file);
  };

  // ── Members ───────────────────────────────────────────────────────────────
  const handleAddMember = async()=>{
    if(!newMember.name.trim()) return;
    if(newMember.role==="Elder" && members.filter(m=>m.role==="Elder").length >= MAX_ELDERS) {
      showToast(`❌ Maximum ${MAX_ELDERS} Elders allowed`,"error"); return;
    }
    if(newMember.role==="Leader" && members.filter(m=>m.role==="Leader").length >= 1) {
      showToast("❌ Only 1 Leader allowed","error"); return;
    }
    const m={...newMember,id:String(Date.now()),points:0,joined:today,created_at:new Date().toISOString()};
    try { await supabase.from("members").insert([m]); } catch {}
    setMembers(prev=>[...prev,m]);
    setNewMember({name:"",role:"Member",cls:"Berserker",status:"Active",email:""});
    setShowAddMember(false);
    showToast(`✅ ${m.name} added to guild!`);
  };

  const handleEditMember = async()=>{
    if(!editMember) return;
    const old = members.find(m=>m.id===editMember.id);
    if(editMember.role==="Elder" && old?.role!=="Elder" && members.filter(m=>m.role==="Elder").length >= MAX_ELDERS) {
      showToast(`❌ Maximum ${MAX_ELDERS} Elders allowed`,"error"); return;
    }
    try { await supabase.from("members").update(editMember).eq("id",editMember.id); } catch {}
    setMembers(prev=>prev.map(m=>m.id===editMember.id?editMember:m));
    if (currentUser && editMember.id === currentUser.id) {
      setCurrentUser(prev=>({...prev, points:editMember.points, role:editMember.role}));
    }
    setEditMember(null); showToast("✅ Member updated!");
  };

  const handleRemoveMember = async(id)=>{
    try { await supabase.from("members").delete().eq("id",id); } catch {}
    setMembers(prev=>prev.filter(m=>m.id!==id));
    showToast("🗑️ Member removed","warn");
  };

  const handleChangeRole = async(memberId, newRole)=>{
    if(newRole==="Elder" && members.filter(m=>m.role==="Elder").length >= MAX_ELDERS) {
      showToast(`❌ Maximum ${MAX_ELDERS} Elders allowed`,"error"); return;
    }
    try { await supabase.from("members").update({role:newRole}).eq("id",memberId); } catch {}
    setMembers(prev=>prev.map(m=>m.id===memberId?{...m,role:newRole}:m));
    showToast("✅ Role updated!");
  };

  const handleAddPoints = async(memberId, delta)=>{
    const updated = members.map(m=>m.id===memberId?{...m,points:Math.max(0,(m.points||0)+delta)}:m);
    setMembers(updated);
    const m = updated.find(x=>x.id===memberId);
    if(m) { try { await supabase.from("members").update({points:m.points}).eq("id",memberId); } catch {} }
  };

  // ── Events ────────────────────────────────────────────────────────────────
  const handleCreateEvent = ()=>{
    if(!eventForm.name.trim()) { showToast("❌ Event name required","error"); return; }
    const evType = EVENT_TYPES.find(e=>e.id===eventForm.type);
    const ev = {
      id: String(Date.now()),
      type: eventForm.type,
      typeLabel: evType?.label || eventForm.type,
      icon: evType?.icon || "📅",
      name: eventForm.name,
      date: eventForm.date,
      notes: eventForm.notes,
      server: eventForm.server,
      points: parseInt(eventForm.points) || evType?.defaultPoints || 5,
      attendance: {},
      createdBy: currentUser?.name,
      createdAt: new Date().toISOString(),
    };
    setEvents(prev=>[ev,...prev]);
    setShowCreateEvent(false);
    setEventForm({ type:"sindri", name:"", date:today, notes:"", server:"", points:10 });
    showToast(`✅ Event "${ev.name}" created!`);
  };

  const handleMarkEventAttendance = async(eventId, memberId, present)=>{
    setEvents(prev=>prev.map(ev=>{
      if(ev.id!==eventId) return ev;
      return {...ev, attendance:{...ev.attendance, [memberId]:present}};
    }));
    const ev = events.find(e=>e.id===eventId);
    if(!ev) return;
    const wasPresent = ev.attendance[memberId];
    if(present && !wasPresent) {
      await handleAddPoints(memberId, ev.points);
      showToast(`+${ev.points} pts awarded!`);
    } else if(!present && wasPresent) {
      await handleAddPoints(memberId, -ev.points);
      showToast(`-${ev.points} pts removed`,"warn");
    }
  };

  const handleMarkAllPresent = (eventId)=>{
    members.forEach(m=>handleMarkEventAttendance(eventId, m.id, true));
    showToast("✅ All members marked present!");
  };

  const handleDeleteEvent = (eventId)=>{
    setEvents(prev=>prev.filter(e=>e.id!==eventId));
    showToast("🗑️ Event deleted","warn");
  };

  // ── Auction image upload ──────────────────────────────────────────────────
  const handleAuctionImageUpload = async(e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    setAuctionImgUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `auction/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("asset").upload(path, file, {cacheControl:"3600",upsert:false});
      if(!error) {
        const { data: urlData } = supabase.storage.from("asset").getPublicUrl(path);
        setAuctionForm(p=>({...p,imageUrl:urlData.publicUrl,image:null}));
        showToast("🖼️ Image uploaded!");
      } else {
        const reader = new FileReader();
        reader.onload = ev=>setAuctionForm(p=>({...p,imageUrl:ev.target.result,image:null}));
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = ev=>setAuctionForm(p=>({...p,imageUrl:ev.target.result,image:null}));
      reader.readAsDataURL(file);
    }
    setAuctionImgUploading(false);
  };

  const handleAddAuctionItem = async()=>{
    if(!auctionForm.name.trim()) { showToast("❌ Item name required","error"); return; }
    const endTime = Date.now() + (parseFloat(auctionForm.durationHours)||24)*3600000;
    const item = {
      id: String(Date.now()),
      name: auctionForm.name,
      rarity: auctionForm.rarity,
      minBid: parseInt(auctionForm.minBid)||500,
      currentBid: 0, highBidder: null,
      bids: [],
      locked: false, winner: null, claimed: false,
      image: auctionForm.imageUrl || "🏺",
      end_time: new Date(endTime).toISOString(),
      endTime,
      created_at: new Date().toISOString(),
    };
    try {
      const dbItem = {...item, bids:JSON.stringify([]), endTime:undefined};
      const { error } = await supabase.from("auction_items").insert([dbItem]);
      if(error) throw error;
      await loadAuctionItems();
    } catch {
      setAuctionItems(prev=>[item,...prev]);
    }
    setShowAddAuction(false);
    setAuctionForm({name:"",rarity:"Epic",minBid:1000,durationHours:24,image:null,imageUrl:""});
    showToast(`✅ ${item.name} added to auction!`);
  };

  const handleEditAuctionItem = async()=>{
    if(!editAuction) return;
    try {
      const { error } = await supabase.from("auction_items").update({
        name: editAuction.name,
        rarity: editAuction.rarity,
        minBid: editAuction.minBid,
        image: editAuction.image,
        end_time: new Date(editAuction.endTime).toISOString(),
      }).eq("id",editAuction.id);
      if(!error) await loadAuctionItems();
      else setAuctionItems(prev=>prev.map(i=>i.id===editAuction.id?editAuction:i));
    } catch {
      setAuctionItems(prev=>prev.map(i=>i.id===editAuction.id?editAuction:i));
    }
    setEditAuction(null); showToast("✅ Auction item updated!");
  };

  const handleDeleteAuctionItem = async(id)=>{
    try { await supabase.from("auction_items").delete().eq("id",id); } catch {}
    setAuctionItems(prev=>prev.filter(i=>i.id!==id));
    showToast("🗑️ Item removed","warn");
  };

  // ── Auction bidding ───────────────────────────────────────────────────────
  const handleBid = async()=>{
    const amount = parseInt(bidAmount);
    const myMember = members.find(m=>m.name===currentUser?.name || m.email===currentUser?.email);
    const myPoints = myMember?.points || 0;

    // Check bid eligibility
    if(!canBid(currentUser, myMember)) {
      const days = daysUntilBid(myMember);
      showToast(`❌ Recruits can bid after 7 days. ${days} day(s) remaining.`,"error"); return;
    }
    if(!bidModal||isNaN(amount)) { showToast("❌ Enter a valid amount","error"); return; }
    if(amount <= bidModal.currentBid && bidModal.currentBid > 0) { showToast(`❌ Bid must exceed ${bidModal.currentBid.toLocaleString()} pts`,"error"); return; }
    if(amount < bidModal.minBid) { showToast(`❌ Minimum bid is ${bidModal.minBid.toLocaleString()} pts`,"error"); return; }
    if(amount > myPoints) { showToast(`❌ Not enough points! You have ${myPoints.toLocaleString()} pts`,"error"); return; }
    const myName = currentUser?.name||"Guest";
    const newBidEntry = {bidder:myName, amount, time:new Date().toLocaleTimeString()};
    const updatedBids = [...(bidModal.bids||[]), newBidEntry];
    try {
      const { error } = await supabase.from("auction_items").update({
        currentBid: amount,
        highBidder: myName,
        bids: JSON.stringify(updatedBids),
      }).eq("id",bidModal.id);
      if(!error) await loadAuctionItems();
      else throw error;
    } catch {
      setAuctionItems(prev=>prev.map(item=>{
        if(item.id!==bidModal.id) return item;
        return {...item, currentBid:amount, highBidder:myName, bids:updatedBids};
      }));
    }
    setBidModal(null); setBidAmount("");
    showToast(`🏺 Bid of ${amount.toLocaleString()} pts placed on ${bidModal.name}!`);
  };

  const handleAnnounceWinner = async(item)=>{
    const w = {id:Date.now(),itemName:item.name,winner:item.highBidder,points:item.currentBid,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),claimed:false,rarity:item.rarity,image:item.image};
    setWinners(prev=>[...prev,w]);
    try { await supabase.from("auction_items").update({locked:true,winner:item.highBidder}).eq("id",item.id); await loadAuctionItems(); } catch {
      setAuctionItems(prev=>prev.map(i=>i.id===item.id?{...i,locked:true,winner:item.highBidder}:i));
    }
    if(discordConnected) showToast("📢 Discord notified: Winner announced!","info");
    showToast(`🏆 ${item.highBidder} won ${item.name}!`);
  };

  const handleClaimWinner = (id)=>{ setWinners(prev=>prev.map(w=>w.id===id?{...w,claimed:true}:w)); showToast("✅ Item marked as claimed!"); };
  const handleRemoveWinner = (id)=>{ setWinners(prev=>prev.filter(w=>w.id!==id)); showToast("🗑️ Removed","warn"); };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportToExcel = (silent=false)=>{
    try {
      const wb = XLSX.utils.book_new();
      const memberRows = members.map(m=>({
        Name: m.name, Role: m.role, Class: m.cls||"—",
        Points: m.points||0, Status: m.status||"—", Email: m.email||"—", Joined: m.joined||"—"
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), "Members");
      const eventRows = [];
      events.forEach(ev=>{
        const presentCount = Object.values(ev.attendance).filter(Boolean).length;
        eventRows.push({
          "Event Name": ev.name, "Type": ev.typeLabel, "Date": ev.date,
          "Points Awarded": ev.points, "Present": presentCount,
          "Total Members": members.length, "Notes": ev.notes||"—", "Server": ev.server||"—"
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows.length ? eventRows : [{Note:"No events yet"}]), "Events");
      const attRows = [];
      events.forEach(ev=>{
        members.forEach(m=>{
          attRows.push({
            Member: m.name, Role: m.role, Event: ev.name,
            Type: ev.typeLabel, Date: ev.date,
            Present: ev.attendance[m.id] ? "YES" : "NO",
            "Points Earned": ev.attendance[m.id] ? ev.points : 0
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attRows.length ? attRows : [{Note:"No attendance yet"}]), "Attendance Detail");
      const winRows = winners.map(w=>({ Item: w.itemName, Winner: w.winner, Points: w.points, Date: w.date, Claimed: w.claimed?"YES":"NO", Rarity: w.rarity }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(winRows.length ? winRows : [{Note:"No winners yet"}]), "Auction Winners");
      const dateStr = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}).replace(/,/g,"").replace(/ /g,"-");
      XLSX.writeFile(wb, `RAMPAGE-Guild-Report-${dateStr}.xlsx`);
      if(!silent) showToast("📊 Excel exported successfully!");
    } catch(e) {
      if(!silent) showToast("❌ Export failed","error");
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered       = members.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.cls?.toLowerCase().includes(search.toLowerCase()));
  const activeCount    = members.filter(m=>m.status==="Active").length;
  const myMemberRecord = members.find(m=>m.name===currentUser?.name || m.email===currentUser?.email);
  const myPoints       = myMemberRecord?.points || 0;
  const userRole       = getEffectiveRole(currentUser);

  // ── Render: Auth ──────────────────────────────────────────────────────────
  if (!currentUser) {
    const page = authPage;
    const setPage = (p)=>{ setAuthPage(p); setAuthError(""); setAuthSuccess(""); };
    const error = authError;
    const success = authSuccess;
    const loading = authLoading;
    const onLogin = handleLogin;
    const onRegister = handleRegister;
    const onForgot = handleForgotPassword;

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Exo+2:wght@400;500;600;700;800&display=swap');
          *{margin:0;padding:0;box-sizing:border-box;}
          body{background:#070910;min-height:100vh;}
          .auth-bg { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(251,191,36,0.06) 0%, transparent 50%), #070910; position:relative; overflow:hidden; font-family:'Exo 2',sans-serif; }
          @keyframes bgShift { from{opacity:0.5;transform:scale(1)} to{opacity:1;transform:scale(1.1)} }
          .auth-card { background:linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02)); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:36px 34px; width:100%; max-width:420px; box-shadow:0 40px 120px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.06); position:relative; z-index:1; animation:cardIn 0.5s cubic-bezier(0.4,0,0.2,1); }
          @keyframes cardIn { from{opacity:0;transform:translateY(32px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          .auth-input { width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:13px; padding:13px 17px; color:#e2e8f0; font-size:14px; font-family:'Exo 2',sans-serif; outline:none; transition:all 0.2s; }
          .auth-input:focus { border-color:rgba(99,102,241,0.6); background:rgba(99,102,241,0.07); box-shadow:0 0 0 4px rgba(99,102,241,0.1); }
          .auth-input::placeholder { color:#2d3a52; }
          .auth-btn { width:100%; padding:14px; border:none; border-radius:13px; font-family:'Exo 2',sans-serif; font-weight:800; font-size:15px; letter-spacing:0.04em; cursor:pointer; transition:all 0.22s; position:relative; overflow:hidden; }
          .auth-btn::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.12),transparent); opacity:0; transition:opacity 0.22s; }
          .auth-btn:hover::before { opacity:1; }
          .auth-btn:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(99,102,241,0.4); }
          .auth-btn:active { transform:translateY(0) scale(0.98); }
          .tab-btn { flex:1; padding:11px; background:none; border:none; cursor:pointer; font-family:'Exo 2',sans-serif; font-weight:700; font-size:13.5px; letter-spacing:0.04em; transition:all 0.2s; border-radius:10px; }
          .tab-btn.active { background:rgba(99,102,241,0.18); color:#a5b4fc; }
          .tab-btn:not(.active) { color:#3d5070; }
          .tab-btn:not(.active):hover { color:#64748b; }
          .error-shake { animation:shake 0.4s ease; }
          @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
          .floating-icon { animation:floatIcon 4s ease-in-out infinite; }
          @keyframes floatIcon { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          .forgot-link { background:none; border:none; color:#60a5fa; font-size:12px; cursor:pointer; font-family:'Exo 2',sans-serif; text-decoration:underline; padding:0; margin-top:2px; display:inline-block; transition:color 0.2s; }
          .forgot-link:hover { color:#93c5fd; }
          .back-link { background:none; border:none; color:#64748b; font-size:12px; cursor:pointer; font-family:'Exo 2',sans-serif; padding:0; margin-top:8px; display:flex; align-items:center; gap:5px; transition:color 0.2s; }
          .back-link:hover { color:#94a3b8; }
        `}</style>

        <div className="auth-bg">
          <div style={{position:"absolute",top:"15%",left:"8%",width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)",pointerEvents:"none",animation:"bgShift 6s ease-in-out infinite alternate-reverse"}} />
          <div style={{position:"absolute",bottom:"18%",right:"10%",width:220,height:220,borderRadius:"50%",background:"radial-gradient(circle,rgba(251,191,36,0.08),transparent 70%)",pointerEvents:"none",animation:"bgShift 7s ease-in-out infinite alternate"}} />

          <div className="auth-card">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
              <div className="floating-icon" style={{width:72,height:72,borderRadius:"50%",border:"2px solid rgba(251,191,36,0.5)",background:"rgba(251,191,36,0.07)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,boxShadow:"0 0 40px rgba(251,191,36,0.2)"}}>
                <img src={MOCK_LOGO} alt="Rampage" style={{width:"80%",height:"80%",objectFit:"contain",borderRadius:"50%"}} onError={e=>{e.target.style.display="none";}} />
              </div>
              <h1 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:32,fontWeight:700,letterSpacing:"0.16em",background:"linear-gradient(135deg,#fbbf24,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>RAMPAGE</h1>
              <p style={{color:"#2d3a52",fontSize:10.5,letterSpacing:"0.12em",marginTop:4}}>GUILD TRACKER · SEASON 12</p>
            </div>

            {/* Tab switcher — hidden on forgot page */}
            {page !== "forgot" && (
              <div style={{display:"flex",gap:6,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,padding:5,marginBottom:24}}>
                <button className={`tab-btn${page==="login"?" active":""}`} onClick={()=>setPage("login")}>Sign In</button>
                <button className={`tab-btn${page==="register"?" active":""}`} onClick={()=>setPage("register")}>Register</button>
              </div>
            )}

            {/* Error / Success banners */}
            {error&&(
              <div className="error-shake" style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:11,padding:"10px 14px",marginBottom:16,fontSize:12.5,color:"#fca5a5",display:"flex",alignItems:"center",gap:8}}>
                <span>⚠️</span>{error}
              </div>
            )}
            {success&&(
              <div style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:11,padding:"10px 14px",marginBottom:16,fontSize:12.5,color:"#6ee7b7",display:"flex",alignItems:"center",gap:8}}>
                <span>✅</span>{success}
              </div>
            )}

            {/* ── Sign In ── */}
            {page==="login"&&(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Email</label>
                  <input className="auth-input" type="email" placeholder="e.g. yourname@gmail.com" value={loginForm.email} onChange={e=>setLoginForm(p=>({...p,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onLogin()} />
                </div>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Password</label>
                  <input className="auth-input" type="password" placeholder="••••••••" value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onLogin()} />
                  <div style={{textAlign:"right",marginTop:6}}>
                    <button className="forgot-link" onClick={()=>{ setForgotEmail(loginForm.email); setPage("forgot"); }}>
                      Forgot password?
                    </button>
                  </div>
                </div>
                <button className="auth-btn" onClick={onLogin} disabled={loading}
                  style={{background:"linear-gradient(135deg,#4f46e5,#6366f1)",color:"#fff",marginTop:2,boxShadow:"0 6px 30px rgba(99,102,241,0.35)"}}>
                  {loading?"Signing in...":"Sign In →"}
                </button>
                <div style={{background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.18)",borderRadius:10,padding:"12px 16px",marginTop:4,textAlign:"center"}}>
                  <div style={{fontSize:14,color:"#fbbf24",fontWeight:700,letterSpacing:"0.06em",marginBottom:4}}>⚔️ Welcome to RAMPAGE</div>
                  <p style={{fontSize:11.5,color:"#64748b",lineHeight:1.6}}>Register with your guild name and sign in. New accounts start as <strong style={{color:"#a78bfa"}}>Recruit</strong>. Leader <strong style={{color:"#fbbf24"}}>Valiant</strong> will assign your rank.</p>
                </div>
              </div>
            )}

            {/* ── Register ── */}
            {page==="register"&&(
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Display Name</label>
                  <input className="auth-input" type="text" placeholder="Your in-game name" value={regForm.name} onChange={e=>setRegForm(p=>({...p,name:e.target.value}))} />
                </div>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Email</label>
                  <input className="auth-input" type="email" placeholder="yourname@gmail.com" value={regForm.email} onChange={e=>setRegForm(p=>({...p,email:e.target.value}))} />
                  <p style={{color:"#3d5070",fontSize:10.5,marginTop:5}}>Use a real email — Gmail, Yahoo, Outlook, etc.</p>
                </div>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Class</label>
                  <select className="auth-input" value={regForm.cls} onChange={e=>setRegForm(p=>({...p,cls:e.target.value}))} style={{cursor:"pointer"}}>
                    {["Berserker","Skald","Warlord","Volva","Archer","RuneFighter"].map(o=><option key={o} value={o} style={{background:"#0a0c18"}}>{o}</option>)}
                  </select>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Password</label>
                    <input className="auth-input" type="password" placeholder="Min 6 chars" value={regForm.password} onChange={e=>setRegForm(p=>({...p,password:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Confirm</label>
                    <input className="auth-input" type="password" placeholder="Repeat" value={regForm.confirmPassword} onChange={e=>setRegForm(p=>({...p,confirmPassword:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onRegister()} />
                  </div>
                </div>
                <button className="auth-btn" onClick={onRegister} disabled={loading}
                  style={{background:"linear-gradient(135deg,#0f766e,#14b8a6)",color:"#fff",marginTop:4,boxShadow:"0 6px 30px rgba(20,184,166,0.3)"}}>
                  {loading?"Creating account...":"Create Account →"}
                </button>
                <p style={{textAlign:"center",color:"#3d5070",fontSize:11}}>New members join as <strong style={{color:"#a78bfa"}}>Recruit</strong> — Valiant will promote you.</p>
              </div>
            )}

            {/* ── Forgot Password ── */}
            {page==="forgot"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{textAlign:"center",marginBottom:4}}>
                  <div style={{fontSize:28,marginBottom:8}}>🔐</div>
                  <p style={{color:"#94a3b8",fontSize:13,lineHeight:1.6}}>Enter your registered email and we'll send you a password reset link.</p>
                </div>
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10.5,fontWeight:700,marginBottom:7,textTransform:"uppercase",letterSpacing:"0.09em"}}>Your Email</label>
                  <input className="auth-input" type="email" placeholder="yourname@gmail.com" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onForgot()} autoFocus />
                </div>
                <button className="auth-btn" onClick={onForgot} disabled={loading}
                  style={{background:"linear-gradient(135deg,#7c3aed,#8b5cf6)",color:"#fff",boxShadow:"0 6px 30px rgba(139,92,246,0.3)"}}>
                  {loading?"Sending...":"Send Reset Link →"}
                </button>
                <div style={{textAlign:"center"}}>
                  <button className="back-link" onClick={()=>setPage("login")} style={{margin:"0 auto"}}>
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Role badge ────────────────────────────────────────────────────────────
  const RoleBadge = ({role}) => {
    const st = ROLE_STYLE[role] || ROLE_STYLE.Recruit;
    return (
      <span style={{background:st.bg,color:st.color,border:`1px solid ${st.border}`,borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>
        {role}
      </span>
    );
  };

  // ── Permission matrix info panel ──────────────────────────────────────────
  const PERMISSION_MATRIX = [
    { feature: "Edit core / redesign app",  Admin:true,  Leader:false, Elder:false, Member:false, Recruit:false },
    { feature: "Manage all members",         Admin:true,  Leader:true,  Elder:false, Member:false, Recruit:false },
    { feature: "Manage bid items",           Admin:true,  Leader:true,  Elder:true,  Member:false, Recruit:false },
    { feature: "Place bids",                 Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:"7d" },
    { feature: "Create events",              Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:false },
    { feature: "Mark attendance",            Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:false },
    { feature: "Edit boss timer",            Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:false },
    { feature: "Participate events",         Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:true  },
    { feature: "Earn points",               Admin:true,  Leader:true,  Elder:true,  Member:true,  Recruit:true  },
    { feature: "Wipe all data",             Admin:true,  Leader:false, Elder:false, Member:false, Recruit:false },
  ];

  // ── Main layout ───────────────────────────────────────────────────────────
  // Sidebar + main content
  const sidebarW = collapsed ? 64 : 220;

  const renderNav = () => NAV.map(n=>(
    <button key={n.id}
      onClick={()=>setActiveNav(n.id)}
      style={{
        display:"flex",alignItems:"center",gap:collapsed?0:10,
        padding:collapsed?"12px":"11px 16px",
        background:activeNav===n.id?"rgba(99,102,241,0.18)":"none",
        border:activeNav===n.id?"1px solid rgba(99,102,241,0.25)":"1px solid transparent",
        borderRadius:11,color:activeNav===n.id?"#a5b4fc":"#3d5070",
        cursor:"pointer",width:"100%",textAlign:"left",
        fontSize:13,fontWeight:600,fontFamily:"'Exo 2',sans-serif",
        letterSpacing:"0.03em",transition:"all 0.15s",
        justifyContent:collapsed?"center":"flex-start",
      }}
    >
      <span style={{fontSize:16}}>{n.icon}</span>
      {!collapsed&&<span>{n.label}</span>}
    </button>
  ));

  // ── Section renderers ─────────────────────────────────────────────────────

  // DASHBOARD
  const renderDashboard = () => {
    const topMembers = [...members].sort((a,b)=>(b.points||0)-(a.points||0)).slice(0,5);
    const todayBosses = FIELD_BOSS_SCHEDULE.filter(b=>b.days.includes(getDayName()));
    return (
      <div style={{display:"grid",gap:20}}>
        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
          {[
            {label:"Total Members",val:members.length,icon:"👥",color:"#60a5fa"},
            {label:"Active Now",val:activeCount,icon:"🟢",color:"#34d399"},
            {label:"Live Auctions",val:auctionItems.filter(i=>!i.locked).length,icon:"🏺",color:"#a78bfa"},
            {label:"Your Points",val:myPoints.toLocaleString(),icon:"⭐",color:"#fbbf24"},
          ].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"18px 20px"}}>
              <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
              <div style={{fontSize:26,fontWeight:800,color:s.color,fontFamily:"'Rajdhani',sans-serif"}}>{s.val}</div>
              <div style={{fontSize:11,color:"#3d5070",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Your role card */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16}}>
          <div style={{flex:1}}>
            <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Signed in as</div>
            <div style={{fontSize:18,fontWeight:800,color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>{currentUser.name}</div>
            <RoleBadge role={userRole} />
            {userRole==="Recruit" && myMemberRecord && (
              <div style={{marginTop:8,fontSize:11.5,color:"#64748b"}}>
                {canBid(currentUser, myMemberRecord)
                  ? "✅ You can now place bids!"
                  : `⏳ Bidding unlocks in ${daysUntilBid(myMemberRecord)} day(s)`}
              </div>
            )}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Points</div>
            <div style={{fontSize:28,fontWeight:800,color:"#fbbf24",fontFamily:"'Rajdhani',sans-serif"}}>{myPoints.toLocaleString()}</div>
          </div>
        </div>

        {/* Today's field bosses */}
        {todayBosses.length > 0 && (
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"18px 22px"}}>
            <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Today's Field Bosses</div>
            {todayBosses.map(b=>(
              <div key={b.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <div>
                  <div style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{b.name}</div>
                  <div style={{color:"#3d5070",fontSize:11,marginTop:2}}>{b.map}</div>
                </div>
                <div style={{color:"#f87171",fontWeight:700,fontSize:13}}>{b.time}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top 5 leaderboard */}
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"18px 22px"}}>
          <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Top Members</div>
          {topMembers.map((m,i)=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{width:22,color:["#fbbf24","#94a3b8","#f97316","#e2e8f0","#e2e8f0"][i],fontWeight:800,fontSize:14}}>{["🥇","🥈","🥉","4","5"][i]}</span>
              <span style={{flex:1,color:"#e2e8f0",fontSize:13,fontWeight:600}}>{m.name}</span>
              <RoleBadge role={m.role} />
              <span style={{color:"#fbbf24",fontWeight:700,fontSize:13}}>{(m.points||0).toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // MEMBERS
  const renderMembers = () => (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..." style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:11,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
        {canManageMembers(currentUser) && (
          <button onClick={()=>setShowAddMember(true)} style={{background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:11,padding:"10px 18px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>+ Add</button>
        )}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>{["Name","Role","Class","Points","Status","Joined",canManageMembers(currentUser)?"Actions":""].map(h=>(<th key={h} style={TH}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {filtered.map(m=>{
              const rs = ROLE_STYLE[m.role]||ROLE_STYLE.Recruit;
              const ss = STATUS_STYLE[m.status]||STATUS_STYLE.Offline;
              return (
                <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <td style={{padding:"11px 18px",color:"#e2e8f0",fontSize:13,fontWeight:600}}>{m.name}</td>
                  <td style={{padding:"11px 18px"}}><RoleBadge role={m.role} /></td>
                  <td style={{padding:"11px 18px",color:"#64748b",fontSize:12}}>{m.cls||"—"}</td>
                  <td style={{padding:"11px 18px",color:"#fbbf24",fontWeight:700,fontSize:13}}>{(m.points||0).toLocaleString()}</td>
                  <td style={{padding:"11px 18px"}}><span style={{background:ss.bg,color:ss.color,borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>{m.status||"Active"}</span></td>
                  <td style={{padding:"11px 18px",color:"#64748b",fontSize:12}}>{m.joined||"—"}</td>
                  {canManageMembers(currentUser) && (
                    <td style={{padding:"11px 18px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setEditMember({...m})} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:7,padding:"4px 10px",color:"#a5b4fc",fontSize:11,cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Edit</button>
                        <button onClick={()=>handleAddPoints(m.id,10)} style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:7,padding:"4px 8px",color:"#34d399",fontSize:11,cursor:"pointer"}}>+10</button>
                        <button onClick={()=>handleRemoveMember(m.id)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 8px",color:"#f87171",fontSize:11,cursor:"pointer"}}>✕</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add member modal */}
      {showAddMember && canManageMembers(currentUser) && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:360}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:20,marginBottom:18}}>Add Member</h3>
            {[["Name","name","text"],["Email","email","email"]].map(([label,key,type])=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>{label}</label>
                <input type={type} value={newMember[key]} onChange={e=>setNewMember(p=>({...p,[key]:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Role</label>
              <select value={newMember.role} onChange={e=>setNewMember(p=>({...p,role:e.target.value}))} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                {/* Admin can only be set via ADMIN_EMAIL */}
                {["Leader","Elder","Member","Recruit"].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Class</label>
              <select value={newMember.cls} onChange={e=>setNewMember(p=>({...p,cls:e.target.value}))} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                {["Berserker","Skald","Warlord","Volva","Archer","RuneFighter"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button onClick={handleAddMember} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"11px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>Add</button>
              <button onClick={()=>setShowAddMember(false)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit member modal */}
      {editMember && canManageMembers(currentUser) && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:360}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:20,marginBottom:18}}>Edit {editMember.name}</h3>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Role</label>
              <select value={editMember.role} onChange={e=>setEditMember(p=>({...p,role:e.target.value}))} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                {["Leader","Elder","Member","Recruit"].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Points</label>
              <input type="number" value={editMember.points||0} onChange={e=>setEditMember(p=>({...p,points:parseInt(e.target.value)||0}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Status</label>
              <select value={editMember.status||"Active"} onChange={e=>setEditMember(p=>({...p,status:e.target.value}))} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                <option value="Active">Active</option><option value="Offline">Offline</option>
              </select>
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button onClick={handleEditMember} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"11px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>Save</button>
              <button onClick={()=>setEditMember(null)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // BOSSES
  const renderBossGroup = (bossArr, groupLabel) => {
    const byName = {};
    bossArr.forEach(b=>{ if(!byName[b.name]) byName[b.name]=[]; byName[b.name].push(b); });
    return (
      <div style={{marginBottom:24}}>
        <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:12}}>{groupLabel}</div>
        {Object.entries(byName).map(([name,channels])=>(
          <div key={name} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:16,marginBottom:10}}>
            <div style={{color:"#e2e8f0",fontWeight:700,fontSize:14,marginBottom:10}}>{name}</div>
            {channels.map(b=>{
              const st = BOSS_STATUS_STYLE[bossStatus(b.secs)];
              return (
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{color:"#3d5070",fontSize:11,minWidth:40}}>Ch {b.channel}</span>
                  <span style={{flex:1,color:st.color,fontWeight:700,fontSize:13,fontFamily:"'Rajdhani',sans-serif"}}>{fmtSecs(b.secs)}</span>
                  <span style={{background:st.bg,color:st.color,border:`1px solid ${st.border}`,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{bossStatus(b.secs)}</span>
                  {canEditBossTimer(currentUser) && (
                    <>
                      <button onClick={()=>handleMarkKilledGroup(b.id,b.group)} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:7,padding:"4px 10px",color:"#f87171",fontSize:11,cursor:"pointer"}}>Killed</button>
                      <button onClick={()=>handleResetToZero(b.id,b.group)} style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:7,padding:"4px 8px",color:"#34d399",fontSize:11,cursor:"pointer"}}>Reset</button>
                      <button onClick={()=>{setBossTimerModal({id:b.id,group:b.group});setTimerHH("0");setTimerMM("0");setTimerSS("0");}} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:7,padding:"4px 8px",color:"#a5b4fc",fontSize:11,cursor:"pointer"}}>Set</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderBosses = () => (
    <div>
      {renderBossGroup(bosses,"Live 4 Bosses")}
      {renderBossGroup(folkvangNormal,"Folkvang — Normal")}
      {renderBossGroup(folkvangInterserver,"Folkvang — Interserver")}
      {renderBossGroup(canyonBosses,"Canyon of Nidavellir")}
      {renderBossGroup(lindwurmBosses,"Lindwurm Cave")}

      {bossTimerModal && canEditBossTimer(currentUser) && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:320}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:18,marginBottom:16}}>Set Timer (HH:MM:SS)</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
              {[["HH",timerHH,setTimerHH],["MM",timerMM,setTimerMM],["SS",timerSS,setTimerSS]].map(([lbl,val,set])=>(
                <div key={lbl}>
                  <label style={{display:"block",color:"#3d5070",fontSize:10,marginBottom:4}}>{lbl}</label>
                  <input type="number" min="0" value={val} onChange={e=>set(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px",color:"#e2e8f0",fontSize:14,outline:"none",textAlign:"center",fontFamily:"'Exo 2',sans-serif"}} />
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleSetTimerHMS} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"10px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>Set</button>
              <button onClick={()=>setBossTimerModal(null)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // EVENTS
  const renderEvents = () => (
    <div>
      {canManageEvents(currentUser) && (
        <div style={{marginBottom:18}}>
          <button onClick={()=>setShowCreateEvent(true)} style={{background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:11,padding:"10px 20px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>+ Create Event</button>
        </div>
      )}
      {events.length===0&&<div style={{color:"#3d5070",fontSize:14,textAlign:"center",padding:40}}>No events yet.</div>}
      {events.map(ev=>{
        const evType = EVENT_TYPES.find(t=>t.id===ev.type);
        return (
          <div key={ev.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:18,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <span style={{fontSize:20,marginRight:8}}>{ev.icon}</span>
                <span style={{color:"#e2e8f0",fontWeight:700,fontSize:15}}>{ev.name}</span>
                <span style={{marginLeft:10,color:evType?.color||"#60a5fa",fontSize:11}}>{ev.typeLabel}</span>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{color:"#fbbf24",fontSize:12,fontWeight:700}}>+{ev.points} pts</span>
                {canManageEvents(currentUser) && (
                  <>
                    <button onClick={()=>setMarkEventId(markEventId===ev.id?null:ev.id)} style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:7,padding:"4px 10px",color:"#a5b4fc",fontSize:11,cursor:"pointer"}}>Attendance</button>
                    <button onClick={()=>handleDeleteEvent(ev.id)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 8px",color:"#f87171",fontSize:11,cursor:"pointer"}}>✕</button>
                  </>
                )}
              </div>
            </div>
            <div style={{color:"#3d5070",fontSize:11,marginTop:6}}>{ev.date}{ev.server&&` · ${ev.server}`}</div>
            {markEventId===ev.id && canManageEvents(currentUser) && (
              <div style={{marginTop:14,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>Mark Attendance</div>
                  <button onClick={()=>handleMarkAllPresent(ev.id)} style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:7,padding:"4px 10px",color:"#34d399",fontSize:11,cursor:"pointer"}}>All Present</button>
                </div>
                {members.map(m=>(
                  <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                    <span style={{color:"#e2e8f0",fontSize:12}}>{m.name}</span>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>handleMarkEventAttendance(ev.id,m.id,true)} style={{background:ev.attendance[m.id]?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${ev.attendance[m.id]?"rgba(52,211,153,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"3px 10px",color:ev.attendance[m.id]?"#34d399":"#64748b",fontSize:11,cursor:"pointer"}}>✓ Present</button>
                      <button onClick={()=>handleMarkEventAttendance(ev.id,m.id,false)} style={{background:ev.attendance[m.id]===false?"rgba(239,68,68,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${ev.attendance[m.id]===false?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"3px 10px",color:ev.attendance[m.id]===false?"#f87171":"#64748b",fontSize:11,cursor:"pointer"}}>✗ Absent</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showCreateEvent && canManageEvents(currentUser) && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:380}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:20,marginBottom:18}}>Create Event</h3>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Type</label>
              <select value={eventForm.type} onChange={e=>{const et=EVENT_TYPES.find(t=>t.id===e.target.value);setEventForm(p=>({...p,type:e.target.value,points:et?.defaultPoints||5}));}} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                {EVENT_TYPES.map(et=><option key={et.id} value={et.id}>{et.icon} {et.label}</option>)}
              </select>
            </div>
            {[["Event Name","name","text"],["Notes (optional)","notes","text"],["Server (optional)","server","text"]].map(([label,key,type])=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>{label}</label>
                <input type={type} value={eventForm[key]} onChange={e=>setEventForm(p=>({...p,[key]:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Points</label>
              <input type="number" value={eventForm.points} onChange={e=>setEventForm(p=>({...p,points:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button onClick={handleCreateEvent} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"11px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>Create</button>
              <button onClick={()=>setShowCreateEvent(false)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ATTENDANCE summary
  const renderAttendance = () => {
    if(events.length===0) return <div style={{color:"#3d5070",fontSize:14,textAlign:"center",padding:40}}>No events yet.</div>;
    return (
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={TH}>Member</th>
              {events.slice(0,6).map(ev=><th key={ev.id} style={{...TH,maxWidth:80}}>{ev.icon} {ev.name.slice(0,10)}</th>)}
              <th style={TH}>Total Pts</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m=>(
              <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <td style={{padding:"10px 18px",color:"#e2e8f0",fontSize:13}}>{m.name}</td>
                {events.slice(0,6).map(ev=>(
                  <td key={ev.id} style={{padding:"10px 18px",textAlign:"center"}}>
                    {ev.attendance[m.id]===true ? <span style={{color:"#34d399"}}>✓</span> : ev.attendance[m.id]===false ? <span style={{color:"#f87171"}}>✗</span> : <span style={{color:"#3d5070"}}>—</span>}
                  </td>
                ))}
                <td style={{padding:"10px 18px",color:"#fbbf24",fontWeight:700}}>{(m.points||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // AUCTION
  const renderAuction = () => (
    <div>
      {canManageBids(currentUser) && (
        <div style={{marginBottom:18}}>
          <button onClick={()=>setShowAddAuction(true)} style={{background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:11,padding:"10px 20px",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>+ Add Item</button>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {auctionItems.map(item=>{
          const rs = RARITY_STYLE[item.rarity]||RARITY_STYLE.Common;
          const timeLeft = item.endTime - now;
          const ended = timeLeft <= 0;
          const myMember = members.find(m=>m.name===currentUser?.name||m.email===currentUser?.email);
          const bidEligible = canBid(currentUser, myMember);
          return (
            <div key={item.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${item.locked?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:16,padding:18,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:28}}>{typeof item.image==="string"&&item.image.startsWith("http")?<img src={item.image} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:8}} />:item.image}</div>
                  <div style={{color:"#e2e8f0",fontWeight:700,fontSize:14,marginTop:6}}>{item.name}</div>
                  <span style={{background:rs.bg,color:rs.color,border:`1px solid ${rs.glow}`,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{item.rarity}</span>
                </div>
                {canManageBids(currentUser) && (
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>setEditAuction({...item})} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:7,padding:"4px 8px",color:"#a5b4fc",fontSize:11,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>handleDeleteAuctionItem(item.id)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 8px",color:"#f87171",fontSize:11,cursor:"pointer"}}>✕</button>
                  </div>
                )}
              </div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:"#3d5070",fontSize:11}}>Min Bid</span>
                  <span style={{color:"#94a3b8",fontSize:12,fontWeight:600}}>{item.minBid.toLocaleString()} pts</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:"#3d5070",fontSize:11}}>Current Bid</span>
                  <span style={{color:"#fbbf24",fontSize:13,fontWeight:700}}>{item.currentBid>0?`${item.currentBid.toLocaleString()} pts`:"No bids"}</span>
                </div>
                {item.highBidder&&<div style={{color:"#64748b",fontSize:11,marginBottom:6}}>Leader: <strong style={{color:"#a5b4fc"}}>{item.highBidder}</strong></div>}
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <span style={{color:"#3d5070",fontSize:11}}>Time Left</span>
                  <span style={{color:ended?"#f87171":"#34d399",fontSize:12,fontWeight:600}}>{fmtCountdown(timeLeft)}</span>
                </div>
                {item.locked ? (
                  <div style={{textAlign:"center",color:"#fbbf24",fontWeight:700,fontSize:12,padding:"8px",background:"rgba(251,191,36,0.1)",borderRadius:8}}>🏆 Won by {item.winner}</div>
                ) : (
                  <div style={{display:"flex",gap:8}}>
                    {bidEligible ? (
                      <button onClick={()=>{setBidModal(item);setBidAmount("");}} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"9px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Exo 2',sans-serif"}}>Place Bid</button>
                    ) : (
                      <div style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"9px",color:"#3d5070",fontSize:11,textAlign:"center"}}>
                        {isRecruit(currentUser) ? `🔒 Bid in ${daysUntilBid(myMember)}d` : "🔒 No bidding"}
                      </div>
                    )}
                    {canManageBids(currentUser) && item.highBidder && (
                      <button onClick={()=>handleAnnounceWinner(item)} style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,padding:"9px 12px",color:"#fbbf24",cursor:"pointer",fontSize:12,fontWeight:700}}>🏆</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bid modal */}
      {bidModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:340}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:18,marginBottom:6}}>Place Bid</h3>
            <div style={{color:"#64748b",fontSize:12,marginBottom:18}}>{bidModal.name} · Min: {bidModal.minBid.toLocaleString()} pts · Your pts: {myPoints.toLocaleString()}</div>
            <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} placeholder={`Min ${bidModal.minBid.toLocaleString()}`} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"12px 14px",color:"#e2e8f0",fontSize:14,outline:"none",fontFamily:"'Exo 2',sans-serif",marginBottom:14}} />
            <div style={{display:"flex",gap:10}}>
              <button onClick={handleBid} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"11px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>Bid</button>
              <button onClick={()=>setBidModal(null)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit auction item modal */}
      {(showAddAuction||editAuction) && canManageBids(currentUser) && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"#0f1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:28,width:380}}>
            <h3 style={{color:"#e2e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:20,marginBottom:18}}>{editAuction?"Edit Item":"Add Auction Item"}</h3>
            {[["Item Name","name"],["Image URL (optional)","imageUrl"]].map(([label,key])=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>{label}</label>
                <input value={editAuction?editAuction[key]||"":auctionForm[key]||""} onChange={e=>editAuction?setEditAuction(p=>({...p,[key]:e.target.value})):setAuctionForm(p=>({...p,[key]:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Rarity</label>
              <select value={editAuction?editAuction.rarity:auctionForm.rarity} onChange={e=>editAuction?setEditAuction(p=>({...p,rarity:e.target.value})):setAuctionForm(p=>({...p,rarity:e.target.value}))} style={{width:"100%",background:"#0a0c18",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}}>
                {["Legendary","Epic","Rare","Common"].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div>
                <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Min Bid (pts)</label>
                <input type="number" value={editAuction?editAuction.minBid:auctionForm.minBid} onChange={e=>editAuction?setEditAuction(p=>({...p,minBid:parseInt(e.target.value)||0})):setAuctionForm(p=>({...p,minBid:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
              </div>
              {!editAuction && (
                <div>
                  <label style={{display:"block",color:"#3d5070",fontSize:10,fontWeight:700,marginBottom:5,textTransform:"uppercase"}}>Duration (hrs)</label>
                  <input type="number" value={auctionForm.durationHours} onChange={e=>setAuctionForm(p=>({...p,durationHours:e.target.value}))} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Exo 2',sans-serif"}} />
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button onClick={editAuction?handleEditAuctionItem:handleAddAuctionItem} style={{flex:1,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",borderRadius:10,padding:"11px",color:"#fff",cursor:"pointer",fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>{editAuction?"Save":"Add"}</button>
              <button onClick={()=>{setShowAddAuction(false);setEditAuction(null);}} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"11px",color:"#64748b",cursor:"pointer",fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // WINNERS
  const renderWinners = () => (
    <div>
      {winners.length===0&&<div style={{color:"#3d5070",fontSize:14,textAlign:"center",padding:40}}>No winners yet.</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {winners.map(w=>{
          const rs = RARITY_STYLE[w.rarity]||RARITY_STYLE.Common;
          return (
            <div key={w.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${rs.glow}`,borderRadius:14,padding:16}}>
              <div style={{fontSize:24,marginBottom:8}}>{w.image||"🏆"}</div>
              <div style={{color:"#e2e8f0",fontWeight:700,fontSize:14}}>{w.itemName}</div>
              <div style={{color:rs.color,fontSize:11,marginTop:2}}>{w.rarity}</div>
              <div style={{marginTop:10,color:"#a5b4fc",fontWeight:600}}>{w.winner}</div>
              <div style={{color:"#fbbf24",fontSize:12,marginTop:2}}>{w.points.toLocaleString()} pts</div>
              <div style={{color:"#3d5070",fontSize:11,marginTop:4}}>{w.date}</div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {canManageBids(currentUser) && (
                  <>
                    <button onClick={()=>handleClaimWinner(w.id)} disabled={w.claimed} style={{flex:1,background:w.claimed?"rgba(52,211,153,0.15)":"rgba(52,211,153,0.08)",border:`1px solid ${w.claimed?"rgba(52,211,153,0.4)":"rgba(52,211,153,0.2)"}`,borderRadius:8,padding:"7px",color:w.claimed?"#34d399":"#64748b",fontSize:11,cursor:w.claimed?"default":"pointer",fontFamily:"'Exo 2',sans-serif",fontWeight:600}}>{w.claimed?"✅ Claimed":"Mark Claimed"}</button>
                    <button onClick={()=>handleRemoveWinner(w.id)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"7px 10px",color:"#f87171",fontSize:11,cursor:"pointer"}}>✕</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // SETTINGS
  const renderSettings = () => (
    <div style={{display:"grid",gap:20,maxWidth:600}}>
      {/* Profile */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:22}}>
        <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Your Profile</div>
        <div style={{display:"flex",gap:14,alignItems:"center"}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(99,102,241,0.2)",border:"2px solid rgba(99,102,241,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#a5b4fc"}}>{currentUser.name[0]}</div>
          <div>
            <div style={{color:"#e2e8f0",fontWeight:700,fontSize:16}}>{currentUser.name}</div>
            <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{currentUser.email}</div>
            <div style={{marginTop:6}}><RoleBadge role={userRole} /></div>
          </div>
        </div>
        <button onClick={handleLogout} style={{marginTop:18,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 20px",color:"#f87171",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Exo 2',sans-serif"}}>Sign Out</button>
      </div>

      {/* Export */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:22}}>
        <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Data Export</div>
        <button onClick={()=>exportToExcel(false)} style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:10,padding:"10px 20px",color:"#34d399",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Exo 2',sans-serif"}}>📊 Export to Excel</button>
      </div>

      {/* Permission Matrix */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:22}}>
        <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Role Permissions</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr>
                <th style={{...TH,fontSize:9}}>Feature</th>
                {["Admin","Leader","Elder","Member","Recruit"].map(r=><th key={r} style={{...TH,fontSize:9,textAlign:"center"}}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map(row=>(
                <tr key={row.feature} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <td style={{padding:"8px 18px",color:"#94a3b8",fontSize:11}}>{row.feature}</td>
                  {["Admin","Leader","Elder","Member","Recruit"].map(r=>(
                    <td key={r} style={{padding:"8px 18px",textAlign:"center"}}>
                      {row[r]===true ? <span style={{color:"#34d399"}}>✓</span> : row[r]==="7d" ? <span style={{color:"#fbbf24",fontSize:10}}>7d</span> : <span style={{color:"#3d5070"}}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Discord */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:22}}>
        <div style={{color:"#3d5070",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Discord Integration</div>
        <input value={discordWebhook} onChange={e=>setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"'Exo 2',sans-serif",marginBottom:10}} />
        <button onClick={()=>{if(discordWebhook){setDiscordConnected(true);showToast("✅ Discord connected!");}else{showToast("❌ Enter webhook URL","error");}}} style={{background:discordConnected?"rgba(52,211,153,0.1)":"rgba(99,102,241,0.1)",border:`1px solid ${discordConnected?"rgba(52,211,153,0.3)":"rgba(99,102,241,0.25)"}`,borderRadius:10,padding:"9px 18px",color:discordConnected?"#34d399":"#a5b4fc",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Exo 2',sans-serif"}}>{discordConnected?"✅ Connected":"Connect Discord"}</button>
      </div>

      {/* Admin-only: Wipe all data */}
      {canWipeData(currentUser) && (
        <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:16,padding:22}}>
          <div style={{color:"#f87171",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>⚠️ Danger Zone — Admin Only</div>
          <p style={{color:"#64748b",fontSize:12,marginBottom:14}}>Wipe ALL user data (members, auction items, events, winners) from Supabase. This cannot be undone.</p>
          {!showWipeConfirm ? (
            <button onClick={()=>setShowWipeConfirm(true)} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.35)",borderRadius:10,padding:"10px 20px",color:"#f87171",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Exo 2',sans-serif"}}>🗑️ Wipe All Data</button>
          ) : (
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{color:"#f87171",fontSize:12}}>Are you sure? This deletes everything.</span>
              <button onClick={handleWipeAccounts} disabled={wipeLoading} style={{background:"rgba(239,68,68,0.25)",border:"1px solid rgba(239,68,68,0.5)",borderRadius:8,padding:"8px 16px",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"'Exo 2',sans-serif"}}>{wipeLoading?"Wiping...":"Yes, Wipe"}</button>
              <button onClick={()=>setShowWipeConfirm(false)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 16px",color:"#64748b",cursor:"pointer",fontSize:12,fontFamily:"'Exo 2',sans-serif"}}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const sectionMap = {
    dashboard: renderDashboard,
    members: renderMembers,
    bosses: renderBosses,
    events: renderEvents,
    attendance: renderAttendance,
    auction: renderAuction,
    winners: renderWinners,
    settings: renderSettings,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Exo+2:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#070910;min-height:100vh;font-family:'Exo 2',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:3px}
        select option{background:#0a0c18;}
      `}</style>

      <div style={{display:"flex",minHeight:"100vh",background:"#070910"}}>
        {/* Sidebar */}
        <div style={{width:sidebarW,minHeight:"100vh",background:"rgba(255,255,255,0.02)",borderRight:"1px solid rgba(255,255,255,0.05)",padding:"18px 10px",display:"flex",flexDirection:"column",gap:4,transition:"width 0.2s",flexShrink:0}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-start",gap:10,padding:"6px 8px",marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:"50%",border:"2px solid rgba(251,191,36,0.4)",background:"rgba(251,191,36,0.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <img src={logoUrl} alt="" style={{width:"85%",height:"85%",objectFit:"contain",borderRadius:"50%"}} onError={e=>{e.target.style.display="none";}} />
            </div>
            {!collapsed&&<span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:18,fontWeight:700,letterSpacing:"0.12em",background:"linear-gradient(135deg,#fbbf24,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>RAMPAGE</span>}
          </div>

          {renderNav()}

          <div style={{flex:1}} />
          {/* Current user role pill */}
          {!collapsed && (
            <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10,marginTop:8}}>
              <div style={{color:"#3d5070",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Signed in as</div>
              <div style={{color:"#e2e8f0",fontSize:12,fontWeight:600,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</div>
              <RoleBadge role={userRole} />
            </div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)} style={{marginTop:8,background:"none",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"8px",color:"#3d5070",cursor:"pointer",fontSize:14,fontFamily:"'Exo 2',sans-serif"}}>
            {collapsed?"→":"←"}
          </button>
        </div>

        {/* Main content */}
        <div style={{flex:1,overflow:"auto",padding:"28px 28px 40px"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div>
              <h2 style={{fontFamily:"'Rajdhani',sans-serif",fontSize:22,fontWeight:700,color:"#e2e8f0",letterSpacing:"0.06em"}}>{NAV.find(n=>n.id===activeNav)?.icon} {NAV.find(n=>n.id===activeNav)?.label}</h2>
              <div style={{color:"#3d5070",fontSize:11,marginTop:2}}>{today}</div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              {notifications.length>0 && (
                <div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"5px 10px",color:"#f87171",fontSize:11,fontWeight:700}}>
                  🔔 {notifications.length} alert{notifications.length>1?"s":""}
                </div>
              )}
            </div>
          </div>

          {/* Page content */}
          {(sectionMap[activeNav] || renderDashboard)()}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:999,background:toast.type==="error"?"rgba(239,68,68,0.15)":toast.type==="warn"?"rgba(251,191,36,0.12)":"rgba(52,211,153,0.12)",border:`1px solid ${toast.type==="error"?"rgba(239,68,68,0.35)":toast.type==="warn"?"rgba(251,191,36,0.3)":"rgba(52,211,153,0.3)"}`,borderRadius:12,padding:"12px 18px",color:toast.type==="error"?"#f87171":toast.type==="warn"?"#fbbf24":"#34d399",fontSize:13,fontWeight:600,maxWidth:320,animation:"cardIn 0.3s ease",fontFamily:"'Exo 2',sans-serif",backdropFilter:"blur(12px)"}}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
