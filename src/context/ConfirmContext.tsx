"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type PendingConfirm = {
  message: string;
  mode: "confirm" | "alert";
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  customConfirm: (message: string) => Promise<boolean>;
  customAlert: (message: string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const open = useCallback((message: string, mode: "confirm" | "alert") => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ message, mode, resolve });
    });
  }, []);

  const customConfirm = useCallback((message: string) => open(message, "confirm"), [open]);
  const customAlert = useCallback(
    (message: string) => open(message, "alert").then(() => undefined),
    [open]
  );

  const close = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ customConfirm, customAlert }}>
      {children}
      {pending && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-msg">
              {pending.message.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
            <div className="modal-actions">
              {pending.mode === "confirm" && (
                <button className="btn-mini" onClick={() => close(false)}>
                  取消
                </button>
              )}
              <button className="btn-primary" onClick={() => close(true)}>
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
