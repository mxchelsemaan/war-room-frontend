import { subDays, subMonths, startOfYear, format } from "date-fns";

export interface DatePreset {
  key: string;
  label: string;
  getRange: () => { from: string; to: string };
}

export const DATE_PRESETS: DatePreset[] = [
  {
    key: "yesterday",
    label: "Yesterday",
    getRange: () => {
      const d = format(subDays(new Date(), 1), "yyyy-MM-dd");
      return { from: d, to: d };
    },
  },
  {
    key: "last_7",
    label: "Last 7 days",
    getRange: () => ({
      from: format(subDays(new Date(), 7), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "last_30",
    label: "Last 30 days",
    getRange: () => ({
      from: format(subDays(new Date(), 30), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "last_3mo",
    label: "Last 3 months",
    getRange: () => ({
      from: format(subMonths(new Date(), 3), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "last_6mo",
    label: "Last 6 months",
    getRange: () => ({
      from: format(subMonths(new Date(), 6), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "ytd",
    label: "Year to date",
    getRange: () => ({
      from: format(startOfYear(new Date()), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "last_year",
    label: "Last year",
    getRange: () => ({
      from: format(subMonths(new Date(), 12), "yyyy-MM-dd"),
      to: format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    key: "all_time",
    label: "All time",
    getRange: () => ({ from: "", to: "" }),
  },
];
