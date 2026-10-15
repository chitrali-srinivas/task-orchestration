"use client";

// V2-local copy of the shared FilterSidebar (src/app/components/filter/components/FilterSidebar.tsx).
// Changes:
// - multi-select options are { label, value } so live mode can show names but filter by ids
//   (farmer_id, village_id, AZ id, surveyor / verifier phone). Without `optionsByField` every field uses the
//   shared component's built-in lists as { label: x, value: x } — identical to the shared sidebar;
// - no Status section (status is set by the table tabs) and no Mati Deployed range (the v4 Deployment API has
//   no deployed_amount range filter);
// - the selection follows the filters applied to the table (`appliedFilters`), so a filter cleared from the table
//   is also cleared here.

import * as React from "react";
import { 
    Calendar as CalendarIcon, 
    X, 
    Search,
    RotateCcw,
    ChevronDown,
    Check,
    Plus
} from "lucide-react";
import { endOfDay, format } from "date-fns";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { FilterValue } from "@/app/components/filter/components/FilterSidebar";

export type { FilterValue };

export interface FilterOption {
    label: string;
    value: string;
}

type MultiSelectField = "farmers" | "engagementTypes" | "villages" | "bases" | "azs" | "surveyors" | "statuses" | "verifiedBy";

interface FilterSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (filters: FilterValue) => void;
    initialFilters?: FilterValue;
    /** The filters currently applied to the table. The sidebar's selection is reset to them whenever they change. */
    appliedFilters?: Partial<FilterValue>;
    initialOpenField?: string | null;
    activeColumns?: string[];
    /** Options per multi-select field; a field without an entry uses the built-in list. */
    optionsByField?: Partial<Record<MultiSelectField, FilterOption[]>>;
    /** Per-field option loading error (e.g. a failed lookup API call). */
    optionErrors?: Partial<Record<MultiSelectField, string>>;
}

const toOptions = (values: string[]): FilterOption[] => values.map((value) => ({ label: value, value }));

const ENGAGEMENT_TYPES = [
    "Engagement 1",
    "Engagement 2",
    "Engagement 3",
    "Engagement 4",
    "Con. Engagement 1",
];

const VILLAGES = [
    "Village A",
    "Village B",
    "Village C",
];

const BASE_OPTIONS = [
    "Base A",
    "Base B",
    "Base C",
    "Base D",
];

const AZ_OPTIONS = [
    "AZ 1 - Wheat",
    "AZ 2 - Rice",
    "AZ 3 - Maize",
    "AZ 4 - Cotton",
    "AZ 5 - Sugarcane",
    "AZ 6 - Soybean",
    "AZ 7 - Barley",
    "AZ 8 - Mustard",
    "AZ 9 - Potato",
    "AZ 10 - Tomato",
];

const SURVEYOR_OPTIONS = [
    "Surveyor 1",
    "Surveyor 2",
    "Surveyor 3",
];

const VERIFIED_BY_OPTIONS = [
    "Verifier 1",
    "Verifier 2",
    "Verifier 3",
];

const FARMER_OPTIONS = [
    "Rajesh Kumar",
    "Sunita Devi",
    "Amit Patel",
    "Priya Sharma",
    "Ramesh Yadav",
];

const VERIFIER_OPTIONS = [
    "Verifier A",
    "Verifier B",
    "Verifier C",
];

const DEFAULT_FILTERS: FilterValue = {
    farmers: [],
    engagementTypes: [],
    villages: [],
    bases: [],
    azs: [],
    surveyors: [],
    statuses: [],
    verifiedBy: [],
};

