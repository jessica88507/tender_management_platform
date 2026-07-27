import { Buildings, CalendarDots, FileText, Files, Microphone, PushPin, type Icon } from "@phosphor-icons/react";

// Split out from constants.ts on purpose: constants.ts is imported by scheduler.ts, which also
// runs server-side (API routes). Pulling @phosphor-icons/react into that import chain broke the
// server build ("createContext is not a function") — keep any React-component exports here,
// client-component-only.

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
