"use client"

// Samples — unified verification of deployment and control samples (design-first; mock backend over the CSV export).
// Deployment V2's page pattern with sample data: the same table, tabs (same order), filters, column menus, detail
// sheet with map, dialogs and infinite scroll.
//   Table   ONE ROW = ONE SAMPLE (row identity = sample id); tab counts, paging and filters are per sample.
//   Detail  opened from a sample row, in the context of that sample's FARMER: every sample of theirs across AZs,
//           filtered by status, with the selected sample revealed. Previous / Next move between FARMERS (as V2's
//           Previous / Next move between its rows, which are farmers).
// Data: UI → data/data-source.ts (the swap point) → SamplesApi → mock backend. Nothing here computes a status or a count.
// Design: docs/samples/samples-feature-discovery-and-design.md.
import * as React from "react"
import type { ColumnFiltersState, VisibilityState } from "@tanstack/react-table"
import { NavBarType4 } from "@/components/nav-bars/NavBarType4"
import { DataInspectorTrigger } from "@/components/data-inspector/data-inspector"
import { useServerTable } from "@/lib/server-table"
import { useInfinitePagesDataSource } from "@/app/layouts/deployment-v2-oct-26/data/infinite-pages"
import { buildColumns, COLUMN_TITLES, FILTER_FIELD_FOR_COLUMN, type SamplesTab } from "./components/columns"
import { SampleDetailSheet } from "./components/sample-detail-sheet"
import { SamplesFilterSheet, isFilterValueActive, type FilterDraft, type FilterField } from "./components/samples-filter-sheet"
import { SamplesTable } from "./components/samples-table"
import { SamplesToolbar } from "./components/samples-toolbar"
import { BUCKET_LABEL, KIND_LABEL, PURPOSE_LABEL, farmerName, personName } from "./domain/labels"
import { SAMPLE_PURPOSES, type SampleListRow } from "./domain/types"
import { useMockDbSnapshot, useSamplesTableDataSource } from "./data/data-source"
import type { SamplesTableFilters } from "./data/query-mapper"
import { useSamplesFilterOptions, useSamplesSession } from "./data/use-samples-data"
import { SamplesInspector } from "./inspector/samples-inspector"

/** Deployment V2's tab order and default (All · Verified · Pending · Need Correction; Verified selected first). */
const TABS: SamplesTab[] = ["all", "approved", "pending", "need_correction"]
const TAB_LABEL: Record<SamplesTab, string> = { all: "All", ...BUCKET_LABEL }
const sampleRowKey = (row: SampleListRow) => row.sample_id

interface Selection {
    farmerId: string
    /** The sample row that opened the detail (revealed there); null after Previous / Next moved to another farmer. */
    sampleId: string | null
    openedFrom: SamplesTab
}

