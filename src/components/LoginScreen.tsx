"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { SignIn, Warning } from "@phosphor-icons/react";

const inputClass =
  "w-full py-2.5 px-3 border border-[#2a4a5c] rounded text-[17.5px] bg-[#0a1620] text-[#d6f3ff] placeholder:text-[#4a7688] focus:outline-none focus:border-[#38bdf8] focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] transition-shadow font-mono";
const labelClass = "block text-[13.5px] text-[#7fb8cc] mb-1.5 font-mono tracking-[0.15em] text-left uppercase";

function CornerBracket({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M2 10V4a2 2 0 0 1 2-2h6" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
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
    <div className="min-h-screen flex items-center justify-center bg-[#050b12] px-6 relative overflow-hidden">
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.14) 1px, transparent 1px), linear-gradient(rgba(56,189,248,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.28) 1px, transparent 1px)",
          backgroundSize: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
        }}
      />
      {/* Soft radial glow behind the card */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 700px 500px at 50% 45%, rgba(56,189,248,0.16), transparent 70%)",
        }}
      />
      {/* Scanning sweep line */}
      <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#38bdf8]/70 to-transparent animate-[loginScan_5s_linear_infinite]" />

      <div className="relative w-full max-w-[440px]">
        {/* Corner brackets framing the whole card, like a technical drawing / HUD reticle */}
        <CornerBracket className="absolute -top-2.5 -left-2.5 w-6 h-6" />
        <CornerBracket className="absolute -top-2.5 -right-2.5 w-6 h-6 rotate-90" />
        <CornerBracket className="absolute -bottom-2.5 -left-2.5 w-6 h-6 -rotate-90" />
        <CornerBracket className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rotate-180" />

        <div className="bg-[#0d1a24]/95 border border-[#1e3a4a] rounded-lg py-10 px-9 text-center shadow-[0_0_40px_rgba(56,189,248,0.12),0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-sm">
          {/* Badge: compass/gauge motif instead of the app's chop-stamp circle */}
          <div className="mx-auto mb-6 w-[110px] h-[110px] rounded-full border-2 border-[#38bdf8] flex flex-col items-center justify-center relative">
            <div className="absolute inset-[6px] rounded-full border border-[#2a5a6c] border-dashed" />
            {[0, 90, 180, 270].map((deg) => (
              <span
                key={deg}
                className="absolute w-[2px] h-2 bg-[#38bdf8]"
                style={{ transform: `rotate(${deg}deg) translateY(-50px)` }}
              />
            ))}
            <div className="font-mono text-[11px] tracking-[0.3em] text-[#7fb8cc]">BIG</div>
            <div className="font-mono text-[24px] font-bold leading-none my-0.5 text-[#38bdf8]">投標</div>
            <div className="font-mono text-[11px] tracking-[0.3em] text-[#7fb8cc]">MASTER</div>
          </div>

          <h1 className="font-mono font-bold text-[26px] text-[#e8f9ff] mb-1.5 tracking-wide">業務投標管理平台</h1>
          <p className="font-mono text-[13.5px] text-[#38bdf8] tracking-[0.3em] mb-6">BIGMASTER</p>

          <p className="text-[16px] text-[#9cc7d8] leading-relaxed mb-7">僅開放業務部人員登入。</p>

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
              <div className="flex items-center gap-1.5 text-[15.5px] text-[#ff8080] mt-3 font-mono">
                <Warning weight="fill" size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#38bdf8] text-[#04141c] border-none py-3.5 px-6 rounded font-mono font-bold text-[18px] tracking-[0.1em] cursor-pointer hover:bg-[#67d3ff] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38bdf8] disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
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
