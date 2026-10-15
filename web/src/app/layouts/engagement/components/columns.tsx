"use client"

import { ColumnDef } from "@tanstack/react-table"
import { EngagementRecord } from "../data/schema"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableColumnHeader } from "./data-table-column-header"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Eye, EyeOff, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

// --- Helper Components ---

const PhoneNumberCell = ({ phoneNumber, showEyeByDefault = false }: { phoneNumber?: string, showEyeByDefault?: boolean }) => {
    const [isVisible, setIsVisible] = useState(false)
    if (!phoneNumber) return <span className="text-muted-foreground">-</span>

    const maskedNumber = phoneNumber.replace(/.(?=.{4})/g, "*")

    return (
        <div className="flex items-center gap-2 group">
            <span className="text-sm font-medium font-mono">
                {isVisible ? phoneNumber : maskedNumber}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-6 w-6 transition-opacity",
                    showEyeByDefault ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                    e.stopPropagation()
                    setIsVisible(!isVisible)
                }}
            >
                {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
        </div>
    )
}

const FarmerHoverCard = ({ farmer }: { farmer: EngagementRecord["farmer"] }) => {
    return (
        <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
                <div className="flex items-center gap-3 cursor-help group">
                    <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800">
                        <AvatarImage src={farmer.avatar} alt={farmer.name} />
                        <AvatarFallback>{farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm">{farmer.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                            {farmer.phoneNumber?.replace(/.(?=.{4})/g, "*")}
                        </span>
                    </div>
                </div>
            </HoverCardTrigger>
            <HoverCardContent align="start" side="bottom" className="w-80 z-[300] p-4">
                <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border border-zinc-200 dark:border-zinc-800">
                        <AvatarImage src={farmer.avatar} />
                        <AvatarFallback>{farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1.5 flex-1">
                        <h4 className="text-sm font-semibold leading-none">{farmer.name}</h4>
                        <div className="flex items-center gap-2 pt-1">
                            <Phone className="h-3 w-3 opacity-70 shrink-0" />
                            <PhoneNumberCell phoneNumber={farmer.phoneNumber} showEyeByDefault={true} />
                        </div>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

const SurveyorHoverCard = ({ surveyor }: { surveyor: EngagementRecord["surveyor"] }) => {
    return (
        <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
                <div className="flex flex-col leading-tight cursor-help group">
                    <span className="text-sm">{surveyor.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                        {surveyor.phoneNumber?.replace(/.(?=.{4})/g, "*")}
                    </span>
                </div>
            </HoverCardTrigger>
            <HoverCardContent align="start" side="bottom" className="w-80 z-[300] p-4">
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold leading-none">{surveyor.name}</h4>
                    <div className="flex items-center gap-2 pt-1">
                        <Phone className="h-3 w-3 opacity-70 shrink-0" />
                        <PhoneNumberCell phoneNumber={surveyor.phoneNumber} showEyeByDefault={true} />
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

// Custom filter function supporting string substring search, array multi-select, and date/numeric ranges
const customFilterFn = (row: any, columnId: string, filterValue: any) => {
    if (filterValue === undefined || filterValue === null || filterValue === "") return true;
    let cellValue = row.getValue(columnId);
    if (cellValue === undefined || cellValue === null) {
        if (columnId === "farmer") cellValue = row.original?.farmer?.name;
        else if (columnId === "surveyor") cellValue = row.original?.surveyor?.name;
        else if (columnId === "verifiedBy") cellValue = row.original?.verified?.verifier;
        else if (columnId === "verifiedOn") cellValue = row.original?.verified?.date;
    }
    if (cellValue === undefined || cellValue === null) return false;

    // String search (from in-column search bar)
    if (typeof filterValue === "string") {
        if (!filterValue.trim()) return true;
        return String(cellValue).toLowerCase().includes(filterValue.toLowerCase().trim());
    }

    // Array filter (from filter sidebar multi-select or date tuple)
    if (Array.isArray(filterValue)) {
        if (filterValue.length === 0) return true;
        if (filterValue.length === 2 && (filterValue[0] instanceof Date || filterValue[1] instanceof Date)) {
            const [from, to] = filterValue;
            const cellDate = cellValue instanceof Date ? cellValue : new Date(cellValue);
            if (isNaN(cellDate.getTime())) return false;
            if (from && cellDate < new Date(from)) return false;
            if (to && cellDate > new Date(to)) return false;
            return true;
        }
        if (filterValue.length === 2 && (typeof filterValue[0] === 'number' || typeof filterValue[1] === 'number')) {
            const [min, max] = filterValue;
            const num = parseFloat(String(cellValue).replace(/[^0-9.-]+/g, ""));
            if (isNaN(num)) return false;
            if (min !== undefined && min !== null && num < min) return false;
            if (max !== undefined && max !== null && num > max) return false;
            return true;
        }
        return filterValue.some(v => 
            String(cellValue).toLowerCase() === String(v).toLowerCase() ||
            String(cellValue).toLowerCase().includes(String(v).toLowerCase())
        );
    }

    // Object filter (date or number range)
    if (typeof filterValue === "object") {
        const { from, to, min, max } = filterValue;
        if (min !== undefined || max !== undefined) {
            const num = parseFloat(String(cellValue).replace(/[^0-9.-]+/g, ""));
            if (isNaN(num)) return false;
            if (min !== undefined && min !== null && num < min) return false;
            if (max !== undefined && max !== null && num > max) return false;
            return true;
        }
        if (!from && !to) return true;
        const cellDate = cellValue instanceof Date ? cellValue : new Date(cellValue);
        if (isNaN(cellDate.getTime())) return false;
        if (from && cellDate < new Date(from)) return false;
        if (to && cellDate > new Date(to)) return false;
        return true;
    }

    return true;
};

// Default columns for Verified/Pending/Invalid tabs
export const columns: ColumnDef<EngagementRecord>[] = [
    {
        accessorKey: "submittedOn",
        size: 120,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Submitted on" />
        ),
        cell: ({ row }) => {
            const date = row.getValue("submittedOn") as Date
            return <div className="text-sm">{format(date, "dd MMM yy").toUpperCase()}</div>
        },
    },
    {
        id: "farmer",
        accessorFn: (row) => row.farmer.name,
        size: 200,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Farmer" />
        ),
        cell: ({ row }) => <FarmerHoverCard farmer={row.original.farmer} />,
    },
    {
        accessorKey: "engagementType",
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Engagement type" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("engagementType")}</div>,
    },
    {
        accessorKey: "base",
        size: 120,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Base" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("base") || "-"}</div>,
    },
    {
        accessorKey: "village",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Village" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("village")}</div>,
    },
    {
        accessorKey: "azs",
        size: 100,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="AZ code" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("azs")}</div>,
    },
    {
        accessorKey: "azName",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="AZ name" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("azName")}</div>,
    },
    {
        accessorKey: "surveyor",
        id: "surveyor",
        accessorFn: (row) => row.surveyor.name,
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Surveyor" />
        ),
        cell: ({ row }) => <SurveyorHoverCard surveyor={row.original.surveyor} />,
    },
    {
        id: "verifiedBy",
        accessorFn: (row) => row.verified?.verifier,
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Verified By" />
        ),
        cell: ({ row }) => {
            const verified = row.original.verified
            if (!verified) return <span className="text-muted-foreground">-</span>
            return <div className="text-sm">{verified.verifier}</div>
        },
    },
    {
        id: "verifiedOn",
        accessorFn: (row) => row.verified?.date,
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Verified On" />
        ),
        cell: ({ row }) => {
            const verified = row.original.verified
            if (!verified) return <span className="text-muted-foreground">-</span>
            return <div className="text-sm">{format(verified.date, "dd MMM yy").toUpperCase()}</div>
        },
    },
]

