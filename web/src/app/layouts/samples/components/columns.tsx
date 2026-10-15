"use client"

// Samples — table columns: Deployment V2's table pattern with Samples' fields. ONE ROW = ONE SAMPLE.
// Order follows V2 (deployment-v2-oct-26/page.tsx COLUMN_TITLES): Submitted on · Farmer · Village · [the domain's
// facts — V2: Plots / Area / Cal. Area; Samples: Sample ID / Sample type / Purpose / Plot] · AZ code · AZ name ·
// Status (All tab) · Surveyor · Verified By · Verified On.
// Cells reuse the shared Deployment column pieces: FarmerHoverCard and SurveyorHoverCard (deployment/components/
// columns.tsx — the verifier uses the same person hover card), V2's "dd MMM yy" dates, "-" for missing values, V2's
// status badge classes, and V2's column header (Filter · sort · hide; no column search, as V2).
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { PencilRuler } from "lucide-react"
import { FarmerHoverCard, SurveyorHoverCard } from "@/app/layouts/deployment/components/columns"
import { DataTableColumnHeader as Header } from "@/app/layouts/deployment-v2-oct-26/components/data-table-column-header"
import { STATUS_BADGE_CLASS, type DeploymentStatusLabel } from "@/app/layouts/deployment-v2-oct-26/components/deployment-details-panel"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BUCKET_LABEL, KIND_LABEL, PURPOSE_LABEL, farmerName, personName } from "../domain/labels"
import type { PersonRef, SampleListRow, StatusBucket } from "../domain/types"

export type SamplesTab = "all" | StatusBucket

export const COLUMN_TITLES: Record<string, string> = {
    submittedOn: "Submitted on",
    farmer: "Farmer",
    village: "Village",
    sample: "Sample ID",
    kind: "Sample type",
    purpose: "Purpose",
    plot: "Plot",
    azs: "AZ code",
    azName: "AZ name",
    status: "Status",
    surveyor: "Surveyor",
    verifiedBy: "Verified By",
    verifiedOn: "Verified On",
}

/** Column id → the filter sheet's field (the AZ columns share one filter; the Plot column filters by boundary need). */
export const FILTER_FIELD_FOR_COLUMN: Record<string, string> = {
    submittedOn: "submitted",
    farmer: "farmer",
    village: "village",
    azs: "az",
    azName: "az",
    kind: "kinds",
    purpose: "purposes",
    plot: "boundary",
    surveyor: "surveyor",
    verifiedBy: "verifiedBy",
}

/** Deployment V2's status palette, by Samples bucket (approved ↔ V2 "Verified"). */
const BUCKET_TO_V2: Record<StatusBucket, DeploymentStatusLabel> = { approved: "Verified", pending: "Pending", need_correction: "Need Correction" }
export const bucketBadgeClass = (bucket: StatusBucket) => STATUS_BADGE_CLASS[BUCKET_TO_V2[bucket]]

/** V2's DispatchViewBadge look (same classes), with the status words. */
export function BucketBadge({ bucket, children, className }: { bucket: StatusBucket; children?: React.ReactNode; className?: string }) {
    return (
        <Badge variant="outline" data-bucket-badge={bucket} className={cn("text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full border shadow-none whitespace-nowrap", bucketBadgeClass(bucket), className)}>
            {children ?? BUCKET_LABEL[bucket]}
        </Badge>
    )
}

/** The shared person hover card's shape (deployment/data/schema.ts surveyor): a person as the data knows them. */
export const toHoverPerson = (person: PersonRef, role: string) => ({ name: personName(person, role), id: person.id, phoneNumber: person.phone ?? undefined })

const dash = <span className="text-muted-foreground">-</span>
/** V2's table date ("07 FEB 25"). */
const tableDate = (ms: number) => format(new Date(ms), "dd MMM yy").toUpperCase()
const needsBoundary = (r: SampleListRow) => r.status === "pending" && r.boundary_state === "boundary_required"

const sortOnly = { enableColumnFilter: false } as const
const noControls = { enableColumnFilter: false, enableSorting: false } as const

