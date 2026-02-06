import { useState, useEffect } from "react";
import "./App.css";
import {
  db, doc, setDoc, getDoc, getDocs, collection, query, where, orderBy,
  addDoc, deleteDoc, serverTimestamp,
} from "./firebase";

// ============== CONSTANTS ==============
const HABIT_TYPES = [
  { value: "spiritual", label: "Spiritual", emoji: "🕌" },
  { value: "health", label: "Health", emoji: "💪" },
  { value: "productivity", label: "Productivity", emoji: "⚡" },
  { value: "custom", label: "Custom", emoji: "✨" },
];
const NAMAZ_PRESETS = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"];
const MSG_TYPES = [
  { value: "motivation", label: "💪 Motivation" },
  { value: "reminder", label: "⏰ Reminder" },
  { value: "feedback", label: "💬 Feedback" },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}
function getStreak(dailyCards) {
  if (!dailyCards || dailyCards.length === 0) return 0;
  const sorted = [...dailyCards].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expStr = expected.toISOString().split("T")[0];
    if (sorted[i].date === expStr && sorted[i].completionPct > 0) streak++;
    else break;
  }
  return streak;
}

// ============== FIREBASE HELPERS ==============

// Save user profile
async function saveUserProfile(user) {
  await setDoc(doc(db, "users", user.username), user);
}

// Get user profile
async function getUserProfile(username) {
  const snap = await getDoc(doc(db, "users", username));
  return snap.exists() ? snap.data() : null;
}

// Get all users
async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => d.data());
}

// Save user private data (habits + daily cards in one doc to reduce reads)
async function saveUserData(username, data) {
  await setDoc(doc(db, "userData", username), { ...data, updatedAt: new Date().toISOString() });
}

// Get user private data
async function getUserData(username) {
  const snap = await getDoc(doc(db, "userData", username));
  return snap.exists() ? snap.data() : null;
}

// Save a thought
async function saveThought(thought) {
  await setDoc(doc(db, "thoughts", thought.id), thought);
}

// Delete a thought
async function removeThought(id) {
  await deleteDoc(doc(db, "thoughts", id));
}

