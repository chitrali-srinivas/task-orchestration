// PORT-BOUND — one row of the Tasks table: a task joined with its farmer, survey template and parent task.
// Flat fields (taskCode, surveyName, farmerName, …) are what the table sorts, searches and filters on.
import type { Task } from "@/lib/orchestration/engine";
import type { JobStatus } from "@/lib/orchestration/jobs";

export interface TaskRecord {
    id: string;
    taskNo: number;
    /** "T12", as shown on the phone. */
    taskCode: string;
    status: string;
    surveyId: string;
    surveyName: string;
    surveyVersion?: number;
    workflowName: string;
    farmerId: string;
    farmerName: string;
    village: string;
    /** YYYY-MM-DD */
    plannedStart: string;
    /** YYYY-MM-DD; empty = indefinite. */
    plannedEnd?: string;
    /** "Registration" or "T3 · Collected" (the parent task and the status that created this one). */
    createdFrom: string;
    parentTaskId?: string;
    /** ISO timestamp */
    updatedAt: string;
    statusComment?: string;
    /**
     * From the job the task is on (assignment is not a task status): its open job, or the closed job that did it.
     * A task released by a closed job (still planned) has none of these, only `jobNote`.
     */
    surveyorId?: string;
    assignedTo?: string;
    /** YYYY-MM-DD, the job's day. */
    visitDate?: string;
    jobId?: string;
    /** "J12" */
    jobCode?: string;
    jobStatus?: JobStatus;
    /** Stops can still change (the surveyor hasn't accepted the job). */
    jobEditable?: boolean;
    /** 1-based stop on the job, and the job's number of stops. */
    stopNo?: number;
    stopCount?: number;
    /** Why a closed job left this task undone ("Not done on J12: farmer away"). */
    jobNote?: string;
    /**
     * Default order of the table: status level (lifecycle order, pending first), then oldest planned start, then task
     * number, as one sortable string ("00|2026-09-20|000003").
     */
    queueKey: string;
    task: Task;
}

export interface DateRange {
    from?: Date;
    to?: Date;
}

export interface TaskFilters {
    /** The status tab; undefined = All. */
    tabStatus?: string;
    surveyName?: string[];
    farmerName?: string[];
    village?: string[];
    /** "registration" | "follow-up" */
    createdFrom?: string[];
    plannedStart?: DateRange;
    plannedEnd?: DateRange;
    /** Surveyor ids; "unassigned" = not on a published route. */
    assignedTo?: string[];
    visitDate?: DateRange;
}
