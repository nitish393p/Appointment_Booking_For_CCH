import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchAll } from "../lib/api.js";
import { errMsg } from "../lib/format.js";

const DataCtx = createContext(null);

// Loads the shared data once and refreshes it every minute,
// so the whole team sees each other's changes without reloading the page.
export function DataProvider({ children }) {
  const [state, setState] = useState({
    appts: [], fees: {}, payments: [], team: [], activity: [], holidays: [],
  });
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(async () => {
    try {
      const d = await fetchAll();
      const fees = {};
      d.fees.forEach((f) => { fees[f.appointment_id] = Number(f.fee); });
      setState({
        appts: d.appts, fees, payments: d.payments, team: d.team,
        activity: d.activity, holidays: d.holidays,
      });
      setLoadError("");
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, [reload]);

  const value = useMemo(() => {
    const paidFor = (id) => state.payments
      .filter((p) => p.appointment_id === id)
      .reduce((s, p) => s + Number(p.amount), 0);
    const feeFor = (id) => state.fees[id] ?? 0;
    const balFor = (id) => Math.max(feeFor(id) - paidFor(id), 0);
    const teamName = (id) => state.team.find((t) => t.id === id)?.full_name || "Unassigned";
    const byId = (id) => state.appts.find((a) => a.id === id);
    return { ...state, loadError, reload, paidFor, feeFor, balFor, teamName, byId };
  }, [state, loadError, reload]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);
