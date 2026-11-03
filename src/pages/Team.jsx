import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { createStaffAccount, updateProfile } from "../lib/api.js";
import { errMsg } from "../lib/format.js";
import { ROLE_LABEL } from "../lib/constants.js";

export default function Team() {
  const { user, isDirector } = useAuth();
  const { team, reload } = useData();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newMember, setNewMember] = useState({
    full_name: "", email: "", password: "", role: "forensics_expert",
  });

  function setNewMemberField(field) {
    return (event) => setNewMember((current) => ({ ...current, [field]: event.target.value }));
  }

  async function change(id, patch, okMsg) {
    setBusyId(id);
    try {
      await updateProfile(id, patch);
      toast.show(okMsg);
      await reload();
    } catch (e) {
      toast.show(errMsg(e), true);
    } finally {
      setBusyId(null);
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const account = await createStaffAccount({
        full_name: newMember.full_name.trim(),
        email: newMember.email.trim(),
        password: newMember.password,
        role: newMember.role,
      });
      setNewMember({ full_name: "", email: "", password: "", role: "forensics_expert" });
      toast.show(`Staff account created for ${account.email}`);
      await reload();
    } catch (error) {
      setCreateError(errMsg(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Team</h1>
      <p className="muted">The director creates staff accounts, assigns access, and can deactivate accounts.</p>
      {isDirector && (
        <form className="team-create" onSubmit={createAccount}>
          <h2>Create staff account</h2>
          <p className="muted">Staff sign in with their email and the password you set. Share passwords privately.</p>
          <div className="team-create-grid">
            <label>
              Full name
              <input className="input" value={newMember.full_name} onChange={setNewMemberField("full_name")}
                     autoComplete="name" maxLength={120} required />
            </label>
            <label>
              Login email
              <input className="input" type="email" value={newMember.email} onChange={setNewMemberField("email")}
                     autoComplete="email" maxLength={254} required />
            </label>
            <label>
              Initial password
              <input className="input" type="password" value={newMember.password}
                     onChange={setNewMemberField("password")} autoComplete="new-password"
                     minLength={6} maxLength={128} required />
              <span className="muted">Use at least 6 characters.</span>
            </label>
            <label>
              Access level
              <select className="input" value={newMember.role} onChange={setNewMemberField("role")}>
                <option value="forensics_expert">Forensics Expert - assigned appointments only</option>
                <option value="assistant_director">Assistant Director - all appointments and finance</option>
              </select>
            </label>
          </div>
          {createError && <div className="form-err show" role="alert">{createError}</div>}
          <button className="btn primary" type="submit" disabled={creating}>
            {creating ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}
      <div className="team-grid">
        {team.map((t) => {
          const initials = t.full_name.split(/\s+/).filter(Boolean).slice(0, 2)
            .map((w) => w[0]).join("").toUpperCase() || "?";
          const me = t.id === user.id;
          return (
            <div className="member" key={t.id}>
              <div className="avatar">{initials}</div>
              <div className="mname">{t.full_name}{me && <span className="you">YOU</span>}</div>
              <div className="mrole">{ROLE_LABEL[t.role] || t.role}{!t.active && <b> · inactive</b>}</div>
              <div className="actions">
                {isDirector && !me ? (
                  <>
                    <select className="input small-input" value={t.role} disabled={busyId === t.id}
                            onChange={(e) => change(t.id, { role: e.target.value }, "Role updated")}>
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className={"btn small " + (t.active ? "danger" : "")} disabled={busyId === t.id}
                            onClick={() => change(t.id, { active: !t.active },
                              t.active ? "Account deactivated" : "Account activated")}>
                      {t.active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                ) : (
                  <span className="muted">{t.active ? "Active" : "Deactivated"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
