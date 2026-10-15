"use client";

import * as React from "react";
import {
    Calendar as CalendarIcon,
    X,
    Search,
    ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
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

export interface SeasonFilterValue {
    seasonIds: string[];
    bases: string[];
    countries: string[];
    azNames: string[];
    seasons: string[];
    statuses: string[];
    createdBy: string[];
    updatedBy: string[];
    startDate?: { from?: Date; to?: Date };
    endDate?: { from?: Date; to?: Date };
}

export const DEFAULT_SEASON_FILTERS: SeasonFilterValue = {
    seasonIds: [],
    bases: [],
    countries: [],
    azNames: [],
    seasons: [],
    statuses: [],
    createdBy: [],
    updatedBy: [],
};

interface SeasonFilterSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: SeasonFilterValue;
    onApply: (filters: SeasonFilterValue) => void;
    onReset: () => void;
    initialOpenField?: string | null;
    seasonIds?: string[];
    bases?: string[];
    countries?: string[];
    azNames?: string[];
    seasons?: string[];
    statuses?: string[];
    createdByList?: string[];
    updatedByList?: string[];
}

const FilterMultiSelect = ({
    label,
    field,
    options = [],
    currentFilters,
    onFilterChange,
    onReset,
    autoOpen = false,
}: {
    label: string;
    field: keyof SeasonFilterValue;
    options?: string[];
    currentFilters: SeasonFilterValue;
    onFilterChange: (field: keyof SeasonFilterValue, next: string[]) => void;
    onReset: (field: keyof SeasonFilterValue) => void;
    autoOpen?: boolean;
}) => {
    const [search, setSearch] = React.useState("");
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (autoOpen) {
            // Delay open to allow the Sheet transition and triggering DropdownMenu closing cleanup to finish
            const timer = setTimeout(() => {
                setIsOpen(true);
                containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => {
                    searchInputRef.current?.focus();
                }, 100);
            }, 250);
            return () => clearTimeout(timer);
        } else {
            setIsOpen(false);
        }
    }, [autoOpen]);

    const safeOptions = React.useMemo(() => {
        if (!Array.isArray(options)) return [];
        return Array.from(
            new Set(
                options
                    .filter((opt): opt is string => typeof opt === "string" && opt.trim().length > 0)
                    .map((opt) => opt.trim())
            )
        );
    }, [options]);

    const currentSelected = (currentFilters[field] as string[]) || [];

    const filteredOptions = React.useMemo(() => {
        if (!search.trim()) return safeOptions;
        const q = search.toLowerCase();
        return safeOptions.filter((opt) => opt.toLowerCase().includes(q));
    }, [safeOptions, search]);

    const toggleOption = (value: string) => {
        const next = currentSelected.includes(value)
            ? currentSelected.filter((v) => v !== value)
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
                                    setIsOpen((prev) => !prev);
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
                                currentSelected.map((option) => (
                                    <Badge
                                        key={option}
                                        variant="secondary"
                                        className="pl-2 pr-1 py-1 gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-none text-[10px] font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="truncate max-w-[130px]">{option}</span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = currentSelected.filter((v) => v !== option);
                                                onFilterChange(field, next);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const next = currentSelected.filter((v) => v !== option);
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
                            setTimeout(() => {
                                searchInputRef.current?.focus();
                            }, 50);
                        }}
                    >
                        <div className="shrink-0 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                                <Input
                                    ref={searchInputRef}
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
                            {filteredOptions.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-500 font-medium">
                                    No results found
                                </div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <div
                                        key={option}
                                        className="flex items-center gap-2.5 rounded-sm px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors group"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleOption(option);
                                        }}
                                    >
                                        <Checkbox
                                            checked={currentSelected.includes(option)}
                                            onCheckedChange={() => toggleOption(option)}
                                            className="h-4 w-4"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-50 truncate">
                                            {option}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="shrink-0 p-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1 bg-zinc-50/40 dark:bg-zinc-900/30">
                            <Button
                                type="button"
                                variant="ghost"
                                className="flex-1 justify-center h-8 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
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
                                className="flex-1 justify-center h-8 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
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

