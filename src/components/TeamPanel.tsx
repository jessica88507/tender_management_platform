"use client";

import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";

export function TeamPanel({ caseId, c }: { caseId: string; c: Case }) {
  const { ui, setTeamOpen, setTeamEditing, updateCase } = useApp();

  const setArchitectMep = (key: "architect" | "mep", idx: number, value: string) => {
    updateCase(caseId, (draft) => {
      draft.team[key][idx] = value;
    });
  };
  const addArchitectMep = (key: "architect" | "mep") => {
    updateCase(caseId, (draft) => {
      draft.team[key].push("");
    });
  };
  const removeArchitectMep = (key: "architect" | "mep", idx: number) => {
    updateCase(caseId, (draft) => {
      draft.team[key].splice(idx, 1);
    });
  };

  const setConsultantField = (
    idx: number,
    field: "role" | "company" | "contact" | "affiliation",
    value: string
  ) => {
    updateCase(caseId, (draft) => {
      draft.team.consultants[idx][field] = value;
    });
  };
  const removeConsultant = (idx: number) => {
    updateCase(caseId, (draft) => {
      draft.team.consultants.splice(idx, 1);
    });
  };
  const addConsultant = () => {
    updateCase(caseId, (draft) => {
      draft.team.consultants.push({ role: "新增顧問類別", company: "", contact: "", affiliation: "", custom: true });
    });
  };

  const cards: { role: string; name: string }[] = [
    { role: "🏛️ 建築師", name: c.team.architect.filter(Boolean).join("、") || "—" },
    { role: "⚡ 機電團隊", name: c.team.mep.filter(Boolean).join("、") || "—" },
    ...c.team.consultants.map((row) => ({ role: row.role, name: row.contact || row.company || "—" })),
  ];

  return (
    <details
      className="panel"
      open={ui.teamOpen}
      onToggle={(e) => setTeamOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>👥 備標團隊成員</summary>
      <div className="panel-body">
        <div className="panel-toolbar">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTeamEditing(!ui.teamEditing);
            }}
          >
            {ui.teamEditing ? "✓ 完成編輯" : "✎ 編輯團隊"}
          </button>
        </div>

        {!ui.teamEditing && (
          <div className="org-chart">
            {cards.map((cd, i) => (
              <div className="org-card" key={i}>
                <div className="org-role">{cd.role}</div>
                <div className="org-name">{cd.name}</div>
              </div>
            ))}
          </div>
        )}

        {ui.teamEditing && (
          <>
            {([
              ["architect", "建築師"],
              ["mep", "機電團隊"],
            ] as const).map(([key, label]) => (
              <div className="team-group" key={key}>
                <h4>
                  {label}（{c.team[key].length}）
                </h4>
                <div className="team-simple-list">
                  {c.team[key].map((name, idx) => (
                    <div className="team-simple-row" key={idx}>
                      <input
                        type="text"
                        placeholder="姓名"
                        value={name}
                        onChange={(e) => setArchitectMep(key, idx, e.target.value)}
                      />
                      <button title="刪除" onClick={() => removeArchitectMep(key, idx)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-mini" onClick={() => addArchitectMep(key)}>
                  ＋ 新增{label}
                </button>
              </div>
            ))}

            <div className="team-group">
              <h4>專業顧問</h4>
              <table className="cons-table">
                <thead>
                  <tr>
                    <th>專業顧問</th>
                    <th>顧問工程</th>
                    <th>負責人</th>
                    <th>所屬</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {c.team.consultants.map((row, idx) => (
                    <tr key={idx}>
                      <td className="role-cell">
                        {row.custom ? (
                          <input
                            type="text"
                            value={row.role}
                            onChange={(e) => setConsultantField(idx, "role", e.target.value)}
                          />
                        ) : (
                          row.role
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="顧問工程公司名稱"
                          value={row.company}
                          onChange={(e) => setConsultantField(idx, "company", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="負責人"
                          value={row.contact}
                          onChange={(e) => setConsultantField(idx, "contact", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="所屬"
                          value={row.affiliation}
                          onChange={(e) => setConsultantField(idx, "affiliation", e.target.value)}
                        />
                      </td>
                      <td>
                        {row.custom && (
                          <button className="task-del" title="刪除" onClick={() => removeConsultant(idx)}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-mini" onClick={addConsultant}>
                ＋ 新增其他顧問類別
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
