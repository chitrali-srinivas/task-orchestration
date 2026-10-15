"use client"

import * as React from "react"
import {
    ColumnDef,
    ExpandedState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
}

export function DataTable<TData, TValue>({
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const [expanded, setExpanded] = React.useState<ExpandedState>({})

    const table = useReactTable({
        data,
        columns,
        state: {
            expanded,
        },
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getRowCanExpand: () => true,
    })

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <React.Fragment key={row.id}>
                                <TableRow
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                {row.getIsExpanded() && (
                                    <TableRow>
                                        <TableCell colSpan={row.getVisibleCells().length} className="bg-zinc-50 dark:bg-zinc-900/40 p-0">
                                            <div className="p-4 pl-12">
                                                {/* Sub-table for Samples */}
                                                <h4 className="text-sm font-semibold mb-2">Sample Logs</h4>
                                                <Table className="border rounded-md bg-white dark:bg-zinc-950 mb-4">
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="h-8">Date</TableHead>
                                                            <TableHead className="h-8">Type</TableHead>
                                                            <TableHead className="h-8">Surveyor</TableHead>
                                                            <TableHead className="h-8">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {/* @ts-ignore */}
                                                        {row.original.samples.map((sample) => (
                                                            <TableRow key={sample.id} className="hover:bg-transparent">
                                                                <TableCell className="py-2">{sample.date}</TableCell>
                                                                <TableCell className="py-2">{sample.sampleType}</TableCell>
                                                                <TableCell className="py-2">{sample.surveyor}</TableCell>
                                                                <TableCell className="py-2 text-green-600">{sample.status}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>

                                                {/* Sub-table for Metrics */}
                                                <h4 className="text-sm font-semibold mb-2">Key Metrics</h4>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {/* @ts-ignore */}
                                                    {row.original.metrics.map((m) => (
                                                        <div key={m.id} className="bg-white dark:bg-zinc-950 p-3 rounded border text-sm">
                                                            <div className="text-zinc-500 text-xs uppercase">{m.metric}</div>
                                                            <div className="font-mono font-medium text-lg">{m.value} <span className="text-xs text-zinc-400">{m.unit}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