export function SeasonFilterSidebar({
    open,
    onOpenChange,
    filters,
    onApply,
    onReset,
    initialOpenField = null,
    seasonIds = [],
    bases = [],
    countries = [],
    azNames = [],
    seasons = [],
    statuses = [],
    createdByList = [],
    updatedByList = [],
}: SeasonFilterSidebarProps) {
    const [localFilters, setLocalFilters] = React.useState<SeasonFilterValue>(filters);

    React.useEffect(() => {
        setLocalFilters(filters);
    }, [filters, open]);

    const normalizedOpenField = React.useMemo(() => {
        if (!initialOpenField) return null;
        const map: Record<string, string> = {
            id: "seasonIds",
            seasonIds: "seasonIds",
            baseName: "bases",
            bases: "bases",
            country: "countries",
            countries: "countries",
            azName: "azNames",
            azNames: "azNames",
            season: "seasons",
            seasons: "seasons",
            status: "statuses",
            statuses: "statuses",
            createdBy: "createdBy",
            updatedBy: "updatedBy",
            createdAt: "startDate",
            seasonStart: "startDate",
            startDate: "startDate",
            seasonEnd: "endDate",
            endDate: "endDate",
        };
        return map[initialOpenField] || initialOpenField;
    }, [initialOpenField]);

    const handleResetField = (field: keyof SeasonFilterValue) => {
        setLocalFilters((prev) => ({
            ...prev,
            [field]: DEFAULT_SEASON_FILTERS[field],
        }));
    };

    const handleFilterChange = (field: keyof SeasonFilterValue, next: string[]) => {
        setLocalFilters((prev) => ({ ...prev, [field]: next }));
    };

    const handleResetAll = () => {
        setLocalFilters(DEFAULT_SEASON_FILTERS);
        onReset();
        onOpenChange(false);
    };

    const handleApply = () => {
        onApply(localFilters);
        onOpenChange(false);
    };

    const renderDateRange = (label: string, field: "startDate" | "endDate") => {
        const hasValue = localFilters[field]?.from || localFilters[field]?.to;
        const isAutoOpen = open && normalizedOpenField === field;
        const dateContainerRef = React.useRef<HTMLDivElement>(null);
        const [isDateOpen, setIsDateOpen] = React.useState(false);

        React.useEffect(() => {
            if (isAutoOpen) {
                const timer = setTimeout(() => {
                    setIsDateOpen(true);
                    dateContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 250);
                return () => clearTimeout(timer);
            } else {
                setIsDateOpen(false);
            }
        }, [isAutoOpen]);

        return (
            <div ref={dateContainerRef} className="p-4 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</Label>
                    {hasValue && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                            onClick={() => handleResetField(field)}
                        >
                            Reset
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Popover open={isDateOpen} onOpenChange={setIsDateOpen} modal={false}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDateOpen((prev) => !prev)}
                                className={cn(
                                    "w-full justify-between h-10 px-3 text-xs border-zinc-200 dark:border-zinc-800",
                                    !localFilters[field]?.from && "text-muted-foreground",
                                    isDateOpen && "border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400 dark:ring-zinc-600"
                                )}
                            >
                                {localFilters[field]?.from
                                    ? format(localFilters[field]!.from!, "yyyy-MM-dd")
                                    : "From"}
                                <CalendarIcon className="h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md rounded-md z-[2000]"
                            align="start"
                            sideOffset={4}
                            avoidCollisions={true}
                            collisionPadding={16}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <Calendar
                                mode="single"
                                selected={localFilters[field]?.from}
                                onSelect={(d) => {
                                    setLocalFilters((prev) => ({
                                        ...prev,
                                        [field]: { ...prev[field], from: d },
                                    }));
                                    setIsDateOpen(false);
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                    "w-full justify-between h-10 px-3 text-xs border-zinc-200 dark:border-zinc-800",
                                    !localFilters[field]?.to && "text-muted-foreground"
                                )}
                            >
                                {localFilters[field]?.to
                                    ? format(localFilters[field]!.to!, "yyyy-MM-dd")
                                    : "To"}
                                <CalendarIcon className="h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md rounded-md z-[2000]"
                            align="start"
                            sideOffset={4}
                            avoidCollisions={true}
                            collisionPadding={16}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <Calendar
                                mode="single"
                                selected={localFilters[field]?.to}
                                onSelect={(d) =>
                                    setLocalFilters((prev) => ({
                                        ...prev,
                                        [field]: { ...prev[field], to: d },
                                    }))
                                }
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        );
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[380px] p-0 flex flex-col gap-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-[200]">
                <SheetHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <SheetTitle className="text-base font-medium text-zinc-900 dark:text-zinc-50">
                        Filters
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1" onWheel={(e) => e.stopPropagation()}>
                    <FilterMultiSelect
                        label="Season ID"
                        field="seasonIds"
                        options={seasonIds}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "seasonIds"}
                    />
                    <FilterMultiSelect
                        label="Base Name"
                        field="bases"
                        options={bases}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "bases"}
                    />
                    <FilterMultiSelect
                        label="Country"
                        field="countries"
                        options={countries}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "countries"}
                    />
                    <FilterMultiSelect
                        label="AZ Name"
                        field="azNames"
                        options={azNames}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "azNames"}
                    />
                    <FilterMultiSelect
                        label="Season"
                        field="seasons"
                        options={seasons}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "seasons"}
                    />
                    <FilterMultiSelect
                        label="Status"
                        field="statuses"
                        options={statuses}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "statuses"}
                    />
                    <FilterMultiSelect
                        label="Created By"
                        field="createdBy"
                        options={createdByList}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "createdBy"}
                    />
                    <FilterMultiSelect
                        label="Updated By"
                        field="updatedBy"
                        options={updatedByList}
                        currentFilters={localFilters}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetField}
                        autoOpen={open && normalizedOpenField === "updatedBy"}
                    />
                    {renderDateRange("Season Start", "startDate")}
                    {renderDateRange("Season End", "endDate")}
                </ScrollArea>

                <SheetFooter className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-row items-center gap-3 sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-10 text-sm font-medium border-zinc-200 dark:border-zinc-800"
                        onClick={handleResetAll}
                    >
                        Reset all
                    </Button>
                    <Button
                        type="button"
                        className="flex-1 h-10 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 text-sm font-medium shadow-none"
                        onClick={handleApply}
                    >
                        Apply now
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
