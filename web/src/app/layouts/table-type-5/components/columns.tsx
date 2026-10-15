"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MetricStats } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertCircle, CheckCircle } from "lucide-react"

export const columns: ColumnDef<MetricStats>[] = [
    {
        accessorKey: "id",
        header: "Reading ID",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>
    },
    {
        accessorKey: "category",
        header: "Category",
    },
    {
        accessorKey: "metric",
        header: "Metric",
    },
    {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <div className={status === "Warning" ? "font-bold text-yellow-600" : ""}>
                    {row.getValue("value")}
                    <span className="text-xs ml-1">{row.original.unit}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "status",
        header: "Integrity Check",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-2 cursor-help">
                                {status === "Optimal" ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                )}
                                <span className={status === "Warning" ? "text-yellow-700 font-medium" : "text-green-700"}>{status}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{status === "Warning" ? "Value deviates from expected range." : "Value exceeds quality standards."}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )
        },
    },
]
