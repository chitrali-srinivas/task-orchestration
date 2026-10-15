"use client"

// PROTOTYPE-ONLY (wiring) / PORT-BOUND (rules) — V2.1 (requirement 3): everything the FARMER-level detail loads.
//   rows        the farmer's list rows — every status, every AZ, every round (deploymentApi.listFarmerRows: the v4 list
//               with farmer_ids and status "all", every page). V2.1 (live API audit): those rows are DISPATCHES, so they
//               are grouped by farmer + deployment_num + az_id (data/dispatch-rows.ts groupDispatchRows) — one section
//               and one set of reads per group, never per dispatch row (a group of 3 dispatches used to show 3 × 3 cards).
//   per row     one dispatch read (data/dispatch-reads.ts: the row's AZ with `status` omitted, the production
//               per-status reads as fallback), the row's NOC (per AZ, as matic-dash) and the row's report history
//               (az_id sent, form_name "Deployment" — production reads AWD / Mati Boost history under it too) — three
//               reads, independent failures, at most 4 rows in flight.
//   staleness   results are kept per farmer and tagged with a load token: a newly opened farmer never shows the previous
//               farmer's data, and a response from an older load is discarded.
//   reload      after a mutation the same farmer is read again WITHOUT dropping what is shown: the rows and their
//               dispatches stay (marked loading) until the new reads replace them.
import * as React from "react"
import { getDeploymentRowKey } from "../data/adapter"
import { deploymentApi } from "../data/deployment-api"
import { readRowDispatches, type DispatchReadMode } from "../data/dispatch-reads"
import { buildNocDetailsRequest, buildReportHistoryRequest } from "../data/request-builders"
import { groupDispatchRows } from "../data/dispatch-rows"
import type { DeploymentMetadataRow, DeploymentNocDetails, ReportHistoryEntry, TrailerDispatchItem } from "../data/schema"

const CONCURRENCY = 4
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export interface FarmerRowDetail {
    /** The GROUP row (data/dispatch-rows.ts DispatchGroup.row): group-level fields and request building only. */
    row: DeploymentMetadataRow
    rowKey: string
    /** The group's dispatch rows from the list (one per dispatch); only the seed row until the farmer's rows are read. */
    groupRows: DeploymentMetadataRow[]
    /** The dispatch read is in flight (the previous dispatches, if any, stay shown meanwhile). */
    loading: boolean
    /** The dispatch read has succeeded at least once for this row (false: never loaded, or only failed). */
    loaded: boolean
    dispatches: TrailerDispatchItem[]
    dispatchesError: string | null
    /** How the dispatches were read (data/dispatch-reads.ts); null until read. */
    readMode: DispatchReadMode | null
    noc: DeploymentNocDetails | null
    nocError: string | null
    nocLoading: boolean
    /** null while unknown or after a failed read. */
    history: ReportHistoryEntry[] | null
    historyFailed: boolean
}

export interface FarmerDetail {
    farmerId: string | null
    /** The farmer's list rows in round / AZ order; null until read (or when the read failed). */
    rows: DeploymentMetadataRow[] | null
    /** V2.1: the farmer's list rows exactly as the API sent them (one per dispatch, a repeated dispatch kept) — the
     *  header's Cal. Area source; null until read (or when the read failed). A reload keeps the previous ones. */
    dispatchRows: DeploymentMetadataRow[] | null
    rowsError: string | null
    rowsLoading: boolean
    byRow: ReadonlyMap<string, FarmerRowDetail>
    /** True until the rows and every row's dispatch read have settled. */
    loading: boolean
    /** Reads the farmer again (rows and every row). */
    reload: () => void
    /** Reads one row again (its dispatches, NOC and history). */
    reloadRow: (rowKey: string) => void
}

const sortRows = (rows: DeploymentMetadataRow[]) => [...rows].sort((a, b) => (a.deployment_num - b.deployment_num) || (a.az_id - b.az_id))

