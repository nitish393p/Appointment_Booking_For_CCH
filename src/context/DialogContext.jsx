import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Dialogs from "../components/Dialogs.jsx";

const DialogCtx = createContext(null);

// Only one dialog is open at a time. Each dialog is described by { type, id }.
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const close = useCallback(() => setDialog(null), []);
  const openDialog = useCallback((d) => setDialog(d), []);
  const value = useMemo(() => ({ openDialog, close }), [openDialog, close]);

  return (
    <DialogCtx.Provider value={value}>
      {children}
      {dialog && <Dialogs dialog={dialog} onClose={close} openDialog={openDialog} />}
    </DialogCtx.Provider>
  );
}

export const useDialog = () => useContext(DialogCtx);
