/**
 * Storage backend for the app: a write-through cache in front of Supabase, or localStorage.
 *
 * Mode is picked from the environment:
 *  - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY set → "supabase": `ready()` loads every
 *    collection into memory once; `get` reads the cache; `set` updates the cache and upserts /
 *    deletes rows in Postgres (serialized, in the background).
 *  - otherwise → "local": the browser's localStorage, one key per collection (the demo mode).
 *
 * The stores (tasks, workflows, masters, surveys) stay synchronous on top of this; pages just
 * `await ready()` before their first read.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Collection = "surveys" | "masters" | "workflows" | "farmers" | "tasks" | "settings";

type Row = { id: string } & Record<string, any>;

interface Spec {
    table: string;
    /** localStorage key (demo mode). */
    key: string;
    /** Indexed columns copied out of the object. */
    cols: (row: Row) => Record<string, unknown>;
    /** Convert an older localStorage shape to a row array (demo mode only). */
    legacy?: (raw: unknown) => Row[];
}

const SPECS: Record<Collection, Spec> = {
    surveys: { table: "wf_survey_template", key: "mati.surveys", cols: (r) => ({ name: r.name, status: r.status }) },
    masters: {
        table: "wf_master_record",
        key: "mati.masters",
        cols: (r) => ({ set_id: r.setId }),
        // Earlier builds stored { suppliers: [...], fleet: [...] }.
        legacy: (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? Object.entries(raw as Record<string, Row[]>).flatMap(([setId, rows]) => rows.map((r) => ({ ...r, setId }))) : []),
    },
    workflows: { table: "wf_workflow", key: "mati.workflows", cols: (r) => ({ name: r.name, country: r.country, status: r.status }) },
    farmers: { table: "wf_farmer", key: "mati.farmers", cols: (r) => ({ name: r.name, village: r.village }) },
    tasks: {
        table: "wf_task",
        key: "mati.tasks",
        cols: (r) => ({
            task_no: r.taskNo,
            workflow_id: r.workflowId,
            step_id: r.stepId,
            survey_id: r.surveyId,
            farmer_id: r.farmerId,
            status: r.status,
            planned_start: r.plannedStart || null,
            planned_end: r.plannedEnd || null,
            parent_task_id: r.parentTaskId || null,
        }),
    },
    settings: {
        table: "wf_setting",
        key: "mati.sim",
        cols: () => ({}),
        // Earlier builds stored { today: "YYYY-MM-DD" }.
        legacy: (raw) => (raw && typeof raw === "object" && !Array.isArray(raw) ? [{ id: "today", ...(raw as object) }] : []),
    },
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const mode: "supabase" | "local" = url && anonKey ? "supabase" : "local";

let client: SupabaseClient | null = null;
const supabase = () => (client ??= createClient(url!, anonKey!));

const cache = new Map<Collection, Row[]>();
let readyPromise: Promise<void> | null = null;
let queue: Promise<void> = Promise.resolve();
const readyHooks: (() => void)[] = [];

/** Loads every collection once (Supabase mode). Resolves immediately in local mode. */
export function ready(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (!readyPromise) {
        readyPromise =
            mode === "local"
                ? Promise.resolve()
                : Promise.all(
                      (Object.keys(SPECS) as Collection[]).map(async (c) => {
                          const { data, error } = await supabase().from(SPECS[c].table).select("data");
                          if (error) throw new Error(`Supabase load ${SPECS[c].table}: ${error.message}`);
                          cache.set(c, (data || []).map((r) => r.data as Row));
                      })
                  ).then(() => undefined);
        readyPromise.then(() => readyHooks.forEach((h) => h()));
    }
    return readyPromise;
}

/** Runs once the backend has loaded (and immediately if it already has). */
export function onReady(hook: () => void) {
    readyHooks.push(hook);
    if (mode === "local") hook();
}

/** All rows of a collection. In Supabase mode this is the cache filled by ready(). */
export function get<T extends Row>(c: Collection): T[] {
    if (typeof window === "undefined") return [];
    if (mode === "supabase") return (cache.get(c) || []) as T[];
    try {
        const raw = window.localStorage.getItem(SPECS[c].key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return (Array.isArray(parsed) ? parsed : SPECS[c].legacy?.(parsed) || []) as T[];
    } catch {
        return [];
    }
}

/** Replaces a collection. Writes through to Postgres (upsert changed rows, delete missing ones). */
export function set<T extends Row>(c: Collection, rows: T[]) {
    if (typeof window === "undefined") return;
    if (mode === "local") {
        try {
            window.localStorage.setItem(SPECS[c].key, JSON.stringify(rows));
        } catch {
            /* ignore quota / private mode */
        }
        return;
    }
    const before = new Map((cache.get(c) || []).map((r) => [r.id, r]));
    cache.set(c, rows);
    const spec = SPECS[c];
    const changed = rows.filter((r) => before.get(r.id) !== r);
    const removed = [...before.keys()].filter((id) => !rows.some((r) => r.id === id));
    queue = queue
        .then(async () => {
            if (changed.length) {
                const { error } = await supabase()
                    .from(spec.table)
                    .upsert(changed.map((r) => ({ id: r.id, data: r, ...spec.cols(r), updated_at: new Date().toISOString() })));
                if (error) throw new Error(`Supabase upsert ${spec.table}: ${error.message}`);
            }
            if (removed.length) {
                const { error } = await supabase().from(spec.table).delete().in("id", removed);
                if (error) throw new Error(`Supabase delete ${spec.table}: ${error.message}`);
            }
        })
        .catch((e) => console.error(e));
}

/** Waits for pending writes (tests / before navigating away). */
export const flush = () => queue;
