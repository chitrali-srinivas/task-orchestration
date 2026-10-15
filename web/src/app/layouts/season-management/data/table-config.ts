// PROTOTYPE-ONLY — mock server rules for the Season Management table (in-memory search/filter/count logic).
// Production has no Season Management API yet; see data/api-contract.ts.
import type { TableConfig } from "@/mocks/server-table";
import { parseDateValue } from "@/mocks/server-table";
import { SeasonRecord, SeasonQueryFilters } from "./schema";

export function createSeasonTableConfig(seasons: SeasonRecord[]): TableConfig<SeasonRecord, SeasonQueryFilters> {
    return {
        dataset: seasons,
        searchableFields: [
            "id",
            "baseName",
            "country",
            "azName",
            "season",
            "status",
            "createdBy",
            "updatedBy",
        ],
        customFilterHandlers: {
            statusTab: (row, val) => {
                if (!val || val === "All") return true;
                return row.status === val;
            },
            seasonIds: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.id);
            },
            bases: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.baseName);
            },
            countries: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.country);
            },
            azNames: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.azName);
            },
            seasons: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.season || "Kharif");
            },
            statuses: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.status);
            },
            createdBy: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.createdBy);
            },
            updatedBy: (row, val) => {
                if (!val || val.length === 0) return true;
                return val.includes(row.updatedBy);
            },
            startDate: (row, val) => {
                if (!val?.from && !val?.to) return true;
                const date = parseDateValue(row.seasonStart);
                if (!date) return false;
                if (val.from && date < new Date(val.from)) return false;
                if (val.to && date > new Date(val.to)) return false;
                return true;
            },
            endDate: (row, val) => {
                if (!val?.from && !val?.to) return true;
                const date = parseDateValue(row.seasonEnd);
                if (!date) return false;
                if (val.from && date < new Date(val.from)) return false;
                if (val.to && date > new Date(val.to)) return false;
                return true;
            },
        },
        calculateSummaryCounts: (dataset) => ({
            all: dataset.length,
            draft: dataset.filter(s => s.status === "Draft").length,
            planned: dataset.filter(s => s.status === "Planned").length,
            inprogress: dataset.filter(s => s.status === "Inprogress").length,
            completed: dataset.filter(s => s.status === "Completed").length,
            cancelled: dataset.filter(s => s.status === "Cancelled").length,
        }),
    };
}
