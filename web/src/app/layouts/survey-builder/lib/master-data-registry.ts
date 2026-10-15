/**
 * Master Data Registry
 *
 * Two masters are defined here (Supplier info, Fleet master). Their records are NOT
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
