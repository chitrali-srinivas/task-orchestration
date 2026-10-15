import { AvailabilitySchedule, LocationScope } from "../types/survey-schema";

export interface OperationalBase {
    id: string;
    name: string;
    code: string;
    state: string;
}

export interface OperationalVillage {
    id: string;
    name: string;
    taluk: string;
    district: string;
    baseId: string;
}

export interface OperationalSurveyor {
    id: string;
    name: string;
    employeeId: string;
    phone: string;
    baseId: string;
}

export const AVAILABLE_BASES: OperationalBase[] = [
    { id: "base_rcr", name: "Raichur Central Base", code: "RCR-01", state: "Karnataka" },
    { id: "base_ydg", name: "Yadgir North Base", code: "YDG-02", state: "Karnataka" },
    { id: "base_klb", name: "Kalaburagi Base", code: "KLB-03", state: "Karnataka" },
    { id: "base_knl", name: "Kurnool Regional Base", code: "KNL-04", state: "Andhra Pradesh" },
];

export const AVAILABLE_VILLAGES: OperationalVillage[] = [
    { id: "vil_01", name: "Hunasagi", taluk: "Hunasagi", district: "Yadgir", baseId: "base_ydg" },
    { id: "vil_02", name: "Shorapur", taluk: "Shorapur", district: "Yadgir", baseId: "base_ydg" },
    { id: "vil_03", name: "Shahapur", taluk: "Shahapur", district: "Yadgir", baseId: "base_ydg" },
    { id: "vil_04", name: "Devadurga", taluk: "Devadurga", district: "Raichur", baseId: "base_rcr" },
    { id: "vil_05", name: "Manvi", taluk: "Manvi", district: "Raichur", baseId: "base_rcr" },
    { id: "vil_06", name: "Sindhanur", taluk: "Sindhanur", district: "Raichur", baseId: "base_rcr" },
    { id: "vil_07", name: "Afzalpur", taluk: "Afzalpur", district: "Kalaburagi", baseId: "base_klb" },
    { id: "vil_08", name: "Aland", taluk: "Aland", district: "Kalaburagi", baseId: "base_klb" },
    { id: "vil_09", name: "Adoni", taluk: "Adoni", district: "Kurnool", baseId: "base_knl" },
    { id: "vil_10", name: "Yemmiganur", taluk: "Yemmiganur", district: "Kurnool", baseId: "base_knl" },
];

export const AVAILABLE_SURVEYORS: OperationalSurveyor[] = [
    { id: "surv_01", name: "Prakash Hiremath", employeeId: "MATI-SRV-101", phone: "+91 9845012345", baseId: "base_rcr" },
    { id: "surv_02", name: "Sunita Kulkarni", employeeId: "MATI-SRV-102", phone: "+91 9741234567", baseId: "base_rcr" },
    { id: "surv_03", name: "Mohammed Irfan", employeeId: "MATI-SRV-103", phone: "+91 9900345678", baseId: "base_ydg" },
    { id: "surv_04", name: "Basavaraj Bommai", employeeId: "MATI-SRV-104", phone: "+91 9448456789", baseId: "base_klb" },
    { id: "surv_05", name: "Radha Krishna", employeeId: "MATI-SRV-105", phone: "+91 9880567890", baseId: "base_knl" },
];

export const AVAILABLE_TIMEZONES = [
    { value: "Asia/Kolkata", label: "IST (India Standard Time, UTC+05:30)" },
    { value: "UTC", label: "UTC (Coordinated Universal Time, UTC+00:00)" },
    { value: "Asia/Dubai", label: "GST (Gulf Standard Time, UTC+04:00)" },
    { value: "Asia/Singapore", label: "SGT (Singapore Standard Time, UTC+08:00)" },
];

/**
 * Derives current schedule status from timestamps
 */
export function getScheduleStatus(
    schedule: AvailabilitySchedule,
    referenceDate = new Date()
): "Upcoming" | "Active" | "Expired" | "Disabled" {
    if (schedule.status === "Disabled") return "Disabled";

    const start = new Date(schedule.startAt).getTime();
    const end = new Date(schedule.endAt).getTime();
    const now = referenceDate.getTime();

    if (now < start) return "Upcoming";
    if (now >= start && now <= end) return "Active";
    return "Expired";
}

/**
 * Checks for overlapping schedules targeting the same location audience
 */
export function checkScheduleOverlap(schedules: AvailabilitySchedule[]): {
    hasOverlap: boolean;
    overlappingScheduleIds: string[];
    warningMessage?: string;
} {
    const activeOrUpcoming = schedules.filter(
        (s) => s.status !== "Disabled" && getScheduleStatus(s) !== "Expired"
    );

    const overlappingSet = new Set<string>();

    for (let i = 0; i < activeOrUpcoming.length; i++) {
        for (let j = i + 1; j < activeOrUpcoming.length; j++) {
            const s1 = activeOrUpcoming[i];
            const s2 = activeOrUpcoming[j];

            const start1 = new Date(s1.startAt).getTime();
            const end1 = new Date(s1.endAt).getTime();
            const start2 = new Date(s2.startAt).getTime();
            const end2 = new Date(s2.endAt).getTime();

            // Check date overlap
            const dateOverlap = Math.max(start1, start2) <= Math.min(end1, end2);

            if (dateOverlap) {
                // Check audience overlap
                const audienceOverlap = doScopesOverlap(s1.scope, s2.scope);
                if (audienceOverlap) {
                    overlappingSet.add(s1.id);
                    overlappingSet.add(s2.id);
                }
            }
        }
    }

    const ids = Array.from(overlappingSet);
    return {
        hasOverlap: ids.length > 0,
        overlappingScheduleIds: ids,
        warningMessage:
            ids.length > 0
                ? "Warning: Multiple active/upcoming schedules overlap for the same target location audience."
                : undefined,
    };
}

function doScopesOverlap(scope1: LocationScope, scope2: LocationScope): boolean {
    if (scope1.allLocations || scope2.allLocations) return true;

    // Check shared bases
    if (scope1.baseIds && scope2.baseIds) {
        const sharedBase = scope1.baseIds.some((b) => scope2.baseIds?.includes(b));
        if (sharedBase) return true;
    }

    // Check shared villages
    if (scope1.villageIds && scope2.villageIds) {
        const sharedVillage = scope1.villageIds.some((v) => scope2.villageIds?.includes(v));
        if (sharedVillage) return true;
    }

    // Check shared surveyors
    if (scope1.surveyorIds && scope2.surveyorIds) {
        const sharedSurveyor = scope1.surveyorIds.some((s) => scope2.surveyorIds?.includes(s));
        if (sharedSurveyor) return true;
    }

    return false;
}

/**
 * Formats a date range into a concise human-readable string with explicit timezone
 */
export function formatScheduleDateRange(
    startAt: string,
    endAt: string,
    timezone = "Asia/Kolkata"
): string {
    try {
        const s = new Date(startAt);
        const e = new Date(endAt);

        const sStr = s.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const eStr = e.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const tzShort = timezone.includes("Kolkata") ? "IST" : timezone;
        return `${sStr} → ${eStr} (${tzShort})`;
    } catch {
        return `${startAt} → ${endAt}`;
    }
}
