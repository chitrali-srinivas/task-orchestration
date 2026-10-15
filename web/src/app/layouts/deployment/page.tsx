"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NavBarType4 } from "@/components/nav-bars/NavBarType4"
import { Button } from "@/components/ui/button"
import { MessageSquare, Info } from "lucide-react"
import { columns as defaultColumns, allColumns } from "./components/columns"
import { EngagementTable } from "./components/data-table"
import { EngagementDetailSheet } from "./components/engagement-detail-sheet"
import { EngagementRecord } from "./data/schema"
import { EngagementFilters } from "./data/schema"
import { useDeploymentDataSource, deploymentFallbackCounts } from "./data/data-source"
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

export default function DeploymentPage() {
    const [selectedRecord, setSelectedRecord] = React.useState<EngagementRecord | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
    const [activeTab, setActiveTab] = React.useState<"All" | "Verified" | "Pending" | "Invalid">("Verified")
    const [language, setLanguage] = React.useState<"en" | "hi">("en")

    const dataSource = useDeploymentDataSource()

    const serverTable = useServerTable<EngagementRecord, EngagementFilters>({
        dataSource,
        initialFilters: {
            status: "Verified",
        },
        initialPageSize: 20,
        debounceMs: 350,
    })

    const handleTabChange = (val: string) => {
        const nextTab = val as "All" | "Verified" | "Pending" | "Invalid"
        setActiveTab(nextTab)
        serverTable.setFilter("status", nextTab === "All" ? undefined : nextTab)
    }

    const handleClearFilters = React.useCallback(() => {
        serverTable.clearFilters(activeTab === "All" ? {} : { status: activeTab })
    }, [activeTab, serverTable])

    const handleRecordClick = (record: EngagementRecord) => {
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
    const summaryCounts = (serverTable.summaryCounts as { verified: number; pending: number; invalid: number } | undefined) || deploymentFallbackCounts

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
            return allColumns
        }
        if (activeTab === "Verified") {
            return defaultColumns
        }
        // Filter out verification columns for Pending and Need Correction tabs
        return defaultColumns.filter(col => 
            (col as any).id !== "verifiedBy" && (col as any).id !== "verifiedOn"
        )
    }, [activeTab])

    return (
        <NavBarType4 
            pageTitle="Deployment" 
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
                            isLoading={serverTable.isLoading}
                            isInitialLoading={serverTable.isInitialLoading}
                            error={serverTable.error}
                            onRetry={serverTable.retry}
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

                <EngagementDetailSheet
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
