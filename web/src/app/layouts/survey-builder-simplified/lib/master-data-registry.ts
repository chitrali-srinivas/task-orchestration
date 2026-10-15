/**
 * Master Data Registry
 * Provides reusable operational datasets (trucks, villages, bases, surveyors, crops)
 * for dropdown/select questions with stable record references.
 */

export interface MasterFieldDefinition {
    key: string;
    label: string;
    isSearchable?: boolean;
    isSecondary?: boolean;
}

export interface MasterSetDefinition {
    id: string;
    name: string;
    description: string;
    category: string;
    displayFieldKey: string;
    fields: MasterFieldDefinition[];
    sampleRecords: Record<string, any>[];
}

export const MASTER_SETS: MasterSetDefinition[] = [
    {
        id: "trucks",
        name: "Logistics Fleet & Trucks",
        description: "Registered transport vehicles, tonnage capacity, and dedicated drivers.",
        category: "Logistics & Supply Chain",
        displayFieldKey: "vehicleNumber",
        fields: [
            { key: "vehicleNumber", label: "Vehicle Number", isSearchable: true },
            { key: "driverName", label: "Driver Name", isSearchable: true, isSecondary: true },
            { key: "vehicleType", label: "Vehicle Type", isSearchable: true, isSecondary: true },
            { key: "capacityTons", label: "Capacity (Tons)", isSecondary: true },
            { key: "model", label: "Brand / Model", isSearchable: true },
        ],
        sampleRecords: [
            { id: "trk_01", vehicleNumber: "KA01AB1234", driverName: "Ramesh Sharma", vehicleType: "Tata Signa 2823", capacityTons: 25, model: "Tata Motors" },
            { id: "trk_02", vehicleNumber: "KA02CD5678", driverName: "Suresh Gowda", vehicleType: "Ashok Leyland 3520", capacityTons: 30, model: "Ashok Leyland" },
            { id: "trk_03", vehicleNumber: "DL04EF9012", driverName: "Manpreet Singh", vehicleType: "Eicher Pro 6028", capacityTons: 28, model: "Eicher" },
            { id: "trk_04", vehicleNumber: "MH12GH3456", driverName: "Vijay Deshmukh", vehicleType: "BharatBenz 2823C", capacityTons: 26, model: "BharatBenz" },
            { id: "trk_05", vehicleNumber: "UP32IJ7890", driverName: "Anil Yadav", vehicleType: "Mahindra Blazo X 28", capacityTons: 24, model: "Mahindra" },
        ],
    },
    {
        id: "villages",
        name: "Revenue Villages",
        description: "Census revenue villages with Taluk, District, and PIN code mappings.",
        category: "Geographies & Admin",
        displayFieldKey: "villageName",
        fields: [
            { key: "villageName", label: "Village Name", isSearchable: true },
            { key: "taluk", label: "Taluk / Block", isSearchable: true, isSecondary: true },
            { key: "district", label: "District", isSearchable: true, isSecondary: true },
            { key: "pinCode", label: "PIN Code", isSearchable: true, isSecondary: true },
            { key: "zoneId", label: "Zone Code" },
        ],
        sampleRecords: [
            { id: "vil_01", villageName: "Hunasagi", taluk: "Hunasagi", district: "Yadgir", pinCode: "585215", zoneId: "AZ2" },
            { id: "vil_02", villageName: "Shorapur", taluk: "Shorapur", district: "Yadgir", pinCode: "585220", zoneId: "AZ2" },
            { id: "vil_03", villageName: "Shahapur", taluk: "Shahapur", district: "Yadgir", pinCode: "585223", zoneId: "AZ2" },
            { id: "vil_04", villageName: "Devadurga", taluk: "Devadurga", district: "Raichur", pinCode: "584111", zoneId: "AZ2" },
            { id: "vil_05", villageName: "Manvi", taluk: "Manvi", district: "Raichur", pinCode: "584123", zoneId: "AZ2" },
            { id: "vil_06", villageName: "Sindhanur", taluk: "Sindhanur", district: "Raichur", pinCode: "584128", zoneId: "AZ2" },
        ],
    },
    {
        id: "bases",
        name: "Operational Field Bases",
        description: "Permanent operations hub centers, regional state codes, and base managers.",
        category: "Facilities & Hubs",
        displayFieldKey: "baseName",
        fields: [
            { key: "baseName", label: "Base Name", isSearchable: true },
            { key: "baseCode", label: "Base Code", isSearchable: true, isSecondary: true },
            { key: "state", label: "State", isSearchable: true, isSecondary: true },
            { key: "manager", label: "Base Manager", isSearchable: true, isSecondary: true },
        ],
        sampleRecords: [
            { id: "base_01", baseName: "Raichur Central Base", baseCode: "RCR-01", state: "Karnataka", manager: "Dr. Anand Rao" },
            { id: "base_02", baseName: "Yadgir North Base", baseCode: "YDG-02", state: "Karnataka", manager: "Kiran Patil" },
            { id: "base_03", baseName: "Kalaburagi Base", baseCode: "KLB-03", state: "Karnataka", manager: "Deepak Biradar" },
            { id: "base_04", baseName: "Kurnool Regional Base", baseCode: "KNL-04", state: "Andhra Pradesh", manager: "Venkatesh Naidu" },
        ],
    },
    {
        id: "surveyors",
        name: "Certified Field Surveyors",
        description: "Active MATIC field surveyors with contact details, badge IDs, and home bases.",
        category: "Personnel & Staff",
        displayFieldKey: "name",
        fields: [
            { key: "name", label: "Surveyor Name", isSearchable: true },
            { key: "employeeId", label: "Employee ID", isSearchable: true, isSecondary: true },
            { key: "phone", label: "Phone Number", isSearchable: true, isSecondary: true },
            { key: "assignedBase", label: "Assigned Base", isSearchable: true, isSecondary: true },
        ],
        sampleRecords: [
            { id: "surv_01", name: "Prakash Hiremath", employeeId: "MATI-SRV-101", phone: "+91 9845012345", assignedBase: "Raichur Central Base" },
            { id: "surv_02", name: "Sunita Kulkarni", employeeId: "MATI-SRV-102", phone: "+91 9741234567", assignedBase: "Raichur Central Base" },
            { id: "surv_03", name: "Mohammed Irfan", employeeId: "MATI-SRV-103", phone: "+91 9900345678", assignedBase: "Yadgir North Base" },
            { id: "surv_04", name: "Basavaraj Bommai", employeeId: "MATI-SRV-104", phone: "+91 9448456789", assignedBase: "Kalaburagi Base" },
            { id: "surv_05", name: "Radha Krishna", employeeId: "MATI-SRV-105", phone: "+91 9880567890", assignedBase: "Kurnool Regional Base" },
        ],
    },
    {
        id: "crops",
        name: "Agricultural Crops & Varieties",
        description: "Registered regional crop varieties, cropping seasons, and standard growth cycles.",
        category: "Agronomy & Crops",
        displayFieldKey: "cropName",
        fields: [
            { key: "cropName", label: "Crop Name", isSearchable: true },
            { key: "season", label: "Season", isSearchable: true, isSecondary: true },
            { key: "variety", label: "Variety", isSearchable: true, isSecondary: true },
            { key: "maturityDays", label: "Maturity Days", isSecondary: true },
        ],
        sampleRecords: [
            { id: "crp_01", cropName: "Cotton", season: "Kharif", variety: "Bt Cotton BG-II", maturityDays: 160 },
            { id: "crp_02", cropName: "Pigeon Pea (Red Gram / Tur)", season: "Kharif", variety: "GRG-152 (Maruti)", maturityDays: 170 },
            { id: "crp_03", cropName: "Paddy (Rice)", season: "Kharif / Rabi", variety: "BPT 5204 (Sona Masuri)", maturityDays: 145 },
            { id: "crp_04", cropName: "Bengal Gram (Chickpea)", season: "Rabi", variety: "JG-11", maturityDays: 100 },
            { id: "crp_05", cropName: "Sugarcane", season: "Annual", variety: "Co 86032", maturityDays: 360 },
        ],
    },
];

/**
 * Retrieves all registered master datasets
 */
export function getMasterSets(): MasterSetDefinition[] {
    return MASTER_SETS;
}

/**
 * Retrieves a single master dataset definition by ID
 */
export function getMasterSetById(id?: string): MasterSetDefinition | undefined {
    if (!id) return undefined;
    return MASTER_SETS.find((m) => m.id === id);
}

/**
 * Searches records within a master dataset
 */
export function searchMasterRecords(masterSetId: string, query: string): Record<string, any>[] {
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
