"use client"

// V2.1: the dispatch-level table's columns, in Deployment V2's order and with its labels
// (src/app/layouts/deployment/components/columns.tsx allColumns: Submitted on · Farmer · Village · Plots · Area ·
// Cal. Area · AZ code · AZ name · Deployed · Status · Surveyor · Verified By · Verified On) — V2.1: Submitted on ·
// Dispatch ID · Farmer · Village · Plots · Boundaries · Area · Cal. Area · AZ code · AZ name · Deployed · Status ·
// Surveyor · Verified By · Verified On. Cells reuse V2's / Samples' pieces: `text-sm` text, V2's "dd MMM yy" table date,
// the shared person hover card (FarmerHoverCard / SurveyorHoverCard), V2's table status badge, "-" for a missing value,
// Samples' mono identifier.
//
// Live API audit (2026-10-11): every list row IS one dispatch, so every cell reads that row (getDeploymentMetadata):
//   Dispatch ID   dispatch_id ("DISP-n")
//   Status        franchise_status (the dispatch's own; relabelled, never derived) + its validation marker
//   Plots         plots — the dispatch's plot count
//   Area          actual_area — the ENROLLED area of the deployment (farmer · round · AZ): Deployment V2's meaning; the
//                 API repeats it on each dispatch of the deployment, so dispatches of one deployment show the same value
//   Cal. Area     calculated_area — the dispatch's calculated area (on live data Σ of its plots' area)
//   Deployed      deployed_amount — the dispatch's amount
//   Surveyor      surveyor_name / surveyor_phone_no · Verified By  verified_by / franchise_verifier_id
//   Verified On   verified_at — the dispatch's own decision time (null while pending)
//   Boundaries    the only value the list doesn't carry: saved valid outlines / plots, from the deployment's dispatch
//                 read (hooks/use-dispatch-rows.ts, one read per loaded farmer · round · AZ) — the approval gate
// Numbers arrive as numbers or digit strings: shown rounded to 2 decimals; absent / null / non-numeric → "-". A 0 the
// API sends is shown as 0 (a value, not a missing one).
// Header menus: a column's id is its server key (data/api-contract.ts, data/query-mapper.ts SORT_BY_COLUMN), and it
// offers what the v4 API can do for it, as Deployment V2 does (V2's NOT_API_FILTERABLE): Plots / Area / Cal. Area /
// Deployed / Status sort only; Verified By sorts and filters; Verified On filters only (no API sort key); Dispatch ID and
// Boundaries have no API sort or filter, so their menu offers Hide column only (every column can be hidden — a
// frontend action; the toolbar's column list brings it back). Verified By / Verified On follow V2's tabs (hidden on Pending /
// Need Correction).
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FarmerHoverCard, SurveyorHoverCard } from "@/app/layouts/deployment/components/columns"
import { DataTableColumnHeader } from "./data-table-column-header"
import { STATUS_BADGE_CLASS, type DeploymentStatusLabel } from "./deployment-details-panel"
import { DISPATCH_VIEW_LABEL, VIEW_OF_STATUS } from "./deployment-dispatch-view"
import { formatPhone, parseEpochMs } from "../data/adapter"
import { dispatchQuantities, type DispatchDisplayRow } from "../data/dispatch-rows"
import { ValidationMarker } from "./dispatch-validation"

type Row = DispatchDisplayRow
const EMPTY = <span className="text-muted-foreground">-</span>
/** V2's table date ("07 FEB 25" — deployment/components/columns.tsx, Samples' tableDate). */
const tableDate = (ms: number) => format(new Date(ms), "dd MMM yy").toUpperCase()

/** A quantity cell (data/dispatch-rows.ts dispatchQuantities): the value rounded to 2 decimals, or "-". */
function NumberCell({ value, attr }: { value: number | null; attr: string }) {
    return value === null ? <span data-cell={attr} data-cell-missing className="text-muted-foreground">-</span> : <div data-cell={attr} data-value={value} className="text-sm">{value}</div>
}

/** What the Boundaries cell knows about a dispatch: its deployment's read state, and the counts once read. */
export type BoundaryCell =
    | { state: "loading" }
    | { state: "error"; error: string; groupKey: string }
    | { state: "ok"; saved: number; plots: number }
    | { state: "not-in-read" }

