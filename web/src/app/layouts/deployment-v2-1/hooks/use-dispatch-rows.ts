"use client"

// PROTOTYPE-ONLY (wiring) / PORT-BOUND (rules) — V2.1: the group dispatch reads behind the table's BOUNDARIES column.
//
// The list API is dispatch-grain (live API audit, 2026-10-11): rows, statuses, tabs and counts come from it alone. The
// one table value it doesn't carry is boundary completeness (saved valid outlines / plots), which needs the plots'
// geometry from getTrailerDetails. So, for the LOADED rows only, one read per distinct group (farmer + deployment_num +
// az_id) — never per row, never to decide which rows exist or what a tab counts. Rules:
//   cache      per group key, kept across page appends and tab / filter / sort changes; cleared when the data changes
//              (a mutation in mock mode).
//   fan-out    at most 4 reads in flight, queued in list order.
//   staleness  a response requested before the data changed is discarded (noted in the Inspector trace) and re-read.
//   failure    a failed group keeps its error (its Boundaries cells offer Retry); other groups are unaffected.
import * as React from "react"
import { getDeploymentRowKey } from "../data/adapter"
import { deploymentTrace } from "../data/api-trace"
import { useDeploymentRows } from "../data/data-source"
import { readRowDispatches, type DispatchReadMode } from "../data/dispatch-reads"
import type { DeploymentMetadataRow, DeploymentV2Record, TrailerDispatchItem } from "../data/schema"

const CONCURRENCY = 4
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The state of one group's dispatch read. */
export type GroupDispatchState =
    | { status: "ok"; dispatches: TrailerDispatchItem[]; mode: DispatchReadMode }
    | { status: "error"; error: string }

export interface GroupDispatchReads {
    /** Per group key (a new Map after every change; a group without an entry is loading / queued). */
    states: ReadonlyMap<string, GroupDispatchState>
    /** Reads one group again (after a failure). */
    retry: (groupKey: string) => void
    /** Reads every failed group again. */
    retryFailed: () => void
}

interface Cache {
    /** The data snapshot the states belong to (a new snapshot = a mutation happened → read again). */
    rows: DeploymentMetadataRow[]
    states: Map<string, GroupDispatchState>
}

export function useGroupDispatchReads(records: DeploymentV2Record[]): GroupDispatchReads {
    const authoritativeRows = useDeploymentRows()
    const [cache, setCache] = React.useState<Cache>({ rows: authoritativeRows, states: new Map() })
    if (cache.rows !== authoritativeRows) setCache({ rows: authoritativeRows, states: new Map() })
    const inFlightRef = React.useRef(new Set<string>())
    const [kick, setKick] = React.useState(0)

    React.useEffect(() => {
        if (cache.rows !== authoritativeRows) return
        const inFlight = inFlightRef.current
        // One entry per group, in list order (several dispatch rows share a group). The group's loaded dispatch rows are a
        // known lower bound of its dispatches, so an empty status-omitted read falls back to the per-status reads.
        const loadedPerGroup = new Map<string, number>()
        for (const record of records) {
            const key = getDeploymentRowKey(record.api)
            loadedPerGroup.set(key, (loadedPerGroup.get(key) ?? 0) + 1)
        }
        const queue: DeploymentMetadataRow[] = []
        const queued = new Set<string>()
        for (const record of records) {
            const key = getDeploymentRowKey(record.api)
            if (queued.has(key) || cache.states.has(key) || inFlight.has(key)) continue
            queued.add(key)
            queue.push({ ...record.api, trailers_deployed: loadedPerGroup.get(key) ?? 1 })
        }
        const requestRows = cache.rows
        const settle = (key: string, state: GroupDispatchState) => {
            inFlight.delete(key)
            setCache((prev) => {
                if (prev.rows !== requestRows) {
                    deploymentTrace.record({ source: "live", kind: "read", method: "NOTE", path: "(client)", label: `Discarded a stale boundary read for group ${key} (requested before the data changed)`, state: "ok" })
                    setKick((k) => k + 1)
                    return prev
                }
                const states = new Map(prev.states)
                states.set(key, state)
                return { ...prev, states }
            })
        }
        for (const row of queue.slice(0, Math.max(0, CONCURRENCY - inFlight.size))) {
            const key = getDeploymentRowKey(row)
            inFlight.add(key)
            readRowDispatches(row).then(
                ({ dispatches, mode }) => settle(key, { status: "ok", dispatches, mode }),
                (error: unknown) => settle(key, { status: "error", error: errorMessage(error) }),
            )
        }
    }, [records, cache, authoritativeRows, kick])

    const retry = React.useCallback((groupKey: string) => {
        if (inFlightRef.current.has(groupKey)) return
        setCache((prev) => {
            if (!prev.states.has(groupKey)) return prev
            const states = new Map(prev.states)
            states.delete(groupKey)
            return { ...prev, states }
        })
    }, [])
    const retryFailed = React.useCallback(() => {
        setCache((prev) => {
            const states = new Map(prev.states)
            for (const [key, state] of prev.states) if (state.status === "error" && !inFlightRef.current.has(key)) states.delete(key)
            return states.size === prev.states.size ? prev : { ...prev, states }
        })
    }, [])

    return { states: cache.states, retry, retryFailed }
}
