/**
 * Master Data Registry
 *
 * The masters are defined here (Villages, Users, Fleet, Drivers, Suppliers). Their records are NOT
 * hard-coded: they are entered on the Masters pages (/layouts/masters/<id>, one per master in the sidebar) and kept
 * in localStorage under `mati.masters`, so whatever is added there is what the survey builder's master-data picker,
 * the phone preview and planning show.
 */

export type MasterRecord = Record<string, any> & { id: string };

export interface MasterFieldDefinition {
    key: string;
    label: string;
    isSearchable?: boolean;
    isSecondary?: boolean;
    /** How the Masters page edits this field. Default: free text. */
    editor?:
        | { kind: "text"; placeholder?: string }
        | { kind: "select"; options: string[] }
        /** Pick a record from another master; copies that record's display value here and its id into `idKey`. */
        | { kind: "ref"; setId: string; idKey: string }
        /** A point picked on a map (or typed), kept as two numbers in `latKey` and `lngKey`. */
        | { kind: "location"; latKey: string; lngKey: string };
    /** Value a new record starts with. */
    defaultValue?: string;
    /** Only asked when another field has this value (e.g. visits per day only for surveyors). */
    showWhen?: { key: string; value: string };
    /** Must be filled in when another field has this value (e.g. a surveyor's home, where planning starts their day). */
    requiredWhen?: { key: string; value: string };
}

export interface MasterSetDefinition {
    id: string;
    name: string;
    /** One record, for "Add village" / "Edit user". */
    itemName: string;
    description: string;
    category: string;
    displayFieldKey: string;
    fields: MasterFieldDefinition[];
    sampleRecords: MasterRecord[];
}

export const MASTERS_STORAGE_KEY = "mati.masters";

export const USER_ROLES = ["Surveyor", "Verifier", "Admin", "Super Admin"] as const;
export type UserRoleName = (typeof USER_ROLES)[number];
const SURVEYOR_ONLY = { key: "role", value: "Surveyor" };

/** Static definitions (no records), in sidebar order. Records are merged in by getMasterSets(). */
export const MASTER_DEFINITIONS: Omit<MasterSetDefinition, "sampleRecords">[] = [
    {
        id: "villages",
        name: "Villages",
        itemName: "village",
        description: "Villages with their centre point and radius (production's village_list fields). A farmer without a GPS point is visited at their village centre.",
        category: "Geography",
        displayFieldKey: "villageName",
        fields: [
            { key: "villageName", label: "Village name", isSearchable: true },
            { key: "centre", label: "Centre", editor: { kind: "location", latKey: "lat", lngKey: "lng" } },
            { key: "lat", label: "Latitude", isSecondary: true },
            { key: "lng", label: "Longitude", isSecondary: true },
            { key: "radiusKm", label: "Radius (km)", editor: { kind: "text", placeholder: "2" } },
        ],
    },
    {
        id: "users",
        name: "Users",
        itemName: "user",
        description: "Everyone who works in the system, one role each. Surveyors get jobs: their day starts and ends at home when it's set, otherwise at their base village; a day's job holds at most \"Max visits per day\" farmer visits (8 when empty).",
        category: "People",
        displayFieldKey: "name",
        fields: [
            { key: "name", label: "Name", isSearchable: true },
            { key: "phone", label: "Phone", isSearchable: true, isSecondary: true },
            { key: "role", label: "Role", isSearchable: true, isSecondary: true, defaultValue: "Surveyor", editor: { kind: "select", options: [...USER_ROLES] } },
            { key: "home", label: "Home location", editor: { kind: "location", latKey: "homeLat", lngKey: "homeLng" }, requiredWhen: SURVEYOR_ONLY },
            { key: "homeLat", label: "Home latitude" },
            { key: "homeLng", label: "Home longitude" },
            { key: "baseVillage", label: "Base village", isSecondary: true, editor: { kind: "ref", setId: "villages", idKey: "baseVillageId" }, showWhen: SURVEYOR_ONLY },
            { key: "baseVillageId", label: "Base village id" },
            { key: "maxVisitsPerDay", label: "Max visits per day", editor: { kind: "text", placeholder: "8" }, showWhen: SURVEYOR_ONLY },
            { key: "active", label: "Active", defaultValue: "Yes", editor: { kind: "select", options: ["Yes", "No"] } },
        ],
    },
    {
        id: "fleet",
        name: "Fleet",
        itemName: "vehicle",
        description: "Vehicles (JCB / trailer / truck) and the supplier they belong to.",
        category: "Logistics",
        displayFieldKey: "vehicleNumber",
        fields: [
            { key: "vehicleNumber", label: "Vehicle number", isSearchable: true },
            { key: "vehicleType", label: "Vehicle type", isSearchable: true, isSecondary: true, editor: { kind: "select", options: ["JCB", "Trailer", "Truck"] } },
            { key: "supplierName", label: "Supplier name", isSearchable: true, isSecondary: true, editor: { kind: "ref", setId: "suppliers", idKey: "supplierId" } },
            { key: "supplierId", label: "Supplier id" },
        ],
    },
    {
        id: "drivers",
        name: "Drivers",
        itemName: "driver",
        description: "Drivers of the fleet's vehicles, with their licence and the supplier they work for.",
        category: "Logistics",
        displayFieldKey: "driverName",
        fields: [
            { key: "driverName", label: "Driver name", isSearchable: true },
            { key: "phone", label: "Phone", isSearchable: true, isSecondary: true },
            { key: "licenceNumber", label: "Licence number", isSearchable: true },
            { key: "supplierName", label: "Supplier", isSearchable: true, isSecondary: true, editor: { kind: "ref", setId: "suppliers", idKey: "supplierId" } },
            { key: "supplierId", label: "Supplier id" },
            { key: "vehicleNumber", label: "Vehicle", isSearchable: true, editor: { kind: "ref", setId: "fleet", idKey: "vehicleId" } },
            { key: "vehicleId", label: "Vehicle id" },
            { key: "active", label: "Active", defaultValue: "Yes", editor: { kind: "select", options: ["Yes", "No"] } },
        ],
    },
    {
        id: "suppliers",
        name: "Suppliers",
        itemName: "supplier",
        description: "Suppliers with address, location and point of contact.",
        category: "Supply",
        displayFieldKey: "supplierName",
        fields: [
            { key: "supplierName", label: "Supplier name", isSearchable: true },
            { key: "address", label: "Address", isSecondary: true },
            { key: "location", label: "Location", isSearchable: true, isSecondary: true },
            { key: "pocName", label: "POC name", isSearchable: true, isSecondary: true },
            { key: "email", label: "Email" },
            { key: "contactNumber", label: "Contact number", isSearchable: true },
        ],
    },
];

