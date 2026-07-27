import { Case, Task, Team } from "./types";
import { addDays, daysBetween, snapToBizDay, toISO, uid } from "./date";
import { CONSULTANT_DEFAULTS, WEEKDAY_NAMES } from "./constants";

export function normalizeTeam(team: Partial<Team> | undefined): Team {
  const t: Team = {
    architect: team?.architect ?? [],
    mep: team?.mep ?? [],
    consultants: (team?.consultants ?? []).map((item) =>
      typeof item === "string"
        ? { id: uid(), role: item, company: "", contact: "", affiliation: "", custom: true, team: null }
        : {
            id: item.id ?? uid(),
            role: item.role,
            company: item.company ?? "",
            contact: item.contact ?? "",
            affiliation: item.affiliation ?? "",
            custom: item.custom ?? true,
            team: item.team ?? null,
          }
    ),
  };
  CONSULTANT_DEFAULTS.forEach((role) => {
    if (!t.consultants.some((x) => x.role === role)) {
      t.consultants.push({ id: uid(), role, company: "", contact: "", affiliation: "", custom: false, team: null });
    }
  });
  return t;
}

export function normalizeCase(c: Case): Case {
  if (!c.workStart) c.workStart = c.start;
  if (c.bidLead === undefined) c.bidLead = "";
  return c;
}

export function getOwnerOptions(c: Case): string[] {
  const opts: string[] = [];
  if (c.bidLead) opts.push(c.bidLead);
  (c.team.architect || []).forEach((n) => n && opts.push(n));
  (c.team.mep || []).forEach((n) => n && opts.push(n));
  (c.team.consultants || []).forEach((row) => row.contact && opts.push(row.contact));
  ["業主", "估算部", "模型資訊部", "建築師", "機電團隊", "備標團隊"].forEach((x) => opts.push(x));
  return Array.from(new Set(opts));
}

