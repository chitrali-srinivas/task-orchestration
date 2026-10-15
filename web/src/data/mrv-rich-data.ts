export type Profile = {
    id: string;
    name: string;
    village: string;
    fatherName: string;
    mobile: string;
    surveyor: string;
    avatarUrl?: string; // Placeholder relative path or null
    status: "Active" | "Inactive" | "Pending";
};

export type SampleLog = {
    id: string;
    sampleType: "Pre-Season" | "Start-Season" | "Harvest";
    progress: number; // 0-100
    date: string;
    surveyor: string;
    status: "Completed" | "In Progress" | "Failed";
};

export type MetricStats = {
    id: string;
    category: "Soil" | "Carbon" | "Water";
    metric: string;
    value: number;
    unit: string;
    trend: "up" | "down" | "stable";
    status: "Optimal" | "Warning" | "Critical";
};

export type GeoLocation = {
    id: string;
    locationName: string;
    lat: number;
    lng: number;
    type: "Farm" | "Storage" | "Processing";
    status: "Verified" | "Unverified";
};

export type FarmerRecord = Profile & {
    samples: SampleLog[];
    metrics: MetricStats[];
    location: GeoLocation;
};

// --- Mock Data Generators ---

const names = ["Ramesh Kumar", "Suresh Patel", "Anita Devi", "Rajesh Singh", "Priya Sharma", "Amit Verma", "Sunita Gupta", "Vikram Rao"];
const villages = ["Rampur", "Sonpur", "Lakhanpur", "Madhopur", "Kishanpur", "Shantipura", "Belapur", "Navgaon"];

export const mockFarmers: FarmerRecord[] = Array.from({ length: 20 }).map((_, i) => ({
    id: `FARM-${1000 + i}`,
    name: names[i % names.length],
    village: villages[i % villages.length],
    fatherName: `Father of ${names[i % names.length].split(" ")[0]}`,
    mobile: `+91 98765 432${i.toString().padStart(2, "0")}`,
    surveyor: names[(i + 2) % names.length],
    status: i % 5 === 0 ? "Inactive" : i % 7 === 0 ? "Pending" : "Active",
    samples: [
        {
            id: `SMP-${2000 + i}-A`,
            sampleType: "Pre-Season",
            progress: 100,
            date: "2024-01-15",
            surveyor: "Surveyor A",
            status: "Completed",
        },
        {
            id: `SMP-${2000 + i}-B`,
            sampleType: "Start-Season",
            progress: i % 2 === 0 ? 100 : 45,
            date: "2024-03-20",
            surveyor: "Surveyor B",
            status: i % 2 === 0 ? "Completed" : "In Progress",
        },
    ],
    metrics: [
        {
            id: `MET-${3000 + i}`,
            category: "Soil",
            metric: "pH",
            value: 6.5 + (i % 10) / 10,
            unit: "pH",
            trend: i % 3 === 0 ? "up" : "stable",
            status: i % 10 === 0 ? "Warning" : "Optimal",
        },
        {
            id: `MET-${4000 + i}`,
            category: "Carbon",
            metric: "SOC",
            value: 1.2 + (i % 5) / 10,
            unit: "%",
            trend: "up",
            status: "Optimal",
        },
    ],
    location: {
        id: `LOC-${5000 + i}`,
        locationName: `${villages[i % villages.length]} - Field ${i + 1}`,
        lat: 12.9716 + (Math.random() - 0.5) * 0.1,
        lng: 77.5946 + (Math.random() - 0.5) * 0.1,
        type: "Farm",
        status: "Verified",
    },
}));
