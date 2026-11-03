import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login({ initialError }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setErr("Sign-in failed. Check your email and password.");
    } catch {
      setErr("Sign-in failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // Only ever display text, never an error object
  const shown =
    (typeof err === "string" && err) ||
    (typeof initialError === "string" && initialError) ||
    "";

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">CyberCase</div>
        <div className="login-sub">Appointments desk · Cyber Crime Helpline LLP</div>
        <label><span>Email</span>
          <input type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label><span>Password</span>
          <input type="password" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {shown && <div className="form-err show">{shown}</div>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-note">Access is by invitation only. Contact the director to get an account.</p>
      </form>
    </div>
  );
}