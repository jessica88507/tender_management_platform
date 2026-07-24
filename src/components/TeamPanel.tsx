"use client";

import { useState } from "react";
import { Bank, CaretRight, Check, HardHat, PencilSimple, Plus, UsersThree, X } from "@phosphor-icons/react";
import { Case, Consultant, TeamGroup } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { uid } from "@/lib/date";

const TEAM_LABELS: Record<Exclude<TeamGroup, null>, string> = {
  architect: "建築師團隊",
  jianguo: "建國工程團隊",
};
const TEAM_ICONS: Record<Exclude<TeamGroup, null>, typeof Bank> = {
  architect: Bank,
  jianguo: HardHat,
};

const btnMiniClass =
  "inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-tab-brown text-tab-brown py-2 px-3.5 rounded-md text-[13px] font-bold cursor-pointer hover:bg-tab-brown/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red";

function OrgBranch({
  title,
  icon: Icon,
  names,
  consultants,
}: {
  title: string;
  icon?: typeof Bank;
  names: string[];
  consultants: Consultant[];
}) {
  const empty = names.length === 0 && consultants.length === 0;
  return (
    <div className="relative flex-1 min-w-[220px] pt-3.5 before:content-[''] before:absolute before:-top-3.5 before:left-1/2 before:w-0.5 before:h-3.5 before:bg-line-grey">
      <div className="font-bold font-serif text-[13.5px] text-ink bg-paper-light border-[1.5px] border-tab-brown rounded-md py-1.5 px-3 text-center mb-2 flex items-center justify-center gap-1.5">
        {Icon && <Icon weight="fill" size={15} className="text-tab-brown" />}
        {title}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {names.map((n) => (
          <div className="bg-white border border-line-grey rounded-lg py-2 px-3.5 min-w-[104px] text-center" key={n}>
            <div className="text-[13px] text-ink font-mono">{n}</div>
          </div>
        ))}
        {consultants.map((row) => (
          <div className="bg-white border border-line-grey rounded-lg py-2 px-3.5 min-w-[104px] text-center" key={row.id}>
            <div className="text-[11px] text-ink-soft font-bold whitespace-nowrap">{row.role}</div>
            <div className="text-[13px] text-ink font-mono mt-0.5">{row.contact || row.company || "—"}</div>
          </div>
        ))}
        {empty && <div className="text-ink-soft text-[11px]">尚無成員</div>}
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
  const Icon = TEAM_ICONS[group];

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
      className={
        "flex-1 min-w-[260px] rounded-[10px] border-[1.5px] border-dashed p-3 bg-white transition-colors " +
        (isOver ? "bg-[#FCEFD9] border-accent-gold" : "border-line-grey")
      }
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
      <div className="font-serif font-bold text-sm mb-2 flex items-center gap-1.5">
        <Icon weight="fill" size={16} className="text-tab-brown" />
        {TEAM_LABELS[group]}
      </div>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {names.map((name, idx) => (
          <div className="flex items-center gap-2" key={idx}>
            <input
              type="text"
              placeholder="姓名"
              value={name}
              onChange={(e) => setName(idx, e.target.value)}
              className="flex-1 py-1.5 px-2 border border-line-grey rounded-md text-[12.5px] bg-white"
            />
            <button title="刪除" onClick={() => removeName(idx)} className="text-line-grey hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <button className={btnMiniClass} onClick={addName}>
        <Plus weight="bold" size={13} />
        新增{simpleLabel}
      </button>

      <div className="flex flex-wrap gap-1.5 min-h-[34px] border-t border-dashed border-line-grey pt-2 mt-2.5">
        {assigned.map((row) => (
          <div
            className="flex items-center gap-1.5 bg-paper-light border border-line-grey rounded-2xl py-1 px-2.5 text-xs cursor-grab"
            key={row.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", row.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <span className="font-bold text-ink">{row.role}</span>
            <span className="text-ink-soft font-mono">{row.contact || row.company || "未填"}</span>
            <button title="移出" onClick={() => onDropConsultant(row.id, null)} className="text-line-grey hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
              <X size={12} />
            </button>
          </div>
        ))}
        {assigned.length === 0 && <div className="text-[11px] text-ink-soft">拖曳下方顧問到此分類</div>}
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
  const tableInputClass = "w-full border border-transparent bg-transparent py-1 px-1.5 rounded text-xs focus:border-line-grey focus:bg-white focus:outline-none";

  return (
    <details
      className="group border border-line-grey rounded-lg mb-3.5 bg-paper-light"
      open={ui.teamOpen}
      onToggle={(e) => setTeamOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer py-3 px-4 font-bold text-[17px] font-serif list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <CaretRight weight="bold" size={12} className="text-tab-brown group-open:rotate-90 transition-transform" />
        <UsersThree weight="fill" size={18} className="text-steel" />
        備標團隊成員
      </summary>
      <div className="px-4 pb-4 pt-1">
        <div className="flex justify-end mb-2">
          <button
            className={btnMiniClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTeamEditing(!ui.teamEditing);
            }}
          >
            {ui.teamEditing ? <Check weight="bold" size={14} /> : <PencilSimple weight="bold" size={14} />}
            {ui.teamEditing ? "完成編輯" : "編輯團隊"}
          </button>
        </div>

        {!ui.teamEditing && (
          <div className="py-1.5">
            <div className="inline-block font-serif font-bold text-sm bg-ink text-paper-light py-1.5 px-4 rounded-md">
              備標團隊
            </div>
            <div className="relative flex gap-7 pt-5.5 flex-wrap before:content-[''] before:absolute before:top-0 before:left-5 before:right-5 before:h-0 before:border-t-2 before:border-line-grey">
              <OrgBranch
                title={TEAM_LABELS.architect}
                icon={TEAM_ICONS.architect}
                names={c.team.architect.filter(Boolean)}
                consultants={c.team.consultants.filter((x) => x.team === "architect")}
              />
              <OrgBranch
                title={TEAM_LABELS.jianguo}
                icon={TEAM_ICONS.jianguo}
                names={c.team.mep.filter(Boolean)}
                consultants={c.team.consultants.filter((x) => x.team === "jianguo")}
              />
              {unassigned.length > 0 && <OrgBranch title="未分類顧問" names={[]} consultants={unassigned} />}
            </div>
          </div>
        )}

        {ui.teamEditing && (
          <>
            <div className="flex gap-4 mb-3.5 flex-wrap">
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
              className={
                "rounded-lg border border-dashed py-2.5 px-3 mb-3.5 transition-colors " +
                (poolOver ? "bg-[#FCEFD9] border-accent-gold" : "bg-tab-brown/5 border-tab-brown")
              }
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
              <div className="text-[11.5px] text-ink-soft font-mono mb-1.5">
                未分類顧問（可拖曳到上方任一團隊框框內做分類）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((row) => (
                  <div
                    className="flex items-center gap-1.5 bg-paper-light border border-line-grey rounded-2xl py-1 px-2.5 text-xs cursor-grab"
                    key={row.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", row.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span className="font-bold text-ink">{row.role}</span>
                    <span className="text-ink-soft font-mono">{row.contact || row.company || "未填"}</span>
                  </div>
                ))}
                {unassigned.length === 0 && <div className="text-[11px] text-ink-soft">目前沒有未分類的顧問</div>}
              </div>
            </div>

            <div className="mb-3.5">
              <h4 className="text-[12.5px] font-serif text-ink mb-1.5">專業顧問明細</h4>
              <table className="w-full border-collapse text-xs mb-1.5">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[10.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">專業顧問</th>
                    <th className="text-left font-mono text-[10.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">顧問工程</th>
                    <th className="text-left font-mono text-[10.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">負責人</th>
                    <th className="text-left font-mono text-[10.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">所屬</th>
                    <th className="text-left font-mono text-[10.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">分類</th>
                    <th className="border-b border-ink py-1.5 px-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {c.team.consultants.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="font-bold text-ink whitespace-nowrap border-b border-dashed border-line-grey py-1 px-1.5">
                        {row.custom ? (
                          <input
                            type="text"
                            value={row.role}
                            onChange={(e) => setConsultantField(idx, "role", e.target.value)}
                            className={tableInputClass}
                          />
                        ) : (
                          row.role
                        )}
                      </td>
                      <td className="border-b border-dashed border-line-grey py-1 px-1.5">
                        <input
                          type="text"
                          placeholder="顧問工程公司名稱"
                          value={row.company}
                          onChange={(e) => setConsultantField(idx, "company", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-line-grey py-1 px-1.5">
                        <input
                          type="text"
                          placeholder="負責人"
                          value={row.contact}
                          onChange={(e) => setConsultantField(idx, "contact", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-line-grey py-1 px-1.5">
                        <input
                          type="text"
                          placeholder="所屬"
                          value={row.affiliation}
                          onChange={(e) => setConsultantField(idx, "affiliation", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-line-grey py-1 px-1.5">
                        <span className="text-[10px] text-tab-brown whitespace-nowrap">
                          {row.team ? TEAM_LABELS[row.team] : "未分類"}
                        </span>
                      </td>
                      <td className="border-b border-dashed border-line-grey py-1 px-1.5">
                        {row.custom && (
                          <button title="刪除" onClick={() => removeConsultant(idx)} className="text-line-grey hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className={btnMiniClass} onClick={addConsultant}>
                <Plus weight="bold" size={13} />
                新增其他顧問類別
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