/** Keys a field's editor fills in by itself (a ref's id, a location's numbers); not shown or typed separately. */
export function derivedKeys(fields: MasterFieldDefinition[]): string[] {
    return fields.flatMap((f) =>
        f.editor?.kind === "ref" ? [f.editor.idKey] : f.editor?.kind === "location" ? [f.editor.latKey, f.editor.lngKey] : []
    );
}

/**
 * Surveyors were their own master before Users; their records become Surveyor users (same ids, so jobs keep their
 * surveyor). Runs once, the first time the store is read without a users list.
 */
export function migrateMasters(store: MastersStore): MastersStore | undefined {
    const { surveyors, ...rest } = store;
    if (!surveyors || store.users) return undefined;
    return {
        ...rest,
        users: surveyors.map(({ surveyorName, ...r }) => ({ ...r, name: surveyorName ?? "", role: "Surveyor" })),
    };
}

/** Kept for backwards compatibility: definitions with whatever records are stored right now. */
export const MASTER_SETS: MasterSetDefinition[] = MASTER_DEFINITIONS.map((d) => ({ ...d, sampleRecords: [] }));

type MastersStore = Record<string, MasterRecord[]>;

function readStore(): MastersStore {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(MASTERS_STORAGE_KEY);
        const store = raw ? (JSON.parse(raw) as MastersStore) : {};
        const migrated = migrateMasters(store);
        if (migrated) writeStore(migrated);
        return migrated ?? store;
    } catch {
        return {};
    }
}

function writeStore(store: MastersStore) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(MASTERS_STORAGE_KEY, JSON.stringify(store));
    } catch {
        /* ignore quota / private mode */
    }
}

/** Records entered on the Masters page for one master. */
export function loadMasterRecords(setId: string): MasterRecord[] {
    return readStore()[setId] || [];
}

export function saveMasterRecords(setId: string, records: MasterRecord[]) {
    writeStore({ ...readStore(), [setId]: records });
}

/**
 * Retrieves all registered master datasets, with their current records.
 */
export function getMasterSets(): MasterSetDefinition[] {
    const store = readStore();
    return MASTER_DEFINITIONS.map((d) => ({ ...d, sampleRecords: store[d.id] || [] }));
}

/**
 * Retrieves a single master dataset definition by ID
 */
export function getMasterSetById(id?: string): MasterSetDefinition | undefined {
    if (!id) return undefined;
    const def = MASTER_DEFINITIONS.find((m) => m.id === id);
    return def ? { ...def, sampleRecords: loadMasterRecords(id) } : undefined;
}

/**
 * Searches records within a master dataset
 */
export function searchMasterRecords(masterSetId: string, query: string): MasterRecord[] {
    const master = getMasterSetById(masterSetId);
    if (!master) return [];

    if (!query || query.trim() === "") {
        return master.sampleRecords;
    }

    const q = query.toLowerCase().trim();
    const searchableFields = master.fields.filter((f) => f.isSearchable).map((f) => f.key);

    return master.sampleRecords.filter((rec) => {
        return searchableFields.some((key) => {
            const val = rec[key];
            return val !== undefined && String(val).toLowerCase().includes(q);
        });
    });
}
