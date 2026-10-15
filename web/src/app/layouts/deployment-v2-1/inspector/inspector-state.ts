// V2.1: DESIGN-TIME — what the page is showing right now, for the Data / API Inspector's mapping section: the selected
// table record and the open FARMER detail (its rows, their dispatches and the map markers). The page and the detail
// sheet publish; only the Inspector reads. Kept out of the production data flow: nothing in the UI reads this store.
import * as React from "react"
import type { DeploymentMetadataRow, DeploymentV2Record, TrailerDispatchItem } from "../data/schema"

export interface InspectorMarker {
    id: string
    /** The plot deployment the marker stands for (null: a demo plot without one). */
    deploymentId: number | null
    source: string | null
    /** Fill colour from the source (null: hollow — source not recorded). */
    color: string | null
    amount: number | null
    /** Marker diameter (px) from the amount. */
    diameter: number
    outlinePoints: number
}

/** One list row (farmer + round + AZ) of the open farmer and what its reads returned. */
export interface InspectorDetailRow {
    row: DeploymentMetadataRow
    typeKey: string
    dispatches: TrailerDispatchItem[]
    loading: boolean
    error: string | null
    nocError: string | null
    historyFailed: boolean
}

export interface InspectorDetail {
    /** The detail sheet is open now (false: the last farmer opened, sheet since closed). */
    open: boolean
    farmerId: string
    /** The list row the detail was opened from (the table's selected dispatch's row). */
    row: DeploymentMetadataRow
    typeKey: string
    /** Every row of the farmer the detail read (round / AZ order), with its dispatches. */
    rows: InspectorDetailRow[]
    rowsError: string | null
    /** Every dispatch across the rows (what the map and the report selection work on). */
    trailers: TrailerDispatchItem[]
    loading: boolean
    error: string | null
    markers: InspectorMarker[]
    amountLabel: string | null
    /** The dispatch selected in the table (deployment_detail_id), if any. */
    selectedDispatchId: string | null
}

interface InspectorState {
    record: DeploymentV2Record | null
    detail: InspectorDetail | null
}

let state: InspectorState = { record: null, detail: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const inspectorState = {
    setRecord(record: DeploymentV2Record | null) {
        if (state.record === record) return
        state = { ...state, record }
        emit()
    },
    setDetail(detail: InspectorDetail | null) {
        state = { ...state, detail }
        emit()
    },
    subscribe(listener: () => void) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
    },
    getSnapshot: () => state,
}

const EMPTY: InspectorState = { record: null, detail: null }

export function useInspectorState(): InspectorState {
    return React.useSyncExternalStore(inspectorState.subscribe, inspectorState.getSnapshot, () => EMPTY)
}
