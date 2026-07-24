import { Buildings, CalendarDots, FileText, Files, Microphone, PushPin, type Icon } from "@phosphor-icons/react";

export const CATEGORIES = [
  "會議安排",
  "公司內部流程",
  "服務建議書製作",
  "投標文件蒐集、確認",
  "評選作業",
  "其他事項",
] as const;

export const CAT_LETTERS: Record<string, string> = {
  會議安排: "A",
  公司內部流程: "B",
  服務建議書製作: "C",
  "投標文件蒐集、確認": "D",
  評選作業: "E",
  其他事項: "F",
};

export const CAT_COLORS: Record<string, string> = {
  會議安排: "var(--color-navy)",
  公司內部流程: "var(--color-olive)",
  服務建議書製作: "var(--color-chop-red)",
  "投標文件蒐集、確認": "var(--color-done-green)",
  評選作業: "var(--color-amber)",
  其他事項: "var(--color-steel)",
};

export const CAT_ICON_COMPONENTS: Record<string, Icon> = {
  會議安排: CalendarDots,
  公司內部流程: Buildings,
  服務建議書製作: FileText,
  "投標文件蒐集、確認": Files,
  評選作業: Microphone,
  其他事項: PushPin,
};

export function catIconComponent(cat: string): Icon {
  return CAT_ICON_COMPONENTS[cat] || PushPin;
}
export function catColor(cat: string) {
  return CAT_COLORS[cat] || "var(--color-line-grey)";
}
export function catLetter(cat: string) {
  return CAT_LETTERS[cat] || "?";
}

export const WEEKDAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export const CONSULTANT_DEFAULTS = [
  "結構技師",
  "機電技師",
  "空調技師",
  "景觀顧問",
  "交通技師",
  "水保/出流(水利技師)",
  "大地技師",
  "智慧建築顧問(設計階段)",
  "綠建築/能效顧問(設計階段)",
  "低碳顧問(設計階段)",
  "微振顧問",
  "施工監測技師",
  "生態檢核",
];

export const MILESTONE_ORDER = [
  { key: "collect", label: "① 招標公告" },
  { key: "wu", label: "② 吳董會議" },
  { key: "eng_signoff", label: "③ 工程事業簽呈" },
  { key: "notarize", label: "④ 公證時程" },
  { key: "prebid", label: "⑤ 標前會" },
  { key: "final_proof", label: "⑥ 服務建議書最後校稿" },
  { key: "print", label: "⑦ 服務建議書送印" },
  { key: "submit_action", label: "⑧ 投標時間（實際送件）" },
  { key: "deadline", label: "⑨ 投標截止時間" },
] as const;
