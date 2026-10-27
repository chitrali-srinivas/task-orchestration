/**
 * Road routes (pure): the Google Routes API request for a job's nodes (base → stops → base) and its response turned
 * into what the job workspace draws: per-leg road km, drive minutes and the road path. The request itself is made by
 * the server route (app/api/routes/compute), which holds the server-only key. No I/O here.
 */

import type { LatLng } from "./engine";

export interface RoadLeg {
    km: number;
    minutes: number;
    /** The road path from one node to the next. */
    path: LatLng[];
}

export interface RoadRoute {
    /** One per pair of consecutive nodes. */
    legs: RoadLeg[];
    km: number;
    minutes: number;
}

/** Most waypoints one computeRoutes request takes between origin and destination. */
export const MAX_INTERMEDIATES = 25;

/** Only the fields we use (the Routes API requires a field mask and bills by what it returns). */
export const ROUTES_FIELD_MASK = "routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline.encodedPolyline";

/** computeRoutes body for nodes in visiting order: the first is the origin, the last the destination. */
export function computeRoutesBody(nodes: LatLng[]) {
    const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    return {
        origin: waypoint(nodes[0]),
        destination: waypoint(nodes[nodes.length - 1]),
        intermediates: nodes.slice(1, -1).map(waypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
    };
}

/** Google's encoded polyline format → points. */
export function decodePolyline(encoded: string): LatLng[] {
    const points: LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const next = () => {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        return result & 1 ? ~(result >> 1) : result >> 1;
    };
    while (index < encoded.length) {
        lat += next();
        lng += next();
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}

/** "754s" → 754. */
export const durationSeconds = (duration: string | undefined) => (duration ? parseFloat(duration) : 0) || 0;

interface ApiLeg {
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
}

export interface ComputeRoutesResponse {
    routes?: { distanceMeters?: number; duration?: string; legs?: ApiLeg[] }[];
}

/** The first route of a computeRoutes response; undefined when Google found none. */
export function toRoadRoute(json: ComputeRoutesResponse): RoadRoute | undefined {
    const route = json.routes?.[0];
    if (!route?.legs?.length) return undefined;
    const legs = route.legs.map((leg) => ({
        km: (leg.distanceMeters ?? 0) / 1000,
        minutes: Math.round(durationSeconds(leg.duration) / 60),
        path: decodePolyline(leg.polyline?.encodedPolyline ?? ""),
    }));
    return { legs, km: (route.distanceMeters ?? 0) / 1000, minutes: Math.round(durationSeconds(route.duration) / 60) };
}

/** Cache key for a node sequence (5 decimals, about a metre), and back. */
export const routeKey = (nodes: LatLng[]) => nodes.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
export const nodesFromKey = (key: string): LatLng[] =>
    key ? key.split("|").map((pair) => pair.split(",").map(Number)).map(([lat, lng]) => ({ lat, lng })) : [];
