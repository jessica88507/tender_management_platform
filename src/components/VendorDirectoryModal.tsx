"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { useConfirm } from "@/context/ConfirmContext";

export type Vendor = {
  id: string;
  role: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};

const inputClass = "w-full border border-transparent bg-transparent py-1 px-1.5 rounded text-[15.5px] focus:border-border focus:bg-card focus:outline-none";

// Company-wide reusable vendor/consultant directory — see docs/DECISIONS.md. Not tied to any case;
// every member sees and edits the same shared list, same as cases themselves already work in this
// app. TeamPanel's "從資料庫選擇" picker reads from this same /api/vendors endpoint to import an
// entry into a case's own 專業顧問明細 instead of retyping it.
export function VendorDirectoryModal({ onClose }: { onClose: () => void }) {
  const { customConfirm, customAlert } = useConfirm();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((data) => setVendors(data.vendors ?? []))
      .catch(() => setVendors([]));
  };

  useEffect(() => {
    load();
  }, []);

  const addRow = async () => {
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "新增類別" }),
    });
    if (!res.ok) {
      await customAlert("新增失敗，請稍後再試。");
      return;
    }
    load();
  };

  const saveField = async (id: string, patch: Partial<Vendor>) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setVendors((prev) => (prev ? prev.map((v) => (v.id === id ? { ...v, ...patch } : v)) : prev));
    } catch {
      await customAlert("儲存失敗，請稍後再試。");
    } finally {
      setSaving(null);
    }
  };

  const removeRow = async (v: Vendor) => {
    const ok = await customConfirm(`確定要刪除「${v.role}${v.company ? "・" + v.company : ""}」這筆資料嗎？`);
    if (!ok) return;
    const res = await fetch(`/api/vendors/${v.id}`, { method: "DELETE" });
    if (!res.ok) {
      await customAlert("刪除失敗，請稍後再試。");
      return;
    }
    setVendors((prev) => (prev ? prev.filter((x) => x.id !== v.id) : prev));
  };

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-[10px] py-5 px-5.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-w-[900px] w-[90vw] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-[26px]">廠商／顧問資料庫</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink cursor-pointer" title="關閉">
            <X size={20} />
          </button>
        </div>
        <div className="text-[15px] text-ink-soft mb-3.5">
          公司共用的廠商/顧問清單，之後在案件的「專業顧問明細」可以直接從這裡選擇帶入，不用重新輸入。
        </div>

        {vendors === null ? (
          <div className="text-ink-soft text-[17px]">載入中…</div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[720px] border-collapse text-[15.5px]">
              <thead>
                <tr>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">角色/專業</th>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">公司名稱</th>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">負責人</th>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">電話</th>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">Email</th>
                  <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-1.5">備註</th>
                  <th className="border-b-2 border-ink py-1.5 px-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className={saving === v.id ? "opacity-60" : ""}>
                    <td className="font-bold text-ink border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} defaultValue={v.role} onBlur={(e) => e.target.value !== v.role && saveField(v.id, { role: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} placeholder="公司名稱" defaultValue={v.company} onBlur={(e) => e.target.value !== v.company && saveField(v.id, { company: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} placeholder="負責人" defaultValue={v.contact} onBlur={(e) => e.target.value !== v.contact && saveField(v.id, { contact: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} placeholder="電話" defaultValue={v.phone} onBlur={(e) => e.target.value !== v.phone && saveField(v.id, { phone: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} placeholder="Email" defaultValue={v.email} onBlur={(e) => e.target.value !== v.email && saveField(v.id, { email: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <input className={inputClass} placeholder="備註" defaultValue={v.notes} onBlur={(e) => e.target.value !== v.notes && saveField(v.id, { notes: e.target.value })} />
                    </td>
                    <td className="border-b border-dashed border-border py-1 px-1.5">
                      <button title="刪除" onClick={() => removeRow(v)} className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-ink-soft text-[15px] py-3 px-1.5">
                      目前沒有任何資料，點下面「新增」開始建立。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center mt-3.5 shrink-0">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[16px] font-bold cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus weight="bold" size={13} />
            新增
          </button>
          <button
            onClick={onClose}
            className="bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
