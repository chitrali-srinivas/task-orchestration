// Product version and release notes, shown in the page footer (the version links to /layouts/release-notes).
// Add the new release at the top of RELEASE_NOTES and bump APP_VERSION with each release.

export const APP_VERSION = "1.2.4";

export interface Release {
    version: string;
    /** YYYY-MM-DD */
    date: string;
    added: string[];
    changed: string[];
}

export const RELEASE_NOTES: Release[] = [
    {
        version: APP_VERSION,
        date: "2026-11-11",
        added: [
            "The sidebar is grouped into Verification, Science, Admin and Super Admin, with Dashboard at the top.",
            "Farmers page: every farmer registered on the phone, where planning finds them (GPS point, plot centre or village centre), their tasks by status and their next visit.",
            "Masters - Users replaces Surveyors. Each user has a role (Surveyor, Verifier, Admin or Super Admin) and a home location picked on the map. A surveyor's day starts and ends at home.",
            "Masters - Drivers, and a page of its own for each master: Village, Users, Fleet, Drivers and Suppliers.",
            "Plans: jobs, the planner and the map workspace with road routes, including walking legs to stops a bike can't reach.",
        ],
        changed: [
            "Task planning is now called Plans. Old links still open it.",
            "Science (Samples, Carts, Tests, Shipments) and Dashboard are placeholders for now.",
        ],
    },
];
