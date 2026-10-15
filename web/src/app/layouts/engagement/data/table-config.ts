// PROTOTYPE-ONLY — mock server rules for the Engagement table (in-memory search/filter/count logic).
// In production this behaviour is implemented by the backend; see data/api-contract.ts.
import type { TableConfig } from "@/mocks/server-table";
import { EngagementRecord, EngagementFilters } from "./schema";
import { format } from "date-fns";

export type { EngagementFilters };

function matchesDateString(date: Date | string | undefined | null, query: string): boolean {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return false;
    const q = query.toLowerCase().trim();
    if (!q) return true;
    try {
        const formatted1 = format(d, "dd MMM yy").toLowerCase(); // "12 aug 25"
        const formatted2 = format(d, "yyyy-MM-dd").toLowerCase(); // "2025-08-12"
        const formatted3 = format(d, "MMMM").toLowerCase(); // "august"
        const formatted4 = format(d, "MMM").toLowerCase(); // "aug"
        const formatted5 = format(d, "d MMMM yyyy").toLowerCase(); // "12 august 2025"
        const formatted6 = format(d, "yyyy").toLowerCase(); // "2025"
        const formatted7 = format(d, "d").toLowerCase(); // "12"
        return (
            formatted1.includes(q) ||
            formatted2.includes(q) ||
            formatted3.includes(q) ||
            formatted4.includes(q) ||
            formatted5.includes(q) ||
            formatted6.includes(q) ||
            formatted7 === q
        );
    } catch {
        return false;
    }
}

