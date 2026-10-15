// PROTOTYPE-ONLY — in-memory mock "server" for server-driven tables (search, filters, sort, paging, counts).
import type { TableDataSource, TableQuery, TableResponse } from "@/lib/server-table/types";
import { TableConfig } from "./types";
import { format } from "date-fns";

/**
 * Helper to extract nested property value by dot notation path (e.g. "farmer.name")
 */
function getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
}

/**
 * Normalizes a string for searching: trims and collapses internal repeated whitespace
 */
export function normalizeSearchString(text: string): string {
    if (!text) return "";
    return text.trim().replace(/\s+/g, " ");
}

/**
 * Helper to parse dates formatted as Date instances, ISO strings, or custom strings like "07 FEB 25"
 */
export function parseDateValue(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const dateObj = new Date(val);
    if (!isNaN(dateObj.getTime())) return dateObj;

    if (typeof val === "string") {
        const parts = val.trim().split(/\s+/);
        if (parts.length === 3) {
            const months: Record<string, number> = {
                JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
                JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
            };
            const day = parseInt(parts[0], 10);
            const month = months[parts[1].toUpperCase()];
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                return new Date(year, month, day);
            }
        }
    }
    return null;
}

/**
 * Tests if any value (string, number, date, object) matches a normalized query string
 */
function valueMatchesQuery(val: any, normalizedQuery: string): boolean {
    if (val === undefined || val === null) return false;
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return false;
        try {
            const formatted1 = format(val, "dd MMM yy").toLowerCase();
            const formatted2 = format(val, "yyyy-MM-dd").toLowerCase();
            const formatted3 = format(val, "MMMM").toLowerCase();
            const formatted4 = format(val, "MMM").toLowerCase();
            const formatted5 = format(val, "d MMMM yyyy").toLowerCase();
            return (
                formatted1.includes(normalizedQuery) ||
                formatted2.includes(normalizedQuery) ||
                formatted3.includes(normalizedQuery) ||
                formatted4.includes(normalizedQuery) ||
                formatted5.includes(normalizedQuery)
            );
        } catch {
            return false;
        }
    }
    if (typeof val === "object") {
        if (val.name && String(val.name).toLowerCase().includes(normalizedQuery)) return true;
        if (val.id && String(val.id).toLowerCase().includes(normalizedQuery)) return true;
        if (val.phoneNumber && String(val.phoneNumber).includes(normalizedQuery)) return true;
        if (val.verifier && String(val.verifier).toLowerCase().includes(normalizedQuery)) return true;
        if (val.date && valueMatchesQuery(val.date, normalizedQuery)) return true;
    }
    return String(val).toLowerCase().includes(normalizedQuery);
}

/**
 * Generic mock server data service that simulates server-side filtering, searching,
 * sorting, and pagination over an immutable master dataset.
 */
export class MockTableService<TData, TFilters = Record<string, any>> implements TableDataSource<TData, TFilters> {
    private config: TableConfig<TData, TFilters>;

    constructor(config: TableConfig<TData, TFilters>) {
        this.config = config;
    }

    public updateDataset(newDataset: TData[]) {
        this.config.dataset = newDataset;
    }

