// PROTOTYPE-ONLY — the single swap point between the Farmers UI and its data.
// mati-demo: rows are joined from the orchestration store (localStorage) and served by the in-memory mock.
// Production: replace this file with an API-backed TableDataSource; the joined row shape is data/schema.ts.
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import { STATUS, type Farmer } from "@/lib/orchestration/engine";
import { Village, stopLocation } from "@/lib/orchestration/jobs";
import type { TaskRecord } from "@/app/layouts/tasks/data/schema";
import { FarmerFilters, FarmerLocationSource, FarmerRecord } from "./schema";
import { createFarmersTableConfig } from "./table-config";
import { farmersApiContract } from "./api-contract";

export const LOCATION_LABEL: Record<FarmerLocationSource, string> = {
    gps: "GPS point",
    plot: "Plot centre",
    village: "Village centre",
    none: "No location",
};
export const LOCATION_SOURCES: FarmerLocationSource[] = ["gps", "plot", "village", "none"];

/** Join each farmer with their tasks (as the Tasks table builds them) and the open job of their next visit. */
export function buildFarmerRecords(farmers: Farmer[], taskRecords: TaskRecord[], villages: Village[]): FarmerRecord[] {
    const tasksByFarmer = new Map<string, TaskRecord[]>();
    taskRecords.forEach((t) => tasksByFarmer.set(t.farmerId, [...(tasksByFarmer.get(t.farmerId) ?? []), t]));
    return farmers.map((f) => {
        const tasks = (tasksByFarmer.get(f.id) ?? []).sort((a, b) => a.taskNo - b.taskNo);
        const statusCounts: Record<string, number> = {};
        tasks.forEach((t) => (statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1));
        const located = stopLocation(f, villages);
        const source: FarmerLocationSource = located?.source ?? "none";
        // Next visit: the earliest open job holding one of the farmer's planned tasks.
        const next = tasks
            .filter((t) => t.status === STATUS.planned && t.visitDate && t.jobStatus !== "closed")
            .sort((a, b) => (a.visitDate! < b.visitDate! ? -1 : 1))[0];
        return {
            id: f.id,
            name: f.name || "(unnamed farmer)",
            village: f.village || "",
            locationSource: source,
            locationLabel: LOCATION_LABEL[source],
            location: located ? { lat: located.lat, lng: located.lng } : undefined,
            registeredOn: f.createdAt.slice(0, 10),
            registeredAt: f.createdAt,
            taskCount: tasks.length,
            statusCounts,
            planned: statusCounts[STATUS.planned] ?? 0,
            collected: statusCounts[STATUS.collected] ?? 0,
            verified: statusCounts[STATUS.verified] ?? 0,
            nextJobCode: next?.jobCode,
            nextVisit: next?.visitDate,
            tasks,
            farmer: f,
        };
    });
}

export function useFarmersDataSource(records: FarmerRecord[]): TableDataSource<FarmerRecord, FarmerFilters> {
    const config = React.useMemo(() => createFarmersTableConfig(records), [records]);
    return useMockTableDataSource(config, farmersApiContract);
}
