// PROTOTYPE-ONLY — the single swap point between the Task planning UI and its data.
// mati-demo: rows are joined from the orchestration store (localStorage) and served by the in-memory mock.
// Production: replace this file with an API-backed TableDataSource; the joined row shape is data/schema.ts.
"use client";

import * as React from "react";
import type { TableDataSource } from "@/lib/server-table";
import { useMockTableDataSource } from "@/mocks/server-table";
import { STATUS, type Farmer, type Task } from "@/lib/orchestration/engine";
import { JOB_STATUS, Job, JobStatus, Surveyor, Village, routeKm, stopLocation } from "@/lib/orchestration/jobs";
import { JobFilters, JobRecord } from "./schema";
import { createJobsTableConfig } from "./table-config";
import { jobsApiContract } from "./api-contract";

/** Tab and badge labels; the detail sheet uses the long form (JOB_STATUS_NAME: "Job created", "Job sheet closed"). */
export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
    [JOB_STATUS.created]: "Created",
    [JOB_STATUS.assigned]: "Assigned",
    [JOB_STATUS.accepted]: "Accepted",
    [JOB_STATUS.inProgress]: "In progress",
    [JOB_STATUS.closed]: "Closed",
};

export const baseOf = (surveyor: Surveyor | undefined, villages: Village[]) => villages.find((v) => v.id === surveyor?.baseVillageId)?.centre;

/** Join each job with its surveyor, the stops' farmers and the tasks' statuses (what a list API would return). */
export function buildJobRecords(jobs: Job[], tasks: Task[], farmers: Farmer[], surveyors: Surveyor[], villages: Village[]): JobRecord[] {
    const farmerById = new Map(farmers.map((f) => [f.id, f]));
    const surveyorById = new Map(surveyors.map((s) => [s.id, s]));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    return jobs.map((job) => {
        const surveyor = surveyorById.get(job.surveyorId);
        const locations = job.stops.map((s) => stopLocation(farmerById.get(s.farmerId), villages));
        const taskIds = job.stops.flatMap((s) => s.taskIds);
        const villageList = Array.from(new Set(job.stops.map((s) => farmerById.get(s.farmerId)?.village).filter((v): v is string => Boolean(v))));
        return {
            id: job.id,
            jobNo: job.jobNo,
            jobCode: `J${job.jobNo}`,
            date: job.date,
            status: job.status,
            surveyorId: job.surveyorId,
            surveyorName: surveyor?.name ?? "(removed surveyor)",
            stopCount: job.stops.length,
            taskCount: taskIds.length,
            doneCount: taskIds.filter((id) => taskById.get(id)?.status !== STATUS.planned).length,
            distanceKm: routeKm(locations, baseOf(surveyor, villages)),
            unlocatedCount: locations.filter((l) => !l).length,
            villages: villageList.join(", "),
            villageList,
            updatedAt: job.updatedAt,
            sortKey: `${job.date}|${String(job.jobNo).padStart(6, "0")}`,
            job,
        };
    });
}

export function useJobsDataSource(records: JobRecord[]): TableDataSource<JobRecord, JobFilters> {
    const config = React.useMemo(() => createJobsTableConfig(records), [records]);
    return useMockTableDataSource(config, jobsApiContract);
}
