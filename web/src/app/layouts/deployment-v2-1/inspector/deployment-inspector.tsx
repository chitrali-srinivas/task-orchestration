"use client"

// V2.1: DESIGN-TIME — the Deployment V2.1 Data / API Inspector: the generic Inspector (src/components/data-inspector)
// with this layout's spec (deployment-inspector-spec.ts) plus two runtime sections built from what the page actually did:
//   API activity  every request (live HTTP / mock / not-sent test captures): parameters, body, status, timing, response,
//                 errors — newest first (data/api-trace.ts);
//   Data mapping  how the selected API row became the table row, the counts became tabs, and the open record's dispatches
//                 became cards and map markers (inspector-state.ts, record-mapping.ts).
// Opened from the toolbar (left of Filter). Not part of the production feature.
import * as React from "react"
import { DataInspector } from "@/components/data-inspector/data-inspector"
import { Chip, Disclosure, InspectorNote, InspectorSubheading, InspectorTable } from "@/components/data-inspector/inspector-primitives"
import { ApiActivity, FieldMappingTable, ShapeChangesTable, ValueCell } from "@/components/data-inspector/api-activity"
import { describeShapeChanges, useApiTrace, type ApiTraceEntry } from "@/components/data-inspector/api-trace"
import { deploymentTrace } from "../data/api-trace"
import { AUTH_SOURCE_LABEL, pageOrigin, useAuthSourceState } from "../data/auth-source"
import { describeDataSource, isLiveMode } from "../data/data-mode"
import { DISPATCH_GRAIN_COPY } from "../components/dispatch-grain-notice"
import { DEPLOYMENT_ENDPOINTS } from "../data/live-api"
import { getMockDeploymentStatusCounts } from "../data/mock-data"
import { useDeploymentRows } from "../data/data-source"
import type { DeploymentStatusCounts } from "../data/schema"
import { buildDeploymentInspectorSpec } from "./deployment-inspector-spec"
import { useInspectorState, type InspectorDetail } from "./inspector-state"
import { describeCountsMapping, describeRecordMapping } from "./record-mapping"

/** The newest finished entry for a path (its response is what the UI was built from). */
function latest(entries: readonly ApiTraceEntry[], path: string): ApiTraceEntry | undefined {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].path === path && entries[i].state === "ok") return entries[i]
    return undefined
}

/** Live: the raw dispatches the API sent for the open record (from the traced getTrailerDetails responses). */
function rawDispatches(entries: readonly ApiTraceEntry[], detail: InspectorDetail): Map<string, unknown> {
    const out = new Map<string, unknown>()
    for (const e of entries) {
        if (e.path !== DEPLOYMENT_ENDPOINTS.trailerDetails || e.source !== "live" || e.state !== "ok") continue
        // V2.1: the detail is farmer-level — every traced read of this farmer's rows counts.
        const req = (e.request as { trailerDetails?: { farmer_id?: unknown }[] } | undefined)?.trailerDetails?.[0]
        if (String(req?.farmer_id) !== detail.farmerId) continue
        const data = (e.response as { data?: unknown } | undefined)?.data
        if (Array.isArray(data)) for (const d of data) {
            const id = (d as { deployment_detail_id?: unknown })?.deployment_detail_id
            if (id !== undefined && id !== null) out.set(String(id), d)
        }
    }
    return out
}

