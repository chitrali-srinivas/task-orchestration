// Google Maps (Maps JavaScript API) loader settings, shared by every map in the app so they load one script: the job
// map on Plans and the location picker on the Masters pages. The key is NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (web/.env.example).
import { env } from "@/platform/env"

const LIBRARIES: "geometry"[] = ["geometry"]

/** Options for useJsApiLoader; every map must pass these same options. */
export const GOOGLE_MAPS_LOADER = { id: "google-map-script", googleMapsApiKey: env.googleMapsApiKey, libraries: LIBRARIES }

/** Whether maps can load (the key is built in, so this is fixed for the page's life). */
export const hasMapKey = Boolean(env.googleMapsApiKey)
