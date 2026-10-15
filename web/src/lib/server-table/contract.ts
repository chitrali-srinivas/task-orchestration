// PORT-BOUND — what the production API can do for a table, written down next to the feature.
// The mock data source checks every query against this contract and reports anything the production
// API does not support as a "[C] backend requirement" (console + window.__MATI_BACKEND_REQUIREMENTS__).
// The prototype UX is kept; the requirement becomes visible instead of silently "working" in the mock.

export interface TableApiContract {
    /** Feature name, used in messages and to target `?mockError=<feature>`. */
    feature: string;
    /** Production list endpoint, or null when production has no endpoint for this feature yet. */
    endpoint: string | null;
    /** Where these facts were verified (read-only) in the production repository. */
    source: string;
    /** Pagination model of the production API. */
    pagination: "page" | "none";
    /** Server-side free-text search across the table. */
    search: boolean;
    /** Column ids with server-side text search. */
    columnSearch: string[];
    /** Field ids the production API can sort by. */
    sort: string[];
    /** Supported filter keys → the production request parameter(s) they map to. */
    filters: Record<string, string>;
    /** Extra notes per key (value semantics differ, parameter missing, mapping unconfirmed, …). */
    notes?: Record<string, string>;
}
