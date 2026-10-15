"use client"

// Deployment V2.1 — the working version cloned from Deployment V2 Oct 26 (src/app/layouts/deployment-v2-oct-26),
// itself a clone of the existing Deployment page (src/app/layouts/deployment/page.tsx). V2.1 evolves independently:
// V2 and the original Deployment page stay unchanged. V2.1-only changes are tagged "V2.1:" in comments.
//
// V2.1: the table is DISPATCH-level, and so is the list API (live API audit, verified 2026-10-11:
// getDeploymentMetadata returns one row per dispatch; its `status` filter, paging and getDeploymentStatusCounts are per
// dispatch). Each tab sends its status to the server (as Deployment V2 does) and shows the server's dispatch count; a
// table row is a list row. The Boundaries column alone reads each loaded deployment's plots (hooks/use-dispatch-rows.ts).
// A row click opens the FARMER's detail with that dispatch selected; Previous / Next move between the loaded farmers.
import * as React from "react"
import { NavBarType4 } from "@/components/nav-bars/NavBarType4"
import { EngagementTable } from "./components/data-table"
import { DeploymentDetailSheet } from "./components/deployment-detail-sheet"
import { dispatchColumns } from "./components/dispatch-columns"
import { DispatchGrainStatus } from "./components/dispatch-grain-notice"
import type { BoundaryCell } from "./components/dispatch-columns"
import type { DeploymentMetadataRow, DeploymentV2Record } from "./data/schema"
import { EngagementFilters } from "@/app/layouts/deployment/data/schema"
import { useDeploymentV2DataSource } from "./data/data-source"
import { describeDataSource } from "./data/data-mode"
import { useInfinitePagesDataSource } from "./data/infinite-pages"
import { reportedSortOf, useReportedSortMemory } from "./data/reported-sort"
import { checkPlotBoundary } from "./data/boundary-gate"
import { toDeploymentV2Record } from "./data/adapter"
import { dispatchRowKey, farmerOrder, summarizeDispatchRows, toDispatchRows, type DispatchDisplayRow } from "./data/dispatch-rows"
import { useGroupDispatchReads } from "./hooks/use-dispatch-rows"
import { DataInspectorTrigger } from "@/components/data-inspector/data-inspector"
import { DeploymentInspector } from "./inspector/deployment-inspector"
import { inspectorState } from "./inspector/inspector-state"
import { useServerTable } from "@/lib/server-table"
import { surveyData } from "@/app/components/survey/SurveyComponents"

type Tab = "All" | "Verified" | "Pending" | "Invalid"

/*
 * V2.1: the table shows the rows in the order the API returns them. No default sort is sent (the list request carries
 * no sort_by / sort_order until a column is sorted from its header menu), and nothing reorders the rows on the client
 * (manual sorting; toDispatchRows maps one to one; data/infinite-pages.ts appends pages in order). A header sort is
 * sent to the server and kept for that tab's pages and filters; a tab change clears it, so every tab opens in its
 * API order. (Replaces the Submitted on, newest first default of 2026-10-11 — QA-20 — at the user's request,
 * 2026-10-12: live, the server's own order is oldest first for pending.) With no column sorted, the header shows the
 * API's order when the API reports it (data/reported-sort.ts: PROPOSED pagination.sort_by / sort_order) — its column's
 * arrow, Asc / Desc checked — and nothing when it doesn't.
 */

/** A tab count as shown: the server's number; "—" when the counts read failed (never guessed); blank before the first response. */
const shownCount = (n: number | undefined) => (n === undefined ? "" : Number.isFinite(n) ? n : "—")

/** What is open in the detail: the farmer, the dispatch picked in the table (its dispatch_id; null after Previous / Next), the list row it came from. */
interface Selection {
    farmerId: string
    dispatchId: string | null
    seedRow: DeploymentMetadataRow
}