// Columns for the "All" tab view
export const allColumns: ColumnDef<EngagementRecord>[] = [
    {
        accessorKey: "submittedOn",
        size: 120,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Submitted on" />
        ),
        cell: ({ row }) => {
            const date = row.getValue("submittedOn") as Date
            return <div className="text-sm">{format(date, "dd MMM yy").toUpperCase()}</div>
        },
    },
    {
        id: "farmer",
        accessorFn: (row) => row.farmer.name,
        size: 200,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Farmer" />
        ),
        cell: ({ row }) => <FarmerHoverCard farmer={row.original.farmer} />,
    },
    {
        accessorKey: "engagementType",
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Engagement type" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("engagementType")}</div>,
    },
    {
        accessorKey: "base",
        size: 120,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Base" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("base") || "-"}</div>,
    },
    {
        accessorKey: "village",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Village" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("village")}</div>,
    },
    {
        accessorKey: "azs",
        size: 100,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="AZ code" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("azs")}</div>,
    },
    {
        accessorKey: "azName",
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="AZ name" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("azName")}</div>,
    },
    {
        accessorKey: "surveyor",
        id: "surveyor",
        accessorFn: (row) => row.surveyor.name,
        size: 180,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Surveyor" />
        ),
        cell: ({ row }) => <SurveyorHoverCard surveyor={row.original.surveyor} />,
    },
    {
        accessorKey: "status",
        size: 150,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Status" />
        ),
        cell: ({ row }) => {
            const status = row.original.status
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "font-semibold px-2.5 py-0.5 rounded-full border shadow-none",
                        status === "Verified" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                        status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                        status === "Invalid" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                    )}
                >
                    {status === "Invalid" ? "Need Correction" : status}
                </Badge>
            )
        },
    },
    {
        id: "verifiedBy",
        accessorFn: (row) => row.verified?.verifier,
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Verified By" />
        ),
        cell: ({ row }) => {
            const verified = row.original.verified
            if (!verified) return <span className="text-muted-foreground">-</span>
            return <div className="text-sm">{verified.verifier}</div>
        },
    },
    {
        id: "verifiedOn",
        accessorFn: (row) => row.verified?.date,
        size: 140,
        filterFn: customFilterFn,
        header: ({ column, table }) => (
            <DataTableColumnHeader column={column} table={table} title="Verified On" />
        ),
        cell: ({ row }) => {
            const verified = row.original.verified
            if (!verified) return <span className="text-muted-foreground">-</span>
            return <div className="text-sm">{format(verified.date, "dd MMM yy").toUpperCase()}</div>
        },
    },
]
