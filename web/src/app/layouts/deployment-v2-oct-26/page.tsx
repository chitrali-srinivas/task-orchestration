"use client"

// Deployment V2 Oct 26 — a clone of the existing Deployment page (src/app/layouts/deployment/page.tsx).
// Same components and behaviour. Changes: rows come from API-shaped mock data (getDeploymentMetadata /
// getDeploymentStatusCounts) through ./data/data-source.ts, the All tab shows the API's `all` count, and the
// detail sheet's right-side content follows the Matic Ready to Verify / Need Correction structure.

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NavBarType4 } from "@/components/nav-bars/NavBarType4"
import { Button } from "@/components/ui/button"
import { MessageSquare, Info } from "lucide-react"
import { columns as defaultColumns, allColumns } from "@/app/layouts/deployment/components/columns"
import { DataTableColumnHeader } from "./components/data-table-column-header"
import { EngagementTable } from "./components/data-table"
import { DeploymentDetailSheet } from "./components/deployment-detail-sheet"
import type { DeploymentV2Record } from "./data/schema"
import type { EngagementRecord } from "@/app/layouts/deployment/data/schema"
import { EngagementFilters } from "@/app/layouts/deployment/data/schema"
import { useDeploymentV2DataSource, deploymentV2FallbackCounts } from "./data/data-source"
import { useInfinitePagesDataSource } from "./data/infinite-pages"
import { getDeploymentRowKey } from "./data/adapter"
import { useServerTable } from "@/lib/server-table"
import { cn } from "@/lib/utils"
import { surveyData } from "@/app/components/survey/SurveyComponents"
import { format } from "date-fns"
import { Languages, ChevronDown, Check } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// V2: live rows may have no valid created_at (submittedOn undefined). The shared Submitted on cell formats
// unconditionally, so it is wrapped to show the columns' existing "-" empty state instead of throwing.
const withSafeSubmittedOn = (col: ColumnDef<DeploymentV2Record>): ColumnDef<DeploymentV2Record> => {
    if ((col as { accessorKey?: string }).accessorKey !== "submittedOn" || typeof col.cell !== "function") return col
    const cell = col.cell
    return {
        ...col,
        cell: (ctx) => (ctx.row.original.submittedOn ? cell(ctx) : <span className="text-muted-foreground">-</span>),
    }
}

// V2: the shared columns, limited to what the v4 Deployment API supports.
// - Headers are the V2 header copy: no in-column Search (the API has no text search).
// - Plots, Area, Cal. Area and Deployed have no API filter, and Status is set by the tabs, so their headers offer
//   sort / hide only.
// - AZ code shows the row's az_code. The record's `azs` stays the AZ id that filters and requests use.
// deployment_num is not a column: it stays on record.api for row identity and the detail workflow.
const COLUMN_TITLES: Record<string, string> = {
    submittedOn: "Submitted on",
    farmer: "Farmer",
    village: "Village",
    plots: "Plots",
    area: "Area",
    calArea: "Cal. Area",
    azs: "AZ code",
    azName: "AZ name",
    deployed: "Deployed",
    status: "Status",
    surveyor: "Surveyor",
    verifiedBy: "Verified By",
    verifiedOn: "Verified On",
}
const NOT_API_FILTERABLE = new Set(["plots", "area", "calArea", "deployed", "status"])

const toV2Column = (col: ColumnDef<DeploymentV2Record>): ColumnDef<DeploymentV2Record> => {
    const { id, accessorKey } = col as { id?: string; accessorKey?: string }
    const columnId = id ?? accessorKey ?? ""
    const title = COLUMN_TITLES[columnId] ?? columnId
    return {
        ...col,
        ...(NOT_API_FILTERABLE.has(columnId) ? { enableColumnFilter: false } : {}),
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title={title} />,
        ...(columnId === "azs"
            ? { cell: ({ row }) => (row.original.api.az_code?.trim() ? <div className="text-sm">{row.original.api.az_code}</div> : <span className="text-muted-foreground">-</span>) }
            : {}),
    } as ColumnDef<DeploymentV2Record>
}

