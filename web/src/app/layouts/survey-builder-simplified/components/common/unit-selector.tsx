"use client";

import React, { useState, useMemo } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Check,
    X,
    Plus,
    Scale,
    Layers,
    Ruler,
    Droplet,
    Clock,
    Thermometer,
    Gauge,
    Zap,
    Compass,
    HardDrive,
    ChevronsUpDown,
    Hash,
} from "lucide-react";
import {
    UnitDefinition,
    UnitCategory,
    UNIT_CATEGORIES,
    UNIT_CATALOGUE,
    getUnitById,
    searchUnits,
    formatUnitLabel,
    formatUnitShort,
} from "../../lib/unit-catalog";

const CATEGORY_ICONS: Record<UnitCategory, React.ReactNode> = {
    mass: <Scale className="h-3 w-3" />,
    area: <Layers className="h-3 w-3" />,
    length: <Ruler className="h-3 w-3" />,
    volume: <Droplet className="h-3 w-3" />,
    count: <Hash className="h-3 w-3" />,
    time: <Clock className="h-3 w-3" />,
    temperature: <Thermometer className="h-3 w-3" />,
    speed: <Gauge className="h-3 w-3" />,
    pressure: <Gauge className="h-3 w-3" />,
    energy: <Zap className="h-3 w-3" />,
    power: <Zap className="h-3 w-3" />,
    angle: <Compass className="h-3 w-3" />,
    digital: <HardDrive className="h-3 w-3" />,
};

export interface SingleUnitSelectorProps {
    mode?: "single" | "fixed";
    multiple?: false;
    value?: string;
    onChange?: (unitId: string | undefined) => void;
    disabled?: boolean;
    placeholder?: string;
    allowClear?: boolean;
}

export interface MultiUnitSelectorProps {
    mode?: "multiple" | "allowed";
    multiple?: true;
    value?: string[];
    allowedUnits?: string[];
    onChange?: (unitIds: string[]) => void;
    onAllowedUnitsChange?: (unitIds: string[]) => void;
    defaultUnit?: string;
    onDefaultUnitChange?: (defaultUnitId: string | undefined) => void;
    disabled?: boolean;
    placeholder?: string;
}

export type UnitSelectorProps = SingleUnitSelectorProps | MultiUnitSelectorProps;