function DetailMapping({ detail, entries }: { detail: InspectorDetail; entries: readonly ApiTraceEntry[] }) {
    const raw = isLiveMode ? rawDispatches(entries, detail) : new Map<string, unknown>()
    const plots = detail.trailers.reduce((n, d) => n + d.deployment_plots_data.length, 0)
    const rowOf = (d: { deployment_detail_id: string }) => detail.rows.find((r) => r.dispatches.some((x) => x.deployment_detail_id === d.deployment_detail_id))
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 text-xs">
                <Chip>{detail.open ? "open now" : "last opened (sheet closed)"}</Chip>
                <Chip>farmer <span className="font-semibold font-mono ml-1">{detail.farmerId}</span></Chip>
                <Chip>opened from round {detail.row.deployment_num} · AZ {detail.row.az_id} · <span className="font-semibold ml-1">{detail.typeKey}</span></Chip>
                <Chip>rows (round · AZ) <span className="font-semibold ml-1">{detail.rows.length}</span></Chip>
                <Chip>dispatches <span className="font-semibold ml-1">{detail.trailers.length}</span></Chip>
                <Chip>plot deployments <span className="font-semibold ml-1">{plots}</span></Chip>
                <Chip>map markers <span className="font-semibold ml-1">{detail.markers.length}</span></Chip>
                {detail.selectedDispatchId && <Chip>selected dispatch <span className="font-mono font-semibold ml-1">{detail.selectedDispatchId}</span></Chip>}
                {detail.loading && <Chip>loading…</Chip>}
            </div>
            {detail.rowsError && <InspectorNote kind="open">The farmer&apos;s rows couldn&apos;t be read: {detail.rowsError}</InspectorNote>}
            {detail.error && <InspectorNote kind="open">A dispatch read failed: {detail.error}</InspectorNote>}
            <div className="space-y-2">
                <InspectorSubheading>Farmer rows → detail sections</InspectorSubheading>
                <p className="text-xs text-zinc-500">The farmer&apos;s list rows are dispatches; they are grouped by farmer · round · AZ, and each group gets one getTrailerDetails (its AZ, <code>status</code> omitted), one NOC read and one history read. <code>action_required</code> / <code>err_msg</code> are per dispatch: each card shows its own dispatch&apos;s.</p>
                <InspectorTable
                    data-mapping-rows=""
                    columns={["Round", "AZ", "Type", "List dispatch rows", "Returned", "Count check", "Flagged dispatches", "Read"]}
                    rows={detail.rows.map((r) => {
                        // How many dispatch rows the list holds for the group vs what its dispatch read returned (diagnostics only).
                        const stated = r.row.trailers_deployed
                        const check = r.loading || r.error ? "—"
                            : stated === null ? "not known yet (the farmer's rows aren't read)"
                            : stated === r.dispatches.length ? "match"
                            : stated > r.dispatches.length ? `${stated - r.dispatches.length} fewer returned than the list holds`
                            : `${r.dispatches.length - stated} more returned than the list holds (API inconsistency)`
                        return [
                            r.row.deployment_num,
                            r.row.az_id,
                            r.typeKey,
                            stated ?? "—",
                            r.dispatches.length,
                            <span key="check" data-count-check={stated === null ? "missing" : stated === r.dispatches.length ? "match" : "mismatch"}>{check}</span>,
                            r.dispatches.filter((d) => d.action_required === true).length,
                            r.loading ? "loading…" : r.error ? `failed: ${r.error}` : "ok",
                        ]
                    })}
                />
            </div>
            <div className="space-y-2">
                <InspectorSubheading>Dispatches → cards and table rows</InspectorSubheading>
                <p className="text-xs text-zinc-500">The card&apos;s state is <code>franchise_status</code> relabelled (approved → Verified, pending → Pending, rejected → Need Correction); nothing is derived.</p>
                <InspectorTable
                    data-mapping-dispatches=""
                    columns={["Dispatch", "dispatch_id", "Round · AZ", "franchise_status", "Trailer", "Plots", "Located", "Outlines"]}
                    rows={detail.trailers.map((d) => {
                        const r = rowOf(d)
                        return [
                            <span key="id" className="font-mono text-[11px]">{d.deployment_detail_id}</span>,
                            d.dispatch_id,
                            r ? `${r.row.deployment_num} · ${r.row.az_id}` : "—",
                            d.franchise_status ?? "— (none sent)",
                            d.trailer_no || "—",
                            d.deployment_plots_data.length,
                            d.deployment_plots_data.filter((p) => p.location).length,
                            d.deployment_plots_data.filter((p) => p.geometry).length,
                        ]
                    })}
                />
                {isLiveMode ? (
                    raw.size === 0 ? <p className="text-xs text-zinc-500">No traced getTrailerDetails response for this record yet.</p> : (
                        <Disclosure label="View normalisation changes (API dispatch → shown dispatch)">
                            <div className="space-y-3 pt-2">
                                {detail.trailers.map((d) => (
                                    <div key={d.deployment_detail_id} className="space-y-1">
                                        <p className="text-[11px] font-semibold font-mono">{d.deployment_detail_id}</p>
                                        <ShapeChangesTable changes={describeShapeChanges(raw.get(String(d.deployment_detail_id)), d)} />
                                    </div>
                                ))}
                            </div>
                        </Disclosure>
                    )
                ) : (
                    <InspectorNote kind="mock">Mock dispatches are stored API-shaped, so nothing is normalised. In live mode this section lists the key changes live-normalize.ts makes (strings → numbers, defaults, dropped keys).</InspectorNote>
                )}
            </div>
            <div className="space-y-2">
                <InspectorSubheading>Plots → map markers</InspectorSubheading>
                <p className="text-xs text-zinc-500">Colour = source ({detail.amountLabel ? "size = " + detail.amountLabel : "no amount for this type"}). A hollow marker means the source isn&apos;t recorded.</p>
                <InspectorTable
                    data-mapping-markers=""
                    columns={["Marker", "Deployment", "Source", "Colour", "Amount", "Diameter", "Outline points"]}
                    rows={detail.markers.map((m) => [
                        <span key="id" className="font-mono text-[11px]">{m.id}</span>,
                        m.deploymentId ?? "—",
                        m.source ?? <span key="s" className="text-zinc-400">not recorded</span>,
                        m.color ? <span key="c" className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-zinc-300" style={{ background: m.color }} /><span className="font-mono text-[11px]">{m.color}</span></span> : "hollow",
                        <ValueCell key="a" value={m.amount ?? undefined} />,
                        `${m.diameter} px`,
                        m.outlinePoints || "—",
                    ])}
                />
            </div>
        </div>
    )
}

