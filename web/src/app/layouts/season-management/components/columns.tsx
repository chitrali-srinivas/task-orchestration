"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { SeasonRecord } from "../data/schema";
import { SeasonStatusBadge } from "./season-status-badge";
import { DataTableColumnHeader } from "../../deployment/components/data-table-column-header";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// User hover card component displaying Mail ID (no avatar circle)
const UserHoverCard = ({ name }: { name: string }) => {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@maticarbon.com`;

    return (
        <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
                <div className="flex flex-col leading-tight cursor-help group">
                    <span className="text-sm group-hover:underline">
                        {name}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                        {email}
                    </span>
                </div>
            </HoverCardTrigger>
            <HoverCardContent align="start" side="bottom" className="w-72 z-[300] p-3.5">
                <div className="space-y-1.5">
                    <h4 className="text-sm font-semibold leading-none">{name}</h4>
                    <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 opacity-70 shrink-0" />
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{email}</span>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};

// Parse helper for custom formatted dates like "07 FEB 25" or "2025-02-07"
const parseCustomDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
        const months: Record<string, number> = {
            JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
            JUL: 6, AUG: 7, OCT: 9, SEP: 8, NOV: 10, DEC: 11
        };
        const day = parseInt(parts[0], 10);
        const month = months[parts[1].toUpperCase()];
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    return null;
};

// Custom filter function supporting string substring search, array multi-select, and date ranges
const customFilterFn = (row: any, columnId: string, filterValue: any) => {
    if (filterValue === undefined || filterValue === null || filterValue === "") return true;
    const cellValue = row.getValue(columnId);
    if (cellValue === undefined || cellValue === null) return false;

    // String search (from in-column search bar)
    if (typeof filterValue === "string") {
        if (!filterValue.trim()) return true;
        return String(cellValue).toLowerCase().includes(filterValue.toLowerCase().trim());
    }

    // Array filter (from filter sidebar multi-select)
    if (Array.isArray(filterValue)) {
        if (filterValue.length === 0) return true;
        return filterValue.some(v => 
            String(cellValue).toLowerCase() === String(v).toLowerCase() ||
            String(cellValue).toLowerCase().includes(String(v).toLowerCase())
        );
    }

    // Date range filter
    if (typeof filterValue === "object") {
        const { from, to } = filterValue;
        if (!from && !to) return true;
        const cellDate = parseCustomDate(String(cellValue));
        if (!cellDate) return false;
        if (from && cellDate < new Date(from)) return false;
        if (to && cellDate > new Date(to)) return false;
        return true;
    }

    return true;
};

export const columns: ColumnDef<SeasonRecord>[] = [
    {
        accessorKey: "id",
        size: 190,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Season ID" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm">
                    {row.getValue("id")}
                </div>
            );
        },
    },
    {
        accessorKey: "baseName",
        size: 130,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Base Name" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm">
                    {row.getValue("baseName")}
                </div>
            );
        },
    },
    {
        accessorKey: "country",
        size: 100,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Country" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm">
                    {row.getValue("country")}
                </div>
            );
        },
    },
    {
        accessorKey: "azName",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="AZ Name" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm">
                    {row.getValue("azName")}
                </div>
            );
        },
    },
    {
        accessorKey: "season",
        size: 110,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Season" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            const season = row.original.season || "Kharif";
            return (
                <div className="text-sm">
                    {season}
                </div>
            );
        },
    },
    {
        accessorKey: "status",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Status" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return <SeasonStatusBadge status={row.original.status} />;
        },
    },
    {
        accessorKey: "createdBy",
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Created by" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => <UserHoverCard name={row.getValue("createdBy")} />,
    },
    {
        accessorKey: "createdAt",
        size: 130,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Created at" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm whitespace-nowrap">
                    {String(row.getValue("createdAt")).toUpperCase()}
                </div>
            );
        },
    },
    {
        accessorKey: "updatedBy",
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Updated by" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => <UserHoverCard name={row.getValue("updatedBy")} />,
    },
    {
        accessorKey: "seasonStart",
        size: 130,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Season Start" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm whitespace-nowrap">
                    {String(row.getValue("seasonStart")).toUpperCase()}
                </div>
            );
        },
    },
    {
        accessorKey: "seasonEnd",
        size: 130,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader 
                column={column} 
                title="Season End" 
                onOpenFilter={(id) => (table.options.meta as any)?.openFilterForColumn?.(id || column.id)}
            />
        ),
        cell: ({ row }) => {
            return (
                <div className="text-sm whitespace-nowrap">
                    {String(row.getValue("seasonEnd")).toUpperCase()}
                </div>
            );
        },
    },
];
