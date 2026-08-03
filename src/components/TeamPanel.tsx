"use client";

import { useState } from "react";
import { AddressBook, Bank, Buildings, CaretRight, Check, HardHat, PencilSimple, Plus, UsersThree, X } from "@phosphor-icons/react";
import { Case, Consultant, TeamGroup } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { uid } from "@/lib/date";
import type { Vendor } from "./VendorDirectoryModal";

const TEAM_LABELS: Record<"architect" | "jianguo", string> = {
  architect: "建築師團隊",
  jianguo: "建國工程團隊",
};
const TEAM_ICONS: Record<Exclude<TeamGroup, null>, typeof Bank> = {
  architect: Bank,
  jianguo: HardHat,
  extra: Buildings,
};

const btnMiniClass =
  "inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[18px] font-bold cursor-pointer hover:bg-accent/10 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

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
    <div className="relative flex-1 min-w-[220px] pt-3.5 before:content-[''] before:absolute before:-top-3.5 before:left-1/2 before:w-0.5 before:h-3.5 before:bg-border">
      <div className="font-bold font-serif text-[19px] text-ink bg-card border-[1.5px] border-accent rounded-md py-1.5 px-3 text-center mb-2 flex items-center justify-center gap-1.5">
        {Icon && <Icon weight="fill" size={16} className="text-accent" />}
        {title}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {names.map((n) => (
          <div className="bg-card border border-border rounded-lg py-2 px-3.5 min-w-[104px] text-center" key={n}>
            <div className="text-[18px] text-ink font-mono">{n}</div>
          </div>
        ))}
        {consultants.map((row) => (
          <div className="bg-card border border-border rounded-lg py-2 px-3.5 min-w-[104px] text-center" key={row.id}>
            <div className="text-[15.5px] text-ink-soft font-bold whitespace-nowrap">{row.role}</div>
            <div className="text-[18px] text-ink font-mono mt-0.5">{row.contact || row.company || "—"}</div>
          </div>
        ))}
        {empty && <div className="text-ink-soft text-[15.5px]">尚無成員</div>}
      </div>
    </div>
  );
}