function DataMapping() {
    const { record, detail } = useInspectorState()
    const entries = useApiTrace(deploymentTrace)
    const rows = useDeploymentRows()
    const countsEntry = isLiveMode ? latest(entries, DEPLOYMENT_ENDPOINTS.counts) : undefined
    const rawCounts: DeploymentStatusCounts | null = isLiveMode
        ? ((countsEntry?.response as { data?: DeploymentStatusCounts } | undefined)?.data ?? null)
        : getMockDeploymentStatusCounts(rows)
    return (
        <div data-inspector-mapping className="space-y-6 min-w-0">
            <InspectorNote kind={isLiveMode ? "observed" : "mock"}>
                {isLiveMode ? "Live mode: values below are the dev API's responses and the UI built from them." : "Mock mode: rows come from the in-memory mock backend (API-shaped); the mapping to the UI is the same code live mode uses."}
            </InspectorNote>
            <div className="space-y-2">
                <InspectorSubheading>Selected table row → table cells</InspectorSubheading>
                {record ? <FieldMappingTable data-mapping-record="" rows={describeRecordMapping(record)} /> : <p data-mapping-empty className="text-xs text-zinc-500">Open a row in the table to see how each of its cells was produced.</p>}
            </div>
            <div className="space-y-2">
                <InspectorSubheading>Counts → tabs</InspectorSubheading>
                {rawCounts ? <FieldMappingTable data-mapping-counts="" rows={describeCountsMapping(rawCounts)} /> : <p className="text-xs text-zinc-500">No counts response yet.</p>}
            </div>
            <div className="space-y-2">
                <InspectorSubheading>Open record → detail</InspectorSubheading>
                {detail ? <DetailMapping detail={detail} entries={entries} /> : <p className="text-xs text-zinc-500">Open a row to see its dispatches, plots and markers.</p>}
            </div>
        </div>
    )
}

/**
 * V2.1: the data source the page is REALLY using, above the activity list — the effective mode and why, the API host
 * (live), and the session a live call carries (the app's Firebase session / the dev token / none; presence only).
 * Mock results are never labelled live: every entry below carries its own source badge.
 */
function DataSourcePanel() {
    const source = describeDataSource()
    const auth = useAuthSourceState()
    const live = source.mode === "live"
    return (
        <InspectorNote kind={live ? "observed" : "mock"}>
            <div data-inspector-data-source data-data-mode={source.mode} data-auth-source={live ? auth.source : undefined} className="space-y-1">
                <p><span className="font-semibold">Data source: {live ? (source.configured ? `Live · ${source.apiHost}` : "Live · not configured") : "Mock"}.</span> {source.reason}</p>
                {!live && auth.ready && auth.devToken && (
                    <p data-inspector-token-ignored="">A dev token is present in this origin&apos;s localStorage ({pageOrigin()}), but this build is mock, so it is never read — nothing shown here is live.</p>
                )}
                {live && source.configured && (
                    <p data-inspector-session={auth.ready ? auth.source : "checking"}>
                        Session: {auth.ready ? AUTH_SOURCE_LABEL[auth.source] : "checking…"}
                        {auth.ready && auth.source === "none" && ` — every call is refused before it is sent. Sign in to this app (its Firebase project must be the Matic API's), or set the dev token in THIS origin's localStorage (${pageOrigin() || "this origin"}, key mati_dev_auth_token — localStorage is per origin, so a token stored on another port or host is not visible here) and reload.`}
                        {auth.ready && auth.source === "firebase-session" && " — accepted only if this app's Firebase project is the Matic API's; a rejected token is refreshed once, then the call fails as 401 here."}
                        {auth.ready && auth.source === "dev-token" && " — a matic-dash dev session's token; it expires (~1 h) and cannot be refreshed here."}
                    </p>
                )}
                {source.prerequisite && <p>{source.prerequisite}</p>}
                <p data-dispatch-grain-copy className="text-zinc-500">Table rows: {DISPATCH_GRAIN_COPY}</p>
                <p className="text-zinc-500">Every entry below says which transport answered it: Live (a real request), Mock (in memory), Not sent (test-mode capture); failures are marked as errors with the status.</p>
            </div>
        </InspectorNote>
    )
}

export function DeploymentInspector({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const rows = useDeploymentRows()
    const spec = React.useMemo(() => buildDeploymentInspectorSpec({ live: isLiveMode, rows }), [rows])
    const sections = React.useMemo(() => [
        {
            id: "activity",
            title: "API activity",
            description: "Every request this page made, newest first: Live = a real HTTP request, Mock = answered in memory, Not sent = a test-mode capture. Expand an entry for its parameters, body, response and error. No headers or tokens are recorded.",
            content: <><DataSourcePanel /><ApiActivity trace={deploymentTrace} emptyHint={isLiveMode ? "No requests yet: the table loads on open." : "No mock calls yet: the table loads on open."} /></>,
        },
        {
            id: "mapping",
            title: "Data mapping",
            description: "How the API's data became what the page shows: the selected row's cells, the tab counts, and the open record's dispatches and map markers.",
            content: <DataMapping />,
        },
    ], [])
    return (
        <DataInspector
            open={open}
            onOpenChange={onOpenChange}
            spec={spec}
            sections={sections}
            initialSection="activity"
            subtitle="What Deployment V2.1 reads and writes, the requests it actually made, and how each API field reaches the screen."
        />
    )
}