export function createEngagementTableConfig<T extends EngagementRecord>(dataset: T[]): TableConfig<T, EngagementFilters> {
    return {
        dataset,
        defaultPageSize: 100,
        minLatencyMs: 400,
        maxLatencyMs: 700,
        searchableFields: [
            (row) => row.farmer?.name,
            (row) => row.farmer?.id,
            (row) => row.farmer?.phoneNumber,
            "village",
            "azName",
            (row) => String(row.azs),
            (row) => (row.submittedOn ? format(new Date(row.submittedOn), "dd MMM yy yyyy MMMM d") : ""),
            (row) => (row.verified?.date ? format(new Date(row.verified.date), "dd MMM yy yyyy MMMM d") : ""),
            (row) => row.surveyor?.name,
            (row) => row.surveyor?.id,
            (row) => row.surveyor?.phoneNumber,
            (row) => row.verified?.verifier,
            "engagementType",
            "base",
            "status",
            (row) => String((row as any).deployed ?? (row as any).matiDeployed ?? ""),
            (row) => String((row as any).plots ?? ""),
            (row) => String((row as any).area ?? ""),
            (row) => String((row as any).calArea ?? ""),
        ],
        customFilterHandlers: {
            farmer: (row, val) => {
                if (!val) return true;
                if (typeof val === "string") {
                    const lower = val.toLowerCase().trim();
                    return (
                        Boolean(row.farmer?.name?.toLowerCase().includes(lower)) ||
                        Boolean(row.farmer?.id?.toLowerCase().includes(lower)) ||
                        Boolean(row.farmer?.phoneNumber?.includes(lower))
                    );
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((v: string) => {
                        const lower = v.toLowerCase();
                        return (
                            row.farmer?.name?.toLowerCase() === lower ||
                            row.farmer?.name?.toLowerCase().includes(lower) ||
                            row.farmer?.id?.toLowerCase() === lower
                        );
                    });
                }
                return false;
            },
            surveyor: (row, val) => {
                if (!val) return true;
                if (typeof val === "string") {
                    const lower = val.toLowerCase().trim();
                    return (
                        Boolean(row.surveyor?.name?.toLowerCase().includes(lower)) ||
                        Boolean(row.surveyor?.id?.toLowerCase().includes(lower)) ||
                        Boolean(row.surveyor?.phoneNumber?.includes(lower))
                    );
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((v: string) => {
                        const lower = v.toLowerCase();
                        return (
                            row.surveyor?.name?.toLowerCase() === lower ||
                            row.surveyor?.name?.toLowerCase().includes(lower) ||
                            row.surveyor?.id?.toLowerCase() === lower
                        );
                    });
                }
                return false;
            },
            verifiedBy: (row, val) => {
                if (!val) return true;
                const verifier = row.verified?.verifier;
                if (!verifier) return false;
                if (typeof val === "string") {
                    return verifier.toLowerCase().includes(val.toLowerCase().trim());
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((v: string) => verifier.toLowerCase().includes(v.toLowerCase().trim()));
                }
                return false;
            },
            verifiedOn: (row, val) => {
                if (!val) return true;
                if (typeof val === "string") {
                    return matchesDateString(row.verified?.date, val);
                }
                const date = row.verified?.date;
                if (!date) return false;
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return false;
                if (Array.isArray(val) && val.length === 2) {
                    const [from, to] = val;
                    if (from && d < new Date(from)) return false;
                    if (to && d > new Date(to)) return false;
                    return true;
                }
                if (typeof val === "object") {
                    const { from, to } = val;
                    if (from && d < new Date(from)) return false;
                    if (to && d > new Date(to)) return false;
                    return true;
                }
                return true;
            },
            submittedOn: (row, val) => {
                if (!val) return true;
                if (typeof val === "string") {
                    return matchesDateString(row.submittedOn, val);
                }
                const date = row.submittedOn;
                if (!date) return false;
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return false;
                if (Array.isArray(val) && val.length === 2) {
                    const [from, to] = val;
                    if (from && d < new Date(from)) return false;
                    if (to && d > new Date(to)) return false;
                    return true;
                }
                if (typeof val === "object") {
                    const { from, to } = val;
                    if (from && d < new Date(from)) return false;
                    if (to && d > new Date(to)) return false;
                    return true;
                }
                return true;
            },
            azs: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                if (typeof val === "string") {
                    const lower = val.toLowerCase().trim();
                    return (
                        String(row.azs).toLowerCase().includes(lower) ||
                        `az ${row.azs}`.toLowerCase().includes(lower) ||
                        (row.azName ? row.azName.toLowerCase().includes(lower) : false)
                    );
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((v: any) => {
                        const strV = String(v).toLowerCase();
                        return (
                            strV.includes(`az ${row.azs}`) ||
                            strV.includes(String(row.azs)) ||
                            (row.azName ? strV.includes(row.azName.toLowerCase()) : false)
                        );
                    });
                }
                return row.azs === val;
            },
            azName: (row, val) => {
                if (!val) return true;
                if (typeof val === "string") {
                    return Boolean(row.azName?.toLowerCase().includes(val.toLowerCase().trim()));
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((v: string) => row.azName?.toLowerCase() === v.toLowerCase());
                }
                return false;
            },
            matiDeployed: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                const deployedVal = (row as any).deployed ?? (row as any).matiDeployed;
                if (deployedVal === undefined || deployedVal === null) return false;
                if (typeof val === "string" || typeof val === "number") {
                    const q = String(val).toLowerCase().trim();
                    if (!q) return true;
                    return String(deployedVal).toLowerCase().includes(q);
                }
                if (Array.isArray(val) && val.length === 2) {
                    const [min, max] = val;
                    if (min !== undefined && min !== null && deployedVal < min) return false;
                    if (max !== undefined && max !== null && deployedVal > max) return false;
                    return true;
                }
                if (typeof val === "object") {
                    const { min, max } = val;
                    if (min !== undefined && min !== null && deployedVal < min) return false;
                    if (max !== undefined && max !== null && deployedVal > max) return false;
                    return true;
                }
                return true;
            },
            deployed: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                const deployedVal = (row as any).deployed ?? (row as any).matiDeployed;
                if (deployedVal === undefined || deployedVal === null) return false;
                if (typeof val === "string" || typeof val === "number") {
                    const q = String(val).toLowerCase().trim();
                    if (!q) return true;
                    return String(deployedVal).toLowerCase().includes(q);
                }
                if (Array.isArray(val) && val.length === 2) {
                    const [min, max] = val;
                    if (min !== undefined && min !== null && deployedVal < min) return false;
                    if (max !== undefined && max !== null && deployedVal > max) return false;
                    return true;
                }
                if (typeof val === "object") {
                    const { min, max } = val;
                    if (min !== undefined && min !== null && deployedVal < min) return false;
                    if (max !== undefined && max !== null && deployedVal > max) return false;
                    return true;
                }
                return true;
            },
            plots: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                return String((row as any).plots ?? "").toLowerCase().includes(String(val).toLowerCase().trim());
            },
            area: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                return String((row as any).area ?? "").toLowerCase().includes(String(val).toLowerCase().trim());
            },
            calArea: (row, val) => {
                if (val === undefined || val === null || val === "") return true;
                return String((row as any).calArea ?? "").toLowerCase().includes(String(val).toLowerCase().trim());
            },
            status: (row, val) => {
                if (!val || val === "All") return true;
                if (typeof val === "string") {
                    const q = val.toLowerCase().trim();
                    if (q === "need correction" && row.status.toLowerCase() === "invalid") return true;
                    return row.status.toLowerCase().includes(q);
                }
                if (Array.isArray(val)) {
                    if (val.length === 0) return true;
                    return val.some((s: string) => {
                        if (s.toLowerCase() === "need correction" && row.status.toLowerCase() === "invalid") return true;
                        return s.toLowerCase() === row.status.toLowerCase();
                    });
                }
                return row.status.toLowerCase() === String(val).toLowerCase();
            },
        },
        calculateSummaryCounts: (fullDataset) => {
            const verified = fullDataset.filter((item) => item.status === "Verified").length;
            const pending = fullDataset.filter((item) => item.status === "Pending").length;
            const invalid = fullDataset.filter((item) => item.status === "Invalid").length;
            return { verified, pending, invalid };
        },
    };
}
