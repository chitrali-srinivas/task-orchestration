// PROTOTYPE-ONLY — mock server rules for the Tasks table (in-memory search/filter/count logic).
// In production this behaviour is implemented by the backend; see data/api-contract.ts.
import { format } from "date-fns";
import type { TableConfig } from "@/mocks/server-table";
import { DateRange, TaskFilters, TaskRecord } from "./schema";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const includes = (value: string | undefined, query: string) => Boolean(value?.toLowerCase().includes(query.toLowerCase().trim()));

/** Header search on a YYYY-MM-DD field matches what the cell shows ("26 OCT 26", "October") and the raw date. */
function matchesDate(value: string | undefined, query: string): boolean {
    if (!value) return false;
    return includes(`${value} ${format(new Date(`${value}T00:00:00`), "dd MMM yy MMMM yyyy")}`, query);
}

function inRange(value: string | undefined, range: DateRange): boolean {
    if (!range.from && !range.to) return true;
    if (!value) return false;
    return (!range.from || value >= ymd(range.from)) && (!range.to || value <= ymd(range.to));
}

/** A string is the column's header search; an array comes from the filter sheet (option values). */
const textOrOptions = (text: (row: TaskRecord) => string | undefined, option: (row: TaskRecord) => string) =>
    (row: TaskRecord, value: unknown) =>
        typeof value === "string" ? includes(text(row), value) : !Array.isArray(value) || value.length === 0 || value.includes(option(row));

/** A string is the column's header search; a { from, to } object comes from the filter sheet. */
const dateField = (field: (row: TaskRecord) => string | undefined) =>
    (row: TaskRecord, value: unknown) => (typeof value === "string" ? matchesDate(field(row), value) : inRange(field(row), value as DateRange));

export const taskOrigin = (row: TaskRecord) => (row.parentTaskId ? "follow-up" : "registration");

/** "Assigned to" filter option for tasks on no published route. */
export const UNASSIGNED = "unassigned";

export function createTasksTableConfig(dataset: TaskRecord[]): TableConfig<TaskRecord, TaskFilters> {
    return {
        dataset,
        defaultPageSize: 20,
        minLatencyMs: 400,
        maxLatencyMs: 700,
        // Status level first (pending at the top), oldest planned start first within each status.
        defaultSort: { field: "queueKey", direction: "asc" },
        customFilterHandlers: {
            tabStatus: (row, value) => row.status === value,
            taskCode: (row, value) => typeof value !== "string" || includes(row.taskCode, value),
            surveyName: textOrOptions((row) => row.surveyName, (row) => row.surveyId),
            farmerName: textOrOptions((row) => row.farmerName, (row) => row.farmerId),
            village: textOrOptions((row) => row.village, (row) => row.village),
            createdFrom: textOrOptions((row) => row.createdFrom, taskOrigin),
            plannedStart: dateField((row) => row.plannedStart),
            plannedEnd: dateField((row) => row.plannedEnd),
            assignedTo: textOrOptions((row) => row.assignedTo, (row) => row.surveyorId ?? UNASSIGNED),
            visitDate: dateField((row) => row.visitDate),
        },
        calculateSummaryCounts: (rows) => {
            const counts: Record<string, number> = { all: rows.length };
            rows.forEach((row) => (counts[row.status] = (counts[row.status] ?? 0) + 1));
            return counts;
        },
    };
}