const toV2Columns = (cols: ColumnDef<EngagementRecord>[]): ColumnDef<DeploymentV2Record>[] =>
    (cols as unknown as ColumnDef<DeploymentV2Record>[]).map(withSafeSubmittedOn).map(toV2Column)

/** Row identity across loaded pages (API row grain: farmer_id + deployment_num + az_id). */
const deploymentRowKey = (record: DeploymentV2Record) => getDeploymentRowKey(record.api)

export default function DeploymentV2Oct26Page() {
    const [selectedRecord, setSelectedRecord] = React.useState<DeploymentV2Record | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<"All" | "Verified" | "Pending" | "Invalid">("Verified")
    const [language, setLanguage] = React.useState<"en" | "hi">("en")

    // Infinite scroll: page N of a query returns pages 1..N (see data/infinite-pages.ts).
    const dataSource = useInfinitePagesDataSource(useDeploymentV2DataSource(), deploymentRowKey)

    const serverTable = useServerTable<DeploymentV2Record, EngagementFilters>({
        dataSource,
        initialFilters: {
            status: "Verified",
        },
        initialPageSize: 20,
        debounceMs: 350,
    })

    // Infinite scroll. useServerTable resets the page to 1 whenever the tab, a filter or the sort changes. Page 1
    // uses the table's full loading / error states; later pages load below the rows already shown.
    const { pageIndex } = serverTable.pagination
    const { onPaginationChange } = serverTable
    // The page whose rows are on screen changes only when useServerTable delivers rows. Right after the next page is
    // asked for, the page index is already ahead while its request has not started yet: that gap counts as loading,
    // so each page is asked for once.
    const [shownPage, setShownPage] = React.useState({ data: serverTable.data, pageIndex })
    if (shownPage.data !== serverTable.data) setShownPage({ data: serverTable.data, pageIndex })
    const shownPageIndex = shownPage.pageIndex
    const isPageRequested = pageIndex !== shownPageIndex
    const isLoadingFirstPage = serverTable.isLoading && pageIndex === 0
    const isLoadingMore = pageIndex > 0 && !serverTable.error && (serverTable.isLoading || isPageRequested)
    const hasMore = !serverTable.isLoading && !isPageRequested && !serverTable.error && pageIndex + 1 < serverTable.pageCount
    const handleLoadMore = React.useCallback(() => {
        // Only ever move from the page on screen to the next one: repeated calls before it loads change nothing.
        onPaginationChange((prev) => (prev.pageIndex === shownPageIndex ? { ...prev, pageIndex: shownPageIndex + 1 } : prev))
    }, [onPaginationChange, shownPageIndex])

    const handleTabChange = (val: string) => {
        const nextTab = val as "All" | "Verified" | "Pending" | "Invalid"
        setActiveTab(nextTab)
        serverTable.setFilter("status", nextTab === "All" ? undefined : nextTab)
    }

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === "All" ? {} : { status: activeTab })
    }, [activeTab, serverTable])

    const handleRecordClick = (record: DeploymentV2Record) => {
        setSelectedRecord(record)
        setIsDrawerOpen(true)
    }

    const handleNext = () => {
        if (!selectedRecord) return
        const currentIndex = serverTable.data.findIndex(r => r.id === selectedRecord.id)
        if (currentIndex < serverTable.data.length - 1) {
            setSelectedRecord(serverTable.data[currentIndex + 1])
        }
    }

    const handlePrevious = () => {
        if (!selectedRecord) return
        const currentIndex = serverTable.data.findIndex(r => r.id === selectedRecord.id)
        if (currentIndex > 0) {
            setSelectedRecord(serverTable.data[currentIndex - 1])
        }
    }

    const currentIndex = selectedRecord ? serverTable.data.findIndex(r => r.id === selectedRecord.id) : -1
    const isFirst = currentIndex === 0
    const isLast = currentIndex === serverTable.data.length - 1

    // Summary counts for tabs
    const summaryCounts = (serverTable.summaryCounts as { all: number; verified: number; pending: number; invalid: number } | undefined) || deploymentV2FallbackCounts

    const selectedIdNum = selectedRecord ? selectedRecord.id : 0;

    // Filter survey data to only show questions 1-16 (hide 17-28)
    const filteredSurveyData = React.useMemo(() => {
        let baseData = surveyData.filter(item => {
            const idNum = parseInt(item.id);
            return idNum >= 1 && idNum <= 16;
        });

        // For presentation: hide location question (ID: 7) for every 3rd farmer
        if (selectedRecord && selectedIdNum % 3 === 0) {
            baseData = baseData.filter(item => item.id !== "7");
        }

        // If the selected farmer has status "Invalid" and is "Farmer E", return all questions with empty answers
        if (selectedRecord?.status === "Invalid" && selectedRecord?.farmer.name === "Farmer E") {
            return baseData.map(item => ({
                ...item,
                answer: item.type === "badge" || item.type === "rank" || item.type === "repeater" ? [] : ""
            }));
        }

        return baseData;
    }, [selectedRecord?.id, selectedIdNum]);

    const hasLocationQuestion = React.useMemo(() => {
        return filteredSurveyData.some(item => item.id === "7");
    }, [filteredSurveyData]);

    // Dynamic columns
    const activeColumns = React.useMemo(() => {
        if (activeTab === "All") {
            return toV2Columns(allColumns)
        }
        if (activeTab === "Verified") {
            return toV2Columns(defaultColumns)
        }
        // Filter out verification columns for Pending and Need Correction tabs
        return toV2Columns(defaultColumns.filter(col =>
            (col as any).id !== "verifiedBy" && (col as any).id !== "verifiedOn"
        ))
    }, [activeTab])

    return (
        <NavBarType4 
            pageTitle="Deployment V2 Oct 26" 
            activeItemUrl="#deployment"
            pageDescription="Track and manage ongoing farmer interactions, feedback, and survey responses. Review verification status, monitor pending tasks, and address records requiring correction to ensure high-quality data collection."
        >
            <div className="flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full">
                <div className="bg-white dark:bg-zinc-950 flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full">
                    <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
                        <EngagementTable
                            data={serverTable.data}
                            columns={activeColumns}
                            onRowClick={handleRecordClick}
                            activeTab={activeTab}
                            setActiveTab={handleTabChange}
                            counts={summaryCounts}
                            selectedId={selectedRecord?.id?.toString()}
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
                            sorting={serverTable.sorting}
                            onSortingChange={serverTable.onSortingChange}
                            columnFilters={serverTable.columnFilters}
                            onColumnFiltersChange={serverTable.onColumnFiltersChange}
                        />
                    </div>
                </div>

                <DeploymentDetailSheet
                    record={selectedRecord}
                    open={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    isFirst={isFirst}
                    isLast={isLast}
                    currentIndex={currentIndex}
                    totalCount={serverTable.totalCount}
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

                {/* Footer Section */}
                <div className="shrink-0 py-3 px-1 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <div className="flex items-center gap-4">
                            <span>Version 1.2.4-stable</span>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span>All rights reserved by Mati Carbon Pvt</span>
                                <button className="text-zinc-900 dark:text-zinc-300 hover:underline underline-offset-2 font-bold">TnC</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Session ID:</span>
                                <span className="font-mono text-zinc-600 dark:text-zinc-400">MC-8824-X92</span>
                            </div>
                            <span className="hidden sm:inline opacity-30">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="opacity-50">Last Refreshed:</span>
                                <span className="text-zinc-600 dark:text-zinc-400" suppressHydrationWarning>{format(new Date(), "dd MMM yyyy, hh:mm aa")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </NavBarType4>
    )
}
