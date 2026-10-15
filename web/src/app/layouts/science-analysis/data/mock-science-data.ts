export interface LatLng {
    lat: number;
    lng: number;
}

export interface SciencePlot {
    id: string;
    name: string;
    farmerName: string;
    farmerId: string;
    village: string;
    areaAcres: number;
    observationsCount: number;
    latestObservationDate: string;
    acquisitionsStored: number;
    dataSourcesCount: number;
    clearObservationsCount: number;
    coordinates: LatLng[];
    cropType: string;
    soilType: string;
}

export interface SatelliteObservation {
    date: string;
    sentinel2: number | null;
    landsat: number | null;
    planetScope: number | null;
    smoothed: number;
}

export interface VegetationIndexSeries {
    key: string;
    label: string;
    latestValue: number;
    observations: SatelliteObservation[];
}

export interface ClimateObservation {
    date: string;
    rainfallMm: number;
    referenceEtMm: number;
    airTempC: number;
    soilMoisture7cm: number;
}

export interface SoilDepthLayer {
    depthCm: string;
    pH: number;
    organicC: number; // g/kg
    clayPct: number;
    sandPct: number;
    siltPct: number;
    cec: number;
    nitrogenGKg: number;
    bulkDensity: number;
}

export interface RadarObservation {
    date: string;
    vvBackscatter: number;
    vhBackscatter: number;
    ratioVvVh: number;
    radarVegetationIndex: number;
}

export interface PhenologyStage {
    stage: string;
    startDate: string;
    endDate: string;
    ndviPeak: number;
    accumulatedBiomassG: number;
}

export const MOCK_SCIENCE_PLOTS: SciencePlot[] = [
    {
        id: "plot-01",
        name: "Plot - Manegaon - 01",
        farmerName: "Ramesh Patel",
        farmerId: "FARMER-101",
        village: "Manegaon",
        areaAcres: 4.0,
        observationsCount: 719,
        latestObservationDate: "2026-08-14",
        acquisitionsStored: 878,
        dataSourcesCount: 3,
        clearObservationsCount: 486,
        cropType: "Rice / Cotton",
        soilType: "Vertisol (Black Soil)",
        coordinates: [
            { lat: 20.5225, lng: 78.9315 },
            { lat: 20.5235, lng: 78.9325 },
            { lat: 20.5228, lng: 78.9338 },
            { lat: 20.5218, lng: 78.9328 }
        ]
    },
    {
        id: "plot-02",
        name: "Plot - Manegaon - 02",
        farmerName: "Ramesh Patel",
        farmerId: "FARMER-101",
        village: "Manegaon",
        areaAcres: 3.5,
        observationsCount: 680,
        latestObservationDate: "2026-08-14",
        acquisitionsStored: 840,
        dataSourcesCount: 3,
        clearObservationsCount: 450,
        cropType: "Soybean",
        soilType: "Inceptisol",
        coordinates: [
            { lat: 20.5236, lng: 78.9326 },
            { lat: 20.5242, lng: 78.9332 },
            { lat: 20.5238, lng: 78.9341 },
            { lat: 20.5231, lng: 78.9335 }
        ]
    },
    {
        id: "plot-03",
        name: "Plot - Manegaon - 03",
        farmerName: "Suresh Kumar",
        farmerId: "FARMER-102",
        village: "Manegaon",
        areaAcres: 5.2,
        observationsCount: 750,
        latestObservationDate: "2026-08-12",
        acquisitionsStored: 910,
        dataSourcesCount: 3,
        clearObservationsCount: 510,
        cropType: "Paddy",
        soilType: "Vertisol",
        coordinates: [
            { lat: 20.5215, lng: 78.9305 },
            { lat: 20.5224, lng: 78.9314 },
            { lat: 20.5217, lng: 78.9327 },
            { lat: 20.5208, lng: 78.9318 }
        ]
    },
    {
        id: "plot-04",
        name: "Plot - Manegaon - 04",
        farmerName: "Suresh Kumar",
        farmerId: "FARMER-102",
        village: "Manegaon",
        areaAcres: 4.8,
        observationsCount: 710,
        latestObservationDate: "2026-08-14",
        acquisitionsStored: 865,
        dataSourcesCount: 3,
        clearObservationsCount: 472,
        cropType: "Wheat / Gram",
        soilType: "Alfisol",
        coordinates: [
            { lat: 20.5205, lng: 78.9329 },
            { lat: 20.5215, lng: 78.9338 },
            { lat: 20.5209, lng: 78.9348 },
            { lat: 20.5199, lng: 78.9339 }
        ]
    },
    {
        id: "plot-05",
        name: "Plot - Rampur - 01",
        farmerName: "Anita Devi",
        farmerId: "FARMER-103",
        village: "Rampur",
        areaAcres: 6.1,
        observationsCount: 810,
        latestObservationDate: "2026-08-13",
        acquisitionsStored: 950,
        dataSourcesCount: 3,
        clearObservationsCount: 530,
        cropType: "Sugarcane",
        soilType: "Alluvial",
        coordinates: [
            { lat: 20.5260, lng: 78.9360 },
            { lat: 20.5272, lng: 78.9372 },
            { lat: 20.5265, lng: 78.9385 },
            { lat: 20.5253, lng: 78.9373 }
        ]
    },
    {
        id: "plot-06",
        name: "Plot - Sonpur - 01",
        farmerName: "Vikram Singh",
        farmerId: "FARMER-104",
        village: "Sonpur",
        areaAcres: 4.2,
        observationsCount: 640,
        latestObservationDate: "2026-08-11",
        acquisitionsStored: 790,
        dataSourcesCount: 3,
        clearObservationsCount: 410,
        cropType: "Maize",
        soilType: "Inceptisol",
        coordinates: [
            { lat: 20.5180, lng: 78.9280 },
            { lat: 20.5190, lng: 78.9290 },
            { lat: 20.5184, lng: 78.9302 },
            { lat: 20.5174, lng: 78.9292 }
        ]
    }
];

