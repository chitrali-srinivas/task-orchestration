// PROTOTYPE-ONLY — the single swap point between the Season Management UI and its data.
// mati-demo: in-memory mock, re-created whenever the page's local `seasons` array changes (prototype CRUD).
// Production: replace with an API-backed TableDataSource; saving a season becomes an API mutation + refetch.
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import { initialSeasonData } from "./mock-data";
import { SeasonRecord, SeasonQueryFilters } from "./schema";
import { createSeasonTableConfig } from "./table-config";
import { seasonApiContract } from "./api-contract";

/** Seed rows for the prototype's local create/edit flow. */
export const initialSeasons: SeasonRecord[] = initialSeasonData;

export function useSeasonDataSource(seasons: SeasonRecord[]): TableDataSource<SeasonRecord, SeasonQueryFilters> {
    const config = React.useMemo(() => createSeasonTableConfig(seasons), [seasons]);
    return useMockTableDataSource(config, seasonApiContract);
}
