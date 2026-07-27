"use client";

import { useEffect, useState } from "react";
import { Check, PencilSimple, Plus, Trash, UserCircle, X } from "@phosphor-icons/react";
import { useConfirm } from "@/context/ConfirmContext";

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
  role: "member" | "admin";
  createdAt: string;
};

const inputClass =
  "border border-border rounded-md py-2 px-2.5 text-[17.5px] bg-card text-ink focus:outline-none focus:border-accent";
const cellInputClass =
  "w-full border border-border rounded py-1 px-1.5 text-[17px] bg-card text-ink focus:outline-none focus:border-accent";

function EditRow({
  member,
  onDone,
}: {
  member: Member;
  onDone: (updated?: Member) => void;
}) {
  const { customAlert } = useConfirm();
  const [name, setName] = useState(member.name || "");
  const [email, setEmail] = useState(member.email || "");
  const [department, setDepartment] = useState(member.department || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, department, ...(password ? { password } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        await customAlert(data.error || "更新失敗");
        return;
      }
      onDone(data.user);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-highlight-soft/40">
      <td className="border-b border-dashed border-border py-2 px-2">
        <input className={cellInputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" />
      </td>
      <td className="border-b border-dashed border-border py-2 px-2">
        <input
          className={cellInputClass + " font-mono"}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="電子郵件"
        />
      </td>
      <td className="border-b border-dashed border-border py-2 px-2">
        <input className={cellInputClass} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="部門" />
      </td>
      <td className="border-b border-dashed border-border py-2 px-2">
        <input
          className={cellInputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="新密碼（留空不變更）"
        />
      </td>
      <td className="border-b border-dashed border-border py-2 px-2 whitespace-nowrap">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !email.trim()}
          title="儲存"
          className="text-accent hover:bg-accent/10 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary p-1 disabled:opacity-50"
        >
          <Check weight="bold" size={16} />
        </button>
        <button
          onClick={() => onDone()}
          title="取消"
          className="text-ink-soft hover:bg-muted cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary p-1"
        >
          <X weight="bold" size={16} />
        </button>
      </td>
    </tr>
  );
}

export function MembersPanel() {
  const { customConfirm, customAlert } = useConfirm();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("業務部");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setMembers(data.users ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, department }),
      });
      const data = await res.json();
      if (!res.ok) {
        await customAlert(data.error || "新增成員失敗");
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("業務部");
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m: Member) => {
    const ok = await customConfirm(`確定要刪除成員「${m.name || m.email}」嗎？此動作無法復原。`);
    if (!ok) return;
    const res = await fetch(`/api/users/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      await customAlert(data.error || "刪除失敗");
      return;
    }
    load();
  };

  return (
    <div>
      <h2 className="font-serif text-[31px] font-bold mb-5">系統成員</h2>

      <div className="bg-card border border-border rounded-lg p-5 mb-7 max-w-[640px]">
        <div className="font-mono text-[14.5px] font-bold text-accent tracking-[0.2em] mb-3 uppercase">新增成員</div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            className={inputClass}
            placeholder="部門"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
          <input
            className={inputClass}
            type="email"
            placeholder="電子郵件"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="password"
            placeholder="密碼（至少 6 碼）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="col-span-2 flex items-center justify-center gap-1.5 bg-ink text-card border-none py-2.5 px-4 rounded-md text-[17.5px] font-bold cursor-pointer hover:bg-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus weight="bold" size={15} />
            新增成員
          </button>
        </form>
      </div>

      <div className="font-mono text-[14.5px] font-bold text-accent tracking-[0.2em] mb-2.5 uppercase">成員列表</div>
      {members === null ? (
        <div className="text-ink-soft text-[18px]">載入中…</div>
      ) : members.length === 0 ? (
        <div className="text-ink-soft text-[18px]">目前沒有任何成員。</div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[17px]">
          <thead>
            <tr>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">姓名</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">電子郵件</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">部門</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">角色</th>
              <th className="border-b-2 border-ink py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) =>
              editingId === m.id ? (
                <EditRow
                  key={m.id}
                  member={m}
                  onDone={(updated) => {
                    if (updated) setMembers((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);
                    setEditingId(null);
                  }}
                />
              ) : (
              <tr key={m.id}>
                <td className="border-b border-dashed border-border py-2 px-2 flex items-center gap-1.5">
                  <UserCircle weight="fill" size={16} className="text-steel" />
                  {m.name || "—"}
                </td>
                <td className="border-b border-dashed border-border py-2 px-2 font-mono">{m.email}</td>
                <td className="border-b border-dashed border-border py-2 px-2">{m.department || "—"}</td>
                <td className="border-b border-dashed border-border py-2 px-2">
                  {m.role === "admin" ? (
                    <span className="font-mono text-[14.5px] font-bold text-primary">管理員</span>
                  ) : (
                    <span className="font-mono text-[14.5px] text-ink-soft">一般成員</span>
                  )}
                </td>
                <td className="border-b border-dashed border-border py-2 px-2 whitespace-nowrap">
                  <button
                    onClick={() => setEditingId(m.id)}
                    title="編輯"
                    className="text-accent hover:bg-accent/10 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary p-1"
                  >
                    <PencilSimple weight="bold" size={15} />
                  </button>
                  {m.role !== "admin" && (
                    <button
                      onClick={() => handleDelete(m)}
                      title="刪除"
                      className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger p-1"
                    >
                      <Trash size={15} />
                    </button>
                  )}
                </td>
              </tr>
              )
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
