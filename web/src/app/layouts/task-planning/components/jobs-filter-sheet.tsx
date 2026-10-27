"use client"

// Task planning — the filter sheet, copied from Tasks (tasks/components/tasks-filter-sheet.tsx), itself copied from Samples
// (samples/components/samples-filter-sheet.tsx), which draws Deployment's
// filter look from a field list: a right Sheet, one section per field, searchable multi-select popovers, From / To date
// pickers, Reset all / Apply now. The sheet edits a draft; the table filters change only on Apply. Options are
// { label, value }: labels for people, ids for the query.
import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export interface FilterOption {
    label: string
    value: string
}

export type FilterField =
    | { id: string; label: string; kind: "multi"; options: FilterOption[] }
    | { id: string; label: string; kind: "date" }

export interface DateRange {
    from?: Date
    to?: Date
}

/** The sheet's value: multi-select fields → string[]; date fields → { from, to }. */
export type FilterDraft = Record<string, string[] | DateRange | undefined>

export const isFilterValueActive = (value: string[] | DateRange | undefined) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value && (value.from || value.to))

function MultiSelectSection({ field, selected, onChange, autoOpen }: {
    field: Extract<FilterField, { kind: "multi" }>
    selected: string[]
    onChange: (next: string[]) => void
    autoOpen: boolean
}) {
    const [search, setSearch] = React.useState("")
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        if (!autoOpen) return
        const timer = setTimeout(() => {
            setIsOpen(true)
            containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 250)
        return () => clearTimeout(timer)
    }, [autoOpen])

    const labelOf = (value: string) => field.options.find((o) => o.value === value)?.label ?? value
    const shown = search.trim() ? field.options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase())) : field.options
    const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

    return (
        <div ref={containerRef} data-filter-field={field.id} className="p-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{field.label}</Label>
                {selected.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={() => onChange([])}>
                        Reset
                    </Button>
                )}
            </div>
            <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
                <PopoverTrigger asChild>
                    <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setIsOpen((prev) => !prev)
                            }
                        }}
                        className={cn(
                            "w-full flex flex-wrap items-center gap-2 min-h-[40px] p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-left cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400 select-none",
                            isOpen && "border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400 dark:ring-zinc-600"
                        )}
                    >
                        {selected.length === 0 ? (
                            <span className="text-xs text-zinc-400 px-1 py-1">Select</span>
                        ) : (
                            selected.map((value) => (
                                <Badge key={value} variant="secondary" className="pl-2 pr-1 py-1 gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-none text-[10px] font-medium" onClick={(e) => e.stopPropagation()}>
                                    <span className="truncate max-w-[130px]">{labelOf(value)}</span>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Remove ${labelOf(value)}`}
                                        onClick={(e) => { e.stopPropagation(); onChange(selected.filter((v) => v !== value)) }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                onChange(selected.filter((v) => v !== value))
                                            }
                                        }}
                                        className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full p-0.5 transition-colors cursor-pointer inline-flex items-center justify-center"
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                </Badge>
                            ))
                        )}
                        <div className="ml-auto flex items-center pr-1 pointer-events-none">
                            <ChevronDown className="h-4 w-4 text-zinc-400 opacity-50" />
                        </div>
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[348px] max-h-[320px] p-0 overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-md z-[2000]"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    collisionPadding={16}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                            <Input
                                placeholder={`Search ${field.label.toLowerCase()}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-xs border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                            />
                        </div>
                    </div>
                    <div className="flex-1 max-h-[200px] overflow-y-auto overflow-x-hidden p-1 space-y-0.5" onWheel={(e) => e.stopPropagation()}>
                        {shown.length === 0 ? (
                            <div className="py-6 text-center text-xs text-zinc-500 font-medium">No results found</div>
                        ) : (
                            shown.map((option) => (
                                <div
                                    key={option.value}
                                    data-filter-option={option.value}
                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors group"
                                    onClick={(e) => { e.preventDefault(); toggle(option.value) }}
                                >
                                    <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)} className="h-3.5 w-3.5" onClick={(e) => e.stopPropagation()} />
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 truncate">{option.label}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="shrink-0 p-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1 bg-zinc-50/40 dark:bg-zinc-900/30">
                        <Button type="button" variant="ghost" size="sm" className="flex-1 justify-center h-7 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={() => onChange([])}>Clear</Button>
                        <Button type="button" variant="ghost" size="sm" className="flex-1 justify-center h-7 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={() => setIsOpen(false)}>Close</Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

function DateSection({ field, value, onChange, autoOpen }: {
    field: Extract<FilterField, { kind: "date" }>
    value: DateRange
    onChange: (next: DateRange) => void
    autoOpen: boolean
}) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        if (!autoOpen) return
        const timer = setTimeout(() => containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150)
        return () => clearTimeout(timer)
    }, [autoOpen])
    const picker = (edge: "from" | "to") => (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-between h-10 px-3 text-xs border-zinc-200 dark:border-zinc-800", !value[edge] && "text-muted-foreground")}>
                    {value[edge] ? format(value[edge]!, "yyyy-MM-dd") : edge === "from" ? "From" : "To"}
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md rounded-md z-[2000]" align="start" onWheel={(e) => e.stopPropagation()}>
                <Calendar mode="single" selected={value[edge]} onSelect={(d) => onChange({ ...value, [edge]: d ?? undefined })} />
            </PopoverContent>
        </Popover>
    )
    return (
        <div ref={containerRef} data-filter-field={field.id} className="p-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{field.label}</Label>
                {(value.from || value.to) && (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50" onClick={() => onChange({})}>Reset</Button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                {picker("from")}
                {picker("to")}
            </div>
        </div>
    )
}

export function JobsFilterSheet({ open, onOpenChange, fields, applied, onApply, initialOpenField }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    fields: FilterField[]
    /** The filters applied to the table; the draft resets to them whenever they change. */
    applied: FilterDraft
    onApply: (draft: FilterDraft) => void
    initialOpenField?: string | null
}) {
    const appliedKey = JSON.stringify(applied)
    const [draft, setDraft] = React.useState<FilterDraft>(applied)
    const [draftKey, setDraftKey] = React.useState(appliedKey)
    if (draftKey !== appliedKey) {
        setDraftKey(appliedKey)
        setDraft(applied)
    }
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent data-filter-sheet className="w-full sm:max-w-[380px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-[300]">
                <SheetHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <SheetTitle className="text-base font-medium text-zinc-900 dark:text-zinc-50">Filters</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1" onWheel={(e) => e.stopPropagation()}>
                    {fields.map((field) =>
                        field.kind === "multi" ? (
                            <MultiSelectSection
                                key={field.id}
                                field={field}
                                selected={(draft[field.id] as string[] | undefined) ?? []}
                                onChange={(next) => setDraft((d) => ({ ...d, [field.id]: next }))}
                                autoOpen={open && initialOpenField === field.id}
                            />
                        ) : (
                            <DateSection
                                key={field.id}
                                field={field}
                                value={(draft[field.id] as DateRange | undefined) ?? {}}
                                onChange={(next) => setDraft((d) => ({ ...d, [field.id]: next }))}
                                autoOpen={open && initialOpenField === field.id}
                            />
                        )
                    )}
                </ScrollArea>
                <SheetFooter className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-row items-center gap-3 sm:justify-between">
                    <Button variant="outline" className="flex-1 h-10 text-sm font-medium border-zinc-200 dark:border-zinc-800" onClick={() => setDraft({})}>Reset all</Button>
                    <Button
                        data-apply-filters
                        className="flex-1 h-10 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium shadow-none"
                        onClick={() => { onApply(draft); onOpenChange(false) }}
                    >
                        Apply now
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
