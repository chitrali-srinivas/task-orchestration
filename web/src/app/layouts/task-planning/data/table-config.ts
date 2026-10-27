// PROTOTYPE-ONLY — mock server rules for the Task planning table (in-memory search/filter/count logic).
// In production this behaviour is implemented by the backend; see data/api-contract.ts.
import { format } from "date-fns";
import type { TableConfig } from "@/mocks/server-table";
import { DateRange, JobFilters, JobRecord } from "./schema";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const includes = (value: string | undefined, query: string) => Boolean(value?.toLowerCase().includes(query.toLowerCase().trim()));

/** Header search on a YYYY-MM-DD field matches what the cell shows ("27 OCT 26", "October") and the raw date. */
const matchesDate = (value: string, query: string) => includes(`${value} ${format(new Date(`${value}T00:00:00`), "dd MMM yy MMMM yyyy")}`, query);

const inRange = (value: string, range: DateRange) => (!range.from || value >= ymd(range.from)) && (!range.to || value <= ymd(range.to));

export function createJobsTableConfig(dataset: JobRecord[]): TableConfig<JobRecord, JobFilters> {
    return {
        dataset,
        defaultPageSize: 20,
        minLatencyMs: 400,
        maxLatencyMs: 700,
        defaultSort: { field: "sortKey", direction: "desc" },
        customFilterHandlers: {
            tabStatus: (row, value) => row.status === value,
            jobCode: (row, value) => typeof value !== "string" || includes(row.jobCode, value),
            // A string is the column's header search; an array / range comes from the filter sheet.
            date: (row, value) => (typeof value === "string" ? matchesDate(row.date, value) : inRange(row.date, value as DateRange)),
            surveyorName: (row, value) =>
                typeof value === "string" ? includes(row.surveyorName, value) : !Array.isArray(value) || value.length === 0 || value.includes(row.surveyorId),
            village: (row, value) =>
                typeof value === "string" ? includes(row.villages, value) : !Array.isArray(value) || value.length === 0 || row.villageList.some((v) => value.includes(v)),
        },
        calculateSummaryCounts: (rows) => {
            const counts: Record<string, number> = { all: rows.length };
            rows.forEach((row) => (counts[row.status] = (counts[row.status] ?? 0) + 1));
            return counts;
        },
    };
}
