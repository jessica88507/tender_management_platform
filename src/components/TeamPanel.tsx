"use client";

import { useState } from "react";
import { Case, Consultant, TeamGroup } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { uid } from "@/lib/date";

const TEAM_LABELS: Record<Exclude<TeamGroup, null>, string> = {
  architect: "🏛️ 建築師團隊",
  jianguo: "🏗️ 建國工程團隊",
};

function OrgBranch({ title, names, consultants }: { title: string; names: string[]; consultants: Consultant[] }) {
  const empty = names.length === 0 && consultants.length === 0;
  return (
    <div className="org-branch">
      <div className="org-branch-head">{title}</div>
      <div className="org-branch-body">
        {names.map((n) => (
          <div className="org-card" key={n}>
            <div className="org-name">{n}</div>
          </div>
        ))}
        {consultants.map((row) => (
          <div className="org-card" key={row.id}>
            <div className="org-role">{row.role}</div>
            <div className="org-name">{row.contact || row.company || "—"}</div>
          </div>
        ))}
        {empty && <div className="org-empty">尚無成員</div>}
      </div>
    </div>
  );
}

function TeamBox({
  group,
  simpleKey,
  simpleLabel,
  c,
  caseId,
  onDropConsultant,
}: {
  group: Exclude<TeamGroup, null>;
  simpleKey: "architect" | "mep";
  simpleLabel: string;
  c: Case;
  caseId: string;
  onDropConsultant: (id: string, group: TeamGroup) => void;
}) {
  const { updateCase } = useApp();
  const [isOver, setIsOver] = useState(false);
  const names = c.team[simpleKey];
  const assigned = c.team.consultants.filter((x) => x.team === group);

  const setName = (idx: number, value: string) => {
    updateCase(caseId, (draft) => {
      draft.team[simpleKey][idx] = value;
    });
  };
  const addName = () => {
    updateCase(caseId, (draft) => {
      draft.team[simpleKey].push("");
    });
  };
  const removeName = (idx: number) => {
    updateCase(caseId, (draft) => {
      draft.team[simpleKey].splice(idx, 1);
    });
  };

  return (
    <div
      className={"team-box" + (isOver ? " drag-over" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropConsultant(id, group);
      }}
    >
      <div className="team-box-title">{TEAM_LABELS[group]}</div>
      <div className="team-simple-list">
        {names.map((name, idx) => (
          <div className="team-simple-row" key={idx}>
            <input type="text" placeholder="姓名" value={name} onChange={(e) => setName(idx, e.target.value)} />
            <button title="刪除" onClick={() => removeName(idx)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="btn-mini" onClick={addName}>
        ＋ 新增{simpleLabel}
      </button>

      <div className="team-box-consultants">
        {assigned.map((row) => (
          <div
            className="consultant-chip"
            key={row.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", row.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <span className="cchip-role">{row.role}</span>
            <span className="cchip-name">{row.contact || row.company || "未填"}</span>
            <button title="移出" onClick={() => onDropConsultant(row.id, null)}>
              ×
            </button>
          </div>
        ))}
        {assigned.length === 0 && <div className="team-box-empty">拖曳下方顧問到此分類</div>}
      </div>
    </div>
  );
}

export function TeamPanel({ caseId, c }: { caseId: string; c: Case }) {
  const { ui, setTeamOpen, setTeamEditing, updateCase } = useApp();
  const [poolOver, setPoolOver] = useState(false);

  const setConsultantField = (idx: number, field: "role" | "company" | "contact" | "affiliation", value: string) => {
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
      draft.team.consultants.push({
        id: uid(),
        role: "新增顧問類別",
        company: "",
        contact: "",
        affiliation: "",
        custom: true,
        team: null,
      });
    });
  };
  const assignConsultantTeam = (consultantId: string, group: TeamGroup) => {
    updateCase(caseId, (draft) => {
      const row = draft.team.consultants.find((x) => x.id === consultantId);
      if (row) row.team = group;
    });
  };

  const unassigned = c.team.consultants.filter((x) => !x.team);

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
          <div className="org-tree">
            <div className="org-root">備標團隊</div>
            <div className="org-branches">
              <OrgBranch
                title={TEAM_LABELS.architect}
                names={c.team.architect.filter(Boolean)}
                consultants={c.team.consultants.filter((x) => x.team === "architect")}
              />
              <OrgBranch
                title={TEAM_LABELS.jianguo}
                names={c.team.mep.filter(Boolean)}
                consultants={c.team.consultants.filter((x) => x.team === "jianguo")}
              />
              {unassigned.length > 0 && <OrgBranch title="未分類顧問" names={[]} consultants={unassigned} />}
            </div>
          </div>
        )}

        {ui.teamEditing && (
          <>
            <div className="team-boxes">
              <TeamBox
                group="architect"
                simpleKey="architect"
                simpleLabel="建築師"
                c={c}
                caseId={caseId}
                onDropConsultant={assignConsultantTeam}
              />
              <TeamBox
                group="jianguo"
                simpleKey="mep"
                simpleLabel="機電團隊"
                c={c}
                caseId={caseId}
                onDropConsultant={assignConsultantTeam}
              />
            </div>

            <div
              className={"team-pool" + (poolOver ? " drag-over" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setPoolOver(true);
              }}
              onDragLeave={() => setPoolOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPoolOver(false);
                const id = e.dataTransfer.getData("text/plain");
                if (id) assignConsultantTeam(id, null);
              }}
            >
              <div className="team-pool-title">未分類顧問（可拖曳到上方任一團隊框框內做分類）</div>
              <div className="team-pool-chips">
                {unassigned.map((row) => (
                  <div
                    className="consultant-chip"
                    key={row.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", row.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span className="cchip-role">{row.role}</span>
                    <span className="cchip-name">{row.contact || row.company || "未填"}</span>
                  </div>
                ))}
                {unassigned.length === 0 && <div className="team-box-empty">目前沒有未分類的顧問</div>}
              </div>
            </div>

            <div className="team-group">
              <h4>專業顧問明細</h4>
              <table className="cons-table">
                <thead>
                  <tr>
                    <th>專業顧問</th>
                    <th>顧問工程</th>
                    <th>負責人</th>
                    <th>所屬</th>
                    <th>分類</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {c.team.consultants.map((row, idx) => (
                    <tr key={row.id}>
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
                        <span className="team-tag">{row.team ? TEAM_LABELS[row.team] : "未分類"}</span>
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
