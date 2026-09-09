export const ATTENDANCE_FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Todo domingo" },
  { value: "biweekly", label: "A cada quinze dias" },
  { value: "monthly", label: "Uma vez no mês" },
] as const;

export type AttendanceFrequency = (typeof ATTENDANCE_FREQUENCY_OPTIONS)[number]["value"];
