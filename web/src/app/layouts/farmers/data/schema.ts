// PORT-BOUND — one row of the Farmers table: a farmer registered on the phone, joined with their tasks and open job.
// Flat fields (name, village, locationSource, …) are what the table sorts, searches and filters on.
import type { Farmer, LatLng } from "@/lib/orchestration/engine";
import type { TaskRecord } from "@/app/layouts/tasks/data/schema";

/** Where planning finds the farmer: the registration GPS point, the plot boundary's centre, the village centre, or nowhere. */
export type FarmerLocationSource = "gps" | "plot" | "village" | "none";

export interface FarmerRecord {
    id: string;
    name: string;
    village: string;
    locationSource: FarmerLocationSource;
    /** "GPS point", "Plot centre", "Village centre", "No location". */
    locationLabel: string;
    location?: LatLng;
    /** YYYY-MM-DD, the day the farmer was registered. */
    registeredOn: string;
    /** ISO timestamp, for sorting. */
    registeredAt: string;
    taskCount: number;
    /** Tasks by status ("planned", "collected", "verified", "expired", "cancelled", custom statuses). */
    statusCounts: Record<string, number>;
    planned: number;
    collected: number;
    verified: number;
    /** The farmer's next visit: the open job holding any of their tasks ("J4", its day). */
    nextJobCode?: string;
    nextVisit?: string;
    /** The farmer's tasks as the Tasks table shows them, oldest first. */
    tasks: TaskRecord[];
    farmer: Farmer;
}

export interface DateRange {
    from?: Date;
    to?: Date;
}

export interface FarmerFilters {
    /** The location tab; undefined = All. */
    tabLocation?: FarmerLocationSource;
    village?: string[];
    locationSource?: FarmerLocationSource[];
    registeredOn?: DateRange;
    nextVisit?: DateRange;
}