export function UnitSelector(props: UnitSelectorProps) {
    const { disabled = false } = props;
    const isMulti = props.multiple === true || props.mode === "multiple" || props.mode === "allowed" || "allowedUnits" in props;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<UnitCategory | "all">("all");

    // Filter units
    const filteredUnits = useMemo(() => {
        const catFilter = selectedCategory === "all" ? undefined : selectedCategory;
        return searchUnits(searchQuery, catFilter);
    }, [searchQuery, selectedCategory]);

    // Group units by category when searching 'all'
    const groupedUnits = useMemo(() => {
        if (selectedCategory !== "all" || searchQuery.trim().length > 0) {
            return null;
        }
        const map = new Map<UnitCategory, UnitDefinition[]>();
        UNIT_CATEGORIES.forEach((cat) => {
            const units = UNIT_CATALOGUE.filter((u) => u.category === cat.id);
            if (units.length > 0) {
                map.set(cat.id, units);
            }
        });
        return map;
    }, [selectedCategory, searchQuery]);

    // Single Select Mode
    if (!isMulti) {
        const singleProps = props as SingleUnitSelectorProps;
        const selectedDef = singleProps.value ? getUnitById(singleProps.value) : undefined;

        const handleSelectUnit = (unitId: string) => {
            if (singleProps.value === unitId && singleProps.allowClear) {
                singleProps.onChange?.(undefined);
            } else {
                singleProps.onChange?.(unitId);
            }
            setOpen(false);
            setSearchQuery("");
        };

        return (
            <div className="space-y-1.5 w-full">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            disabled={disabled}
                            className="h-10 w-full justify-between rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-normal hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 px-3 text-zinc-900 dark:text-zinc-100 shadow-2xs transition-colors cursor-pointer"
                        >
                            <span className="truncate flex items-center gap-2">
                                {selectedDef ? (
                                    <>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                            {selectedDef.name}
                                        </span>
                                        <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                            {selectedDef.symbol}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-zinc-400 dark:text-zinc-500">
                                        {props.placeholder || "Select unit..."}
                                    </span>
                                )}
                            </span>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1.5" />
                        </Button>
                    </PopoverTrigger>

                    <PopoverContent
                        align="start"
                        className="w-[340px] sm:w-[400px] p-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden"
                    >
                        {/* 1. Search Box */}
                        <div className="flex items-center px-3 border-b border-zinc-100 dark:border-zinc-800">
                            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0 mr-2" />
                            <input
                                placeholder="Search unit, symbol, alias (e.g. kg, acre, m²)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* 2. Category Quick Filters */}
                        {!searchQuery && (
                            <div className="flex items-center gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory("all")}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors ${
                                        selectedCategory === "all"
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    }`}
                                >
                                    All Units
                                </button>
                                {UNIT_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors ${
                                            selectedCategory === cat.id
                                                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                        }`}
                                    >
                                        {CATEGORY_ICONS[cat.id]}
                                        {cat.label.split("/")[0].trim()}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 3. Units List */}
                        <div className="max-h-[280px] overflow-y-auto p-1.5 space-y-1">
                            {singleProps.allowClear && singleProps.value && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        singleProps.onChange?.(undefined);
                                        setOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors"
                                >
                                    <span>Clear / None (Unitless)</span>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}

                            {filteredUnits.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-400">
                                    No units found matching &ldquo;{searchQuery}&rdquo;
                                </div>
                            ) : groupedUnits ? (
                                Array.from(groupedUnits.entries()).map(([catId, units]) => {
                                    const catMeta = UNIT_CATEGORIES.find((c) => c.id === catId);
                                    return (
                                        <div key={catId} className="space-y-0.5 pb-2">
                                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                                                {CATEGORY_ICONS[catId]}
                                                {catMeta?.label}
                                            </div>
                                            {units.map((unit) => {
                                                const isSelected = props.value === unit.id;
                                                return (
                                                    <button
                                                        key={unit.id}
                                                        type="button"
                                                        onClick={() => handleSelectUnit(unit.id)}
                                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                                                            isSelected
                                                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold"
                                                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <span className="truncate">{unit.name}</span>
                                                            <span className="text-[10px] text-zinc-400 font-normal">
                                                                {unit.system}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                                {unit.symbol}
                                                            </span>
                                                            {isSelected && (
                                                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            ) : (
                                filteredUnits.map((unit) => {
                                    const isSelected = props.value === unit.id;
                                    return (
                                        <button
                                            key={unit.id}
                                            type="button"
                                            onClick={() => handleSelectUnit(unit.id)}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                                                isSelected
                                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold"
                                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="truncate">{unit.name}</span>
                                                <span className="text-[10px] text-zinc-400 font-normal">
                                                    {unit.category} • {unit.system}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                    {unit.symbol}
                                                </span>
                                                {isSelected && (
                                                    <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    // Multiple Allowed Units Mode
    const multiProps = props as MultiUnitSelectorProps;
    const allowedList = multiProps.value || multiProps.allowedUnits || [];

    const handleToggleUnit = (unitId: string) => {
        const exists = allowedList.includes(unitId);
        let updated: string[];
        if (exists) {
            updated = allowedList.filter((id) => id !== unitId);
            // If the removed unit was the default unit, clear default
            if (multiProps.defaultUnit === unitId && multiProps.onDefaultUnitChange) {
                multiProps.onDefaultUnitChange(undefined);
            }
        } else {
            updated = [...allowedList, unitId];
            // If this is the very first allowed unit and no default is set, set as default
            if (updated.length === 1 && !multiProps.defaultUnit && multiProps.onDefaultUnitChange) {
                multiProps.onDefaultUnitChange(unitId);
            }
        }
        multiProps.onChange?.(updated);
        multiProps.onAllowedUnitsChange?.(updated);
    };

    const handleRemoveUnit = (unitId: string) => {
        const updated = allowedList.filter((id) => id !== unitId);
        multiProps.onChange?.(updated);
        multiProps.onAllowedUnitsChange?.(updated);
        if (multiProps.defaultUnit === unitId && multiProps.onDefaultUnitChange) {
            multiProps.onDefaultUnitChange(undefined);
        }
    };

    return (
        <div className="space-y-3 w-full">
            {/* 1. Unit Selector Popover */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="h-10 w-full justify-between rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-normal hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600 px-3 text-zinc-900 dark:text-zinc-100 shadow-2xs transition-colors cursor-pointer"
                    >
                        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                            <Plus className="h-3.5 w-3.5 text-zinc-500" />
                            {props.placeholder || "Add allowed unit..."}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                            {allowedList.length} selected
                        </span>
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    align="start"
                    className="w-[340px] sm:w-[400px] p-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden"
                >
                    {/* Search */}
                    <div className="flex items-center px-3 border-b border-zinc-100 dark:border-zinc-800">
                        <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0 mr-2" />
                        <input
                            placeholder="Search unit, symbol, alias..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Category Tabs */}
                    {!searchQuery && (
                        <div className="flex items-center gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("all")}
                                className={`px-2 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors ${
                                    selectedCategory === "all"
                                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                            >
                                All Units
                            </button>
                            {UNIT_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors ${
                                        selectedCategory === cat.id
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    }`}
                                >
                                    {CATEGORY_ICONS[cat.id]}
                                    {cat.label.split("/")[0].trim()}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Unit List */}
                    <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-1">
                        {filteredUnits.length === 0 ? (
                            <div className="py-6 text-center text-xs text-zinc-400">
                                No units found matching &ldquo;{searchQuery}&rdquo;
                            </div>
                        ) : (
                            filteredUnits.map((unit) => {
                                const isSelected = allowedList.includes(unit.id);
                                return (
                                    <button
                                        key={unit.id}
                                        type="button"
                                        onClick={() => handleToggleUnit(unit.id)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                                            isSelected
                                                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold"
                                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="truncate">{unit.name}</span>
                                            <span className="text-[10px] text-zinc-400 font-normal">
                                                {unit.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                {unit.symbol}
                                            </span>
                                            {isSelected && (
                                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            {/* 2. Allowed Units Badge List */}
            {allowedList.length > 0 && (
                <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Configured Allowed Units ({allowedList.length})
                    </Label>
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                        {allowedList.map((unitId) => {
                            const def = getUnitById(unitId);
                            const isDefault = multiProps.defaultUnit === unitId;
                            return (
                                <span
                                    key={unitId}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs transition-colors ${
                                        isDefault
                                            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                                            : "bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800"
                                    }`}
                                >
                                    <span>{def ? def.name : unitId}</span>
                                    <span
                                        className={`font-mono text-[10px] px-1 py-0.2 rounded ${
                                            isDefault
                                                ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                        }`}
                                    >
                                        {def ? def.symbol : unitId}
                                    </span>
                                    {isDefault && (
                                        <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">
                                            Default
                                        </span>
                                    )}
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveUnit(unitId)}
                                            className={`ml-0.5 rounded p-0.5 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 transition-colors ${
                                                isDefault ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"
                                            }`}
                                            title={`Remove ${def?.name || unitId}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. Default Unit Selector */}
            {allowedList.length > 0 && multiProps.onDefaultUnitChange && (
                <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Default Pre-selected Unit
                    </Label>
                    <Select
                        value={multiProps.defaultUnit || "none"}
                        onValueChange={(val) =>
                            multiProps.onDefaultUnitChange &&
                            multiProps.onDefaultUnitChange(val === "none" ? undefined : val)
                        }
                        disabled={disabled}
                    >
                        <SelectTrigger className="h-10 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <SelectValue placeholder="Choose default unit..." />
                        </SelectTrigger>
                        <SelectContent className="text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                            <SelectItem value="none">None (Respondent must select)</SelectItem>
                            {allowedList.map((unitId) => {
                                const def = getUnitById(unitId);
                                return (
                                    <SelectItem key={unitId} value={unitId}>
                                        {def ? `${def.name} (${def.symbol})` : unitId}
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
