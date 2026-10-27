// PROTOTYPE-ONLY — road routes for the job workspace, fetched from our server route (app/api/routes/compute, which calls
// the Google Routes API) and cached in the browser per stop sequence (localStorage "mati.roadRoutes"), so browsing jobs
// or undoing a rearrangement doesn't call Google again. Production: the jobs API would store a job's route when its
// stops change.
"use client";

import * as React from "react";
import type { LatLng } from "@/lib/orchestration/engine";
import { RoadRoute, nodesFromKey, routeKey } from "@/lib/orchestration/roads";

const CACHE_KEY = "mati.roadRoutes";
const CACHE_LIMIT = 200;
const DEBOUNCE_MS = 400;

const memory = new Map<string, RoadRoute>();
/** Set when the server has no Routes key: stop asking until the page reloads. */
let notConfigured = "";

function readStore(): Record<string, RoadRoute> {
    try {
        return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, RoadRoute>;
    } catch {
        return {};
    }
}

function remember(key: string, route: RoadRoute) {
    memory.set(key, route);
    try {
        const store = readStore();
        store[key] = route;
        // Keep the most recent entries only.
        const keys = Object.keys(store);
        keys.slice(0, Math.max(0, keys.length - CACHE_LIMIT)).forEach((k) => delete store[k]);
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch {
        /* storage full or blocked: the in-memory copy still works */
    }
}

/** The cached road route for a node sequence, if it was fetched before. */
export function cachedRoadRoute(key: string): RoadRoute | undefined {
    if (!key) return undefined;
    const hit = memory.get(key) ?? (typeof window === "undefined" ? undefined : readStore()[key]);
    if (hit) memory.set(key, hit);
    return hit;
}

async function fetchRoadRoute(nodes: LatLng[]): Promise<RoadRoute> {
    const response = await fetch("/api/routes/compute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodes }) });
    const json = (await response.json().catch(() => ({}))) as RoadRoute & { error?: string; message?: string };
    if (response.status === 501) notConfigured = json.message ?? "The server has no Routes key.";
    if (!response.ok) throw new Error(json.message ?? `Road route failed (${response.status}).`);
    return json;
}

export type RoadRouteState =
    | { status: "off"; message?: string }
    | { status: "loading" }
    | { status: "ready"; route: RoadRoute }
    | { status: "error"; message: string };

/**
 * The road route through `nodes` (base → stops → base). Served from the cache when the sequence was seen before;
 * otherwise fetched after a short pause, so quick rearranging only asks for the order you stop at.
 */
export function useRoadRoute(nodes: LatLng[], enabled = true): RoadRouteState {
    const key = enabled && nodes.length >= 2 ? routeKey(nodes) : "";
    const [result, setResult] = React.useState<{ key: string; state: RoadRouteState } | null>(null);

    React.useEffect(() => {
        if (!key || notConfigured || cachedRoadRoute(key)) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            fetchRoadRoute(nodesFromKey(key))
                .then((route) => {
                    remember(key, route);
                    if (!cancelled) setResult({ key, state: { status: "ready", route } });
                })
                .catch((error: Error) => {
                    if (!cancelled) setResult({ key, state: notConfigured ? { status: "off", message: notConfigured } : { status: "error", message: error.message } });
                });
        }, DEBOUNCE_MS);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [key]);

    if (!key) return { status: "off" };
    const cached = cachedRoadRoute(key);
    if (cached) return { status: "ready", route: cached };
    if (notConfigured) return { status: "off", message: notConfigured };
    return result?.key === key ? result.state : { status: "loading" };
}