    public async fetch(
        query: TableQuery<TFilters>,
        signal?: AbortSignal
    ): Promise<TableResponse<TData>> {
        const minLatency = this.config.minLatencyMs ?? 400;
        const maxLatency = this.config.maxLatencyMs ?? 700;
        const delayMs = Math.floor(Math.random() * (maxLatency - minLatency + 1)) + minLatency;

        // Simulate network latency with cancellation check
        await new Promise((resolve, reject) => {
            if (signal?.aborted) {
                return reject(new DOMException("Aborted", "AbortError"));
            }
            const timer = setTimeout(() => {
                if (signal?.aborted) {
                    reject(new DOMException("Aborted", "AbortError"));
                } else {
                    resolve(true);
                }
            }, delayMs);

            if (signal) {
                signal.addEventListener(
                    "abort",
                    () => {
                        clearTimeout(timer);
                        reject(new DOMException("Aborted", "AbortError"));
                    },
                    { once: true }
                );
            }
        });

        // 1. Process search on full dataset
        const rawSearch = query.search || "";
        const normalizedSearch = normalizeSearchString(rawSearch).toLowerCase();
        const searchableFields = this.config.searchableFields || [];

        let workingData = [...this.config.dataset];

        // Global search across configured fields
        if (normalizedSearch.length > 0 && searchableFields.length > 0) {
            workingData = workingData.filter((row) => {
                return searchableFields.some((field) => {
                    let val: any;
                    if (typeof field === "function") {
                        val = field(row);
                    } else if (typeof field === "string") {
                        val = getNestedValue(row, field);
                    } else {
                        val = (row as any)[field];
                    }

                    return valueMatchesQuery(val, normalizedSearch);
                });
            });
        }

        // 2. In-column string searches (from column header inline search inputs)
        if (query.columnSearches && Object.keys(query.columnSearches).length > 0) {
            for (const [colId, searchStr] of Object.entries(query.columnSearches)) {
                const normalizedColSearch = normalizeSearchString(searchStr).toLowerCase();
                if (!normalizedColSearch) continue;

                workingData = workingData.filter((row) => {
                    const customHandler = this.config.customFilterHandlers?.[colId];
                    if (customHandler) {
                        return customHandler(row, searchStr);
                    }

                    let val = getNestedValue(row, colId);
                    if (val === undefined || val === null) {
                        val = (row as any)[colId];
                    }
                    return valueMatchesQuery(val, normalizedColSearch);
                });
            }
        }

        // 3. Structured Filters (Facet sidebars, Tab statuses, Ranges)
        const filters = query.filters || ({} as TFilters);
        for (const [key, filterValue] of Object.entries(filters as Record<string, any>)) {
            if (filterValue === undefined || filterValue === null || filterValue === "" || filterValue === "All") {
                continue;
            }

            // Custom handler check
            const customHandler = this.config.customFilterHandlers?.[key];
            if (customHandler) {
                workingData = workingData.filter((row) => customHandler(row, filterValue));
                continue;
            }

            // Array multi-select filter (OR logic within array)
            if (Array.isArray(filterValue)) {
                if (filterValue.length === 0) continue;
                workingData = workingData.filter((row) => {
                    let cellVal = getNestedValue(row, key);
                    if (cellVal === undefined || cellVal === null) {
                        cellVal = (row as any)[key];
                    }
                    if (cellVal === undefined || cellVal === null) return false;

                    const cellStr = String(cellVal).toLowerCase();
                    return filterValue.some((opt) => {
                        const optStr = String(opt).toLowerCase();
                        return cellStr === optStr || cellStr.includes(optStr);
                    });
                });
                continue;
            }

            // Date Range object ({ from, to })
            if (typeof filterValue === "object" && ("from" in filterValue || "to" in filterValue)) {
                const { from, to } = filterValue;
                if (!from && !to) continue;

                const fromDate = from ? parseDateValue(from) : null;
                const toDate = to ? parseDateValue(to) : null;

                workingData = workingData.filter((row) => {
                    let cellVal = getNestedValue(row, key);
                    if (cellVal === undefined || cellVal === null) {
                        cellVal = (row as any)[key];
                    }
                    if (!cellVal) return false;

                    const cellDate = parseDateValue(cellVal);
                    if (!cellDate) return false;

                    if (fromDate && cellDate < fromDate) return false;
                    if (toDate && cellDate > toDate) return false;
                    return true;
                });
                continue;
            }

            // Number Range object ({ min, max })
            if (typeof filterValue === "object" && ("min" in filterValue || "max" in filterValue)) {
                const { min, max } = filterValue;
                if (min === undefined && max === undefined) continue;

                workingData = workingData.filter((row) => {
                    let cellVal = getNestedValue(row, key);
                    if (cellVal === undefined || cellVal === null) {
                        cellVal = (row as any)[key];
                    }
                    if (cellVal === undefined || cellVal === null) return false;

                    const num = typeof cellVal === "number" ? cellVal : parseFloat(String(cellVal).replace(/[^0-9.-]+/g, ""));
                    if (isNaN(num)) return false;

                    if (min !== undefined && min !== null && num < min) return false;
                    if (max !== undefined && max !== null && num > max) return false;
                    return true;
                });
                continue;
            }

            // Primitive / Single Value Match (e.g. tab status "Verified", "Draft", etc.)
            workingData = workingData.filter((row) => {
                let cellVal = getNestedValue(row, key);
                if (cellVal === undefined || cellVal === null) {
                    cellVal = (row as any)[key];
                }
                if (cellVal === undefined || cellVal === null) return false;

                return String(cellVal).toLowerCase() === String(filterValue).toLowerCase();
            });
        }

        // 4. Server-side Sorting on full filtered dataset
        const sort = query.sort || this.config.defaultSort || null;
        if (sort && sort.field) {
            const { field, direction } = sort;
            const multiplier = direction === "desc" ? -1 : 1;

            workingData.sort((a, b) => {
                let valA = getNestedValue(a, field);
                if (valA === undefined || valA === null) valA = (a as any)[field];

                let valB = getNestedValue(b, field);
                if (valB === undefined || valB === null) valB = (b as any)[field];

                if (valA === valB) return 0;
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;

                // Date comparison
                const dateA = parseDateValue(valA);
                const dateB = parseDateValue(valB);
                if (dateA && dateB) {
                    return (dateA.getTime() - dateB.getTime()) * multiplier;
                }

                // Number comparison
                if (typeof valA === "number" && typeof valB === "number") {
                    return (valA - valB) * multiplier;
                }

                // String comparison
                return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
            });
        }

        // 5. Total counts & summary calculations
        const totalCount = workingData.length;
        const page = Math.max(1, query.page || 1);
        const pageSize = Math.max(1, query.pageSize || this.config.defaultPageSize || 20);
        const pageCount = Math.ceil(totalCount / pageSize) || 1;

        // 6. Pagination Slicing
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const rows = workingData.slice(startIndex, endIndex);

        // Optional summary counts (e.g. for tabs)
        let summaryCounts: Record<string, number> | undefined;
        if (this.config.calculateSummaryCounts) {
            summaryCounts = this.config.calculateSummaryCounts(this.config.dataset, query.filters);
        }

        return {
            rows,
            totalCount,
            page,
            pageSize,
            pageCount,
            hasNextPage: page < pageCount,
            hasPreviousPage: page > 1,
            summaryCounts,
        };
    }
}
