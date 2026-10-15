"use client"

import { Table } from "@tanstack/react-table"
import { X, CheckCircle2, AlertCircle, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataTableToolbarProps<TData> {
    table: Table<TData>
}

export function DataTableToolbar<TData>({
    table,
}: DataTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0

    // Helper to safely get the filter value
    const getFilterValue = (columnId: string) => {
        return (table.getColumn(columnId)?.getFilterValue() as string) ?? ""
    }

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder="Filter Sensor IDs..."
                    value={getFilterValue("sensorId")}
                    onChange={(event) =>
                        table.getColumn("sensorId")?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-[150px] lg:w-[250px]"
                />

                <Select
                    value={getFilterValue("status")}
                    onValueChange={(value) => table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)}
                >
                    <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="flagged">Flagged</SelectItem>
                    </SelectContent>
                </Select>

                {isFiltered && (
                    <Button
                        variant="ghost"
                        onClick={() => table.resetColumnFilters()}
                        className="h-8 px-2 lg:px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
