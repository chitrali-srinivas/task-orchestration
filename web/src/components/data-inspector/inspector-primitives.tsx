"use client"

// Data / API Inspector — the generic building blocks: provenance badges, progressive-disclosure toggles, tables, code,
// and three lightweight diagrams built from plain layout primitives (no diagram dependency):
//   FlowDiagram      a left-to-right chain of steps (stacks vertically when the panel is narrow)
//   TreeDiagram      an entity hierarchy with connector lines
//   WorkflowDiagram  a top-down flow with decision branches side by side
import * as React from "react"
import { ArrowDown, ArrowRight, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

// ── Provenance ──────────────────────────────────────────────────────────────────────────────────────

/** Where a statement comes from: seen in existing code / data, this design's proposal, mock data, or unresolved. */
export type Provenance = "observed" | "proposed" | "mock" | "open"

export const PROVENANCE: Record<Provenance, { label: string; meaning: string; className: string }> = {
    observed: { label: "Observed", meaning: "Exists today — read in matic-dash code or the data export", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300" },
    proposed: { label: "Proposed", meaning: "This design — not an existing API, table or rule", className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300" },
    mock: { label: "Mock", meaning: "Demo data or behaviour of the prototype's mock backend", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" },
    open: { label: "Open question", meaning: "Needs a backend / product decision", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" },
}

export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
    const p = PROVENANCE[kind]
    return (
        <Badge variant="outline" data-provenance={kind} title={p.meaning} className={cn("text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-full shadow-none whitespace-nowrap", p.className, className)}>
            {p.label}
        </Badge>
    )
}

/** A short statement with its provenance. */
export function InspectorNote({ kind, children }: { kind: Provenance; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <ProvenanceBadge kind={kind} className="mt-0.5" />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    )
}

export function InspectorSubheading({ children, provenance, ...rest }: { children: React.ReactNode; provenance?: Provenance } & Record<`data-${string}`, string>) {
    return (
        <div className="flex items-center gap-2" {...rest}>
            <h4 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none">{children}</h4>
            {provenance && <ProvenanceBadge kind={provenance} />}
        </div>
    )
}

// ── Progressive disclosure ──────────────────────────────────────────────────────────────────────────

/** "View request", "View fields", "View schema" … — collapsed by default, keyboard-operable (Radix Collapsible). */
export function Disclosure({ label, children, defaultOpen = false, className }: { label: string; children: React.ReactNode; defaultOpen?: boolean; className?: string }) {
    const [open, setOpen] = React.useState(defaultOpen)
    return (
        <Collapsible open={open} onOpenChange={setOpen} className={className}>
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    data-disclosure={label}
                    className="inline-flex items-center gap-1 rounded-sm text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                >
                    <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} aria-hidden />
                    {label}
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent data-disclosure-content={label} className="pt-2">{children}</CollapsibleContent>
        </Collapsible>
    )
}

// ── Tables and code ─────────────────────────────────────────────────────────────────────────────────

/** A compact table; cells are strings or nodes. Scrolls sideways inside its own box when narrow. */
export function InspectorTable({ columns, rows, className, ...rest }: { columns: string[]; rows: React.ReactNode[][]; className?: string } & Record<`data-${string}`, string>) {
    return (
        <div className={cn("rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto", className)} {...rest}>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/60">
                        {columns.map((c) => (
                            <th key={c} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 whitespace-nowrap border-b border-zinc-200 dark:border-zinc-800">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-b-0 border-zinc-100 dark:border-zinc-800 align-top">
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 break-words min-w-[6rem]">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** Monospace block (request / response examples). Scrolls sideways; never wraps JSON. */
export function InspectorCode({ children, className }: { children: string; className?: string }) {
    return (
        <pre data-inspector-code className={cn("rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-[11px] leading-relaxed font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre max-h-80", className)}>
            {children}
        </pre>
    )
}

export function Chip({ children, mono = false, className }: { children: React.ReactNode; mono?: boolean; className?: string }) {
    return <span className={cn("inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-1.5 py-0.5 text-[11px] text-zinc-700 dark:text-zinc-300", mono && "font-mono", className)}>{children}</span>
}

// ── Diagrams ────────────────────────────────────────────────────────────────────────────────────────

export interface FlowNode {
    label: string
    detail?: string
    provenance?: Provenance
}

/** Steps joined by arrows: one row on wide panels, a column on narrow ones (never scrolls sideways). */
export function FlowDiagram({ nodes, ...rest }: { nodes: FlowNode[] } & Record<`data-${string}`, string>) {
    return (
        <div role="list" className="flex flex-col xl:flex-row xl:items-stretch gap-1" {...rest}>
            {nodes.map((n, i) => (
                <React.Fragment key={n.label}>
                    {i > 0 && (
                        <div aria-hidden className="flex items-center justify-center shrink-0 text-zinc-300 dark:text-zinc-600 xl:w-5">
                            <ArrowDown className="h-4 w-4 xl:hidden" />
                            <ArrowRight className="h-4 w-4 hidden xl:block" />
                        </div>
                    )}
                    <div role="listitem" data-flow-node={n.label} className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 shadow-sm">
                        <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50 break-words min-w-0">{n.label}</span>
                            {n.provenance && <ProvenanceBadge kind={n.provenance} className="shrink-0" />}
                        </div>
                        {n.detail && <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 break-words">{n.detail}</p>}
                    </div>
                </React.Fragment>
            ))}
        </div>
    )
}

export interface TreeNode {
    label: string
    detail?: string
    /** How this node relates to its parent ("1 → many", "optional"). */
    relation?: string
    /** The feature's primary entity. */
    primary?: boolean
    children?: TreeNode[]
}

function TreeItem({ node, root }: { node: TreeNode; root?: boolean }) {
    return (
        <li
            data-tree-node={node.label}
            className={cn("relative", !root && "before:absolute before:-left-4 before:top-3.5 before:w-3.5 before:border-t before:border-zinc-300 dark:before:border-zinc-700")}
        >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                <span className={cn(
                    "rounded-md border px-2 py-1 text-xs font-bold",
                    node.primary ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                )}>
                    {node.label}
                </span>
                {node.relation && <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{node.relation}</span>}
                {node.detail && <span className="text-[11px] text-zinc-500 dark:text-zinc-400 min-w-0">{node.detail}</span>}
            </div>
            {node.children && node.children.length > 0 && (
                <ul className="mt-1.5 ml-3 pl-4 border-l border-zinc-300 dark:border-zinc-700 space-y-1.5">
                    {node.children.map((c) => <TreeItem key={c.label} node={c} />)}
                </ul>
            )}
        </li>
    )
}

/** An entity hierarchy with connector lines (the primary entity is filled). */
export function TreeDiagram({ root, ...rest }: { root: TreeNode } & Record<`data-${string}`, string>) {
    return (
        <ul className="min-w-0" {...rest}>
            <TreeItem node={root} root />
        </ul>
    )
}

export type WorkflowTone = "default" | "action" | "success" | "warning" | "danger"
export type WorkflowStep =
    | { label: string; detail?: string; tone?: WorkflowTone }
    | { decision: string; branches: { label: string; steps: WorkflowStep[] }[] }

const TONE: Record<WorkflowTone, string> = {
    default: "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
    action: "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
}

const Down = () => <div aria-hidden className="flex justify-center py-0.5 text-zinc-300 dark:text-zinc-600"><ArrowDown className="h-3.5 w-3.5" /></div>

function WorkflowSteps({ steps }: { steps: WorkflowStep[] }) {
    return (
        <div className="flex flex-col items-stretch min-w-0">
            {steps.map((step, i) => (
                <React.Fragment key={"decision" in step ? step.decision : step.label}>
                    {i > 0 && <Down />}
                    {"decision" in step ? (
                        <div data-workflow-decision={step.decision} className="space-y-1.5">
                            <div className="mx-auto max-w-full rounded-full border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-1 text-center text-xs font-bold text-amber-900 dark:text-amber-200">{step.decision}</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {step.branches.map((b) => (
                                    <div key={b.label} data-workflow-branch={b.label} className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-2 space-y-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{b.label}</p>
                                        <WorkflowSteps steps={b.steps} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div data-workflow-step={step.label} className={cn("rounded-lg border px-3 py-1.5 text-center min-w-0", TONE[step.tone ?? "default"])}>
                            <p className="text-xs font-bold break-words">{step.label}</p>
                            {step.detail && <p className="text-[11px] leading-snug opacity-75 break-words">{step.detail}</p>}
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

/** A top-down workflow; a decision shows its branches side by side, then the flow continues below. */
export function WorkflowDiagram({ steps, ...rest }: { steps: WorkflowStep[] } & Record<`data-${string}`, string>) {
    return <div className="max-w-xl mx-auto w-full" {...rest}><WorkflowSteps steps={steps} /></div>
}
