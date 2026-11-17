"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/layouts/tasks/components/data-table-column-header"
import { formatYmd, initials } from "@/app/layouts/tasks/components/columns"
import type { FarmerStatus } from "@/lib/orchestration/engine"
import { FarmerLocationSource, FarmerRecord } from "../data/schema"

const muted = <span className="text-muted-foreground">-</span>

// Outline pill like the task status badge; "No location" stands out because planning can't place the farmer.
const LOCATION_STYLE: Record<FarmerLocationSource, string> = {
    gps: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    plot: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50",
    village: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
    none: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
}

export function LocationBadge({ source, label, className }: { source: FarmerLocationSource; label: string; className?: string }) {
    return (
        <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none", LOCATION_STYLE[source], className)}>
            {label}
        </Badge>
    )
}

// Farmer status: grey while onboarding, green once verified, red when blacklisted.
const STATUS_STYLE: Record<FarmerStatus, string> = {
    registered: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
    noc_received: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
    blacklisted: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
}

export function FarmerStatusBadge({ status, label, className }: { status: FarmerStatus; label: string; className?: string }) {
    return (
        <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none", STATUS_STYLE[status], className)}>
            {label}
        </Badge>
    )
}

const count = (n: number, tone?: string) => (n > 0 ? <div className={cn("text-sm tabular-nums", tone)}>{n}</div> : muted)

/** Columns of the Farmers table. */
export const farmerColumns: ColumnDef<FarmerRecord>[] = [
    {
        accessorKey: "name",
        size: 220,
        meta: { title: "Farmer" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Farmer" />,
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                    <AvatarFallback className="text-xs">{initials(row.original.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{row.original.name}</span>
            </div>
        ),
    },
    {
        accessorKey: "status",
        size: 140,
        meta: { title: "Status" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Status" />,
        cell: ({ row }) => <FarmerStatusBadge status={row.original.status} label={row.original.statusLabel} />,
    },
    {
        accessorKey: "village",
        size: 150,
        meta: { title: "Village" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Village" />,
        cell: ({ row }) => (row.original.village ? <div className="text-sm">{row.original.village}</div> : muted),
    },
    {
        accessorKey: "locationSource",
        size: 150,
        meta: { title: "Location" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Location" />,
        cell: ({ row }) => <LocationBadge source={row.original.locationSource} label={row.original.locationLabel} />,
    },
    {
        accessorKey: "registeredOn",
        size: 130,
        meta: { title: "Registered" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Registered" />,
        cell: ({ row }) => <div className="text-sm">{formatYmd(row.original.registeredOn)}</div>,
    },
    {
        accessorKey: "taskCount",
        size: 90,
        meta: { title: "Tasks" },
        enableColumnFilter: false,
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Tasks" />,
        cell: ({ row }) => count(row.original.taskCount, "font-semibold"),
    },
    {
        accessorKey: "planned",
        size: 100,
        meta: { title: "Planned" },
        enableColumnFilter: false,
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Planned" />,
        cell: ({ row }) => count(row.original.planned),
    },
    {
        accessorKey: "collected",
        size: 100,
        meta: { title: "Collected" },
        enableColumnFilter: false,
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Collected" />,
        cell: ({ row }) => count(row.original.collected, "text-amber-700 dark:text-amber-400"),
    },
    {
        accessorKey: "verified",
        size: 100,
        meta: { title: "Verified" },
        enableColumnFilter: false,
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Verified" />,
        cell: ({ row }) => count(row.original.verified, "text-emerald-700 dark:text-emerald-400"),
    },
    {
        accessorKey: "nextJobCode",
        size: 140,
        meta: { title: "Next visit" },
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Next visit" />,
        cell: ({ row }) =>
            row.original.nextJobCode && row.original.nextVisit ? (
                <div className="flex flex-col leading-tight">
                    <span className="text-sm">{formatYmd(row.original.nextVisit)}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{row.original.nextJobCode}</span>
                </div>
            ) : row.original.planned > 0 ? (
                <span className="text-sm text-muted-foreground">Not on a job</span>
            ) : (
                muted
            ),
    },
]
