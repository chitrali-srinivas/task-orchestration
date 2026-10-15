"use client"

// Data / API Inspector — a design-time panel any layout can open from its toolbar (an icon button left of Filter).
// It answers, in order: what the screen uses (Overview), how the data flows, the domain model, the API, the UI → API
// mapping, the database, the mock data, the workflows, the rules and what is still open. The diagrams are visible
// immediately; fields, payloads, schemas and records sit behind "View …" toggles.
//
// The shell is generic: a layout passes an InspectorSpec (plain data, see inspector-spec.ts) and the Inspector renders
// the standard sections. Free-form `sections` are still accepted (appended after the standard ones, or on their own).
// DESIGN-TIME ONLY: not part of a production feature.
//
// Usage:
//   <DataInspectorTrigger onClick={() => setOpen(true)} />
//   <DataInspector open={open} onOpenChange={setOpen} spec={samplesSpec} />
import * as React from "react"
import { Braces } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { buildSpecSections, type InspectorSectionDef } from "./inspector-sections"
import type { InspectorSpec } from "./inspector-spec"

export * from "./inspector-primitives"
export type * from "./inspector-spec"
export type { InspectorSectionDef }

/** The toolbar's outline icon-button (same size and border as the Columns button next to it). */
export function DataInspectorTrigger({ onClick, label = "Data / API Inspector" }: { onClick: () => void; label?: string }) {
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        data-inspector-trigger
                        aria-label={label}
                        onClick={onClick}
                        className="h-10 w-10 shrink-0 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50"
                    >
                        <Braces className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

const NO_SECTIONS: InspectorSectionDef[] = []

export function DataInspector({
    open,
    onOpenChange,
    spec,
    title,
    subtitle,
    sections: extraSections = NO_SECTIONS,
    initialSection,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The structured content (preferred). */
    spec?: InspectorSpec
    /** Defaults to the spec's feature name. */
    title?: string
    subtitle?: string
    /** Free-form sections: appended after the standard ones, or the whole content when there is no spec. */
    sections?: InspectorSectionDef[]
    initialSection?: string
}) {
    const [active, setActive] = React.useState<string | undefined>(initialSection)
    const sections = React.useMemo(() => [...(spec ? buildSpecSections(spec, setActive) : []), ...extraSections], [spec, extraSections])
    const current = sections.find((s) => s.id === active) ?? sections[0]
    const scrollRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [current?.id])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                data-inspector
                className="w-full sm:w-[75vw] sm:max-w-[75vw] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[320]"
            >
                <SheetHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800 text-left space-y-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500 select-none">Data / API Inspector</p>
                    <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title ?? spec?.feature ?? "Inspector"}</SheetTitle>
                    <SheetDescription className={cn("text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-3xl", !subtitle && "sr-only")}>
                        {subtitle ?? "What this screen needs, where the data comes from, and what the backend has to provide."}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                    <nav aria-label="Inspector sections" className="shrink-0 md:w-52 border-b md:border-b-0 md:border-r border-zinc-100 dark:border-zinc-800 p-2 flex md:flex-col gap-0.5 overflow-x-auto md:overflow-y-auto">
                        {sections.map((section, index) => (
                            <button
                                key={section.id}
                                type="button"
                                data-inspector-tab={section.id}
                                data-active={section.id === current?.id ? "" : undefined}
                                aria-current={section.id === current?.id ? "page" : undefined}
                                onClick={() => setActive(section.id)}
                                className={cn(
                                    "shrink-0 text-left rounded-md px-2.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
                                    section.id === current?.id
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50"
                                )}
                            >
                                <span className="tabular-nums text-[10px] text-zinc-400 w-4">{index + 1}</span>
                                <span className="whitespace-nowrap">{section.title}</span>
                            </button>
                        ))}
                    </nav>
                    <div ref={scrollRef} data-inspector-body className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-5 md:p-6">
                        {current && (
                            <section data-inspector-section={current.id} className="space-y-5 min-w-0 w-full">
                                <div className="space-y-1">
                                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{current.title}</h3>
                                    {current.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-5xl">{current.description}</p>}
                                </div>
                                {current.content}
                            </section>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
