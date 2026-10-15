"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MetricStats } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

export const columns: ColumnDef<MetricStats>[] = [
    {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <span className="font-semibold text-zinc-700 dark:text-zinc-300">{row.getValue("category")}</span>
    },
    {
        accessorKey: "metric",
        header: "Metric",
    },
    {
        accessorKey: "value",
        header: () => <div className="text-right">Value</div>,
        cell: ({ row }) => {
            return (
                <div className="text-right font-mono font-medium">
                    {row.getValue("value")}
                    <span className="text-zinc-400 ml-1 text-xs">{row.original.unit}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "trend",
        header: "Trend",
        cell: ({ row }) => {
            const trend = row.getValue("trend") as string
            return (
                <div className="flex items-center gap-1">
                    {trend === "up" && <ArrowUp className="h-4 w-4 text-green-600" />}
                    {trend === "down" && <ArrowDown className="h-4 w-4 text-red-600" />}
                    {trend === "stable" && <Minus className="h-4 w-4 text-zinc-400" />}
                    <span className="capitalize text-xs text-zinc-500">{trend}</span>
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
                <Badge variant={status === "Optimal" ? "default" : status === "Warning" ? "outline" : "destructive"} className={status === "Warning" ? "text-yellow-600 border-yellow-600" : ""}>
                    {status}
                </Badge>
            )
        },
    },
]
