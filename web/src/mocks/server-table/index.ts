// PROTOTYPE-ONLY — mock data sources for server-driven tables. Never imported by port-bound code;
// each feature wires its mock in data/data-source.ts (the one file replaced at production transfer).
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table/types";
import type { TableApiContract } from "@/lib/server-table/contract";
import { MockTableService } from "./mock-table-service";
import { withApiContract } from "./contract-check";
import type { TableConfig } from "./types";

export * from "./types";
export * from "./mock-table-service";
export * from "./contract-check";

/**
 * In-memory TableDataSource for a mock TableConfig. Recreated when `config` changes, and kept in sync
 * with `config.dataset` so prototype CRUD (e.g. saving a season) is reflected in the next fetch.
 * When a production `contract` is given, every query is checked against it (see contract-check.ts).
 */
export function useMockTableDataSource<TData, TFilters = Record<string, unknown>>(
    config: TableConfig<TData, TFilters>,
    contract?: TableApiContract
): TableDataSource<TData, TFilters> {
    const service = React.useMemo(() => new MockTableService<TData, TFilters>(config), [config]);

    React.useEffect(() => {
        service.updateDataset(config.dataset);
    }, [config.dataset, service]);

    return React.useMemo(() => (contract ? withApiContract(service, contract) : service), [service, contract]);
}