/** What the server can do for a column (data/api-contract.ts): sort by it, filter by it. */
type ApiCapabilities = { sort: boolean; filter: boolean }
const SORT_AND_FILTER: ApiCapabilities = { sort: true, filter: true }
const SORT_ONLY: ApiCapabilities = { sort: true, filter: false }
const FILTER_ONLY: ApiCapabilities = { sort: false, filter: true }

/**
 * A column. `value` gives a column its accessor (TanStack sorts and filters only accessor columns; the id is what the
 * server query maps to `sort_by` / its filter — data/query-mapper.ts) and `api` what the server can do with it; a column
 * without a value has no menu.
 */
function column(id: string, title: string, def: Omit<ColumnDef<Row>, "id" | "header">, value?: (row: Row) => string | number, api: ApiCapabilities = SORT_AND_FILTER): ColumnDef<Row> {
    return {
        id,
        meta: { title },
        ...(value ? { accessorFn: value } : {}),
        enableSorting: !!value && api.sort,
        enableColumnFilter: !!value && api.filter,
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title={title} />,
        ...def,
    }
}

export type DispatchTableTab = "All" | "Verified" | "Pending" | "Invalid"

export function dispatchColumns({ boundaryOf, onRetryBoundary, tab }: { boundaryOf: (row: Row) => BoundaryCell; onRetryBoundary: (groupKey: string) => void; tab: DispatchTableTab }): ColumnDef<Row>[] {
    const columns: ColumnDef<Row>[] = [
        column("submittedOn", "Submitted on", {
            size: 120,
            cell: ({ row }) => (row.original.record.submittedOn ? <div data-row-submitted={row.original.record.submittedOn.getTime()} className="text-sm">{tableDate(row.original.record.submittedOn.getTime())}</div> : EMPTY),
        }, (row) => row.record.submittedOn?.getTime() ?? 0),
        // The row's identifier, second (after Submitted on), in Samples' identifier-cell treatment (`text-sm font-mono`).
        column("dispatch", "Dispatch ID", {
            size: 150,
            cell: ({ row }) => {
                const r = row.original
                return r.dispatchId === null
                    ? <span data-dispatch-cell="" data-dispatch-missing-id className="text-xs text-amber-700 dark:text-amber-300">No dispatch id</span>
                    : <span data-dispatch-cell={r.dispatchId} className="text-sm font-mono">DISP-{r.dispatchId}</span>
            },
        }),
        column("farmer", "Farmer", {
            size: 200,
            cell: ({ row }) => <FarmerHoverCard farmer={row.original.record.farmer} />,
        }, (row) => row.record.farmer.name),
        column("village", "Village", {
            size: 140,
            cell: ({ row }) => <span className="text-sm">{row.original.record.village || "-"}</span>,
        }, (row) => row.record.village),
        column("plots", "Plots", {
            size: 80,
            cell: ({ row }) => <NumberCell value={dispatchQuantities(row.original.record.api).plots} attr="plots" />,
        }, (row) => dispatchQuantities(row.record.api).plots ?? "", SORT_ONLY),
        column("dispatchBoundaries", "Boundaries", {
            size: 110,
            cell: ({ row }) => {
                const b = boundaryOf(row.original)
                if (b.state === "loading") return <span data-dispatch-boundaries-state="loading" className="inline-flex items-center text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Reading boundaries" /></span>
                if (b.state === "not-in-read") return <span data-dispatch-boundaries-state="not-in-read" title="The deployment's dispatch read didn't include this dispatch" className="text-muted-foreground">-</span>
                if (b.state === "error") {
                    return (
                        <span data-dispatch-boundaries-state="error" className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300" title={b.error}>
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <Button variant="outline" size="sm" data-boundary-retry={b.groupKey} onClick={(e) => { e.stopPropagation(); onRetryBoundary(b.groupKey) }} className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider">Retry</Button>
                        </span>
                    )
                }
                return (
                    <div data-dispatch-boundaries={b.saved} data-dispatch-boundaries-state="ok" title="Plots with a valid saved boundary / plots (approval needs every plot)" className={cn("text-sm", b.plots > 0 && b.saved < b.plots && "text-amber-700 dark:text-amber-300")}>
                        {b.saved}/{b.plots}
                    </div>
                )
            },
        }),
        // Deployment V2's Area: the deployment's ENROLLED area (actual_area), the same on each of its dispatches.
        column("area", "Area", {
            size: 80,
            cell: ({ row }) => <NumberCell value={dispatchQuantities(row.original.record.api).area} attr="area" />,
        }, (row) => dispatchQuantities(row.record.api).area ?? "", SORT_ONLY),
        // Deployment V2's Cal. Area: the calculated area the API sends for this dispatch (calculated_area).
        column("calArea", "Cal. Area", {
            size: 100,
            cell: ({ row }) => <NumberCell value={dispatchQuantities(row.original.record.api).calArea} attr="cal-area" />,
        }, (row) => dispatchQuantities(row.record.api).calArea ?? "", SORT_ONLY),
        column("azs", "AZ code", {
            size: 100,
            cell: ({ row }) => {
                const api = row.original.record.api
                return (
                    <span data-row-az={api.az_id} data-row-key={row.original.rowKey} data-row-status={api.status} className="text-sm">
                        {api.az_code || "-"}
                    </span>
                )
            },
        }, (row) => row.record.azs),
        column("azName", "AZ name", {
            size: 140,
            cell: ({ row }) => <span data-row-az-name className="text-sm">{row.original.record.api.az_name || "-"}</span>,
        }, (row) => row.record.azName ?? ""),
        column("deployed", "Deployed", {
            size: 100,
            cell: ({ row }) => <NumberCell value={dispatchQuantities(row.original.record.api).deployed} attr="deployed" />,
        }, (row) => dispatchQuantities(row.record.api).deployed ?? "", SORT_ONLY),
        // Status where V2's All tab has it (after Deployed): the dispatch's own franchise_status, relabelled, with the
        // dispatch's validation marker beside it (never changing the status).
        column("status", "Status", {
            size: 150,
            cell: ({ row }) => {
                const r = row.original
                const badge = r.franchiseStatus === null
                    ? <Badge variant="outline" data-dispatch-status="unknown" className="font-semibold px-2.5 py-0.5 rounded-full border shadow-none border-zinc-200 text-zinc-500">No status sent</Badge>
                    : (() => {
                        const view = VIEW_OF_STATUS[r.franchiseStatus]
                        return <Badge variant="outline" data-dispatch-status={r.franchiseStatus} className={cn("font-semibold px-2.5 py-0.5 rounded-full border shadow-none", STATUS_BADGE_CLASS[DISPATCH_VIEW_LABEL[view] as DeploymentStatusLabel])}>{DISPATCH_VIEW_LABEL[view]}</Badge>
                    })()
                return <span className="inline-flex items-center gap-1.5">{badge}<ValidationMarker validation={r.validation} /></span>
            },
        }, (row) => row.franchiseStatus ?? "", SORT_ONLY),
        // The dispatch's surveyor in V2's person hover card (name + masked phone); sorting is the server's surveyor_name.
        column("surveyor", "Surveyor", {
            size: 180,
            cell: ({ row }) => {
                const surveyor = row.original.record.surveyor
                return surveyor.name ? <span data-row-surveyor onClick={(e) => e.stopPropagation()}><SurveyorHoverCard surveyor={surveyor} /></span> : EMPTY
            },
        }, (row) => row.record.surveyor.name),
    ]
    if (tab === "All" || tab === "Verified") {
        columns.push(
            // The dispatch's verifier in the same person hover card as Samples' Verified By.
            column("verifiedBy", "Verified By", {
                size: 140,
                cell: ({ row }) => {
                    const api = row.original.record.api
                    if (!api.verified_by) return EMPTY
                    const verifier = { name: api.verified_by, id: "", phoneNumber: formatPhone(api.franchise_verifier_id) }
                    return <span data-row-verifier onClick={(e) => e.stopPropagation()}><SurveyorHoverCard surveyor={verifier} /></span>
                },
            }, (row) => row.record.api.verified_by ?? ""),
            // Verified On: the dispatch's own verified_at ("-" while pending). Filter only: no API sort key.
            column("verifiedOn", "Verified On", {
                size: 140,
                cell: ({ row }) => {
                    const ms = parseEpochMs(row.original.record.api.verified_at)
                    return ms === null ? EMPTY : <div data-row-verified-on={ms} className="text-sm">{tableDate(ms)}</div>
                },
            }, (row) => parseEpochMs(row.record.api.verified_at) ?? "", FILTER_ONLY),
        )
    }
    return columns
}