export default function SamplesPage() {
    const [tab, setTab] = React.useState<SamplesTab>("approved")
    const [selected, setSelected] = React.useState<Selection | null>(null)
    const [sheetOpen, setSheetOpen] = React.useState(false)
    const [filterSheet, setFilterSheet] = React.useState<{ open: boolean; field: string | null }>({ open: false, field: null })
    const [inspectorOpen, setInspectorOpen] = React.useState(false)
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

    const session = useSamplesSession()
    const options = useSamplesFilterOptions()
    const mockDb = useMockDbSnapshot()

    // Infinite scroll over the page-based contract (Deployment V2's wrapper, reused unchanged); rows are samples.
    const dataSource = useInfinitePagesDataSource(useSamplesTableDataSource(), sampleRowKey)
    const serverTable = useServerTable<SampleListRow, SamplesTableFilters>({
        dataSource,
        initialFilters: { bucket: "approved" },
        initialPageSize: 20,
        debounceMs: 350,
    })

    // Deployment V2's infinite-scroll bookkeeping: page 1 uses the table's loading / error states; later pages load
    // below the rows already shown, and each page is asked for once.
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

    const columns = React.useMemo(() => buildColumns(tab), [tab])
    const counts = serverTable.summaryCounts as (Record<SamplesTab, number> & { farmers: number }) | undefined

    const handleTabChange = (value: string) => {
        setTab(value as SamplesTab)
        serverTable.setFilter("bucket", value as SamplesTab)
    }

    const columnFilters = serverTable.columnFilters
    const applied: FilterDraft = React.useMemo(() => {
        const out: FilterDraft = {}
        for (const f of columnFilters) {
            if (typeof f.value === "string") continue
            out[f.id] = f.value as FilterDraft[string]
        }
        return out
    }, [columnFilters])
    const filterCount = Object.values(applied).filter(isFilterValueActive).length
    const applyFilters = (draft: FilterDraft) => {
        const next: ColumnFiltersState = []
        for (const [id, value] of Object.entries(draft)) if (isFilterValueActive(value)) next.push({ id, value })
        serverTable.onColumnFiltersChange(next)
    }
    const clearFilters = React.useCallback(() => serverTable.clearFilters({ bucket: tab }), [serverTable, tab])

    const filterFields: FilterField[] = React.useMemo(() => {
        const o = options.data
        return [
            { id: "submitted", label: "Submitted on", kind: "date" },
            { id: "farmer", label: "Farmers", kind: "multi", options: (o?.farmers ?? []).map((f) => ({ label: farmerName(f), value: f.id })) },
            { id: "village", label: "Village", kind: "multi", options: (o?.villages ?? []).map((v) => ({ label: v.name, value: v.id })) },
            { id: "az", label: "AZs", kind: "multi", options: (o?.azs ?? []).filter((a) => a.id !== 0).map((a) => ({ label: a.name ? `${a.code} · ${a.name}` : a.code, value: String(a.id) })) },
            { id: "kinds", label: "Sample type", kind: "multi", options: (["deployment", "control"] as const).map((k) => ({ label: KIND_LABEL[k], value: k })) },
            { id: "purposes", label: "Purpose", kind: "multi", options: SAMPLE_PURPOSES.map((p) => ({ label: PURPOSE_LABEL[p], value: p })) },
            { id: "boundary", label: "Plot boundary", kind: "multi", options: [{ label: "Needs a boundary", value: "required" }, { label: "No boundary needed", value: "none_required" }] },
            { id: "surveyor", label: "Surveyor", kind: "multi", options: (o?.surveyors ?? []).map((s) => ({ label: personName(s, `Surveyor ${s.id.slice(-4)}`), value: s.id })) },
            { id: "verifiedBy", label: "Verified By", kind: "multi", options: (o?.verifiers ?? []).map((v) => ({ label: personName(v, `Verifier ${v.id.slice(-4)}`), value: v.id })) },
        ]
    }, [options.data])

    // Farmer-level navigation (V2's Previous / Next walk its rows, which are farmers): the distinct farmers of the
    // loaded sample rows, in table order; N is the server's count of farmers in this tab.
    const rows = serverTable.data
    const farmerIds = React.useMemo(() => [...new Set(rows.map((r) => r.farmer.id))], [rows])
    const farmerIndex = selected ? farmerIds.indexOf(selected.farmerId) : -1
    const openRow = (row: SampleListRow) => {
        setSelected({ farmerId: row.farmer.id, sampleId: row.sample_id, openedFrom: tab })
        setSheetOpen(true)
    }
    const stepFarmer = (delta: number) => {
        const next = farmerIds[farmerIndex + delta]
        if (next) setSelected({ farmerId: next, sampleId: null, openedFrom: tab })
    }
    const selectedFarmer = selected ? rows.find((r) => r.farmer.id === selected.farmerId)?.farmer ?? null : null
    // the table marks the opened sample's row, or the farmer's first row after Previous / Next
    const highlightedRowId = selected ? selected.sampleId ?? rows.find((r) => r.farmer.id === selected.farmerId)?.sample_id ?? null : null

    return (
        <NavBarType4
            pageTitle="Samples"
            activeItemUrl="#samples"
            pageDescription="Verify deployment and control samples: review photos, GPS and plots, draw control plot boundaries, then approve or report each sample in the context of its farmer."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    <SamplesTable
                        columns={columns}
                        data={rows}
                        getRowId={sampleRowKey}
                        onRowClick={openRow}
                        selectedId={sheetOpen ? highlightedRowId : null}
                        onOpenFilterForColumn={(column) => setFilterSheet({ open: true, field: FILTER_FIELD_FOR_COLUMN[column] ?? column })}
                        isLoading={isLoadingFirstPage}
                        error={pageIndex === 0 ? serverTable.error : null}
                        onRetry={serverTable.retry}
                        hasActiveFilters={filterCount > 0}
                        onClearFilters={clearFilters}
                        sorting={serverTable.sorting}
                        onSortingChange={serverTable.onSortingChange}
                        columnFilters={columnFilters}
                        onColumnFiltersChange={serverTable.onColumnFiltersChange}
                        columnVisibility={columnVisibility}
                        onColumnVisibilityChange={setColumnVisibility}
                        hasMore={hasMore}
                        onLoadMore={handleLoadMore}
                        isLoadingMore={isLoadingMore}
                        loadMoreError={pageIndex > 0 ? serverTable.error : null}
                        onRetryLoadMore={serverTable.retry}
                        emptyTitle={`No ${tab === "all" ? "" : TAB_LABEL[tab].toLowerCase() + " "}samples`}
                        emptyDetail="There are no samples in this category."
                        renderToolbar={(table) => (
                            <SamplesToolbar
                                table={table}
                                tabs={TABS.map((value) => ({ value, label: TAB_LABEL[value], count: counts?.[value] }))}
                                activeTab={tab}
                                onTabChange={handleTabChange}
                                filterCount={filterCount}
                                onOpenFilters={() => setFilterSheet({ open: true, field: null })}
                                onClearFilters={() => applyFilters({})}
                                inspector={<DataInspectorTrigger onClick={() => setInspectorOpen(true)} />}
                                columnTitles={COLUMN_TITLES}
                            />
                        )}
                    />
                </div>

                <SamplesFilterSheet
                    open={filterSheet.open}
                    onOpenChange={(open) => setFilterSheet((s) => ({ open, field: open ? s.field : null }))}
                    fields={filterFields}
                    applied={applied}
                    onApply={applyFilters}
                    initialOpenField={filterSheet.field}
                />

                <SampleDetailSheet
                    farmerId={selected?.farmerId ?? null}
                    farmer={selectedFarmer}
                    selectedSampleId={selected?.sampleId ?? null}
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    onNext={() => stepFarmer(1)}
                    onPrevious={() => stepFarmer(-1)}
                    isFirst={farmerIndex <= 0}
                    isLast={farmerIndex === -1 || farmerIndex >= farmerIds.length - 1}
                    currentIndex={Math.max(0, farmerIndex)}
                    totalCount={counts?.farmers ?? farmerIds.length}
                    openedFrom={selected?.openedFrom ?? tab}
                    canVerify={session.data?.can_verify ?? false}
                />

                <SamplesInspector open={inspectorOpen} onOpenChange={setInspectorOpen} db={mockDb} selectedFarmerId={selected?.farmerId ?? null} selectedSampleId={selected?.sampleId ?? null} />
            </div>
        </NavBarType4>
    )
}
