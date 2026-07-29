"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { SignIn, Warning } from "@phosphor-icons/react";

// Light-mode palette mirrors the app's own light `--color-*` variables (globals.css) — same hex
// values, just hardcoded rather than wired through `data-theme`, since this screen renders before
// any session (and therefore any saved theme preference) is known, and per the user's decision the
// app's own default is always light anyway.
const inputClass =
  "w-full py-2.5 px-3 border border-[#cbd8e6] rounded text-[17.5px] bg-white text-[#0a1420] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0284c7] focus:shadow-[0_0_0_3px_rgba(2,132,199,0.15)] transition-shadow font-mono";
const labelClass = "block text-[13.5px] text-[#46586e] mb-1.5 font-mono tracking-[0.15em] text-left uppercase";

function CornerBracket({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M2 10V4a2 2 0 0 1 2-2h6" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("帳號或密碼錯誤，或該帳號不屬於業務部。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] px-6 relative overflow-hidden">
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(2,132,199,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(2,132,199,0.10) 1px, transparent 1px), linear-gradient(rgba(2,132,199,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(2,132,199,0.18) 1px, transparent 1px)",
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
        }}
      />
      {/* Soft radial glow behind the card */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 700px 500px at 50% 45%, rgba(2,132,199,0.10), transparent 70%)",
        }}
      />
      {/* Scanning sweep line */}
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#0284c7]/50 to-transparent animate-[loginScan_5s_linear_infinite]" />

      <div className="relative w-full max-w-[440px]">
        {/* Corner brackets framing the whole card, like a technical drawing / HUD reticle */}
        <CornerBracket className="absolute -top-2.5 -left-2.5 w-6 h-6" />
        <CornerBracket className="absolute -top-2.5 -right-2.5 w-6 h-6 rotate-90" />
        <CornerBracket className="absolute -bottom-2.5 -left-2.5 w-6 h-6 -rotate-90" />
        <CornerBracket className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rotate-180" />

        <div className="bg-white/95 border border-[#cbd8e6] rounded-lg py-10 px-9 text-center shadow-[0_0_40px_rgba(2,132,199,0.10),0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          {/* Badge: compass/gauge motif instead of the app's chop-stamp circle */}
          <div className="mx-auto mb-6 w-[110px] h-[110px] rounded-full border-2 border-[#0284c7] flex flex-col items-center justify-center relative">
            <div className="absolute inset-[6px] rounded-full border border-[#cbd8e6] border-dashed" />
            {[0, 90, 180, 270].map((deg) => (
              <span
                key={deg}
                className="absolute w-[2px] h-2 bg-[#0284c7]"
                style={{ transform: `rotate(${deg}deg) translateY(-50px)` }}
              />
            ))}
            <div className="font-mono text-[11px] tracking-[0.3em] text-[#46586e]">BIG</div>
            <div className="font-mono text-[24px] font-bold leading-none my-0.5 text-[#0284c7]">投標</div>
            <div className="font-mono text-[11px] tracking-[0.3em] text-[#46586e]">MASTER</div>
          </div>

          <h1 className="font-mono font-bold text-[26px] text-[#0a1420] mb-1.5 tracking-wide">業務投標管理平台</h1>
          <p className="font-mono text-[13.5px] text-[#0284c7] tracking-[0.3em] mb-6">BIGMASTER</p>

          <p className="text-[16px] text-[#46586e] leading-relaxed mb-7">僅開放業務部人員登入。</p>

          <form onSubmit={handleSubmit} className="text-left">
            <label className={labelClass} htmlFor="login-username">
              帳號
            </label>
            <input
              id="login-username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="請輸入帳號"
            />

            <label className={labelClass + " mt-4"} htmlFor="login-password">
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
              <div className="flex items-center gap-1.5 text-[15.5px] text-[#dc2626] mt-3 font-mono">
                <Warning weight="fill" size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0284c7] text-white border-none py-3.5 px-6 rounded font-mono font-bold text-[18px] tracking-[0.1em] cursor-pointer hover:bg-[#0369a1] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-[0_0_20px_rgba(2,132,199,0.25)]"
            >
              <SignIn weight="bold" size={18} />
              {loading ? "登入中…" : "登入系統"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
