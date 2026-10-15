"use client"

import { ColumnDef } from "@tanstack/react-table"
import { SampleLog } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Eye } from "lucide-react"

export const columns: ColumnDef<SampleLog>[] = [
    {
        accessorKey: "id",
        header: "Log ID",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>
    },
    {
        accessorKey: "date",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
    },
    {
        accessorKey: "sampleType",
        header: "Phase",
    },
    {
        accessorKey: "surveyor",
        header: "Surveyor",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "Completed" ? "outline" : "secondary"} className={status === "Completed" ? "border-green-600 text-green-600" : ""}>
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: () => (
            <Button variant="ghost" size="sm">
                <Eye className="mr-2 h-4 w-4" /> View
            </Button>
        ),
    },
]
