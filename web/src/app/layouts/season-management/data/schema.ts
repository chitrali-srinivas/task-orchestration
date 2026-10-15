export type SeasonStatus = "Draft" | "Planned" | "Inprogress" | "Completed" | "Cancelled";

export type ActivityType = "Sampling" | "Deployment" | "Sowing" | "Engagement";

export type ActivityStatus = "Completed" | "Inprogress" | "Planned" | "Cancelled";

export interface SeasonActivity {
    id: string;
    activity: string;
    activityType: ActivityType;
    surveyId: string;
    activityStart: string; // YYYY-MM-DD or MM/DD/YYYY
    activityEnd: string;   // YYYY-MM-DD or MM/DD/YYYY
    hidden: number;        // 0 = visible, 1 = hidden
    status: ActivityStatus;
}

export interface SeasonRecord {
    id: string;            // e.g. "GPM_Kharif_AZ1_28"
    seasonName: string;    // e.g. "Kharif_GPM_2025"
    season?: string;       // e.g. "Kharif" | "Rabi" | "Zaid"
    baseName: string;      // e.g. "GPM_ANP"
    country: string;       // e.g. "India"
    azName: string;        // e.g. "Paddy ERW"
    azId: string;          // e.g. "AZ1 - paddy ERW"
    status: SeasonStatus;
    createdBy: string;     // e.g. "Aarav Sharma"
    createdAt: string;     // e.g. "07 FEB 25"
    updatedBy: string;     // e.g. "Aarav Sharma"
    updatedAt: string;     // e.g. "07 FEB 25"
    seasonStart: string;   // e.g. "2025-02-07" or "07 FEB 25"
    seasonEnd: string;     // e.g. "2026-02-07" or "07 FEB 25"
    activities: SeasonActivity[];
}

export const DEFAULT_ACTIVITY_TEMPLATES: { activity: string; activityType: ActivityType }[] = [
    { activity: "Pre-Sample", activityType: "Sampling" },
    { activity: "Deployment", activityType: "Deployment" },
    { activity: "Sowing", activityType: "Sowing" },
    { activity: "Engagement Phase 1", activityType: "Engagement" },
    { activity: "Engagement Control Phase 1", activityType: "Engagement" },
    { activity: "Engagement Phase 2", activityType: "Engagement" },
    { activity: "Engagement Control Phase 2", activityType: "Engagement" },
    { activity: "Engagement Phase 3", activityType: "Engagement" },
    { activity: "Engagement Control Phase 3", activityType: "Engagement" },
    { activity: "Engagement Phase 4", activityType: "Engagement" },
    { activity: "Engagement Control Phase 4", activityType: "Engagement" },
    { activity: "EOY Sample", activityType: "Sampling" },
    { activity: "Engagement EOY", activityType: "Engagement" },
    { activity: "EO2Y Sample", activityType: "Sampling" },
    { activity: "Engagement EO2Y", activityType: "Engagement" },
    { activity: "EO3Y Sample", activityType: "Sampling" },
    { activity: "Engagement EO3Y", activityType: "Engagement" },
    { activity: "EO4Y Sample", activityType: "Sampling" },
    { activity: "Engagement EO4Y", activityType: "Engagement" },
    { activity: "EO5Y Sample", activityType: "Sampling" },
    { activity: "Engagement EO5Y", activityType: "Engagement" },
];

/** Query filters sent by the Season Management table (sidebar fields + the status tab key `statusTab`). */
export type SeasonQueryFilters = import("../components/season-filter-sidebar").SeasonFilterValue & { statusTab?: string };
