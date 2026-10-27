// PORT-BOUND — one row of the Task planning table: a job joined with its surveyor, farmers and tasks.
// Flat fields (jobCode, surveyorName, villages, …) are what the table sorts, searches and filters on.
import type { Job, JobStatus } from "@/lib/orchestration/jobs";

export interface JobRecord {
    id: string;
    jobNo: number;
    /** "J12" */
    jobCode: string;
    /** YYYY-MM-DD, the visit day. */
    date: string;
    status: JobStatus;
    surveyorId: string;
    surveyorName: string;
    stopCount: number;
    taskCount: number;
    /** Tasks on the job that are no longer planned (collected, verified, …). */
    doneCount: number;
    /** Straight-line km from the surveyor's base village through the stops and back; undefined when no stop has a location. */
    distanceKm?: number;
    /** Stops without a location (left out of the distance). */
    unlocatedCount: number;
    /** The stops' villages in visiting order, e.g. "Rampur, Lakhanpur". */
    villages: string;
    villageList: string[];
    /** ISO timestamp */
    updatedAt: string;
    /** Default order: newest day first, then job number, as one sortable string ("2026-10-27|000012"). */
    sortKey: string;
    job: Job;
}

export interface DateRange {
    from?: Date;
    to?: Date;
}

export interface JobFilters {
    /** The status tab; undefined = All. */
    tabStatus?: string;
    date?: DateRange;
    /** Surveyor ids. */
    surveyorName?: string[];
    village?: string[];
}
