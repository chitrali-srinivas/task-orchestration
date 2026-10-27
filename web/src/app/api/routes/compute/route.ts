// Road route for a job — POST { nodes: [{ lat, lng }, …] } (base → stops → base, in visiting order) → { legs, km, minutes }.
// Calls the Google Routes API (computeRoutes, driving, no traffic) on the server, so the Routes key
// (GOOGLE_ROUTES_API_KEY, server-only: see web/.env.example) never reaches the browser.
import { NextResponse } from "next/server";
import type { LatLng } from "@/lib/orchestration/engine";
import { MAX_INTERMEDIATES, ROUTES_FIELD_MASK, computeRoutesBody, toRoadRoute, type ComputeRoutesResponse } from "@/lib/orchestration/roads";

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const isPoint = (p: unknown): p is LatLng => {
    const q = p as LatLng | null;
    return typeof q?.lat === "number" && typeof q?.lng === "number" && Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180;
};

const fail = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

export async function POST(request: Request) {
    const key = process.env.GOOGLE_ROUTES_API_KEY;
    if (!key) return fail(501, "not-configured", "GOOGLE_ROUTES_API_KEY isn't set on the server.");

    const body = (await request.json().catch(() => null)) as { nodes?: unknown } | null;
    const nodes = Array.isArray(body?.nodes) ? body.nodes : [];
    if (nodes.length < 2 || !nodes.every(isPoint)) return fail(400, "bad-request", "Send at least two points as { lat, lng }.");
    if (nodes.length - 2 > MAX_INTERMEDIATES) return fail(400, "too-many-stops", `A road route takes at most ${MAX_INTERMEDIATES} stops.`);

    const response = await fetch(COMPUTE_ROUTES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": ROUTES_FIELD_MASK },
        body: JSON.stringify(computeRoutesBody(nodes)),
        cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as ComputeRoutesResponse & { error?: { message?: string; status?: string } };
    if (!response.ok) return fail(502, json.error?.status ?? "google-error", json.error?.message ?? `The Routes API answered ${response.status}.`);

    const route = toRoadRoute(json);
    if (!route) return fail(404, "no-route", "Google found no driving route through these points.");
    return NextResponse.json(route);
}
