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
          className="fixed inset-0 bg-ink/45 flex items-center justify-center z-[999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="bg-paper-light border border-line-grey rounded-[10px] py-5 px-5.5 max-w-[380px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <div className="text-[13px] leading-relaxed text-ink mb-4">
              {pending.message.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </div>
            <div className="flex justify-end gap-2.5">
              {pending.mode === "confirm" && (
                <button
                  onClick={() => close(false)}
                  className="bg-transparent border-[1.5px] border-tab-brown text-tab-brown py-2 px-3.5 rounded-md text-[13px] font-bold cursor-pointer hover:bg-tab-brown/10"
                >
                  取消
                </button>
              )}
              <button
                onClick={() => close(true)}
                className="bg-chop-red text-white border-none py-3 px-5.5 rounded-lg font-bold cursor-pointer text-[15px] hover:bg-chop-red-dark"
              >
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
