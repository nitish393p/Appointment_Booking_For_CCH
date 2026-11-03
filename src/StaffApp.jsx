import "./styles.css";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { DialogProvider } from "./context/DialogContext.jsx";
import Login from "./pages/Login.jsx";
import Shell from "./components/Shell.jsx";
import { configured } from "./lib/supabase.js";

function Gate() {
  const { loading, user, error } = useAuth();
  if (!configured) {
    return (
      <div className="page-msg">
        <h2>Setup needed</h2>
        <p>Copy .env.example to .env.local, add your Supabase URL and anon key, then restart the app.</p>
      </div>
    );
  }
  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <Login initialError={error} />;
  return (
    <DataProvider>
      <DialogProvider>
        <Shell />
      </DialogProvider>
    </DataProvider>
  );
}

export default function StaffApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}