// Get thoughts for a user
async function getThoughts(username) {
  const q = query(collection(db, "thoughts"), where("username", "==", username));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Get public thoughts for a user (for profile view)
async function getPublicThoughts(username) {
  const q = query(collection(db, "thoughts"), where("username", "==", username), where("visibility", "==", "public"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Save a quote
async function saveQuote(quoteData) {
  await setDoc(doc(db, "quotes", quoteData.id), quoteData);
}
async function removeQuote(id) {
  await deleteDoc(doc(db, "quotes", id));
}
async function getQuotes(username) {
  const q = query(collection(db, "quotes"), where("username", "==", username));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Save a media link
async function saveMediaLink(link) {
  await setDoc(doc(db, "mediaLinks", link.id), link);
}
async function removeMediaLink(id) {
  await deleteDoc(doc(db, "mediaLinks", id));
}
async function getMediaLinks(username) {
  const q = query(collection(db, "mediaLinks"), where("username", "==", username));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Messages
async function saveMessage(msg) {
  await setDoc(doc(db, "messages", msg.id), msg);
}
async function getMessagesForUser(username) {
  // Get received
  const qR = query(collection(db, "messages"), where("to", "==", username));
  const qS = query(collection(db, "messages"), where("from", "==", username));
  const [snapR, snapS] = await Promise.all([getDocs(qR), getDocs(qS)]);
  const received = snapR.docs.map((d) => d.data());
  const sent = snapS.docs.map((d) => d.data());
  // Merge and deduplicate
  const all = [...received, ...sent];
  const unique = [...new Map(all.map((m) => [m.id, m])).values()];
  return unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function getPublicMessagesFor(username) {
  const q = query(collection(db, "messages"), where("to", "==", username), where("visibility", "==", "public"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ============== UI COMPONENTS ==============

function ProgressRing({ pct, size = 60, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em" fill="var(--text)"
        fontSize={size * 0.22} fontWeight="700" style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--card)", borderRadius: 20, padding: "32px", maxWidth: 520, width: "92%",
        maxHeight: "85vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
        border: "1px solid var(--border)", animation: "slideUp 0.3s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: "var(--text)" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, style, disabled }) {
  const base = {
    padding: "10px 22px", borderRadius: 12, border: "none", fontWeight: 600, fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s ease", fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: "var(--accent)", color: "#fff" },
    secondary: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--accent)" },
    danger: { background: "#e74c3c", color: "#fff" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--muted)", fontWeight: 600, letterSpacing: 0.5 }}>{label}</label>}
      <input {...props} style={{
        width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit",
        outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", ...props.style,
      }} />
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{label}</label>}
      <textarea {...props} style={{
        width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit",
        outline: "none", boxSizing: "border-box", minHeight: 80, resize: "vertical", ...props.style,
      }} />
    </div>
  );
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{label}</label>}
      <select {...props} style={{
        width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none", ...props.style,
      }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ============== PAGES ==============

function LandingPage({ onGetStarted }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 32px", position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,20,0.8)", backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>◉</span>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, fontFamily: "var(--font-display)" }}>HabitFlow</span>
        </div>
        <Btn onClick={onGetStarted}>Get Started →</Btn>
      </nav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 3, color: "var(--accent)", marginBottom: 24,
          textTransform: "uppercase", background: "rgba(232,167,53,0.1)", padding: "8px 20px", borderRadius: 30,
        }}>TRACK · REFLECT · GROW</div>
        <h1 style={{
          fontSize: "clamp(36px, 7vw, 72px)", fontWeight: 900, lineHeight: 1.05,
          fontFamily: "var(--font-display)", margin: "0 0 24px", maxWidth: 700,
          background: "linear-gradient(135deg, var(--text) 0%, var(--accent) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Build Your Life System, Publicly.</h1>
        <p style={{ fontSize: 18, color: "var(--muted)", maxWidth: 520, margin: "0 0 40px", lineHeight: 1.7 }}>
          Create habits, log daily progress, share thoughts & quotes — all on one platform built for accountability and self-improvement.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <Btn onClick={onGetStarted} style={{ padding: "14px 36px", fontSize: 16, borderRadius: 14 }}>Start Your Journey →</Btn>
          <Btn variant="secondary" onClick={onGetStarted} style={{ padding: "14px 36px", fontSize: 16, borderRadius: 14 }}>Explore Profiles</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginTop: 80, maxWidth: 900, width: "100%" }}>
          {[
            { icon: "🕌", title: "Spiritual Tracking", desc: "Track namaz, fasting & spiritual growth" },
            { icon: "📝", title: "Daily Journal", desc: "Thoughts, quotes & reflections" },
            { icon: "📊", title: "Public Progress", desc: "Accountability through transparency" },
            { icon: "💬", title: "Community", desc: "Motivate and support each other" },
          ].map((f, i) => (
            <div key={i} style={{
              background: "var(--card)", borderRadius: 16, padding: 28,
              border: "1px solid var(--border)", textAlign: "left",
              animation: `fadeIn 0.5s ease ${i * 0.1}s both`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) return setError("Please fill all fields");
    if (mode === "signup" && (!username || !displayName)) return setError("Please fill all fields");
    if (mode === "signup" && username.length < 3) return setError("Username must be at least 3 characters");
    setLoading(true);
    try {
      if (mode === "signup") {
        const existing = await getUserProfile(username.toLowerCase());
        if (existing) { setLoading(false); return setError("Username already taken"); }
        const user = {
          id: generateId(), email, username: username.toLowerCase(),
          displayName, password, createdAt: new Date().toISOString(),
        };
        await saveUserProfile(user);
        localStorage.setItem("hf-session", JSON.stringify({ username: user.username, email: user.email }));
        onAuth(user);
      } else {
        // Find user by email
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return setError("Account not found"); }
        const userData = snap.docs[0].data();
        if (userData.password !== password) { setLoading(false); return setError("Incorrect password"); }
        localStorage.setItem("hf-session", JSON.stringify({ username: userData.username, email: userData.email }));
        onAuth(userData);
      }
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>◉</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-display)", margin: 0 }}>
            {mode === "login" ? "Welcome Back" : "Join HabitFlow"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8 }}>
            {mode === "login" ? "Log in to continue your journey" : "Start building your life system"}
          </p>
        </div>
        <div style={{ background: "var(--card)", borderRadius: 20, padding: 28, border: "1px solid var(--border)" }}>
          {error && <div style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {mode === "signup" && (
            <>
              <Input label="Display Name" placeholder="Your Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <Input label="Username" placeholder="unique_username" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, "_"))} />
            </>
          )}
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <Btn onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: 13, marginTop: 8 }}>
            {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
          </Btn>
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--muted)" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>
              {mode === "login" ? "Sign Up" : "Log In"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, habits, dailyCards, thoughts, quotes, onNav }) {
  const today = getToday();
  const todayCard = dailyCards.find((c) => c.date === today);
  const streak = getStreak(dailyCards);
  const completedToday = todayCard ? todayCard.completionPct : 0;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(232,167,53,0.12) 0%, rgba(232,167,53,0.03) 100%)",
        borderRadius: 20, padding: "32px 28px", marginBottom: 28, border: "1px solid rgba(232,167,53,0.15)",
      }}>
        <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>{formatDate(today)}</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>Salaam, {user.displayName} 👋</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          {streak > 0 ? `You're on a ${streak}-day streak! Keep going.` : "Start your streak today!"}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Today's Progress", value: <ProgressRing pct={completedToday} size={52} />, raw: true },
          { label: "Current Streak", value: `${streak} 🔥`, color: "#e74c3c" },
          { label: "Total Habits", value: habits.length, color: "var(--accent)" },
          { label: "Journal Entries", value: thoughts.length, color: "#9b59b6" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--card)", borderRadius: 16, padding: "20px 18px", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" }}>{s.label}</div>
            {s.raw ? s.value : <div style={{ fontSize: 26, fontWeight: 800, color: s.color || "var(--text)" }}>{s.value}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        <div onClick={() => onNav("daily-card")} style={{ background: "var(--accent)", borderRadius: 16, padding: "22px 20px", cursor: "pointer", color: "#fff" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{todayCard ? "Update" : "Fill"} Today's Card</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Track your daily habits</div>
        </div>
        <div onClick={() => onNav("journal")} style={{ background: "var(--card)", borderRadius: 16, padding: "22px 20px", cursor: "pointer", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✍️</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Write Thought</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Journal your reflections</div>
        </div>
      </div>
      {dailyCards.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Recent Daily Cards</h3>
          {dailyCards.slice(0, 5).map((card) => (
            <div key={card.date} style={{ background: "var(--card)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDate(card.date)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{card.completedHabits}/{card.totalHabits} habits · {card.sleepHours || "—"}h sleep</div>
              </div>
              <ProgressRing pct={card.completionPct} size={42} stroke={4} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HabitsPage({ habits, setHabits, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [showNamaz, setShowNamaz] = useState(false);

  const persist = async (updated) => {
    setHabits(updated);
    const data = await getUserData(user.username) || {};
    await saveUserData(user.username, { ...data, habits: updated });
  };

  const addHabit = async () => {
    if (!name.trim()) return;
    const h = { id: generateId(), name: name.trim(), type, createdAt: new Date().toISOString() };
    await persist([...habits, h]);
    setName(""); setShowAdd(false);
  };

  const addNamazHabits = async () => {
    const newH = NAMAZ_PRESETS.filter((n) => !habits.some((h) => h.name.toLowerCase() === n.toLowerCase()))
      .map((n) => ({ id: generateId(), name: n, type: "spiritual", createdAt: new Date().toISOString() }));
    await persist([...habits, ...newH]);
    setShowNamaz(false);
  };

  const removeHabit = async (id) => {
    await persist(habits.filter((h) => h.id !== id));
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>My Habits</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={() => setShowNamaz(true)}>🕌 Add Namaz</Btn>
          <Btn onClick={() => setShowAdd(true)}>+ Add Habit</Btn>
        </div>
      </div>
      {habits.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No habits yet</h3>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Create your first habit to start tracking</p>
        </div>
      ) : (
        <div>
          {Object.entries(habits.reduce((acc, h) => { (acc[h.type] = acc[h.type] || []).push(h); return acc; }, {})).map(([tp, list]) => {
            const typeInfo = HABIT_TYPES.find((t) => t.value === tp) || HABIT_TYPES[3];
            return (
              <div key={tp} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>{typeInfo.emoji} {typeInfo.label}</div>
                {list.map((h) => (
                  <div key={h.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 18px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{h.name}</span>
                    <button onClick={() => removeHabit(h.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>🗑</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Habit">
        <Input label="Habit Name" placeholder="e.g. Reading, Exercise" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Category" value={type} onChange={(e) => setType(e.target.value)} options={HABIT_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))} />
        <Btn onClick={addHabit} style={{ width: "100%" }} disabled={!name.trim()}>Add Habit</Btn>
      </Modal>
      <Modal open={showNamaz} onClose={() => setShowNamaz(false)} title="🕌 Add Namaz Habits">
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>Add all 5 daily prayers:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {NAMAZ_PRESETS.map((n) => (
            <span key={n} style={{ background: "var(--surface)", padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", opacity: habits.some((h) => h.name.toLowerCase() === n.toLowerCase()) ? 0.5 : 1 }}>{n}</span>
          ))}
        </div>
        <Btn onClick={addNamazHabits} style={{ width: "100%" }}>Add All Prayers</Btn>
      </Modal>
    </div>
  );
}

function DailyCardPage({ habits, dailyCards, setDailyCards, user }) {
  const today = getToday();
  const existingCard = dailyCards.find((c) => c.date === today);
  const [checked, setChecked] = useState(existingCard ? existingCard.habitChecks : {});
  const [sleepHours, setSleepHours] = useState(existingCard ? String(existingCard.sleepHours || "") : "");
  const [notes, setNotes] = useState(existingCard ? existingCard.notes : "");
  const [saved, setSaved] = useState(false);

  const completedCount = Object.values(checked).filter(Boolean).length;
  const pct = habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  const saveCard = async () => {
    const card = {
      date: today, habitChecks: checked, sleepHours: parseFloat(sleepHours) || 0,
      notes, completionPct: pct, completedHabits: completedCount, totalHabits: habits.length,
    };
    const updated = dailyCards.filter((c) => c.date !== today);
    updated.unshift(card);
    updated.sort((a, b) => b.date.localeCompare(a.date));
    setDailyCards(updated);
    const data = await getUserData(user.username) || {};
    await saveUserData(user.username, { ...data, dailyCards: updated });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>Daily Card</h2>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{formatDate(today)}</div>
        </div>
        <ProgressRing pct={pct} size={64} stroke={5} />
      </div>
      {habits.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--muted)" }}>Create some habits first!</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>HABIT CHECKLIST</div>
            {habits.map((h) => {
              const typeInfo = HABIT_TYPES.find((t) => t.value === h.type) || HABIT_TYPES[3];
              return (
                <div key={h.id} onClick={() => setChecked((prev) => ({ ...prev, [h.id]: !prev[h.id] }))}
                  style={{
                    background: checked[h.id] ? "rgba(232,167,53,0.08)" : "var(--card)",
                    borderRadius: 12, padding: "14px 18px", marginBottom: 8, cursor: "pointer",
                    border: checked[h.id] ? "1px solid rgba(232,167,53,0.3)" : "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s ease",
                  }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8,
                    border: checked[h.id] ? "none" : "2px solid var(--border)",
                    background: checked[h.id] ? "var(--accent)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {checked[h.id] && <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14, textDecoration: checked[h.id] ? "line-through" : "none", opacity: checked[h.id] ? 0.7 : 1 }}>{h.name}</div>
                  <span style={{ fontSize: 16 }}>{typeInfo.emoji}</span>
                </div>
              );
            })}
          </div>
          <Input label="Sleep Hours" type="number" placeholder="e.g. 7.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} style={{ maxWidth: 200 }} />
          <Textarea label="Notes" placeholder="How was your day?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Btn onClick={saveCard} style={{ width: "100%" }}>{saved ? "✓ Saved!" : existingCard ? "Update Card" : "Save Daily Card"}</Btn>
        </>
      )}
    </div>
  );
}

function JournalPage({ user, thoughts, setThoughts, quotes, setQuotes, mediaLinks, setMediaLinks }) {
  const [tab, setTab] = useState("thoughts");
  const [showAdd, setShowAdd] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [thoughtVisibility, setThoughtVisibility] = useState("public");
  const [quoteText, setQuoteText] = useState("");
  const [quoteAuthor, setQuoteAuthor] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const addThought = async () => {
    if (!thoughtText.trim() || saving) return;
    setSaving(true);
    const t = { id: generateId(), text: thoughtText.trim(), visibility: thoughtVisibility, username: user.username, displayName: user.displayName, date: getToday(), createdAt: new Date().toISOString() };
    await saveThought(t);
    setThoughts([t, ...thoughts]);
    setThoughtText(""); setShowAdd(false); setSaving(false);
  };

  const addQuote = async () => {
    if (!quoteText.trim() || saving) return;
    setSaving(true);
    const q = { id: generateId(), text: quoteText.trim(), author: quoteAuthor.trim(), username: user.username, displayName: user.displayName, date: getToday(), createdAt: new Date().toISOString() };
    await saveQuote(q);
    setQuotes([q, ...quotes]);
    setQuoteText(""); setQuoteAuthor(""); setShowAdd(false); setSaving(false);
  };

  const addMedia = async () => {
    if (!mediaUrl.trim() || saving) return;
    setSaving(true);
    const m = { id: generateId(), url: mediaUrl.trim(), title: mediaTitle.trim() || mediaUrl.trim(), username: user.username, date: getToday(), createdAt: new Date().toISOString() };
    await saveMediaLink(m);
    setMediaLinks([m, ...mediaLinks]);
    setMediaUrl(""); setMediaTitle(""); setShowAdd(false); setSaving(false);
  };

  const handleRemove = async (type, id) => {
    if (type === "thoughts") { await removeThought(id); setThoughts(thoughts.filter((t) => t.id !== id)); }
    else if (type === "quotes") { await removeQuote(id); setQuotes(quotes.filter((q) => q.id !== id)); }
    else { await removeMediaLink(id); setMediaLinks(mediaLinks.filter((m) => m.id !== id)); }
  };

  const tabs = [
    { id: "thoughts", label: "✍️ Thoughts", count: thoughts.length },
    { id: "quotes", label: "💎 Quotes", count: quotes.length },
    { id: "media", label: "🔗 Media", count: mediaLinks.length },
  ];

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>Journal</h2>
        <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--surface)", borderRadius: 14, padding: 4 }}>
        {tabs.map((t) => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center", cursor: "pointer",
            fontSize: 13, fontWeight: 600, background: tab === t.id ? "var(--card)" : "transparent",
            color: tab === t.id ? "var(--text)" : "var(--muted)",
            boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
          }}>{t.label} ({t.count})</div>
        ))}
      </div>

      {tab === "thoughts" && (thoughts.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No thoughts yet.</div> :
        thoughts.map((t) => (
          <div key={t.id} style={{ background: "var(--card)", borderRadius: 14, padding: "18px 20px", marginBottom: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(t.date)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: t.visibility === "public" ? "rgba(46,204,113,0.15)" : "rgba(149,165,166,0.15)", color: t.visibility === "public" ? "#2ecc71" : "#95a5a6" }}>{t.visibility}</span>
              </div>
              <button onClick={() => handleRemove("thoughts", t.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>🗑</button>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{t.text}</p>
          </div>
        ))
      )}
      {tab === "quotes" && (quotes.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No quotes yet.</div> :
        quotes.map((q) => (
          <div key={q.id} style={{ background: "var(--card)", borderRadius: 14, padding: "20px 22px", marginBottom: 12, border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontStyle: "italic", fontSize: 15, lineHeight: 1.7, flex: 1 }}>"{q.text}"</div>
              <button onClick={() => handleRemove("quotes", q.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", marginLeft: 10 }}>🗑</button>
            </div>
            {q.author && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 8, fontWeight: 600 }}>— {q.author}</div>}
          </div>
        ))
      )}
      {tab === "media" && (mediaLinks.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No media links yet.</div> :
        mediaLinks.map((m) => (
          <div key={m.id} style={{ background: "var(--card)", borderRadius: 14, padding: "16px 18px", marginBottom: 10, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.title}</a>
            <button onClick={() => handleRemove("media", m.id)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", marginLeft: 10 }}>🗑</button>
          </div>
        ))
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add ${tab === "thoughts" ? "Thought" : tab === "quotes" ? "Quote" : "Media Link"}`}>
        {tab === "thoughts" && (
          <>
            <Textarea label="Your Thought" placeholder="What's on your mind..." value={thoughtText} onChange={(e) => setThoughtText(e.target.value)} />
            <Select label="Visibility" value={thoughtVisibility} onChange={(e) => setThoughtVisibility(e.target.value)} options={[{ value: "public", label: "🌍 Public" }, { value: "private", label: "🔒 Private" }]} />
            <Btn onClick={addThought} style={{ width: "100%" }} disabled={!thoughtText.trim() || saving}>{saving ? "Saving..." : "Save Thought"}</Btn>
          </>
        )}
        {tab === "quotes" && (
          <>
            <Textarea label="Quote" placeholder="Write the quote..." value={quoteText} onChange={(e) => setQuoteText(e.target.value)} />
            <Input label="Author (optional)" placeholder="e.g. Ali ibn Abi Talib" value={quoteAuthor} onChange={(e) => setQuoteAuthor(e.target.value)} />
            <Btn onClick={addQuote} style={{ width: "100%" }} disabled={!quoteText.trim() || saving}>{saving ? "Saving..." : "Save Quote"}</Btn>
          </>
        )}
        {tab === "media" && (
          <>
            <Input label="URL" placeholder="https://youtube.com/..." value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
            <Input label="Title (optional)" placeholder="Video title" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} />
            <Btn onClick={addMedia} style={{ width: "100%" }} disabled={!mediaUrl.trim() || saving}>{saving ? "Saving..." : "Save Link"}</Btn>
          </>
        )}
      </Modal>
    </div>
  );
}

function MessagesPage({ user, messages, setMessages }) {
  const [showCompose, setShowCompose] = useState(false);
  const [toUser, setToUser] = useState("");
  const [msgText, setMsgText] = useState("");
  const [msgType, setMsgType] = useState("motivation");
  const [msgVisibility, setMsgVisibility] = useState("public");
  const [directory, setDirectory] = useState([]);
  const [tab, setTab] = useState("received");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getAllUsers().then((users) => setDirectory(users)).catch(() => {});
  }, []);

  const received = messages.filter((m) => m.to === user.username);
  const sent = messages.filter((m) => m.from === user.username);

  const sendMsg = async () => {
    if (!toUser.trim() || !msgText.trim() || sending) return;
    setSending(true);
    const msg = {
      id: generateId(), from: user.username, fromName: user.displayName,
      to: toUser.toLowerCase().trim(), text: msgText.trim(), type: msgType,
      visibility: msgVisibility, date: getToday(), createdAt: new Date().toISOString(),
    };
    await saveMessage(msg);
    setMessages([msg, ...messages]);
    setMsgText(""); setToUser(""); setShowCompose(false); setSending(false);
  };

  const renderMsg = (m, showFrom) => (
    <div key={m.id} style={{
      background: "var(--card)", borderRadius: 14, padding: "16px 18px", marginBottom: 10,
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${m.type === "motivation" ? "#2ecc71" : m.type === "reminder" ? "#f39c12" : "#3498db"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{showFrom ? `From @${m.from}` : `To @${m.to}`}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: m.type === "motivation" ? "rgba(46,204,113,0.15)" : m.type === "reminder" ? "rgba(243,156,18,0.15)" : "rgba(52,152,219,0.15)", color: m.type === "motivation" ? "#2ecc71" : m.type === "reminder" ? "#f39c12" : "#3498db" }}>{m.type}</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: m.visibility === "public" ? "rgba(46,204,113,0.1)" : "rgba(149,165,166,0.1)", color: m.visibility === "public" ? "#2ecc71" : "#95a5a6" }}>{m.visibility === "public" ? "public" : "DM"}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatDate(m.date)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{m.text}</p>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "var(--font-display)" }}>Messages</h2>
        <Btn onClick={() => setShowCompose(true)}>✉️ Compose</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--surface)", borderRadius: 14, padding: 4 }}>
        {[{ id: "received", label: `📥 Received (${received.length})` }, { id: "sent", label: `📤 Sent (${sent.length})` }].map((t) => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center", cursor: "pointer",
            fontSize: 13, fontWeight: 600, background: tab === t.id ? "var(--card)" : "transparent",
            color: tab === t.id ? "var(--text)" : "var(--muted)",
          }}>{t.label}</div>
        ))}
      </div>
      {tab === "received" && (received.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No messages yet.</div> : received.map((m) => renderMsg(m, true)))}
      {tab === "sent" && (sent.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No messages sent.</div> : sent.map((m) => renderMsg(m, false)))}

      <Modal open={showCompose} onClose={() => setShowCompose(false)} title="Send Message">
        <Input label="To Username" placeholder="@username" value={toUser} onChange={(e) => setToUser(e.target.value)} />
        {directory.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {directory.filter((d) => d.username !== user.username).map((d) => (
              <span key={d.username} onClick={() => setToUser(d.username)} style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                background: toUser === d.username ? "var(--accent)" : "var(--surface)",
                color: toUser === d.username ? "#fff" : "var(--muted)", border: "1px solid var(--border)",
              }}>@{d.username}</span>
            ))}
          </div>
        )}
        <Select label="Type" value={msgType} onChange={(e) => setMsgType(e.target.value)} options={MSG_TYPES} />
        <Select label="Visibility" value={msgVisibility} onChange={(e) => setMsgVisibility(e.target.value)} options={[{ value: "public", label: "🌍 Public" }, { value: "private", label: "🔒 Private (DM)" }]} />
        <Textarea label="Message" placeholder="Write your message..." value={msgText} onChange={(e) => setMsgText(e.target.value)} />
        <Btn onClick={sendMsg} style={{ width: "100%" }} disabled={!toUser.trim() || !msgText.trim() || sending}>{sending ? "Sending..." : "Send Message"}</Btn>
      </Modal>
    </div>
  );
}

function PublicProfilePage({ user, habits, dailyCards, thoughts, quotes, mediaLinks, messages }) {
  const streak = getStreak(dailyCards);
  const today = getToday();
  const todayCard = dailyCards.find((c) => c.date === today);
  const publicThoughts = thoughts.filter((t) => t.visibility === "public");
  const publicMessages = messages.filter((m) => m.to === user.username && m.visibility === "public");

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(232,167,53,0.15) 0%, rgba(232,167,53,0.03) 100%)",
        borderRadius: 20, padding: "32px 28px", marginBottom: 24, textAlign: "center",
        border: "1px solid rgba(232,167,53,0.15)",
      }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30, fontWeight: 800, color: "#fff" }}>
          {user.displayName[0].toUpperCase()}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>{user.displayName}</h2>
        <div style={{ fontSize: 14, color: "var(--accent)", fontWeight: 600 }}>@{user.username}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 20 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{streak}🔥</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Streak</div></div>
          <div style={{ textAlign: "center" }}><ProgressRing pct={todayCard?.completionPct || 0} size={50} stroke={4} /><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Today</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{habits.length}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Habits</div></div>
        </div>
      </div>

      {dailyCards.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📅 Daily Progress</h3>
          {dailyCards.slice(0, 7).map((card) => (
            <div key={card.date} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(card.date)}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{card.completedHabits}/{card.totalHabits} habits</div></div>
              <ProgressRing pct={card.completionPct} size={38} stroke={3} />
            </div>
          ))}
        </div>
      )}

      {publicThoughts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✍️ Thoughts</h3>
          {publicThoughts.map((t) => (
            <div key={t.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{t.text}</p>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{formatDate(t.date)}</div>
            </div>
          ))}
        </div>
      )}

      {quotes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>💎 Quotes</h3>
          {quotes.map((q) => (
            <div key={q.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
              <div style={{ fontStyle: "italic", fontSize: 13, lineHeight: 1.6 }}>"{q.text}"</div>
              {q.author && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>— {q.author}</div>}
            </div>
          ))}
        </div>
      )}

      {mediaLinks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔗 Media</h3>
          {mediaLinks.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", textDecoration: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>🔗 {m.title}</a>
          ))}
        </div>
      )}

      {publicMessages.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>💬 Wall Messages</h3>
          {publicMessages.map((m) => (
            <div key={m.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", borderLeft: `3px solid ${m.type === "motivation" ? "#2ecc71" : m.type === "reminder" ? "#f39c12" : "#3498db"}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>@{m.from} · {m.type}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewOtherProfile({ username, onBack }) {
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [pubThoughts, setPubThoughts] = useState([]);
  const [pubQuotes, setPubQuotes] = useState([]);
  const [pubMedia, setPubMedia] = useState([]);
  const [pubMessages, setPubMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, d, t, q, m, msg] = await Promise.all([
          getUserProfile(username),
          getUserData(username),
          getPublicThoughts(username),
          getQuotes(username),
          getMediaLinks(username),
          getPublicMessagesFor(username),
        ]);
        setProfile(p);
        setData(d);
        setPubThoughts(t);
        setPubQuotes(q);
        setPubMedia(m);
        setPubMessages(msg);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>Loading profile...</div>;
  if (!profile) return <div style={{ textAlign: "center", padding: 60 }}><p style={{ color: "var(--muted)" }}>User not found.</p><Btn onClick={onBack}>← Back</Btn></div>;

  const habits = data?.habits || [];
  const dailyCards = data?.dailyCards || [];
  const streak = getStreak(dailyCards);
  const today = getToday();
  const todayCard = dailyCards.find((c) => c.date === today);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div onClick={onBack} style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 14, marginBottom: 20 }}>← Back to Explore</div>
      <div style={{
        background: "linear-gradient(135deg, rgba(232,167,53,0.15) 0%, rgba(232,167,53,0.03) 100%)",
        borderRadius: 20, padding: "32px 28px", marginBottom: 24, textAlign: "center",
        border: "1px solid rgba(232,167,53,0.15)",
      }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 30, fontWeight: 800, color: "#fff" }}>
          {profile.displayName[0].toUpperCase()}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>{profile.displayName}</h2>
        <div style={{ fontSize: 14, color: "var(--accent)", fontWeight: 600 }}>@{profile.username}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 20 }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{streak}🔥</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Streak</div></div>
          <div style={{ textAlign: "center" }}><ProgressRing pct={todayCard?.completionPct || 0} size={50} stroke={4} /><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Today</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{habits.length}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Habits</div></div>
        </div>
      </div>

      {dailyCards.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📅 Daily Progress</h3>
          {dailyCards.slice(0, 7).map((card) => (
            <div key={card.date} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(card.date)}</div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{card.completedHabits}/{card.totalHabits} habits</div></div>
              <ProgressRing pct={card.completionPct} size={38} stroke={3} />
            </div>
          ))}
        </div>
      )}

      {pubThoughts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✍️ Public Thoughts</h3>
          {pubThoughts.map((t) => (
            <div key={t.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{t.text}</p>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{formatDate(t.date)}</div>
            </div>
          ))}
        </div>
      )}

      {pubQuotes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>💎 Quotes</h3>
          {pubQuotes.map((q) => (
            <div key={q.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
              <div style={{ fontStyle: "italic", fontSize: 13, lineHeight: 1.6 }}>"{q.text}"</div>
              {q.author && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>— {q.author}</div>}
            </div>
          ))}
        </div>
      )}

      {pubMedia.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔗 Media</h3>
          {pubMedia.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", textDecoration: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>🔗 {m.title}</a>
          ))}
        </div>
      )}

      {pubMessages.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>💬 Wall Messages</h3>
          {pubMessages.map((m) => (
            <div key={m.id} style={{ background: "var(--card)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid var(--border)", borderLeft: `3px solid ${m.type === "motivation" ? "#2ecc71" : m.type === "reminder" ? "#f39c12" : "#3498db"}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>@{m.from} · {m.type}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{m.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreProfiles({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState(null);

  useEffect(() => {
    getAllUsers().then((u) => setUsers(u)).catch(() => {});
    setLoading(false);
  }, []);

  if (viewingUser) return <ViewOtherProfile username={viewingUser} onBack={() => setViewingUser(null)} />;

  const others = users.filter((u) => u.username !== currentUser?.username);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 20px", fontFamily: "var(--font-display)" }}>Explore Users</h2>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading...</div> :
      others.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No other users yet</h3>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Invite others to join!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {others.map((u) => (
            <div key={u.username} onClick={() => setViewingUser(u.username)} style={{
              background: "var(--card)", borderRadius: 14, padding: "16px 18px",
              border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              transition: "all 0.2s",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {u.displayName[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.displayName}</div>
                <div style={{ fontSize: 12, color: "var(--accent)" }}>@{u.username}</div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 18 }}>→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== MAIN APP ==============

export default function App() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [dailyCards, setDailyCards] = useState([]);
  const [thoughts, setThoughts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [mediaLinks, setMediaLinks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");

  // Restore session
  useEffect(() => {
    (async () => {
      try {
        const session = localStorage.getItem("hf-session");
        if (session) {
          const { username } = JSON.parse(session);
          const u = await getUserProfile(username);
          if (u) {
            setUser(u);
            await loadAllData(username);
            setPage("app");
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const loadAllData = async (username) => {
    try {
      const [userData, t, q, m, msg] = await Promise.all([
        getUserData(username),
        getThoughts(username),
        getQuotes(username),
        getMediaLinks(username),
        getMessagesForUser(username),
      ]);
      setHabits(userData?.habits || []);
      setDailyCards(userData?.dailyCards || []);
      setThoughts(t);
      setQuotes(q);
      setMediaLinks(m);
      setMessages(msg);
    } catch (e) { console.error(e); }
  };

  const handleAuth = async (u) => {
    setUser(u);
    await loadAllData(u.username);
    setPage("app");
    setActiveNav("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("hf-session");
    setUser(null); setPage("landing");
    setHabits([]); setDailyCards([]); setThoughts([]); setQuotes([]); setMediaLinks([]); setMessages([]);
  };

  const navItems = [
    { id: "dashboard", icon: "🏠", label: "Home" },
    { id: "habits", icon: "🎯", label: "Habits" },
    { id: "daily-card", icon: "📋", label: "Daily" },
    { id: "journal", icon: "✍️", label: "Journal" },
    { id: "messages", icon: "💬", label: "Messages" },
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "explore", icon: "🔍", label: "Explore" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: "pulse 1.5s infinite" }}>◉</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Loading HabitFlow...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {page === "landing" && <LandingPage onGetStarted={() => setPage("auth")} />}
      {page === "auth" && <AuthPage onAuth={handleAuth} />}
      {page === "app" && user && (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside className="desktop-sidebar" style={{
            width: 220, background: "var(--card)", borderRight: "1px solid var(--border)",
            padding: "20px 12px", display: "flex", flexDirection: "column",
            position: "sticky", top: 0, height: "100vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 28 }}>
              <span style={{ fontSize: 22 }}>◉</span>
              <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "var(--font-display)" }}>HabitFlow</span>
            </div>
            <div style={{ flex: 1 }}>
              {navItems.map((item) => (
                <div key={item.id} onClick={() => setActiveNav(item.id)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                  borderRadius: 12, cursor: "pointer", marginBottom: 3,
                  background: activeNav === item.id ? "rgba(232,167,53,0.1)" : "transparent",
                  color: activeNav === item.id ? "var(--accent)" : "var(--muted)",
                  fontWeight: activeNav === item.id ? 700 : 500,
                }}>
                  <span style={{ fontSize: 17, width: 24, textAlign: "center" }}>{item.icon}</span>
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{user.displayName}</div>
              <div style={{ fontSize: 11, color: "var(--accent)" }}>@{user.username}</div>
              <div onClick={handleLogout} style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, cursor: "pointer", padding: "6px 0", borderTop: "1px solid var(--border)" }}>← Log Out</div>
            </div>
          </aside>

          <main style={{ flex: 1, padding: "28px 24px 100px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
            {activeNav === "dashboard" && <Dashboard user={user} habits={habits} dailyCards={dailyCards} thoughts={thoughts} quotes={quotes} onNav={setActiveNav} />}
            {activeNav === "habits" && <HabitsPage habits={habits} setHabits={setHabits} user={user} />}
            {activeNav === "daily-card" && <DailyCardPage habits={habits} dailyCards={dailyCards} setDailyCards={setDailyCards} user={user} />}
            {activeNav === "journal" && <JournalPage user={user} thoughts={thoughts} setThoughts={setThoughts} quotes={quotes} setQuotes={setQuotes} mediaLinks={mediaLinks} setMediaLinks={setMediaLinks} />}
            {activeNav === "messages" && <MessagesPage user={user} messages={messages} setMessages={setMessages} />}
            {activeNav === "profile" && <PublicProfilePage user={user} habits={habits} dailyCards={dailyCards} thoughts={thoughts} quotes={quotes} mediaLinks={mediaLinks} messages={messages} />}
            {activeNav === "explore" && <ExploreProfiles currentUser={user} />}
          </main>

          <nav className="mobile-nav" style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--card)",
            borderTop: "1px solid var(--border)", display: "none", padding: "8px 8px 12px", zIndex: 100,
          }}>
            <div style={{ display: "flex", justifyContent: "space-around", width: "100%" }}>
              {navItems.slice(0, 5).map((item) => (
                <div key={item.id} onClick={() => setActiveNav(item.id)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: "4px 8px",
                  color: activeNav === item.id ? "var(--accent)" : "var(--muted)",
                }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 600 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