const FilterMultiSelect = ({ 
    label, 
    field, 
    options, 
    currentFilters, 
    onFilterChange, 
    onReset,
    autoOpen = false,
    error,
}: { 
    label: string, 
    field: keyof FilterValue, 
    options: FilterOption[], 
    currentFilters: FilterValue, 
    onFilterChange: (field: keyof FilterValue, next: string[]) => void, 
    onReset: (field: keyof FilterValue) => void,
    autoOpen?: boolean,
    error?: string,
}) => {
    const [search, setSearch] = React.useState("");
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (autoOpen) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 250);
            return () => clearTimeout(timer);
        } else {
            setIsOpen(false);
        }
    }, [autoOpen]);

    const currentSelected = (currentFilters[field] as string[]) || [];
    const safeOptions = React.useMemo(() => {
        if (!Array.isArray(options)) return [];
        const byValue = new Map<string, FilterOption>();
        for (const opt of options) {
            if (!opt || typeof opt.value !== "string" || opt.value.trim().length === 0) continue;
            const value = opt.value.trim();
            if (!byValue.has(value)) byValue.set(value, { value, label: opt.label?.trim() || value });
        }
        return Array.from(byValue.values());
    }, [options]);
    const labelOf = (value: string) => safeOptions.find((opt) => opt.value === value)?.label ?? value;

    const filteredOptions = React.useMemo(() => {
        if (!search.trim()) return safeOptions;
        const q = search.toLowerCase();
        return safeOptions.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [safeOptions, search]);

    const toggleOption = (value: string) => {
        const next = currentSelected.includes(value)
            ? currentSelected.filter(v => v !== value)
            : [...currentSelected, value];
        onFilterChange(field, next);
    };
    
    return (
        <div ref={containerRef} className="p-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</Label>
                {currentSelected.length > 0 && (
                    <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="h-auto p-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" 
                        onClick={() => onReset(field)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <div className="space-y-3">
                <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
                    <PopoverTrigger asChild>
                        <div 
                            role="button"
                            tabIndex={0}
                            onClick={() => setIsOpen((prev) => !prev)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setIsOpen(prev => !prev);
                                }
                            }}
                            className={cn(
                                "w-full flex flex-wrap items-center gap-2 min-h-[40px] p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-left cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400 select-none",
                                isOpen && "border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400 dark:ring-zinc-600"
                            )}
                        >
                            {currentSelected.length === 0 ? (
                                <span className="text-xs text-zinc-400 px-1 py-1">Select</span>
                            ) : (
                                currentSelected.map(option => (
                                    <Badge key={option} variant="secondary" className="pl-2 pr-1 py-1 gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-none text-[10px] font-medium" onClick={(e) => e.stopPropagation()}>
                                        <span className="truncate max-w-[130px]">{labelOf(option)}</span>
                                        <span 
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = currentSelected.filter(v => v !== option);
                                                onFilterChange(field, next);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const next = currentSelected.filter(v => v !== option);
                                                    onFilterChange(field, next);
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
                        avoidCollisions={true}
                        collisionPadding={16}
                        onOpenAutoFocus={(e) => {
                            e.preventDefault();
                            // Find the input within this popover and focus it
                            const input = document.querySelector(`[data-search-input="${field}"]`) as HTMLInputElement;
                            if (input) input.focus();
                        }}
                    >
                        <div className="shrink-0 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                                <Input
                                    data-search-input={field}
                                    placeholder={`Search ${label.toLowerCase()}...`}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                                />
                            </div>
                        </div>
                        <div 
                            className="flex-1 max-h-[200px] overflow-y-auto overflow-x-hidden p-1 space-y-0.5" 
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {error ? (
                                <div className="py-6 px-3 text-center text-xs text-red-600 font-medium">{error}</div>
                            ) : filteredOptions.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-500 font-medium">No results found</div>
                            ) : (
                                filteredOptions.map(({ value: option, label: optionLabel }) => (
                                    <div
                                        key={option}
                                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors group"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleOption(option);
                                        }}
                                    >
                                        <Checkbox 
                                            checked={currentSelected.includes(option)}
                                            onCheckedChange={() => toggleOption(option)}
                                            className="h-3.5 w-3.5"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 truncate">{optionLabel}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="shrink-0 p-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1 bg-zinc-50/40 dark:bg-zinc-900/30">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="flex-1 justify-center h-7 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onFilterChange(field, []);
                                }}
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="flex-1 justify-center h-7 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setIsOpen(false);
                                }}
                            >
                                Close
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

const DateRangeFilterSection = ({
    label,
    field,
    filters,
    setFilters,
    onResetField,
    isAutoOpen,
}: {
    label: string;
    field: "submittedOn" | "verifiedOn";
    filters: FilterValue;
    setFilters: React.Dispatch<React.SetStateAction<FilterValue>>;
    onResetField: (field: keyof FilterValue) => void;
    isAutoOpen: boolean;
}) => {
    const hasValue = Boolean(filters[field]?.from || filters[field]?.to);
    const showTime = field === "submittedOn";
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (isAutoOpen) {
            const timer = setTimeout(() => {
                containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isAutoOpen]);

    return (
        <div ref={containerRef} className="p-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</Label>
                {hasValue && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                        onClick={() => onResetField(field)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-between h-10 px-3 text-xs border-zinc-200 dark:border-zinc-800",
                                !filters[field]?.from && "text-muted-foreground"
                            )}
                        >
                            {filters[field]?.from
                                ? format(filters[field]!.from!, showTime ? "yyyy-MM-dd hh:mm a" : "yyyy-MM-dd")
                                : "From"}
                            <CalendarIcon className="h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md rounded-md"
                        align="start"
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <Calendar
                            mode="single"
                            selected={filters[field]?.from}
                            onSelect={(d) => setFilters((prev) => ({ ...prev, [field]: { ...prev[field], from: d } }))}
                            showTime={showTime}
                            timeValue={filters[field]?.from ? format(filters[field]!.from!, "hh:mm a") : "12:00 AM"}
                            onTimeChange={(time) => {
                                if (filters[field]?.from) {
                                    const [t, p] = time.split(" ");
                                    const [h, m] = t.split(":");
                                    const newDate = new Date(filters[field]!.from!);
                                    let hours = parseInt(h);
                                    if (p === "PM" && hours < 12) hours += 12;
                                    if (p === "AM" && hours === 12) hours = 0;
                                    newDate.setHours(hours, parseInt(m));
                                    setFilters((prev) => ({ ...prev, [field]: { ...prev[field], from: newDate } }));
                                }
                            }}
                        />
                    </PopoverContent>
                </Popover>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-between h-10 px-3 text-xs border-zinc-200 dark:border-zinc-800",
                                !filters[field]?.to && "text-muted-foreground"
                            )}
                        >
                            {filters[field]?.to
                                ? format(filters[field]!.to!, showTime ? "yyyy-MM-dd hh:mm a" : "yyyy-MM-dd")
                                : "To"}
                            <CalendarIcon className="h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md rounded-md"
                        align="start"
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <Calendar
                            mode="single"
                            selected={filters[field]?.to}
                            // V2.1 (QA): the picked "to" DAY is inclusive — its end (23:59:59.999, the "11:59 PM" the time field shows
                            // by default), as matic-dash's transformStartDateAndEndDate sends it; the time field can still set an earlier time.
                            onSelect={(d) => setFilters((prev) => ({ ...prev, [field]: { ...prev[field], to: d ? endOfDay(d) : d } }))}
                            showTime={showTime}
                            timeValue={filters[field]?.to ? format(filters[field]!.to!, "hh:mm a") : "11:59 PM"}
                            onTimeChange={(time) => {
                                if (filters[field]?.to) {
                                    const [t, p] = time.split(" ");
                                    const [h, m] = t.split(":");
                                    const newDate = new Date(filters[field]!.to!);
                                    let hours = parseInt(h);
                                    if (p === "PM" && hours < 12) hours += 12;
                                    if (p === "AM" && hours === 12) hours = 0;
                                    newDate.setHours(hours, parseInt(m));
                                    setFilters((prev) => ({ ...prev, [field]: { ...prev[field], to: newDate } }));
                                }
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

export function FilterSidebar({ open, onOpenChange, onApply, initialFilters, appliedFilters, initialOpenField = null, activeColumns = [], optionsByField, optionErrors }: FilterSidebarProps & { activeColumns?: string[] }) {
    const optionsFor = (field: MultiSelectField, fallback: string[]) => optionsByField?.[field] ?? toOptions(fallback);

    // `filters` is the selection being edited. It follows the filters applied to the table: whenever those change
    // (Apply, a column's "Clear filter", Clear all), the selection is reset to them. While they stay the same, edits
    // that were not applied are kept, as before (closing and reopening the sidebar does not discard them).
    const applied = React.useMemo<FilterValue>(() => ({ ...DEFAULT_FILTERS, ...(appliedFilters ?? initialFilters) }), [appliedFilters, initialFilters]);
    const appliedKey = JSON.stringify(applied);
    const [filters, setFilters] = React.useState<FilterValue>(applied);
    const [selectionAppliedKey, setSelectionAppliedKey] = React.useState(appliedKey);
    if (selectionAppliedKey !== appliedKey) {
        setSelectionAppliedKey(appliedKey);
        setFilters(applied);
    }

    const normalizedOpenField = React.useMemo(() => {
        if (!initialOpenField) return null;
        const map: Record<string, string> = {
            farmer: "farmers",
            farmers: "farmers",
            engagementType: "engagementTypes",
            engagementTypes: "engagementTypes",
            village: "villages",
            villages: "villages",
            base: "bases",
            bases: "bases",
            az: "azs",
            azs: "azs",
            azCode: "azs",
            azName: "azs",
            surveyor: "surveyors",
            surveyors: "surveyors",
            verifiedBy: "verifiedBy",
            submittedOn: "submittedOn",
            verifiedOn: "verifiedOn",
        };
        return map[initialOpenField] || initialOpenField;
    }, [initialOpenField]);

    // Filter out options based on active columns
    const visibleFields = React.useMemo(() => {
        const fields: (keyof FilterValue)[] = [
            'submittedOn', 'farmers', 'engagementTypes', 'bases', 'villages',
            'azs', 'surveyors', 'verifiedBy', 'verifiedOn'
        ];
        
        if (activeColumns.length === 0) return fields;

        return fields.filter(field => {
            if (field === 'farmers') return activeColumns.includes('farmer') || activeColumns.includes('farmers');
            if (field === 'engagementTypes') return activeColumns.includes('engagementType') || activeColumns.includes('engagementTypes');
            if (field === 'villages') return activeColumns.includes('village') || activeColumns.includes('villages');
            if (field === 'bases') return activeColumns.includes('base') || activeColumns.includes('bases');
            if (field === 'azs') return activeColumns.includes('azs') || activeColumns.includes('azCode') || activeColumns.includes('azName');
            if (field === 'surveyors') return activeColumns.includes('surveyor') || activeColumns.includes('surveyors');
            if (field === 'verifiedBy') return activeColumns.includes('verifiedBy');
            if (field === 'verifiedOn') return activeColumns.includes('verifiedOn');
            if (field === 'submittedOn') return activeColumns.includes('submittedOn');
            return activeColumns.includes(field);
        });
    }, [activeColumns]);

    const handleResetField = (field: keyof FilterValue) => {
        setFilters(prev => ({ 
            ...prev, 
            [field]: DEFAULT_FILTERS[field]
        }));
    };

    const handleFilterChange = (field: keyof FilterValue, next: string[]) => {
        setFilters(prev => ({ ...prev, [field]: next }));
    };

    const resetAll = () => {
        setFilters(DEFAULT_FILTERS);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[380px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-[300]">
                <SheetHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <SheetTitle className="text-base font-medium text-zinc-900 dark:text-zinc-50">
                        Filters
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1" onWheel={(e) => e.stopPropagation()}>
                    {visibleFields.includes('submittedOn') && (
                        <DateRangeFilterSection
                            label="Submitted on"
                            field="submittedOn"
                            filters={filters}
                            setFilters={setFilters}
                            onResetField={handleResetField}
                            isAutoOpen={open && normalizedOpenField === 'submittedOn'}
                        />
                    )}
                    {visibleFields.includes('farmers') && (
                        <FilterMultiSelect 
                            label="Farmers" 
                            field="farmers" 
                            options={optionsFor("farmers", FARMER_OPTIONS)} 
                            error={optionErrors?.farmers}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'farmers'}
                        />
                    )}

                    {visibleFields.includes('engagementTypes') && (
                        <FilterMultiSelect 
                            label="Engagement type" 
                            field="engagementTypes" 
                            options={optionsFor("engagementTypes", ENGAGEMENT_TYPES)} 
                            error={optionErrors?.engagementTypes}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'engagementTypes'}
                        />
                    )}
                    {visibleFields.includes('bases') && (
                        <FilterMultiSelect 
                            label="Base" 
                            field="bases" 
                            options={optionsFor("bases", BASE_OPTIONS)} 
                            error={optionErrors?.bases}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'bases'}
                        />
                    )}
                    {visibleFields.includes('villages') && (
                        <FilterMultiSelect 
                            label="Village" 
                            field="villages" 
                            options={optionsFor("villages", VILLAGES)} 
                            error={optionErrors?.villages}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'villages'}
                        />
                    )}
                    {visibleFields.includes('azs') && (
                        <FilterMultiSelect 
                            label="AZs" 
                            field="azs" 
                            options={optionsFor("azs", AZ_OPTIONS)} 
                            error={optionErrors?.azs}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'azs'}
                        />
                    )}
                    {visibleFields.includes('surveyors') && (
                        <FilterMultiSelect 
                            label="Surveyor" 
                            field="surveyors" 
                            options={optionsFor("surveyors", SURVEYOR_OPTIONS)} 
                            error={optionErrors?.surveyors}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'surveyors'}
                        />
                    )}
                    {visibleFields.includes('verifiedBy') && (
                        <FilterMultiSelect 
                            label="Verified By" 
                            field="verifiedBy" 
                            options={optionsFor("verifiedBy", VERIFIER_OPTIONS)} 
                            error={optionErrors?.verifiedBy}
                            currentFilters={filters}
                            onFilterChange={handleFilterChange}
                            onReset={handleResetField}
                            autoOpen={open && normalizedOpenField === 'verifiedBy'}
                        />
                    )}
                    {visibleFields.includes('verifiedOn') && (
                        <DateRangeFilterSection
                            label="Verified On"
                            field="verifiedOn"
                            filters={filters}
                            setFilters={setFilters}
                            onResetField={handleResetField}
                            isAutoOpen={open && normalizedOpenField === 'verifiedOn'}
                        />
                    )}
                </ScrollArea>

                <SheetFooter className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-row items-center gap-3 sm:justify-between">
                    <Button variant="outline" className="flex-1 h-10 text-sm font-medium border-zinc-200 dark:border-zinc-800" onClick={resetAll}>Reset all</Button>
                    <Button className="flex-1 h-10 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium shadow-none" onClick={() => { onApply(filters); onOpenChange(false); }}>Apply now</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
