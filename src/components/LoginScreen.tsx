"use client";

import { SignIn } from "@phosphor-icons/react";

export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-[420px] bg-paper-light border border-line-grey rounded-[10px] py-10 px-9 text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto mb-6 w-[100px] h-[100px] rounded-full border-4 border-double border-chop-red flex flex-col items-center justify-center -rotate-6 font-serif text-chop-red bg-[radial-gradient(circle,rgba(174,54,43,0.05),transparent_70%)]">
          <div className="text-[10px] tracking-[0.2em] font-bold">備標</div>
          <div className="font-mono text-2xl font-bold leading-none my-0.5">控台</div>
        </div>

        <h1 className="font-serif font-black text-2xl text-ink mb-1.5">備標控台</h1>
        <p className="font-mono text-[11px] text-ink-soft tracking-[0.2em] mb-6">BID PREP CONTROL</p>

        <p className="text-[13px] text-ink-soft leading-relaxed mb-7">
          僅開放業務部使用公司 Microsoft 帳號登入。
          <br />
          登入後僅能編輯自己開立的案件，其他案件為唯讀檢視。
        </p>

        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 bg-chop-red text-white border-none py-3.5 px-6 rounded-lg font-bold text-[15px] cursor-pointer hover:bg-chop-red-dark transition-colors"
        >
          <SignIn weight="bold" size={19} />
          使用 Microsoft 帳號登入
        </button>

        <p className="text-[11px] text-ink-soft mt-5 font-mono">
          （登入串接建置中：目前點擊按鈕會直接進入系統，正式上線前會換成真正的 Microsoft Entra ID 登入）
        </p>
      </div>
    </div>
  );
}
