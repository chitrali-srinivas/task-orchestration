"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { JobRecord } from "../data/schema"
import { DataTableColumnHeader } from "./data-table-column-header"
import { JobStatusBadge } from "./job-status"

/** "2026-10-27" → "27 OCT 26", the table's date format (Deployment's). */
export const formatYmd = (ymd: string) => format(new Date(`${ymd}T00:00:00`), "dd MMM yy").toUpperCase()

export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"

export const formatKm = (km: number) => `${km.toFixed(1)} km`

/** 47 → "47m", 107 → "1h 47m", 120 → "2h". */
export const formatMinutes = (min: number) => (min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}`)

const muted = <span className="text-muted-foreground">-</span>

/** Columns of the jobs table. `today` is the simulated date. */
export function jobColumns(today: string): ColumnDef<JobRecord>[] {
    return [
        {
            accessorKey: "jobCode",
            size: 90,
            meta: { title: "Job id" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Job id" />,
            cell: ({ row }) => <div className="text-sm font-mono font-semibold">{row.original.jobCode}</div>,
        },
        {
            accessorKey: "date",
            size: 120,
            meta: { title: "Job date" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Job date" />,
            cell: ({ row }) => (
                <div className="flex flex-col leading-tight">
                    <span className="text-sm">{formatYmd(row.original.date)}</span>
                    {row.original.date === today && <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">Today</span>}
                </div>
            ),
        },
        {
            accessorKey: "surveyorName",
            size: 200,
            meta: { title: "Surveyor" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Surveyor" />,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                        <AvatarFallback className="text-xs">{initials(row.original.surveyorName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{row.original.surveyorName}</span>
                </div>
            ),
        },
        {
            accessorKey: "status",
            size: 130,
            meta: { title: "Status" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Status" />,
            cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
        },
        {
            accessorKey: "stopCount",
            size: 90,
            meta: { title: "Stops" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Stops" />,
            cell: ({ row }) => <div className="text-sm tabular-nums">{row.original.stopCount}</div>,
        },
        {
            accessorKey: "taskCount",
            size: 110,
            meta: { title: "Tasks" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Tasks" />,
            cell: ({ row }) => {
                const { taskCount, doneCount } = row.original
                return (
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm tabular-nums">{taskCount}</span>
                        {doneCount > 0 && <span className="text-[10px] text-muted-foreground">{doneCount} done</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: "distanceKm",
            size: 120,
            meta: { title: "Distance" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Distance" />,
            cell: ({ row }) => {
                const { distanceKm, unlocatedCount } = row.original
                return (
                    <div className="flex flex-col leading-tight">
                        {distanceKm === undefined ? muted : <span className="text-sm tabular-nums">{formatKm(distanceKm)}</span>}
                        {unlocatedCount > 0 && (
                            <span className={cn("text-[10px] text-amber-600 dark:text-amber-400")}>
                                {unlocatedCount} {unlocatedCount === 1 ? "stop" : "stops"} without location
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "villages",
            size: 200,
            meta: { title: "Villages" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Villages" />,
            cell: ({ row }) => (row.original.villages ? <div className="text-sm max-w-[260px] truncate">{row.original.villages}</div> : muted),
        },
        {
            accessorKey: "updatedAt",
            size: 120,
            meta: { title: "Last updated" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Last updated" />,
            cell: ({ row }) => <div className="text-sm">{format(new Date(row.original.updatedAt), "dd MMM yy").toUpperCase()}</div>,
        },
    ]
}