/**
 * V2.1 (prototype only — production has no data mode): says so on the page whenever it is NOT showing live API data — the
 * in-memory mock, or a live build without a valid API URL — so a mock page is never taken for a live one. Nothing in live
 * mode (the Inspector's Data source panel names the host there). The mode is fixed when the server starts (data-mode.ts).
 */
function DataModeChip() {
    const source = describeDataSource()
    if (source.mode === "live" && source.configured) return null
    const label = source.mode === "mock" ? "Mock data" : "Live API not configured"
    return (
        <span
            data-page-data-mode={source.mode}
            role="status"
            title={[source.reason, source.prerequisite].filter(Boolean).join(" ")}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
        >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            {label}
        </span>
    )
}

/** V2.1: while the detail is open, the next page loads once the selected farmer is among the last this many loaded. */
const PREFETCH_FARMERS = 3

export default function DeploymentV21Page() {
    const [selection, setSelection] = React.useState<Selection | null>(null)
    /** V2.1: the Data / API Inspector (design-time; opened from the toolbar, left of Filter). */
    const [inspectorOpen, setInspectorOpen] = React.useState(false)
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<Tab>("Verified")
    // V2.1 (prototype): which data this page shows is fixed when the server starts (data-mode.ts) — said once in the
    // console as well as in the Inspector's Data source panel, so a mock page is never taken for a live one
    React.useEffect(() => {
        const source = describeDataSource()
        console.info(`[Deployment V2.1] Data: ${source.mode === "live" ? `LIVE (${source.apiHost ?? "no API host"})` : "MOCK (in-memory)"} — ${source.reason}${source.prerequisite ? ` ${source.prerequisite}` : ""}`)
    }, [])
    const [language, setLanguage] = React.useState<"en" | "hi">("en")

    // Infinite scroll: page N of a query returns pages 1..N (see data/infinite-pages.ts); a dispatch repeated across
    // page boundaries (same dispatch_id) is shown once. The outer wrapper remembers the order the API reported.
    const dataSource = useReportedSortMemory(useInfinitePagesDataSource(useDeploymentV2DataSource(), dispatchRowKey))

    // V2.1: each tab is the server's dispatch-status filter (query-mapper.ts: Verified → approved, Pending → pending,
    // Need Correction → need_correction, All → all), as Deployment V2 sends it. A tab change re-queries from page 1.
    const serverTable = useServerTable<DeploymentV2Record, EngagementFilters>({
        dataSource,
        initialFilters: { status: "Verified" },
        initialSort: null,
        initialPageSize: 20,
        debounceMs: 350,
    })

    // Infinite scroll. useServerTable resets the page to 1 whenever the tab, a filter or the sort changes. Page 1
    // uses the table's full loading / error states; later pages load below the rows already shown.
    const { pageIndex } = serverTable.pagination
    const { onPaginationChange } = serverTable
    const [shownPage, setShownPage] = React.useState({ data: serverTable.data, pageIndex })
    if (shownPage.data !== serverTable.data) setShownPage({ data: serverTable.data, pageIndex })
    const shownPageIndex = shownPage.pageIndex
    const isPageRequested = pageIndex !== shownPageIndex
    const isLoadingFirstPage = serverTable.isLoading && pageIndex === 0
    const isLoadingMore = pageIndex > 0 && !serverTable.error && (serverTable.isLoading || isPageRequested)
    const hasMore = !serverTable.isLoading && !isPageRequested && !serverTable.error && pageIndex + 1 < serverTable.pageCount
    const handleLoadMore = React.useCallback(() => {
        onPaginationChange((prev) => (prev.pageIndex === shownPageIndex ? { ...prev, pageIndex: shownPageIndex + 1 } : prev))
    }, [onPaginationChange, shownPageIndex])

    // V2.1: the table rows ARE the server's dispatch rows, in its order (no expansion, no client-side filter or sort).
    const rows = React.useMemo(() => toDispatchRows(serverTable.data), [serverTable.data])
    // The header's sort: the column sort chosen on this tab (sent to the server); else the order the API reported for
    // the rows shown — display only, nothing is sent for it; else none.
    const reportedSort = reportedSortOf(serverTable.data)
    const shownSorting = React.useMemo(
        () => (serverTable.sorting.length > 0 ? serverTable.sorting : reportedSort ? [{ id: reportedSort.columnId, desc: reportedSort.direction === "desc" }] : []),
        [serverTable.sorting, reportedSort]
    )
    const sortSource = serverTable.sorting.length > 0 ? "column" : reportedSort ? "api" : "none"
    // The tab counts: the server's dispatch counts for the active filters (getDeploymentStatusCounts).
    const summaryCounts = serverTable.summaryCounts as { all: number; verified: number; pending: number; invalid: number } | undefined
    const countsUnavailable = !!summaryCounts && [summaryCounts.all, summaryCounts.verified, summaryCounts.pending, summaryCounts.invalid].some((n) => !Number.isFinite(n))
    const tabCounts = { all: shownCount(summaryCounts?.all), verified: shownCount(summaryCounts?.verified), pending: shownCount(summaryCounts?.pending), invalid: shownCount(summaryCounts?.invalid) }
    const summary = React.useMemo(() => summarizeDispatchRows(rows, serverTable.totalCount), [rows, serverTable.totalCount])

    // The Boundaries column: one dispatch read per loaded deployment (farmer · round · AZ), never per row.
    const groupReads = useGroupDispatchReads(serverTable.data)
    const boundaryOf = React.useCallback((row: DispatchDisplayRow): BoundaryCell => {
        const state = groupReads.states.get(row.rowKey)
        if (!state) return { state: "loading" }
        if (state.status === "error") return { state: "error", error: state.error, groupKey: row.rowKey }
        const dispatch = row.dispatchId === null ? undefined : state.dispatches.find((d) => String(d.dispatch_id) === row.dispatchId)
        if (!dispatch) return { state: "not-in-read" }
        const plots = dispatch.deployment_plots_data
        return { state: "ok", saved: plots.filter((p) => checkPlotBoundary(p).state === "saved").length, plots: plots.length }
    }, [groupReads.states])
    const boundaryFailures = React.useMemo(() => new Set(rows.map((r) => r.rowKey).filter((key) => groupReads.states.get(key)?.status === "error")).size, [rows, groupReads.states])
    // Columns follow Deployment V2's order and labels; Verified By is shown on the Verified / All tabs only (as V2).
    const columns = React.useMemo(() => dispatchColumns({ boundaryOf, onRetryBoundary: groupReads.retry, tab: activeTab }), [boundaryOf, groupReads.retry, activeTab])

    const handleTabChange = (val: string) => {
        const nextTab = val as Tab
        setActiveTab(nextTab)
        // Every tab opens in its API order: a header sort chosen on the previous tab is cleared (same render as the
        // status change, so one request; setFilter returns to page 1).
        if (serverTable.sorting.length > 0) serverTable.setSorting([])
        serverTable.setFilter("status", nextTab === "All" ? undefined : nextTab)
    }

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === "All" ? {} : { status: activeTab })
    }, [activeTab, serverTable])

    /** A dispatch row opens its FARMER's detail with that dispatch selected (a row without a dispatch id: the farmer only). */
    const handleRowClick = (row: DispatchDisplayRow) => {
        setSelection({ farmerId: String(row.record.api.farmer_id), dispatchId: row.dispatchId, seedRow: row.record.api })
        setIsDrawerOpen(true)
    }

    // Previous / Next = the loaded farmers, in list order (Samples: farmers, not rows) — each farmer once, by id.
    const farmers = React.useMemo(() => farmerOrder(rows), [rows])
    const farmerIndex = selection ? farmers.findIndex((f) => f.farmerId === selection.farmerId) : -1
    const goToFarmer = React.useCallback((index: number) => {
        const target = farmers[index]
        if (!target) return
        setSelection({ farmerId: target.farmerId, dispatchId: null, seedRow: target.row })
    }, [farmers])
    // V2.1: background paging while the detail is open — the table's own load more (same query, next page; the page
    // index only moves when no page is pending, so repeated renders or clicks ask once). The end is the server's: rows
    // beyond the loaded pages exist while the shown page isn't the last of its page count.
    const moreFarmers = shownPageIndex + 1 < serverTable.pageCount
    const loadMoreError = pageIndex > 0 ? serverTable.error : null
    React.useEffect(() => {
        if (isDrawerOpen && farmerIndex >= 0 && farmerIndex >= farmers.length - PREFETCH_FARMERS && hasMore) handleLoadMore()
    }, [isDrawerOpen, farmerIndex, farmers.length, hasMore, handleLoadMore])
    // Next at the last loaded farmer, while more exist: wait for that page and then move on — unless the verifier moves
    // first, closes the detail, opens an overlay over it (boundary editor, media, NOC review) or the page fails.
    const [pendingNextFrom, setPendingNextFrom] = React.useState<string | null>(null)
    const pendingNext = pendingNextFrom !== null && isDrawerOpen && selection?.farmerId === pendingNextFrom && !loadMoreError && moreFarmers
    React.useEffect(() => {
        if (pendingNextFrom === null) return
        if (!pendingNext) { setPendingNextFrom(null); return }
        if (farmerIndex >= 0 && farmerIndex < farmers.length - 1) {
            setPendingNextFrom(null)
            goToFarmer(farmerIndex + 1)
        }
    }, [pendingNextFrom, pendingNext, farmerIndex, farmers.length, goToFarmer])
    const handleNext = () => {
        if (farmerIndex >= 0 && farmerIndex < farmers.length - 1) { goToFarmer(farmerIndex + 1); return }
        if (!selection || !moreFarmers) return
        setPendingNextFrom(selection.farmerId)
        if (loadMoreError) serverTable.retry()
        else if (hasMore) handleLoadMore()
    }
    const handlePrevious = () => { setPendingNextFrom(null); goToFarmer(farmerIndex - 1) }
    const handleOverlayChange = React.useCallback((overlayOpen: boolean) => { if (overlayOpen) setPendingNextFrom(null) }, [])
    const isFirst = farmerIndex <= 0
    const atLoadedEnd = farmerIndex >= 0 && farmerIndex >= farmers.length - 1
    // Next is disabled only at the confirmed end (no farmer after this one, and no page left to read).
    const isLast = farmerIndex === -1 || (atLoadedEnd && !moreFarmers)
    const navStatus: "idle" | "loading" | "error" = pendingNext || (atLoadedEnd && isLoadingMore) ? "loading" : atLoadedEnd && loadMoreError && moreFarmers ? "error" : "idle"

    // The Inspector's "selected row": the list row of the selected dispatch — else (a dispatch expanded in the detail that
    // this tab doesn't list) the row the detail was opened from.
    const selectedRecord = React.useMemo(() => {
        if (!selection) return null
        return (selection.dispatchId ? rows.find((r) => r.dispatchId === selection.dispatchId)?.record : undefined)
            ?? rows.find((r) => r.record.api === selection.seedRow)?.record
            ?? toDeploymentV2Record(selection.seedRow, 0)
    }, [rows, selection])
    React.useEffect(() => { inspectorState.setRecord(selectedRecord) }, [selectedRecord])
    React.useEffect(() => () => inspectorState.setRecord(null), [])

    // The existing survey data the sheet's legacy question list reads (questions 1–16; unchanged from V2).
    const filteredSurveyData = React.useMemo(() => surveyData.filter((item) => { const idNum = parseInt(item.id); return idNum >= 1 && idNum <= 16 }), [])
    const hasLocationQuestion = React.useMemo(() => filteredSurveyData.some((item) => item.id === "7"), [filteredSurveyData])

    return (
        <NavBarType4
            pageTitle="Deployment V2.1"
            activeItemUrl="#deployment"
            pageDescription="Track and manage ongoing farmer interactions, feedback, and survey responses. Review verification status, monitor pending tasks, and address records requiring correction to ensure high-quality data collection."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] px-4 pt-3 pb-4 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    {/* The loaded dispatch rows as data attributes (diagnostics / tests); the grain is explained in the Inspector. */}
                    <div
                        className="flex-1 min-h-0 w-full overflow-hidden flex flex-col"
                        data-dispatch-grain
                        data-dispatch-rows={summary.dispatchRows}
                        data-dispatch-total={summary.total}
                        data-rows-without-id={summary.withoutId}
                        data-rows-flagged={summary.flagged}
                        data-boundary-failures={boundaryFailures}
                        data-counts-unavailable={countsUnavailable ? "true" : undefined}
                        data-sort-source={sortSource}
                        data-api-sort={reportedSort ? `${reportedSort.sortBy} ${reportedSort.direction}` : undefined}
                    >
                        <EngagementTable
                            data={rows}
                            columns={columns}
                            onRowClick={handleRowClick}
                            activeTab={activeTab}
                            setActiveTab={handleTabChange}
                            counts={tabCounts}
                            selectedId={selection?.dispatchId ? `dispatch:${selection.dispatchId}` : undefined}
                            /* beside the table's controls (V2's density): the Inspector trigger only — the data source and the
                               dispatch-grain explanation live in the Inspector; failed boundary reads surface in the status line */
                            inspector={<><DataModeChip /><DataInspectorTrigger onClick={() => setInspectorOpen(true)} /></>}
                            notice={!isLoadingFirstPage && !serverTable.error ? <DispatchGrainStatus boundaryFailures={boundaryFailures} withoutId={summary.withoutId} onRetryFailed={groupReads.retryFailed} /> : null}
                            isLoading={isLoadingFirstPage}
                            isInitialLoading={serverTable.isInitialLoading}
                            error={pageIndex === 0 ? serverTable.error : null}
                            onRetry={serverTable.retry}
                            hasMore={hasMore}
                            onLoadMore={handleLoadMore}
                            isLoadingMore={isLoadingMore}
                            loadMoreError={pageIndex > 0 ? serverTable.error : null}
                            onRetryLoadMore={serverTable.retry}
                            hasActiveFilters={serverTable.hasActiveFilters}
                            onClearFilters={handleClearFilters}
                            pageCount={serverTable.pageCount}
                            rowCount={serverTable.totalCount}
                            pagination={serverTable.pagination}
                            onPaginationChange={serverTable.onPaginationChange}
                            sorting={shownSorting}
                            onSortingChange={serverTable.onSortingChange}
                            columnFilters={serverTable.columnFilters}
                            onColumnFiltersChange={serverTable.onColumnFiltersChange}
                        />
                    </div>
                </div>

                <DeploymentInspector open={inspectorOpen} onOpenChange={setInspectorOpen} />

                <DeploymentDetailSheet
                    farmerId={selection?.farmerId ?? null}
                    seedRow={selection?.seedRow ?? null}
                    selectedDispatchId={selection?.dispatchId ?? null}
                    onSelectDispatch={(id) => setSelection((prev) => (prev ? { ...prev, dispatchId: id } : prev))}
                    open={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    isFirst={isFirst}
                    isLast={isLast}
                    currentIndex={farmerIndex}
                    totalCount={farmers.length}
                    moreFarmers={moreFarmers}
                    navStatus={navStatus}
                    onRetryNav={serverTable.retry}
                    onOverlayChange={handleOverlayChange}
                    surveyData={filteredSurveyData}
                    hasLocationQuestion={hasLocationQuestion}
                    language={language}
                    onLanguageChange={setLanguage}
                    defaultTab={
                        activeTab === "All" ? "all" :
                        activeTab === "Verified" ? "verified" :
                        activeTab === "Pending" ? "pending" :
                        activeTab === "Invalid" ? "need_correction" : "all"
                    }
                />

                {/* V2.1: no system-information footer (version / session id / last refreshed — placeholder values); the
                    data-mode badge and the Inspector's Data source panel say what the page is using. */}
            </div>
        </NavBarType4>
    )
}
