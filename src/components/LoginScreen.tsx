"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { SignIn, Warning } from "@phosphor-icons/react";

const inputClass =
  "w-full py-2.5 px-3 border border-border rounded-md text-[17.5px] bg-card focus:outline-none focus:border-accent";
const labelClass = "block text-[14.5px] text-ink-soft mb-1 font-mono tracking-wide text-left";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("帳號或密碼錯誤，或該帳號不屬於業務部。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-[420px] bg-card border border-border rounded-[10px] py-10 px-9 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto mb-6 w-[130px] h-[130px] rounded-full border-4 border-double border-primary flex flex-col items-center justify-center -rotate-6 font-serif text-primary bg-primary/5">
          <div className="text-[13px] tracking-[0.2em] font-bold">備標</div>
          <div className="font-mono text-[31px] font-bold leading-none my-0.5">控台</div>
        </div>

        <h1 className="font-serif font-black text-[31px] text-ink mb-1.5">備標控台</h1>
        <p className="font-mono text-[14.5px] text-ink-soft tracking-[0.2em] mb-6">BID PREP CONTROL</p>

        <p className="text-[17px] text-ink-soft leading-relaxed mb-6">
          僅開放業務部人員登入。
          <br />
          登入後僅能編輯自己開立的案件，其他案件為唯讀檢視。
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <label className={labelClass} htmlFor="login-email">
            帳號（Email）
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@company.com"
          />

          <label className={labelClass + " mt-3.5"} htmlFor="login-password">
            密碼
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />

          {error && (
            <div className="flex items-center gap-1.5 text-[16px] text-danger mt-3">
              <Warning weight="fill" size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white border-none py-3.5 px-6 rounded-lg font-bold text-[19.5px] cursor-pointer hover:bg-primary-dark transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:opacity-60 disabled:cursor-not-allowed mt-5"
          >
            <SignIn weight="bold" size={19} />
            {loading ? "登入中…" : "登入"}
          </button>
        </form>

        <p className="text-[14.5px] text-ink-soft mt-5 font-mono">
          （目前使用帳號密碼登入；正式上線前會換成公司 Microsoft Entra ID 登入）
        </p>
      </div>
    </div>
  );
}
