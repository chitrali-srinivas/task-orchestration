"use client"

import { ColumnDef } from "@tanstack/react-table"
import { FarmerRecord } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown } from "lucide-react"

export const columns: ColumnDef<FarmerRecord>[] = [
    {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
            return row.getCanExpand() ? (
                <Button
                    variant="ghost"
                    {...{
                        onClick: row.getToggleExpandedHandler(),
                        style: { cursor: 'pointer' },
                    }}
                    className="h-8 w-8 p-0"
                >
                    {row.getIsExpanded() ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </Button>
            ) : null
        },
    },
    {
        accessorKey: "name",
        header: "Farmer Name",
    },
    {
        accessorKey: "village",
        header: "Village",
    },
    {
        accessorKey: "status",
        header: "Account Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "Active" ? "default" : "secondary"}>
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "samplesCount",
        header: "Samples",
        cell: ({ row }) => {
            return (
                <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs">{row.original.samples.length} logs</Badge>
                    <Badge variant="outline" className="text-xs">{row.original.metrics.length} metrics</Badge>
                </div>
            )
        }
    }
]
