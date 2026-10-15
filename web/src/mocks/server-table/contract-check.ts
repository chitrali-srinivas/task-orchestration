// PROTOTYPE-ONLY — checks mock table queries against the feature's production API contract.
//
// Default: the prototype keeps working exactly as designed; every parameter the production API does not
// support is reported once as a "[C] backend requirement" (console.warn + window.__MATI_BACKEND_REQUIREMENTS__).
//
// Opt-in URL flags (no effect unless present):
//   ?mockError=1 | ?mockError=<feature>   → the data source fails, showing the table's real error/retry state.
//   ?mockStrict=1                         → queries using unsupported parameters fail, previewing what the
//                                           production API supports today.

import type { TableDataSource, TableQuery } from "@/lib/server-table/types";
import type { TableApiContract } from "@/lib/server-table/contract";

type RequirementRegistry = Record<string, string[]>;
const registryHost = globalThis as typeof globalThis & { __MATI_BACKEND_REQUIREMENTS__?: RequirementRegistry };

function isActive(value: unknown): boolean {
    if (value === undefined || value === null || value === "" || value === "All") return false;
    if (Array.isArray(value)) return value.some((v) => v !== undefined && v !== null && v !== "");
    if (value instanceof Date) return true;
    if (typeof value === "object") {
        const o = value as Record<string, unknown>;
        if ("from" in o || "to" in o) return Boolean(o.from || o.to);
        if ("min" in o || "max" in o) return o.min !== undefined || o.max !== undefined;
        return Object.keys(o).length > 0;
    }
    return true;
}

/** Human-readable list of the query parameters the production API cannot serve. */
export function findUnsupported(query: TableQuery<unknown>, contract: TableApiContract): string[] {
    const out: string[] = [];
    if (contract.endpoint === null) out.push("list endpoint (no production API for this feature)");
    if (query.search?.trim() && !contract.search) out.push("global search");
    for (const [column, value] of Object.entries(query.columnSearches ?? {})) {
        if (value?.trim() && !contract.columnSearch.includes(column)) out.push(`column search on "${column}"`);
    }
    if (query.sort && !contract.sort.includes(query.sort.field)) out.push(`sort by "${query.sort.field}"`);
    for (const [key, value] of Object.entries((query.filters ?? {}) as Record<string, unknown>)) {
        if (isActive(value) && !(key in contract.filters)) out.push(`filter "${key}"`);
    }
    return out;
}

function report(contract: TableApiContract, unsupported: string[]) {
    const registry = (registryHost.__MATI_BACKEND_REQUIREMENTS__ ??= {});
    const seen = (registry[contract.feature] ??= []);
    for (const requirement of unsupported) {
        if (seen.includes(requirement)) continue;
        seen.push(requirement);
        const key = requirement.startsWith("sort by") ? "sort"
            : requirement === "global search" ? "search"
            : requirement.startsWith("list endpoint") ? "endpoint"
            : requirement.match(/"([^"]+)"/)?.[1];
        const note = key && contract.notes?.[key] ? ` ${contract.notes[key]}` : "";
        console.warn(
            `[mock-api] [C] Backend requirement — ${contract.feature}: ${requirement} is not supported by the production API ` +
            `(${contract.endpoint ?? "no endpoint"}).${note} The prototype UX is kept; the API must support this before the feature ships.`
        );
    }
}

function readFlags(): { error: string | null; strict: boolean } {
    if (typeof window === "undefined") return { error: null, strict: false };
    const params = new URLSearchParams(window.location.search);
    return { error: params.get("mockError"), strict: params.get("mockStrict") === "1" };
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const onAbort = () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); };
        const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
        if (signal?.aborted) onAbort(); else signal?.addEventListener("abort", onAbort, { once: true });
    });
}

export function withApiContract<TData, TFilters>(
    source: TableDataSource<TData, TFilters>,
    contract: TableApiContract
): TableDataSource<TData, TFilters> {
    return {
        async fetch(query, signal) {
            const unsupported = findUnsupported(query as TableQuery<unknown>, contract);
            report(contract, unsupported);

            const flags = readFlags();
            if (flags.error && (flags.error === "1" || flags.error === "true" || flags.error === contract.feature)) {
                await delay(400, signal);
                throw new Error(`Simulated API error for "${contract.feature}" (remove ?mockError from the URL to restore data).`);
            }
            if (flags.strict && unsupported.length > 0) {
                await delay(400, signal);
                throw new Error(`Not supported by the production API yet: ${unsupported.join("; ")}.`);
            }
            return source.fetch(query, signal);
        },
    };
}
