"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { STATUS } from "@/lib/orchestration/engine"
import { cn } from "@/lib/utils"
import { TaskRecord } from "../data/schema"
import { DataTableColumnHeader } from "./data-table-column-header"
import { TaskStatusBadge } from "./task-status"

/** "2026-10-26" → "26 OCT 26", the table's date format (Deployment's). */
export const formatYmd = (ymd: string) => format(new Date(`${ymd}T00:00:00`), "dd MMM yy").toUpperCase()

export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"

const muted = <span className="text-muted-foreground">-</span>

/** Row checkboxes for assigning planned tasks to a surveyor (only planned rows can be selected). */
export const selectColumn: ColumnDef<TaskRecord> = {
    id: "select",
    size: 44,
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
        <Checkbox
            // No "indeterminate": the shared Checkbox draws it as a full tick.
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
            aria-label="Select planned tasks on this page"
            className="translate-y-[2px]"
        />
    ),
    cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                disabled={!row.getCanSelect()}
                aria-label={`Select ${row.original.taskCode}`}
                className="translate-y-[2px]"
            />
        </div>
    ),
}

/** Columns of the Tasks table. `today` is the simulated date: tasks starting after it are not on the phone yet. */
export function taskColumns(today: string): ColumnDef<TaskRecord>[] {
    return [
        {
            accessorKey: "taskCode",
            size: 90,
            meta: { title: "Task id" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Task id" />,
            cell: ({ row }) => <div className="text-sm font-mono font-semibold">{row.original.taskCode}</div>,
        },
        {
            accessorKey: "surveyName",
            size: 200,
            meta: { title: "Survey template" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Survey template" />,
            cell: ({ row }) => (
                <div className="flex flex-col leading-tight">
                    <span className="text-sm">{row.original.surveyName}</span>
                    {row.original.surveyVersion !== undefined && (
                        <span className="text-[10px] font-mono text-muted-foreground">v{row.original.surveyVersion}</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "farmerName",
            size: 200,
            meta: { title: "Farmer" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Farmer" />,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                        <AvatarFallback className="text-xs">{initials(row.original.farmerName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{row.original.farmerName}</span>
                </div>
            ),
        },
        {
            accessorKey: "village",
            size: 140,
            meta: { title: "Village" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Village" />,
            cell: ({ row }) => (row.original.village ? <div className="text-sm">{row.original.village}</div> : muted),
        },
        {
            accessorKey: "status",
            size: 130,
            meta: { title: "Status" },
            enableColumnFilter: false,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Status" />,
            cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
        },
        {
            accessorKey: "assignedTo",
            size: 160,
            meta: { title: "Assigned to" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Assigned to" />,
            cell: ({ row }) =>
                row.original.assignedTo ? (
                    <div className="text-sm">{row.original.assignedTo}</div>
                ) : row.original.status === STATUS.planned ? (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                ) : (
                    muted
                ),
        },
        {
            accessorKey: "visitDate",
            size: 130,
            meta: { title: "Visit date" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Visit date" />,
            cell: ({ row }) => {
                const { visitDate, stopNo, stopCount, status } = row.original
                if (!visitDate) return muted
                // Still planned after its visit day: the surveyor didn't get to it (carry-over is manual for now).
                const missed = status === STATUS.planned && visitDate < today
                return (
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm">{formatYmd(visitDate)}</span>
                        <span className={cn("text-[10px]", missed ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                            {missed ? "Missed · reassign" : `Stop ${stopNo} of ${stopCount}`}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "plannedStart",
            size: 130,
            meta: { title: "Planned start" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Planned start" />,
            cell: ({ row }) => {
                const upcoming = row.original.plannedStart > today
                return (
                    <div className="flex flex-col leading-tight">
                        <span className={cn("text-sm", upcoming && "text-muted-foreground")}>{formatYmd(row.original.plannedStart)}</span>
                        {upcoming && row.original.status === STATUS.planned && <span className="text-[10px] text-muted-foreground">Not on the app yet</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: "plannedEnd",
            size: 130,
            meta: { title: "Planned end" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Planned end" />,
            cell: ({ row }) =>
                row.original.plannedEnd ? <div className="text-sm">{formatYmd(row.original.plannedEnd)}</div> : <span className="text-sm text-muted-foreground">Indefinite</span>,
        },
        {
            accessorKey: "createdFrom",
            size: 150,
            meta: { title: "Created from" },
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Created from" />,
            cell: ({ row }) => <div className="text-sm">{row.original.createdFrom}</div>,
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
