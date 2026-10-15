// PLATFORM ADAPTER — public environment variables.
// Portable code reads env values from here, never from `process.env` / `import.meta.env` directly.
//
// mati-demo (Next.js): literal `process.env.NEXT_PUBLIC_*` reads (Next.js inlines them at build time).
// Production (matic-dash, Vite): the same values come from `import.meta.env.VITE_*`,
//   e.g. googleMapsApiKey ← import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
//        matiApiBaseUrl   ← import.meta.env.VITE_API_BASE_URL.

export const env = {
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    /** Matic admin API base URL (no default: live API modes fail loudly without it). */
    matiApiBaseUrl: process.env.NEXT_PUBLIC_MATI_API_BASE_URL ?? "",
    /** Deployment V2 data mode: "mock" (default) or "live". */
    deploymentV2DataMode: process.env.NEXT_PUBLIC_DEPLOYMENT_V2_DATA_MODE ?? "",
} as const
