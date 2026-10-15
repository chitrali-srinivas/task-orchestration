import { X, Eye, Filter, Loader2 } from "lucide-react"
import { Table } from "@tanstack/react-table"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { FilterSidebar, FilterValue } from "@/app/components/filter/components/FilterSidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { flexRender } from "@tanstack/react-table"

interface DataTableToolbarProps<TData> {
    table: Table<TData>
    activeTab: string
    setActiveTab: (value: string) => void
    counts: {
        verified: number
        pending: number
        invalid: number
    }
    activeColumns?: string[]
    isLoading?: boolean
    filterSidebarOpen?: boolean
    setFilterSidebarOpen?: (open: boolean) => void
    initialFilterField?: string | null
    setInitialFilterField?: (field: string | null) => void
}

export function DataTableToolbar<TData>({
    table,
    activeTab,
    setActiveTab,
    counts,
    activeColumns = [],
    isLoading = false,
    filterSidebarOpen: controlledOpen,
    setFilterSidebarOpen: setControlledOpen,
    initialFilterField = null,
    setInitialFilterField,
}: DataTableToolbarProps<TData>) {
    const sidebarFilters = table.getState().columnFilters.filter(f => {
        if (typeof f.value === "string") return false;
        if (Array.isArray(f.value)) return f.value.length > 0 && f.value.some(v => v !== undefined && v !== null && v !== "");
        if (typeof f.value === "object" && f.value !== null) {
            const obj = f.value as any;
            return Boolean(obj.from || obj.to || obj.min !== undefined || obj.max !== undefined);
        }
        return false;
    });
    const isFiltered = sidebarFilters.length > 0;
    const filterCount = sidebarFilters.length;
    const [internalOpen, setInternalOpen] = React.useState(false);
    
    const filterSidebarOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setFilterSidebarOpen = (open: boolean) => {
        if (setControlledOpen) setControlledOpen(open);
        else setInternalOpen(open);
        if (!open && setInitialFilterField) setInitialFilterField(null);
    };

    const handleApplyFilters = (filters: FilterValue) => {
        // Preserve any active string search filters from column headers
        const stringFilters = table.getState().columnFilters.filter((f: any) => typeof f.value === "string" && f.value.trim().length > 0);
        const nextFilters: { id: string; value: any }[] = [...stringFilters];

        if (filters.submittedOn?.from || filters.submittedOn?.to) {
            nextFilters.push({ id: "submittedOn", value: [filters.submittedOn.from, filters.submittedOn.to] });
        }
        if (filters.farmers && filters.farmers.length > 0) {
            nextFilters.push({ id: "farmer", value: filters.farmers });
        }
        if (filters.engagementTypes && filters.engagementTypes.length > 0) {
            nextFilters.push({ id: "engagementType", value: filters.engagementTypes });
        }
        if (filters.bases && filters.bases.length > 0) {
            nextFilters.push({ id: "base", value: filters.bases });
        }
        if (filters.villages && filters.villages.length > 0) {
            nextFilters.push({ id: "village", value: filters.villages });
        }
        if (filters.azs && filters.azs.length > 0) {
            nextFilters.push({ id: "azs", value: filters.azs });
        }
        if (filters.surveyors && filters.surveyors.length > 0) {
            nextFilters.push({ id: "surveyor", value: filters.surveyors });
        }
        if (filters.statuses && filters.statuses.length > 0) {
            nextFilters.push({ id: "status", value: filters.statuses });
        }
        if (filters.verifiedBy && filters.verifiedBy.length > 0) {
            nextFilters.push({ id: "verifiedBy", value: filters.verifiedBy });
        }
        if (filters.matiDeployed?.min !== undefined || filters.matiDeployed?.max !== undefined) {
            nextFilters.push({ id: "matiDeployed", value: [filters.matiDeployed.min, filters.matiDeployed.max] });
        }
        if (filters.verifiedOn?.from || filters.verifiedOn?.to) {
            nextFilters.push({ id: "verifiedOn", value: [filters.verifiedOn.from, filters.verifiedOn.to] });
        }

        table.setColumnFilters(nextFilters);
    };

    return (
        <div className="flex flex-row items-center justify-between gap-4 w-full mb-[16px] min-w-0 overflow-hidden">
            <div className="flex items-center min-w-0 flex-1 gap-4 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto shrink-0">
                        <TabsList className="h-10 w-max justify-start bg-muted p-1">
                            <TabsTrigger
                                value="All"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                All <span className="ml-2 opacity-50 font-normal">{counts.verified + counts.pending + counts.invalid}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Verified"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Verified <span className="ml-2 opacity-50 font-normal">{counts.verified}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Pending"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Pending <span className="ml-2 opacity-50 font-normal">{counts.pending}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="Invalid"
                                className="text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                            >
                                Need Correction <span className="ml-2 opacity-50 font-normal">{counts.invalid}</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="flex items-center gap-2 justify-end shrink-0">
                <div className={cn(
                    "flex items-center h-10 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm transition-all overflow-hidden",
                    isFiltered ? "pl-3 pr-1 gap-2 bg-zinc-100/50 dark:bg-zinc-900/50" : ""
                )}>
                    {isFiltered ? (
                        <>
                            <button
                                onClick={() => setFilterSidebarOpen(true)}
                                className="flex items-center gap-2 h-full hover:opacity-70 transition-opacity pr-1"
                            >
                                <Filter className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                                    {filterCount} {filterCount === 1 ? 'filter' : 'filters'}
                                </span>
                            </button>
                            <Separator orientation="vertical" className="h-4 bg-zinc-200 dark:border-zinc-800" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    table.resetColumnFilters();
                                }}
                                className="h-8 w-8 p-0 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-sm transition-colors shrink-0"
                                title="Clear all filters"
                            >
                                <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0 text-zinc-900 dark:text-zinc-50"
                            onClick={() => setFilterSidebarOpen(true)}
                            title="Filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 relative overflow-visible shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50" title="Columns">
                            <Eye className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1.5">Toggle Columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-[300px]">
                            {table
                                .getAllColumns()
                                .filter(
                                    (column) =>
                                        typeof column.accessorFn !== "undefined" && column.getCanHide()
                                )
                                .map((column) => {
                                    const title =
                                        (column.columnDef?.meta as any)?.title ||
                                        (typeof column.columnDef.header === "string" ? column.columnDef.header : "") ||
                                        {
                                            submittedOn: "Submitted On",
                                            farmer: "Farmer",
                                            engagementType: "Engagement Type",
                                            base: "Base",
                                            village: "Village",
                                            azs: "AZ Code",
                                            azName: "AZ Name",
                                            surveyor: "Surveyor",
                                            status: "Status",
                                            verifiedBy: "Verified By",
                                            verifiedOn: "Verified On",
                                            matiDeployed: "Mati Deployed",
                                        }[column.id] ||
                                        column.id.replace(/([A-Z])/g, " $1").trim()

                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            {title}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </ScrollArea>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <FilterSidebar 
                open={filterSidebarOpen}
                onOpenChange={setFilterSidebarOpen}
                initialOpenField={initialFilterField}
                onApply={handleApplyFilters}
                activeColumns={activeColumns}
            />
        </div>
    )
}
