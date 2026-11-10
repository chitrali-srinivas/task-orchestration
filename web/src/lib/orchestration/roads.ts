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

/* ------------------------------ Walking from the road ------------------------------ */

/** Walking pace from the road to a farm and back. Fields have no mapped paths, so walks are measured straight-line. */
export const WALK_KMH = 4.5;
export const walkMinutes = (km: number) => Math.round((km / WALK_KMH) * 60);
/** Gaps shorter than this are the road snapping to the point, not a walk. */
export const MIN_WALK_KM = 0.03;

export interface Walk {
    /** Index of the stop in the route's nodes. */
    node: number;
    /** Road point where the bike stops → the stop → road point where the next leg starts. */
    path: LatLng[];
    km: number;
    minutes: number;
}

/**
 * The walks a road route leaves at each stop. Google's legs end and start at the nearest road point, so the stretch
 * from the road to a farm in the fields, and back to the road, is on foot. With a base, the first and last nodes are
 * the base village and get no walk.
 */
export function stopWalks(nodes: LatLng[], route: RoadRoute, distance: (a: LatLng, b: LatLng) => number, hasBase: boolean): Walk[] {
    return nodes.flatMap((node, i) => {
        if (hasBase && (i === 0 || i === nodes.length - 1)) return [];
        const arrive = route.legs[i - 1]?.path.at(-1);
        const leave = route.legs[i]?.path[0];
        const km = (arrive ? distance(arrive, node) : 0) + (leave ? distance(node, leave) : 0);
        if (km < MIN_WALK_KM) return [];
        return [{ node: i, path: [...(arrive ? [arrive] : []), node, ...(leave ? [leave] : [])], km, minutes: walkMinutes(km) }];
    });
}

/** Cache key for a node sequence (5 decimals, about a metre), and back. */
export const routeKey = (nodes: LatLng[]) => nodes.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
export const nodesFromKey = (key: string): LatLng[] =>
    key ? key.split("|").map((pair) => pair.split(",").map(Number)).map(([lat, lng]) => ({ lat, lng })) : [];
