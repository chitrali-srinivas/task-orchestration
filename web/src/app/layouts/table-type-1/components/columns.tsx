"use client"

import { ColumnDef } from "@tanstack/react-table"
// Using SampleLog from rich data, aggregated on the fly or pre-processed
import { SampleLog } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export const columns: ColumnDef<SampleLog>[] = [
    {
        accessorKey: "date",
        header: "Date",
    },
    {
        accessorKey: "surveyor",
        header: "Surveyor",
    },
    {
        accessorKey: "sampleType",
        header: "Phase",
        cell: ({ row }) => {
            return <Badge variant="outline">{row.getValue("sampleType")}</Badge>
        }
    },
    {
        accessorKey: "progress",
        header: "Completion",
        cell: ({ row }) => {
            const progress = parseFloat(row.getValue("progress"))
            return (
                <div className="w-[150px] flex items-center gap-2">
                    <Progress value={progress} className="h-2" />
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                </div>
            )
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "Completed" ? "default" : status === "Failed" ? "destructive" : "secondary"}>
                    {status}
                </Badge>
            )
        },
    },
]