function TeamBox({
  group,
  simpleKey,
  simpleLabel,
  title,
  titlePlaceholder,
  onTitleChange,
  onRemove,
  hideAddButton,
  hideMemberList,
  c,
  caseId,
  onDropConsultant,
}: {
  group: Exclude<TeamGroup, null>;
  simpleKey: "architect" | "mep" | "extraMembers";
  simpleLabel: string;
  title: string;
  // When provided, the box's own header becomes the editable team-name field (architect/extra) —
  // instead of a separate field elsewhere — so naming the team happens right where it appears on
  // the org chart. Omitted for 建國工程團隊, which is always the firm's own fixed in-house team.
  titlePlaceholder?: string;
  onTitleChange?: (value: string) => void;
  onRemove?: () => void;
  hideAddButton?: boolean;
  // 3rd team is name-only (no manual member-name list) — just the editable title + consultant
  // drag-drop. Implies hideAddButton.
  hideMemberList?: boolean;
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
        "flex-1 min-w-[260px] rounded-[10px] border-[1.5px] border-dashed p-3 bg-card transition-colors " +
        (isOver ? "bg-highlight-soft border-highlight" : "border-border")
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
      <div className="font-serif font-bold text-[18px] mb-2 flex items-center gap-1.5">
        <Icon weight="fill" size={16} className="text-accent shrink-0" />
        {onTitleChange ? (
          <input
            type="text"
            value={title}
            placeholder={titlePlaceholder}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-b-[1.5px] border-dashed border-border focus:border-accent focus:outline-none font-serif font-bold text-[18px] text-ink placeholder:text-ink-soft placeholder:font-normal placeholder:text-[14.5px] py-0.5"
          />
        ) : (
          <span>{title}</span>
        )}
        {onRemove && (
          <button
            title="移除此團隊"
            onClick={onRemove}
            className="shrink-0 text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {!hideMemberList && (
        <>
          <div className="flex flex-col gap-1.5 mb-2.5">
            {names.map((name, idx) => (
              <div className="flex items-center gap-2" key={idx}>
                <input
                  type="text"
                  placeholder="姓名"
                  value={name}
                  onChange={(e) => setName(idx, e.target.value)}
                  className="flex-1 py-1.5 px-2 border border-border rounded-md text-[16px] bg-card"
                />
                <button title="刪除" onClick={() => removeName(idx)} className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          {!hideAddButton && (
            <button className={btnMiniClass} onClick={addName}>
              <Plus weight="bold" size={13} />
              新增{simpleLabel}
            </button>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-1.5 min-h-[34px] border-t border-dashed border-border pt-2 mt-2.5">
        {assigned.map((row) => (
          <div
            className="flex items-center gap-1.5 bg-card border border-border rounded-2xl py-1 px-2.5 text-[15.5px] cursor-grab"
            key={row.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", row.id);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <span className="font-bold text-ink">{row.role}</span>
            <span className="text-ink-soft font-mono">{row.contact || row.company || "未填"}</span>
            <button title="移出" onClick={() => onDropConsultant(row.id, null)} className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
              <X size={12} />
            </button>
          </div>
        ))}
        {assigned.length === 0 && <div className="text-[14.5px] text-ink-soft">拖曳下方顧問到此分類</div>}
      </div>
    </div>
  );
}

// Sits inline alongside the architect/jianguo boxes (same size/row) rather than as a separate
// element below them — the org chart's 2nd tier supports up to 3 branches, so the "add a 3rd one"
// affordance should look like the empty slot it is, not a disconnected button.
function AddTeamBox({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-[260px] rounded-[10px] border-[1.5px] border-dashed border-accent/50 p-3 bg-accent/5 hover:bg-accent/10 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer min-h-[120px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="inline-flex items-center gap-1.5 text-accent font-bold text-[16px]">
        <Plus weight="bold" size={15} />
        新增第三個團隊
      </span>
      <span className="text-[13.5px] text-ink-soft px-2">
        例如：JV機電公司。沒有的話不用理會這裡。
      </span>
    </button>
  );
}

export function TeamPanel({ caseId, c }: { caseId: string; c: Case }) {
  const { ui, setTeamOpen, setTeamEditing, updateCase, canEditActive } = useApp();
  const [poolOver, setPoolOver] = useState(false);
  // Keeps the 3rd-team box visible immediately after clicking "+ 新增第三個團隊", before any name
  // has been typed — `extraName` alone (with no member-name list anymore) is what real saved data
  // relies on, so an empty draft would otherwise collapse straight back into the ghost add-box.
  const [extraTeamJustAdded, setExtraTeamJustAdded] = useState(false);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [vendorList, setVendorList] = useState<Vendor[] | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");

  const setConsultantField = (idx: number, field: "role" | "company" | "contact", value: string) => {
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
  // Lazily fetched on first open, not on every panel render — the directory rarely changes mid-
  // session, and most edits to a case's team never touch it at all.
  const openVendorPicker = () => {
    setShowVendorPicker(true);
    if (!vendorList) {
      fetch("/api/vendors")
        .then((r) => r.json())
        .then((data) => setVendorList(data.vendors ?? []))
        .catch(() => setVendorList([]));
    }
  };
  const addFromVendor = (v: Vendor) => {
    updateCase(caseId, (draft) => {
      draft.team.consultants.push({
        id: uid(),
        role: v.role,
        company: v.company,
        contact: v.contact,
        affiliation: "",
        custom: true,
        team: null,
      });
    });
    setShowVendorPicker(false);
    setVendorSearch("");
  };
  const assignConsultantTeam = (consultantId: string, group: TeamGroup) => {
    updateCase(caseId, (draft) => {
      const row = draft.team.consultants.find((x) => x.id === consultantId);
      if (row) row.team = group;
    });
  };
  const setArchitectName = (value: string) => {
    updateCase(caseId, (draft) => {
      draft.team.architectName = value;
    });
  };
  const addExtraTeam = () => {
    setExtraTeamJustAdded(true);
  };
  const removeExtraTeam = () => {
    setExtraTeamJustAdded(false);
    updateCase(caseId, (draft) => {
      draft.team.extraName = "";
      draft.team.extraMembers = [];
      draft.team.consultants.forEach((x) => {
        if (x.team === "extra") x.team = null;
      });
    });
  };
  const setExtraName = (value: string) => {
    updateCase(caseId, (draft) => {
      draft.team.extraName = value;
    });
  };

  const unassigned = c.team.consultants.filter((x) => !x.team);
  const hasExtraTeamData = c.team.extraName.trim() !== "" || c.team.extraMembers.length > 0 || c.team.consultants.some((x) => x.team === "extra");
  const showExtraBox = hasExtraTeamData || extraTeamJustAdded;
  const architectConsultants = c.team.consultants.filter((x) => x.team === "architect");
  const jianguoConsultants = c.team.consultants.filter((x) => x.team === "jianguo");
  const extraConsultants = c.team.consultants.filter((x) => x.team === "extra");
  const tableInputClass = "w-full border border-transparent bg-transparent py-1 px-1.5 rounded text-[15.5px] focus:border-border focus:bg-card focus:outline-none";
  const teamDisplayLabel = (group: TeamGroup) => {
    if (group === "extra") return c.team.extraName || "第三團隊";
    if (group === "architect" || group === "jianguo") return TEAM_LABELS[group];
    return "未分類（請於上方拖曳分類）";
  };

  return (
    <details
      className="group border border-border rounded-lg mb-3.5 bg-card shadow-sm"
      open={ui.teamOpen}
      onToggle={(e) => setTeamOpen((e.target as HTMLDetailsElement).open)}
      data-tutorial="team-panel"
    >
      <summary className="cursor-pointer py-3 px-4 font-bold text-[22px] font-serif list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <CaretRight weight="bold" size={12} className="text-accent group-open:rotate-90 transition-transform" />
        <UsersThree weight="fill" size={18} className="text-steel" />
        備標團隊成員
      </summary>
      <div className="px-4 pb-4 pt-1">
        {canEditActive && (
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
        )}

        {(!ui.teamEditing || !canEditActive) && (
          <div className="py-1.5 flex flex-col items-center">
            <div className="relative inline-block font-serif font-bold text-[18px] bg-ink text-card py-1.5 px-4 rounded-md mb-3.5 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:w-0.5 after:h-3.5 after:bg-border">
              備標團隊
            </div>
            <div className="relative flex gap-7 flex-wrap justify-center w-full before:content-[''] before:absolute before:top-0 before:left-5 before:right-5 before:h-0 before:border-t-2 before:border-border">
              <OrgBranch
                title={c.team.architectName || TEAM_LABELS.architect}
                icon={TEAM_ICONS.architect}
                names={c.team.architect.filter(Boolean)}
                consultants={architectConsultants}
              />
              <OrgBranch
                title={TEAM_LABELS.jianguo}
                icon={TEAM_ICONS.jianguo}
                names={c.team.mep.filter(Boolean)}
                consultants={jianguoConsultants}
              />
              {hasExtraTeamData && (
                <OrgBranch
                  title={c.team.extraName || "第三團隊"}
                  icon={TEAM_ICONS.extra}
                  names={c.team.extraMembers.filter(Boolean)}
                  consultants={extraConsultants}
                />
              )}
              {unassigned.length > 0 && <OrgBranch title="未分類顧問" names={[]} consultants={unassigned} />}
            </div>
          </div>
        )}

        {ui.teamEditing && canEditActive && (
          <>
            <div className="flex gap-4 mb-1.5 flex-wrap">
              <TeamBox
                group="architect"
                simpleKey="architect"
                simpleLabel="建築師"
                title={c.team.architectName}
                titlePlaceholder="例如：OO建築師事務所"
                onTitleChange={setArchitectName}
                hideAddButton
                c={c}
                caseId={caseId}
                onDropConsultant={assignConsultantTeam}
              />
              <TeamBox
                group="jianguo"
                simpleKey="mep"
                simpleLabel="機電團隊"
                title={TEAM_LABELS.jianguo}
                hideAddButton
                c={c}
                caseId={caseId}
                onDropConsultant={assignConsultantTeam}
              />
              {showExtraBox ? (
                <TeamBox
                  group="extra"
                  simpleKey="extraMembers"
                  simpleLabel="成員"
                  title={c.team.extraName}
                  titlePlaceholder="例如：OO機電工程股份有限公司（JV）"
                  onTitleChange={setExtraName}
                  onRemove={removeExtraTeam}
                  hideMemberList
                  c={c}
                  caseId={caseId}
                  onDropConsultant={assignConsultantTeam}
                />
              ) : (
                <AddTeamBox onClick={addExtraTeam} />
              )}
            </div>
            <div className="text-[13.5px] text-ink-soft mb-3.5">
              團隊名稱可直接點選上方框框標題輸入，會同步顯示在組織圖上。
            </div>

            <div
              className={
                "rounded-lg border border-dashed py-2.5 px-3 mb-3.5 transition-colors " +
                (poolOver ? "bg-highlight-soft border-highlight" : "bg-accent/5 border-accent")
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
              <div className="text-[15px] text-ink-soft font-mono mb-1.5">
                未分類顧問（可拖曳到上方任一團隊框框內做分類）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((row) => (
                  <div
                    className="flex items-center gap-1.5 bg-card border border-border rounded-2xl py-1 px-2.5 text-[15.5px] cursor-grab"
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
                {unassigned.length === 0 && <div className="text-[14.5px] text-ink-soft">目前沒有未分類的顧問</div>}
              </div>
            </div>

            <div className="mb-3.5">
              <h4 className="text-[16px] font-serif text-ink mb-1.5">專業顧問明細</h4>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[15.5px] mb-1.5">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">專業顧問</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">顧問工程</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">負責人</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b border-ink py-1.5 px-1.5">分類（可拖曳）</th>
                    <th className="border-b border-ink py-1.5 px-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {c.team.consultants.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="font-bold text-ink whitespace-nowrap border-b border-dashed border-border py-1 px-1.5">
                        <input
                          type="text"
                          value={row.role}
                          onChange={(e) => setConsultantField(idx, "role", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1 px-1.5">
                        <input
                          type="text"
                          placeholder="顧問工程公司名稱"
                          value={row.company}
                          onChange={(e) => setConsultantField(idx, "company", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1 px-1.5">
                        <input
                          type="text"
                          placeholder="負責人"
                          value={row.contact}
                          onChange={(e) => setConsultantField(idx, "contact", e.target.value)}
                          className={tableInputClass}
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1 px-1.5">
                        <span className="text-[13px] text-accent whitespace-nowrap">{teamDisplayLabel(row.team)}</span>
                      </td>
                      <td className="border-b border-dashed border-border py-1 px-1.5">
                        <button title="刪除" onClick={() => removeConsultant(idx)} className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger">
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex gap-2 flex-wrap relative">
                <button className={btnMiniClass} onClick={addConsultant}>
                  <Plus weight="bold" size={13} />
                  新增其他顧問類別
                </button>
                <button className={btnMiniClass} onClick={() => (showVendorPicker ? setShowVendorPicker(false) : openVendorPicker())}>
                  <AddressBook weight="bold" size={13} />
                  從資料庫選擇
                </button>
                {showVendorPicker && (
                  <>
                    <div className="fixed inset-0 z-[998]" onClick={() => setShowVendorPicker(false)} />
                    <div className="absolute top-full left-0 mt-1.5 z-[999] bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] w-[340px] max-h-[320px] flex flex-col overflow-hidden">
                      <input
                        autoFocus
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        placeholder="搜尋角色或公司名稱…"
                        className="shrink-0 border-b border-border py-2 px-3 text-[15px] bg-card focus:outline-none"
                      />
                      <div className="flex-1 overflow-y-auto">
                        {vendorList === null ? (
                          <div className="text-ink-soft text-[14px] py-3 px-3">載入中…</div>
                        ) : (
                          (() => {
                            const q = vendorSearch.trim().toLowerCase();
                            const filtered = q
                              ? vendorList.filter((v) => `${v.role}${v.company}`.toLowerCase().includes(q))
                              : vendorList;
                            if (filtered.length === 0) {
                              return <div className="text-ink-soft text-[14px] py-3 px-3">沒有符合的資料，可以到「廠商／顧問資料庫」新增。</div>;
                            }
                            return filtered.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => addFromVendor(v)}
                                className="w-full text-left py-2 px-3 hover:bg-accent/10 cursor-pointer border-b border-dashed border-border last:border-b-0"
                              >
                                <div className="text-[15px] font-bold text-ink">{v.role}</div>
                                <div className="text-[13.5px] text-ink-soft">{v.company || "—"}{v.contact ? `・${v.contact}` : ""}</div>
                              </button>
                            ));
                          })()
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
