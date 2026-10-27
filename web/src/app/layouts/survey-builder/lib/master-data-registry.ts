/**
 * Master Data Registry
 *
 * Four masters are defined here (Supplier info, Fleet master, Villages, Surveyors). Their records are NOT
 * hard-coded: they are entered on the Masters page (/layouts/masters) and kept in
 * localStorage under `mati.masters`, so whatever is added there is what the survey
 * builder's master-data picker and the phone preview show.
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
        | { kind: "ref"; setId: string; idKey: string };
}

export interface MasterSetDefinition {
    id: string;
    name: string;
    description: string;
    category: string;
    displayFieldKey: string;
    fields: MasterFieldDefinition[];
    sampleRecords: MasterRecord[];
}

export const MASTERS_STORAGE_KEY = "mati.masters";

/** Static definitions (no records). Records are merged in by getMasterSets(). */
export const MASTER_DEFINITIONS: Omit<MasterSetDefinition, "sampleRecords">[] = [
    {
        id: "suppliers",
        name: "Supplier info",
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
    {
        id: "fleet",
        name: "Fleet master",
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
        id: "villages",
        name: "Villages",
        description: "Villages with their centre point and radius (production's village_list fields). A farmer without a GPS point is visited at their village centre.",
        category: "Geography",
        displayFieldKey: "villageName",
        fields: [
            { key: "villageName", label: "Village name", isSearchable: true },
            { key: "lat", label: "Latitude", isSecondary: true, editor: { kind: "text", placeholder: "21.2567" } },
            { key: "lng", label: "Longitude", isSecondary: true, editor: { kind: "text", placeholder: "77.5104" } },
            { key: "radiusKm", label: "Radius (km)", editor: { kind: "text", placeholder: "2" } },
        ],
    },
    {
        id: "surveyors",
        name: "Surveyors",
        description: "Field surveyors that pending tasks are assigned to. For now anyone can cover any village; a day's job holds at most \"Max visits per day\" farmer visits (8 when empty).",
        category: "People",
        displayFieldKey: "surveyorName",
        fields: [
            { key: "surveyorName", label: "Surveyor name", isSearchable: true },
            { key: "phone", label: "Phone", isSearchable: true, isSecondary: true },
            { key: "baseVillage", label: "Base village", isSecondary: true, editor: { kind: "ref", setId: "villages", idKey: "baseVillageId" } },
            { key: "baseVillageId", label: "Base village id" },
            { key: "maxVisitsPerDay", label: "Max visits per day", editor: { kind: "text", placeholder: "8" } },
            { key: "active", label: "Active", editor: { kind: "select", options: ["Yes", "No"] } },
        ],
    },
];

/** Kept for backwards compatibility: definitions with whatever records are stored right now. */
export const MASTER_SETS: MasterSetDefinition[] = MASTER_DEFINITIONS.map((d) => ({ ...d, sampleRecords: [] }));

type MastersStore = Record<string, MasterRecord[]>;

function readStore(): MastersStore {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(MASTERS_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as MastersStore) : {};
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