const freshRow = (row: DeploymentMetadataRow, groupRows: DeploymentMetadataRow[]): FarmerRowDetail => ({
    row, rowKey: getDeploymentRowKey(row), groupRows, loading: true, loaded: false, dispatches: [], dispatchesError: null, readMode: null, noc: null, nocError: null, nocLoading: true, history: null, historyFailed: false,
})

interface State {
    farmerId: string | null
    token: number
    rows: DeploymentMetadataRow[] | null
    dispatchRows: DeploymentMetadataRow[] | null
    rowsError: string | null
    rowsLoading: boolean
    byRow: Map<string, FarmerRowDetail>
}

const EMPTY: State = { farmerId: null, token: 0, rows: null, dispatchRows: null, rowsError: null, rowsLoading: false, byRow: new Map() }

/**
 * `seedRow`: the list row the detail was opened from — shown (and read) first while the farmer's rows load, so the
 * clicked dispatch's row is never missing from the detail even if the farmer-rows read fails.
 */
export function useFarmerDetail(farmerId: string | null, open: boolean, seedRow: DeploymentMetadataRow | null): FarmerDetail {
    const [state, setState] = React.useState<State>(EMPTY)
    const [token, setToken] = React.useState(0)
    const [rowTokens, setRowTokens] = React.useState<Record<string, number>>({})
    const tokenRef = React.useRef(0)
    /** The latest state, for the effects below (synced after each render; declared first so it is current when they run). */
    const stateRef = React.useRef(state)
    React.useEffect(() => { stateRef.current = state })

    const readRow = React.useCallback((row: DeploymentMetadataRow, loadToken: number, isCurrent: () => boolean) => {
        const rowKey = getDeploymentRowKey(row)
        const update = (patch: Partial<FarmerRowDetail>) => setState((prev) => {
            if (!isCurrent() || prev.token !== loadToken) return prev
            const current = prev.byRow.get(rowKey)
            if (!current) return prev
            const byRow = new Map(prev.byRow)
            byRow.set(rowKey, { ...current, ...patch })
            return { ...prev, byRow }
        })
        const dispatches = readRowDispatches(row).then(
            ({ dispatches: list, mode }) => update({ dispatches: list, dispatchesError: null, readMode: mode, loading: false, loaded: true }),
            (error: unknown) => update({ dispatches: [], dispatchesError: errorMessage(error), loading: false }),
        )
        const noc = deploymentApi.getDeploymentNocDetails(buildNocDetailsRequest(row)).then(
            (details) => update({ noc: details, nocError: null, nocLoading: false }),
            (error: unknown) => update({ noc: null, nocError: errorMessage(error), nocLoading: false }),
        )
        const history = deploymentApi.getFarmerReportedHistory(buildReportHistoryRequest(row)).then(
            (response) => update({ history: response.reported_farmer_details_result, historyFailed: false }),
            () => update({ history: null, historyFailed: true }),
        )
        return Promise.allSettled([dispatches, noc, history])
    }, [])

    // The farmer's rows, then every row's reads (bounded fan-out).
    React.useEffect(() => {
        if (!open || !farmerId) {
            setState(EMPTY)
            return
        }
        const loadToken = ++tokenRef.current
        const isCurrent = () => tokenRef.current === loadToken
        // The seed (the clicked dispatch row) stands for its group until the farmer's rows arrive: how many dispatches the
        // group has is unknown until then (trailers_deployed null — not 1).
        const seed = seedRow && String(seedRow.farmer_id) === farmerId ? { ...seedRow, trailers_deployed: null, franchise_statuses: undefined } : null
        // A reload of the same farmer keeps what is shown (every row marked loading); a new farmer starts from its seed row.
        const previous = stateRef.current.farmerId === farmerId && stateRef.current.rows ? stateRef.current : null
        const initialRows = previous ? previous.rows! : seed ? [seed] : []
        const initial = new Map<string, FarmerRowDetail>()
        for (const row of initialRows) {
            const key = getDeploymentRowKey(row)
            const kept = previous?.byRow.get(key)
            initial.set(key, kept ? { ...kept, loading: true, nocLoading: true, dispatchesError: null } : freshRow(row, seedRow ? [seedRow] : [row]))
        }
        setState({ farmerId, token: loadToken, rows: previous ? previous.rows : null, dispatchRows: previous ? previous.dispatchRows : null, rowsError: null, rowsLoading: true, byRow: initial })
        let cancelled = false
        deploymentApi.listFarmerRows(farmerId).then(
            (dispatchRows) => {
                if (cancelled || !isCurrent()) return
                // One entry per group (farmer + deployment_num + az_id), however many dispatch rows it has.
                const groups = groupDispatchRows(dispatchRows)
                const groupRowsByKey = new Map(groups.map((g) => [g.key, g.rows]))
                const sorted = sortRows(groups.length > 0 ? groups.map((g) => g.row) : initialRows)
                setState((prev) => {
                    if (prev.token !== loadToken) return prev
                    const byRow = new Map<string, FarmerRowDetail>()
                    for (const row of sorted) {
                        const key = getDeploymentRowKey(row)
                        const current = prev.byRow.get(key)
                        const groupRows = groupRowsByKey.get(key) ?? current?.groupRows ?? [row]
                        byRow.set(key, current ? { ...current, row, groupRows } : freshRow(row, groupRows))
                    }
                    return { ...prev, rows: sorted, dispatchRows, rowsError: null, rowsLoading: false, byRow }
                })
                // On a reload every row is read again (the seed row of a first open was already started below).
                const started = new Set(previous ? [] : initialRows.map(getDeploymentRowKey))
                const queue = sorted.filter((row) => !started.has(getDeploymentRowKey(row)))
                const next = (): void => {
                    if (cancelled || !isCurrent()) return
                    const row = queue.shift()
                    if (!row) return
                    void readRow(row, loadToken, isCurrent).then(next)
                }
                for (let i = 0; i < CONCURRENCY; i++) next()
            },
            (error: unknown) => {
                if (cancelled || !isCurrent()) return
                // The seed row still shows (its reads ran); the rest of the farmer is unknown — said so, with Retry.
                setState((prev) => (prev.token !== loadToken ? prev : { ...prev, rows: initialRows.length ? sortRows(initialRows) : null, dispatchRows: null, rowsError: errorMessage(error), rowsLoading: false }))
                if (previous) for (const row of initialRows) void readRow(row, loadToken, isCurrent)
            },
        )
        if (!previous) for (const row of initialRows) void readRow(row, loadToken, isCurrent)
        return () => {
            cancelled = true
        }
    }, [open, farmerId, seedRow, token, readRow])

    // One row again (after a mutation on it, or Retry on its dispatch read).
    React.useEffect(() => {
        const entries = Object.entries(rowTokens)
        if (entries.length === 0) return
        const loadToken = tokenRef.current
        for (const [rowKey] of entries) {
            const detail = stateRef.current.byRow.get(rowKey)
            if (!detail) continue
            setState((prev) => {
                const current = prev.byRow.get(rowKey)
                if (!current) return prev
                const byRow = new Map(prev.byRow)
                byRow.set(rowKey, { ...current, loading: true, nocLoading: true, dispatchesError: null })
                return { ...prev, byRow }
            })
            void readRow(detail.row, loadToken, () => tokenRef.current === loadToken)
        }
    }, [rowTokens, readRow])

    const reload = React.useCallback(() => setToken((t) => t + 1), [])
    const reloadRow = React.useCallback((rowKey: string) => setRowTokens((prev) => ({ ...prev, [rowKey]: (prev[rowKey] ?? 0) + 1 })), [])

    const loading = state.rowsLoading || [...state.byRow.values()].some((r) => r.loading)
    return { farmerId: state.farmerId, rows: state.rows, dispatchRows: state.dispatchRows, rowsError: state.rowsError, rowsLoading: state.rowsLoading, byRow: state.byRow, loading, reload, reloadRow }
}
