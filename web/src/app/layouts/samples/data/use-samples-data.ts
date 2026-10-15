// PORT-BOUND (shape) — read hooks for the Samples UI over SamplesApi. Each read is abortable, keeps its data while
// the SAME subject refetches (a mutation succeeded → data version changed), and drops it for a new subject.
// matic-dash: replace with useQuery / invalidateQueries (keys: ["samples", "farmer", farmerId], …) — the hook
// signatures stay, so components don't change.
"use client"

import * as React from "react"
import type { FarmerSamplesDetail, FilterOptionsResponse, SampleEvent, Session } from "../domain/types"
import { samplesApi, useSamplesDataVersion } from "./data-source"

export interface AsyncState<T> {
    data: T | null
    error: string | null
    isLoading: boolean
    retry: () => void
}

interface Loaded<T> { subject: string; data: T | null; error: string | null; isLoading: boolean }

/** `subject` identifies what is read (null: nothing); `refresh` changes when the same subject must be re-read. */
function useAsync<T>(subject: string | null, refresh: number, load: (signal: AbortSignal) => Promise<T>): AsyncState<T> {
    const [state, setState] = React.useState<Loaded<T>>({ subject: "", data: null, error: null, isLoading: false })
    const [attempt, setAttempt] = React.useState(0)
    const loadRef = React.useRef(load)
    React.useEffect(() => { loadRef.current = load })
    React.useEffect(() => {
        if (subject === null) return
        const controller = new AbortController()
        setState((prev) => ({ subject, data: prev.subject === subject ? prev.data : null, error: null, isLoading: true }))
        loadRef.current(controller.signal).then(
            (data) => { if (!controller.signal.aborted) setState({ subject, data, error: null, isLoading: false }) },
            (error: unknown) => {
                if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return
                setState((prev) => ({ ...prev, subject, error: error instanceof Error ? error.message : String(error), isLoading: false }))
            }
        )
        return () => controller.abort()
    }, [subject, refresh, attempt])
    const retry = React.useCallback(() => setAttempt((n) => n + 1), [])
    if (subject === null) return { data: null, error: null, isLoading: false, retry }
    const current = state.subject === subject
    return { data: current ? state.data : null, error: current ? state.error : null, isLoading: current ? state.isLoading : true, retry }
}

export function useSamplesSession(): AsyncState<Session> {
    return useAsync("session", 0, () => samplesApi.getSession())
}

export function useSamplesFilterOptions(): AsyncState<FilterOptionsResponse> {
    return useAsync("filter-options", 0, () => samplesApi.getFilterOptions())
}

export function useFarmerDetail(farmerId: string | null): AsyncState<FarmerSamplesDetail> {
    const version = useSamplesDataVersion()
    return useAsync(farmerId, version, (signal) => samplesApi.getFarmerDetail(farmerId!, signal))
}

export function useFarmerHistory(farmerId: string | null, enabled: boolean): AsyncState<SampleEvent[]> {
    const version = useSamplesDataVersion()
    return useAsync(farmerId && enabled ? `history:${farmerId}` : null, version, (signal) => samplesApi.getFarmerHistory(farmerId!, signal))
}
