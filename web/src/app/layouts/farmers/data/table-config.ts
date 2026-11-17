// PROTOTYPE-ONLY — mock server rules for the Farmers table (in-memory search/filter/count logic).
// In production this behaviour is implemented by the backend; see data/api-contract.ts.
import { format } from "date-fns";
import type { TableConfig } from "@/mocks/server-table";
import { DateRange, FarmerFilters, FarmerRecord } from "./schema";

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
const textOrOptions = (text: (row: FarmerRecord) => string | undefined, option: (row: FarmerRecord) => string) =>
    (row: FarmerRecord, value: unknown) =>
        typeof value === "string" ? includes(text(row), value) : !Array.isArray(value) || value.length === 0 || value.includes(option(row));

/** A string is the column's header search; a { from, to } object comes from the filter sheet. */
const dateField = (field: (row: FarmerRecord) => string | undefined) =>
    (row: FarmerRecord, value: unknown) => (typeof value === "string" ? matchesDate(field(row), value) : inRange(field(row), value as DateRange));

export function createFarmersTableConfig(dataset: FarmerRecord[]): TableConfig<FarmerRecord, FarmerFilters> {
    return {
        dataset,
        defaultPageSize: 20,
        minLatencyMs: 300,
        maxLatencyMs: 600,
        // Newest registrations first.
        defaultSort: { field: "registeredAt", direction: "desc" },
        customFilterHandlers: {
            tabStatus: (row, value) => row.status === value,
            name: (row, value) => typeof value !== "string" || includes(row.name, value),
            status: (row, value) => typeof value !== "string" || includes(row.statusLabel, value),
            village: textOrOptions((row) => row.village, (row) => row.village),
            locationSource: textOrOptions((row) => row.locationLabel, (row) => row.locationSource),
            registeredOn: dateField((row) => row.registeredOn),
            nextJobCode: (row, value) => typeof value !== "string" || includes(row.nextJobCode, value),
            nextVisit: dateField((row) => row.nextVisit),
        },
        calculateSummaryCounts: (rows) => {
            const counts: Record<string, number> = { all: rows.length };
            rows.forEach((row) => (counts[row.status] = (counts[row.status] ?? 0) + 1));
            return counts;
        },
    };
}