// Generate 5 Years of monthly/biweekly historical observation dates for indices
const generateTimeDates = (): string[] => {
    const dates: string[] = [];
    const startYear = 2022;
    const endYear = 2026;
    for (let y = startYear; y <= endYear; y++) {
        for (let m = 1; m <= 12; m++) {
            const mStr = m < 10 ? `0${m}` : `${m}`;
            dates.push(`${y}-${mStr}-01`);
            if (y === 2026 && m === 8) break;
            if (m % 2 === 0) dates.push(`${y}-${mStr}-15`);
        }
    }
    return dates;
};

const datesList = generateTimeDates();

export const MOCK_VEGETATION_INDICES: Record<string, VegetationIndexSeries[]> = {
    "plot-01": [
        {
            key: "NDVI",
            label: "NDVI",
            latestValue: 0.41,
            observations: datesList.map((d, i) => {
                const seasonFactor = Math.sin((i / datesList.length) * Math.PI * 8);
                const base = 0.35 + 0.3 * Math.max(0, seasonFactor);
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.1 - 0.05)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "NDRE",
            label: "NDRE",
            latestValue: 0.36,
            observations: datesList.map((d, i) => {
                const base = 0.28 + 0.25 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "MOISTURE",
            label: "MOISTURE",
            latestValue: 0.46,
            observations: datesList.map((d, i) => {
                const base = 0.3 + 0.28 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8 + 0.2));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "EVI",
            label: "EVI",
            latestValue: 0.44,
            observations: datesList.map((d, i) => {
                const base = 0.32 + 0.27 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "SAVI",
            label: "SAVI",
            latestValue: 0.41,
            observations: datesList.map((d, i) => {
                const base = 0.3 + 0.24 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.07 - 0.035)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.04 - 0.02)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "GNDVI",
            label: "GNDVI",
            latestValue: 0.45,
            observations: datesList.map((d, i) => {
                const base = 0.33 + 0.28 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "NDWI",
            label: "NDWI",
            latestValue: 0.39,
            observations: datesList.map((d, i) => {
                const base = 0.25 + 0.32 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8 + 0.5));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.07 - 0.035)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.09 - 0.045)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        },
        {
            key: "EN_SOIL",
            label: "EN SOIL",
            latestValue: 0.46,
            observations: datesList.map((d, i) => {
                const base = 0.3 + 0.26 * Math.max(0, Math.sin((i / datesList.length) * Math.PI * 8));
                return {
                    date: d,
                    sentinel2: Number((base + (Math.random() * 0.06 - 0.03)).toFixed(2)),
                    landsat: Number((base + (Math.random() * 0.08 - 0.04)).toFixed(2)),
                    planetScope: Number((base + (Math.random() * 0.05 - 0.025)).toFixed(2)),
                    smoothed: Number(base.toFixed(2))
                };
            })
        }
    ]
};

export const MOCK_CLIMATE_DATA: ClimateObservation[] = [
    { date: "2026-03-01", rainfallMm: 4.2, referenceEtMm: 28.5, airTempC: 24.2, soilMoisture7cm: 0.274 },
    { date: "2026-03-15", rainfallMm: 8.5, referenceEtMm: 32.1, airTempC: 26.8, soilMoisture7cm: 0.293 },
    { date: "2026-04-01", rainfallMm: 12.0, referenceEtMm: 35.4, airTempC: 29.5, soilMoisture7cm: 0.310 },
    { date: "2026-04-15", rainfallMm: 6.2, referenceEtMm: 38.2, airTempC: 32.1, soilMoisture7cm: 0.285 },
    { date: "2026-05-01", rainfallMm: 18.4, referenceEtMm: 42.0, airTempC: 34.6, soilMoisture7cm: 0.340 },
    { date: "2026-05-15", rainfallMm: 25.8, referenceEtMm: 40.5, airTempC: 33.2, soilMoisture7cm: 0.380 },
    { date: "2026-06-01", rainfallMm: 42.1, referenceEtMm: 36.2, airTempC: 31.0, soilMoisture7cm: 0.420 },
    { date: "2026-06-15", rainfallMm: 55.4, referenceEtMm: 32.8, airTempC: 29.4, soilMoisture7cm: 0.454 },
    { date: "2026-07-01", rainfallMm: 48.2, referenceEtMm: 30.1, airTempC: 28.1, soilMoisture7cm: 0.435 },
    { date: "2026-07-15", rainfallMm: 38.0, referenceEtMm: 33.4, airTempC: 28.8, soilMoisture7cm: 0.410 },
    { date: "2026-08-01", rainfallMm: 51.5, referenceEtMm: 31.2, airTempC: 27.9, soilMoisture7cm: 0.448 },
    { date: "2026-08-14", rainfallMm: 44.0, referenceEtMm: 29.8, airTempC: 27.2, soilMoisture7cm: 0.425 },
];

export const MOCK_SOIL_PROFILE: SoilDepthLayer[] = [
    { depthCm: "0-5", pH: 7.4, organicC: 14.7, clayPct: 38.1, sandPct: 15.8, siltPct: 46.1, cec: 45.1, nitrogenGKg: 1.60, bulkDensity: 1.67 },
    { depthCm: "5-15", pH: 7.5, organicC: 10.6, clayPct: 38.5, sandPct: 16.1, siltPct: 45.3, cec: 45.7, nitrogenGKg: 1.14, bulkDensity: 1.68 },
    { depthCm: "15-30", pH: 7.5, organicC: 6.6, clayPct: 40.5, sandPct: 15.4, siltPct: 44.1, cec: 45.3, nitrogenGKg: 0.73, bulkDensity: 1.70 },
    { depthCm: "30-60", pH: 7.6, organicC: 4.4, clayPct: 41.8, sandPct: 15.5, siltPct: 42.7, cec: 45.1, nitrogenGKg: 0.58, bulkDensity: 1.76 },
    { depthCm: "60-100", pH: 7.6, organicC: 3.7, clayPct: 41.1, sandPct: 16.0, siltPct: 42.9, cec: 45.3, nitrogenGKg: 0.48, bulkDensity: 1.77 },
    { depthCm: "100-200", pH: 7.7, organicC: 2.8, clayPct: 41.7, sandPct: 16.6, siltPct: 41.7, cec: 45.5, nitrogenGKg: 0.40, bulkDensity: 1.77 },
];

export const MOCK_RADAR_DATA: RadarObservation[] = [
    { date: "2026-03-01", vvBackscatter: -11.5, vhBackscatter: -17.2, ratioVvVh: 5.7, radarVegetationIndex: 0.32 },
    { date: "2026-04-01", vvBackscatter: -10.8, vhBackscatter: -16.4, ratioVvVh: 5.6, radarVegetationIndex: 0.38 },
    { date: "2026-05-01", vvBackscatter: -9.2, vhBackscatter: -14.8, ratioVvVh: 5.6, radarVegetationIndex: 0.48 },
    { date: "2026-06-01", vvBackscatter: -8.1, vhBackscatter: -13.2, ratioVvVh: 5.1, radarVegetationIndex: 0.62 },
    { date: "2026-07-01", vvBackscatter: -7.6, vhBackscatter: -12.1, ratioVvVh: 4.5, radarVegetationIndex: 0.74 },
    { date: "2026-08-01", vvBackscatter: -8.0, vhBackscatter: -12.8, ratioVvVh: 4.8, radarVegetationIndex: 0.69 },
];

export interface PhenologyStage {
    stage: string;
    startDate: string;
    endDate: string;
    ndviPeak: number;
    accumulatedBiomassG: number;
}

export interface DetectedSeason {
    year: number;
    start: string;
    peak: string;
    end: string;
    lengthD: number;
    amplitude: number;
    auc: number;
}

export interface AnnualSummaryRow {
    year: number;
    rainMm: number;
    etoMm: number;
    gdd: number;
    heatDays: number;
    dryDays: number;
    ndviMean: number;
}

export const MOCK_DETECTED_SEASONS: DetectedSeason[] = [
    { year: 2021, start: "2021-09-26", peak: "2021-10-06", end: "2021-10-29", lengthD: 34, amplitude: 0.594, auc: 10.2 },
    { year: 2022, start: "2022-07-03", peak: "2022-08-12", end: "2022-09-03", lengthD: 63, amplitude: 0.604, auc: 28.1 },
    { year: 2023, start: "2023-07-13", peak: "2023-08-17", end: "2023-10-29", lengthD: 109, amplitude: 0.465, auc: 37.8 },
    { year: 2024, start: "2024-07-16", peak: "2024-09-09", end: "2024-10-11", lengthD: 88, amplitude: 0.770, auc: 49.6 },
    { year: 2025, start: "2025-06-26", peak: "2025-09-19", end: "2025-12-24", lengthD: 182, amplitude: 0.529, auc: 59.2 },
    { year: 2026, start: "2026-01-01", peak: "2026-02-02", end: "2026-03-14", lengthD: 73, amplitude: 0.158, auc: 8.5 },
];

export const MOCK_ANNUAL_SUMMARY: AnnualSummaryRow[] = [
    { year: 2021, rainMm: 491, etoMm: 519, gdd: 2661, heatDays: 0, dryDays: 86, ndviMean: 0.577 },
    { year: 2022, rainMm: 1608, etoMm: 1714, gdd: 7505, heatDays: 92, dryDays: 248, ndviMean: 0.519 },
    { year: 2023, rainMm: 1318, etoMm: 1714, gdd: 7456, heatDays: 59, dryDays: 256, ndviMean: 0.509 },
    { year: 2024, rainMm: 1927, etoMm: 1638, gdd: 7563, heatDays: 80, dryDays: 236, ndviMean: 0.511 },
    { year: 2025, rainMm: 1337, etoMm: 1622, gdd: 7412, heatDays: 84, dryDays: 247, ndviMean: 0.397 },
    { year: 2026, rainMm: 617, etoMm: 1220, gdd: 5003, heatDays: 87, dryDays: 167, ndviMean: 0.350 },
];