export function buildColumns(tab: SamplesTab): ColumnDef<SampleListRow, unknown>[] {
    const columns: ColumnDef<SampleListRow, unknown>[] = [
        {
            id: "submittedOn",
            accessorFn: (r) => r.submitted_at,
            size: 120,
            header: ({ column, table }) => <Header column={column} table={table} title="Submitted on" />,
            cell: ({ row }) => <div className="text-sm">{tableDate(row.original.submitted_at)}</div>,
        },
        {
            id: "farmer",
            accessorFn: (r) => farmerName(r.farmer),
            size: 200,
            header: ({ column, table }) => <Header column={column} table={table} title="Farmer" />,
            cell: ({ row }) => <FarmerHoverCard farmer={{ name: farmerName(row.original.farmer), id: row.original.farmer.id, phoneNumber: row.original.farmer.phone ?? undefined }} />,
        },
        {
            id: "village",
            accessorFn: (r) => r.farmer.village?.name ?? "",
            size: 140,
            header: ({ column, table }) => <Header column={column} table={table} title="Village" />,
            cell: ({ row }) => row.original.farmer.village ? <div className="text-sm">{row.original.farmer.village.name}</div> : dash,
        },
        {
            id: "sample",
            accessorFn: (r) => r.sample_code ?? "",
            size: 150,
            enableHiding: false,
            ...sortOnly,
            header: ({ column, table }) => <Header column={column} table={table} title="Sample ID" />,
            cell: ({ row }) => row.original.sample_code ? <div className="text-sm font-mono">{row.original.sample_code}</div> : dash,
        },
        {
            id: "kind",
            accessorFn: (r) => r.kind,
            size: 110,
            header: ({ column, table }) => <Header column={column} table={table} title="Sample type" />,
            cell: ({ row }) => <div className="text-sm">{KIND_LABEL[row.original.kind]}</div>,
        },
        {
            id: "purpose",
            accessorFn: (r) => r.purpose,
            size: 100,
            header: ({ column, table }) => <Header column={column} table={table} title="Purpose" />,
            cell: ({ row }) => <div className="text-sm">{PURPOSE_LABEL[row.original.purpose]}</div>,
        },
        {
            id: "plot",
            accessorFn: (r) => r.plot?.plot_id ?? "",
            size: 150,
            header: ({ column, table }) => <Header column={column} table={table} title="Plot" />,
            cell: ({ row }) => {
                const r = row.original
                if (needsBoundary(r)) {
                    return (
                        <Badge variant="outline" data-boundary-required className={cn("gap-1 text-[10px] font-semibold py-0.5 px-2 rounded-full border shadow-none whitespace-nowrap", bucketBadgeClass("pending"))}>
                            <PencilRuler className="h-3 w-3" />
                            Boundary required
                        </Badge>
                    )
                }
                return r.plot ? <div className="text-sm font-mono">{r.plot.plot_id}</div> : dash
            },
        },
        {
            id: "azs",
            accessorFn: (r) => r.az.code,
            size: 100,
            header: ({ column, table }) => <Header column={column} table={table} title="AZ code" />,
            cell: ({ row }) => row.original.az.id === 0 ? dash : <div className="text-sm">{row.original.az.code}</div>,
        },
        {
            id: "azName",
            accessorFn: (r) => r.az.name ?? "",
            size: 140,
            header: ({ column, table }) => <Header column={column} table={table} title="AZ name" />,
            cell: ({ row }) => row.original.az.name ? <div className="text-sm">{row.original.az.name}</div> : dash,
        },
    ]
    if (tab === "all") {
        columns.push({
            id: "status",
            accessorFn: (r) => r.bucket,
            size: 150,
            ...noControls,
            header: ({ column, table }) => <Header column={column} table={table} title="Status" />,
            cell: ({ row }) => (
                <Badge variant="outline" data-bucket-badge={row.original.bucket} className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none", bucketBadgeClass(row.original.bucket))}>
                    {BUCKET_LABEL[row.original.bucket]}
                </Badge>
            ),
        })
    }
    columns.push(
        {
            id: "surveyor",
            accessorFn: (r) => personName(r.surveyor, "Surveyor"),
            size: 180,
            header: ({ column, table }) => <Header column={column} table={table} title="Surveyor" />,
            cell: ({ row }) => row.original.surveyor ? <SurveyorHoverCard surveyor={toHoverPerson(row.original.surveyor, "Surveyor")} /> : dash,
        },
        {
            id: "verifiedBy",
            accessorFn: (r) => (r.verified_by ? personName(r.verified_by, "Verifier") : ""),
            size: 160,
            header: ({ column, table }) => <Header column={column} table={table} title="Verified By" />,
            // the same person hover card as the surveyor (V2 has one person pattern, not three)
            cell: ({ row }) => row.original.verified_by ? <SurveyorHoverCard surveyor={toHoverPerson(row.original.verified_by, "Verifier")} /> : dash,
        },
        {
            id: "verifiedOn",
            accessorFn: (r) => r.verified_at ?? 0,
            size: 140,
            ...sortOnly,
            header: ({ column, table }) => <Header column={column} table={table} title="Verified On" />,
            cell: ({ row }) => row.original.verified_at ? <div className="text-sm">{tableDate(row.original.verified_at)}</div> : dash,
        },
    )
    return columns
}
