/**
 * Survey Category & Backend App Location Registry
 * Controls backend-defined application navigation path hierarchies
 */

export interface CategoryDefinition {
    id: string;
    name: string;
    description: string;
    appPath: string[]; // Backend-defined hierarchical application path
}

export const CATEGORY_REGISTRY: CategoryDefinition[] = [
    {
        id: "farmer_enrollment",
        name: "Farmer Enrollment",
        description: "Initial farmer onboarding, KYC documentation, and land parcel registration.",
        appPath: ["Farm", "Farmer", "Enrollment"],
    },
    {
        id: "soil_baseline",
        name: "Soil Baseline & Sampling",
        description: "Geotagged soil carbon testing, sample bag tracking, and lab telemetry.",
        appPath: ["Agronomy", "Soil", "Baseline"],
    },
    {
        id: "crop_monitoring",
        name: "Crop Health & Monitoring",
        description: "Periodic field inspection, biomass estimates, and pest anomaly tracking.",
        appPath: ["Operations", "Crops", "Monitoring"],
    },
    {
        id: "plot_boundary",
        name: "Plot Boundary Mapping",
        description: "High-accuracy polygon surveying, perimeter Walk/Map validation, and NoC audits.",
        appPath: ["GIS", "Field Geometry", "Boundary"],
    },
    {
        id: "biomass_dispatch",
        name: "Biomass Dispatch & Logistics",
        description: "Truck weighbridge tickets, moisture sensor tests, and depot handovers.",
        appPath: ["Supply Chain", "Biomass", "Dispatch"],
    },
    {
        id: "field_operations",
        name: "Field Operations",
        description: "General ground operations, enumerator dispatch, and field compliance.",
        appPath: ["Operations", "Field", "General"],
    },
    {
        id: "post_harvest",
        name: "Post-Harvest Assessment",
        description: "Yield measurement, residue management, and farmer payment settlements.",
        appPath: ["Operations", "Harvest", "Post-Harvest"],
    },
];

/**
 * Returns the category definition matching an ID
 */
export function getCategoryById(categoryId?: string): CategoryDefinition | undefined {
    if (!categoryId) return undefined;
    const query = categoryId.toLowerCase().trim();
    return (
        CATEGORY_REGISTRY.find(
            (c) => c.id.toLowerCase() === query || c.name.toLowerCase() === query
        ) ||
        CATEGORY_REGISTRY.find(
            (c) => c.id.toLowerCase().includes(query) || c.name.toLowerCase().includes(query) || query.includes(c.id.toLowerCase())
        )
    );
}

/**
 * Derives the backend-controlled application location path array
 */
export function getCategoryPath(categoryId?: string): string[] | null {
    const cat = getCategoryById(categoryId);
    return cat ? cat.appPath : null;
}

/**
 * Formats app location as a breadcrumb string (e.g. "Farm → Farmer → Enrollment")
 */
export function formatCategoryPathString(categoryId?: string): string {
    const path = getCategoryPath(categoryId);
    if (!path || path.length === 0) {
        return "Select a category above to view assigned mobile app path.";
    }
    return path.join(" → ");
}