function generateRecurringMeetings(start: Date, deadlineDate: Date, weekday: number): Date[] {
  const first = new Date(start);
  first.setDate(first.getDate() + 3);
  while (first.getDay() !== weekday) first.setDate(first.getDate() + 1);
  const last = addDays(deadlineDate, -7);
  const arr: Date[] = [];
  const cur = new Date(first);
  while (cur <= last && arr.length < 20) {
    arr.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return arr;
}

export function generateTasks(c: Case): Task[] {
  const start = new Date(c.start + "T00:00:00");
  // 開始作業期程 (internal work-prep start) vs 招標公告 (public tender announcement) — two
  // distinct anchor dates; defaults to the same day as `start` until edited separately in
  // InfoPanel (see normalizeCase), so most cases see no change from using this anchor.
  const workStartDate = new Date((c.workStart || c.start) + "T00:00:00");
  const deadlineDT = new Date(c.deadline);
  const deadlineDate = new Date(deadlineDT.getFullYear(), deadlineDT.getMonth(), deadlineDT.getDate());
  const tasks: Task[] = [];
  const add = (
    cat: string,
    label: string,
    owner: string,
    dateObj: Date,
    milestone?: string | null
  ) => {
    tasks.push({
      id: uid(),
      cat,
      label,
      note: "",
      owner: owner || c.bidLead || "",
      due: toISO(dateObj),
      done: false,
      milestone: milestone || null,
    });
  };

  add("投標文件蒐集、確認", "招標公告", "", start, "collect");

  const weekday =
    c.meetingWeekday !== undefined && c.meetingWeekday !== null ? Number(c.meetingWeekday) : 2;
  const meetingDates = generateRecurringMeetings(start, deadlineDate, weekday);
  meetingDates.forEach((d, i) =>
    add("會議安排", `例行會議＃${String(i + 1).padStart(2, "0")}（${WEEKDAY_NAMES[weekday]}）`, "", d)
  );
  add("會議安排", "統包啟動會議", "", snapToBizDay(addDays(start, -7)));
  add(
    "會議安排",
    "吳董設計會議（設計定稿，領標後3~4週）",
    "",
    snapToBizDay(addDays(start, 24)),
    "wu"
  );

  const contractAmt = Number(c.contractAmount) || 0;
  const preBidCount = contractAmt >= 8000000000 ? 3 : 1;
  const preBidDates =
    preBidCount === 3
      ? [addDays(deadlineDate, -7), addDays(deadlineDate, -5), addDays(deadlineDate, -3)].map(snapToBizDay)
      : [snapToBizDay(addDays(deadlineDate, -7))];
  preBidDates.forEach((d, i) =>
    add("會議安排", preBidCount > 1 ? `標前會＃${i + 1}` : "標前會", "", d, "prebid")
  );
  const firstPreBid = preBidDates.reduce((a, b) => (a < b ? a : b));
  const lastPreBid = preBidDates.reduce((a, b) => (a > b ? a : b));

  // Must come after 工程事業簽呈 (eng_signoff, below) is actually signed — both are currently
  // scheduled independently, so re-check ordering manually if firstPreBid ever lands close to
  // the deadline.
  add(
    "會議安排",
    "備標團隊公證（需標前協議書簽署完成）",
    "",
    snapToBizDay(addDays(deadlineDate, -7)),
    "notarize"
  );

  add("公司內部流程", "標前協議書／共同投標協議書確認（投標截止前一週完成）", "", snapToBizDay(addDays(deadlineDate, -7)));
  add("公司內部流程", "營繕工程備標申請（簽呈送出）", "", snapToBizDay(addDays(start, 3)));
  add("公司內部流程", "會辦流程單（契約、投標須知）", "", snapToBizDay(addDays(start, 3)));
  add(
    "公司內部流程",
    "會辦流程單（備標團隊標前協議書，不含金額，領標後2~3週）",
    "",
    snapToBizDay(addDays(start, 18))
  );
  add(
    "公司內部流程",
    "工程事業簽呈（標前協議書含費用、共同投標協議書含費用，標前會前完成）",
    "",
    snapToBizDay(addDays(firstPreBid, -3)),
    "eng_signoff"
  );

  const estimateEnd = snapToBizDay(addDays(firstPreBid, -7));
  const estimateStart = snapToBizDay(addDays(estimateEnd, -14));
  const architectDeliver = snapToBizDay(addDays(estimateStart, -1));
  add("投標文件蒐集、確認", "估算數量作業開始（估算部，2週作業）", "估算部", estimateStart);
  add("投標文件蒐集、確認", "估算部完成估算（需於標前會前1~1.5週完成）", "估算部", estimateEnd);
  add("投標文件蒐集、確認", "建築師提供平立面／剖面／門窗表／外觀材質", "建築師", architectDeliver);
  add("投標文件蒐集、確認", "投標成本定稿（標前會前5天提交）", "", snapToBizDay(addDays(firstPreBid, -3)));
  add("投標文件蒐集、確認", "內部成本簽核", "", snapToBizDay(addDays(lastPreBid, -1)));
  // 投標截止前後2~3天：實際方向未指定，先取投標截止前2天，需再與實際情況確認。
  add("投標文件蒐集、確認", "內部核決", "", snapToBizDay(addDays(deadlineDate, -2)));
  add("投標文件蒐集、確認", "確認設計顧問委託及顧問團隊（領標後一週內）", "", snapToBizDay(addDays(workStartDate, 7)));
  add("投標文件蒐集、確認", "投標資格文件彙整（投標截止前一週）", "", snapToBizDay(addDays(deadlineDate, -7)));
  add("投標文件蒐集、確認", "押標金申請", "", snapToBizDay(addDays(start, 2)));
  add(
    "投標文件蒐集、確認",
    "投標資格實績公證＋統包廠商JV公證合作同意書（投標截止前一週內）",
    "",
    snapToBizDay(addDays(deadlineDate, -7))
  );

  const masterDate = snapToBizDay(addDays(start, 14));
  add("服務建議書製作", "服務建議書母片／分工表提供", "", masterDate);
  const targetPoint = addDays(masterDate, 11);
  const meetingForDraft =
    meetingDates.find((d) => d >= targetPoint) || meetingDates[meetingDates.length - 1] || targetPoint;
  add("服務建議書製作", "服務建議書初稿繳交", "", addDays(meetingForDraft, -1));
  add("服務建議書製作", "服務建議書校正＃1（例行會議彙整）", "", meetingForDraft);
  const printComplete = snapToBizDay(addDays(deadlineDate, -2));
  add("服務建議書製作", "服務建議書校正＃2", "", snapToBizDay(addDays(printComplete, -2)), "final_proof");
  add("服務建議書製作", "服務建議書送印", "", printComplete, "print");
  add("服務建議書製作", "服務建議書用印（含封標）", "", snapToBizDay(addDays(printComplete, -1)));

  add("投標文件蒐集、確認", "送件投標", "", snapToBizDay(addDays(deadlineDate, -1)), "submit_action");
  add("投標文件蒐集、確認", "投標截止", "", deadlineDate, "deadline");

  const totalDays = Math.max(daysBetween(start, deadlineDate), 1);

  // 招標公告日本身即為公開招標日，不再用比例推算；實際日期仍應以招標文件為準，必要時手動調整。
  add("其他事項", "公開招標", "業主", start);
  add("其他事項", "提出釋疑", "備標團隊", addDays(start, Math.round(totalDays / 4)));
  // 業主流程，實際日期仍應以招標文件為準，必要時手動調整。
  add("其他事項", "投標／開標作業（業主流程）", "業主", addDays(deadlineDate, 1));

  ([
    ["初步設計規劃", 0.85],
    ["設計圖說V2", 0.6],
    ["投標前設計圖說定稿", 0.4],
    ["建材設備選用表", 0.32],
    ["建築模型1/100", 0.3],
    ["工程進度／工序定稿", 0.25],
  ] as [string, number][]).forEach(([label, f]) =>
    add("其他事項", label, "", snapToBizDay(new Date(deadlineDate.getTime() - f * totalDays * 86400000)))
  );

  add("評選作業", "施工評選簡報（業主端）", "業主", addDays(deadlineDate, 5));
  add("評選作業", "決選廠商", "業主", addDays(deadlineDate, 20));
  add("評選作業", "完成建築設計動畫（90秒）", "", addDays(deadlineDate, -5));
  add("評選作業", "施工評選簡報初稿", "", addDays(deadlineDate, -3));
  add("評選作業", "施工評選簡報定稿", "", addDays(deadlineDate, 1));
  add("評選作業", "簡報模擬", "", addDays(deadlineDate, 14));

  return tasks.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}
