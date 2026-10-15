"use client";

import React, { useState } from "react";
import {
    ShieldCheck,
    Hash,
    Type,
    Image,
    QrCode,
    Pentagon,
    Calendar,
    CalendarDays,
    CheckSquare,
    MapPin,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { QuestionModel, SurveyModel } from "../../../types/survey-schema";
import { getPresetsForQuestionType, getPresetById, VALIDATION_PRESETS } from "../../../lib/validation-presets";
import { validateRegexSafety, testRegexPattern } from "../../../lib/regex-safety";
import { RegexHelpPopover } from "./regex-help-popover";
import { DatePicker } from "@/components/ui/date-picker";
import { UnitSelector } from "../../common/unit-selector";
import { normalizeLegacyUnit, formatUnitShort } from "../../../lib/unit-catalog";

interface ValidationTabProps {
    question: QuestionModel;
    survey?: SurveyModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

export function ValidationTab({
    question,
    survey,
    onChangeQuestion,
    isPublished = false,
}: ValidationTabProps) {
    const val = question.validation || {};

    const handleUpdate = (updatedVal: Partial<typeof val>) => {
        onChangeQuestion({
            ...question,
            validation: {
                ...val,
                ...updatedVal,
            },
        });
    };

    const isRepeater = question.type === "Repeater_QT" || Boolean(question.repeater?.isRepeater);

    const isNumeric =
        question.type.includes("Decimal") ||
        question.type.includes("WholeNum") ||
        question.type.includes("NaturalNum") ||
        question.type === "Number" ||
        isRepeater;

    const isText = question.type === "Subjective" || question.type === "TextArea";
    const isChoice =
        question.type === "Radio" ||
        question.type === "Checkbox" ||
        question.type === "Dropdown" ||
        question.type === "Selected Dropdown";
    const isCheckbox = question.type === "Checkbox";
    const isDate = question.type === "Date";
    const isDateRange = question.type === "DateRange" || question.type === "CalendarWithDate";
    const isMedia = question.type === "Picture Input" || question.type === "Video";
    const isGPS = question.type === "Map";
    const isPolygon = question.type === "PolygonBoundary";
    const isQR = question.type === "QRCode";
    const isRating = question.type === "Rating";

    const numberFormat = val.numberFormat || (question.type.includes("WholeNum") || question.type.includes("NaturalNum") ? "integer" : "decimal");

    const hasAnyConstraints =
        isText ||
        isNumeric ||
        isCheckbox ||
        isDate ||
        isDateRange ||
        isMedia ||
        isGPS ||
        isPolygon ||
        isQR;

    return (
        <div className="space-y-6">
            {/* Empty state for types without specific constraint controls */}
            {!hasAnyConstraints && (
                <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                    <ShieldCheck className="h-8 w-8 text-zinc-400 mx-auto" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                        No Additional Constraints Available
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Mandatory response rules and error messaging for this question are configured in the <strong>Basic Settings</strong> tab.
                    </p>
                </div>
            )}

            {/* 1. TEXT CHARACTER LENGTH CONSTRAINTS */}
            {isText && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <Type className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Text Character Length Constraints
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Minimum and maximum permissible character count limits for surveyor entry
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Minimum Characters (Min Length)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="e.g. 5"
                                value={val.minChar !== undefined ? val.minChar : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minChar: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[11px] text-zinc-500">Response must contain at least this many characters</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Maximum Characters (Max Length)
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                placeholder="e.g. 500"
                                value={val.maxChar !== undefined ? val.maxChar : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxChar: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[11px] text-zinc-500">Limits response length to prevent excessive text</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MULTI-SELECT CHECKBOX SELECTION LIMITS */}
            {isCheckbox && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Multi-Select Option Selection Constraints
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Minimum and maximum number of choices surveyor can select simultaneously
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Minimum Selections Required
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                placeholder="e.g. 1"
                                value={val.minSelections !== undefined ? val.minSelections : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minSelections: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[11px] text-zinc-500">Surveyor must select at least this many options</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Maximum Selections Allowed
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                placeholder="e.g. 3"
                                value={val.maxSelections !== undefined ? val.maxSelections : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxSelections: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[11px] text-zinc-500">Prevents selecting more than this number of options</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. NUMERIC & MEASUREMENT BOUNDARIES */}
            {isNumeric && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                    {isRepeater ? "Repeater Iteration Boundaries" : "Numeric Range & Value Constraints"}
                                </h3>
                                <p className="text-[11px] text-zinc-500">
                                    Unified numeric configuration supporting whole numbers, decimals, and custom bounds
                                </p>
                            </div>
                        </div>

                        {!isRepeater && (
                            <Badge variant="outline" className="text-[10px] font-mono border-zinc-200 dark:border-zinc-800">
                                {numberFormat.toUpperCase()}
                            </Badge>
                        )}
                    </div>

                    {/* Cross-field validation error banner (VAL-001) */}
                    {val.minValue !== undefined && val.maxValue !== undefined && val.minValue > val.maxValue && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>
                                <strong>Invalid Range:</strong> Minimum value ({val.minValue}) cannot be greater than Maximum value ({val.maxValue}).
                            </span>
                        </div>
                    )}

                    {!isRepeater && (
                        <div className={cn(
                            "grid grid-cols-1 gap-3 p-3 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800",
                            numberFormat === "decimal" ? "sm:grid-cols-2" : "sm:grid-cols-1"
                        )}>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Number Format
                                </Label>
                                <Select
                                    value={numberFormat}
                                    onValueChange={(val: "integer" | "decimal") => handleUpdate({ numberFormat: val })}
                                    disabled={isPublished}
                                >
                                    <SelectTrigger className="h-9 text-xs rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs">
                                        <SelectItem value="integer">Integer (Whole numbers only, e.g. 1, 2, 100)</SelectItem>
                                        <SelectItem value="decimal">Decimal (Floating point, e.g. 3.14, 0.5)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {numberFormat === "decimal" && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                        Decimal Precision (Max Places)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={6}
                                        placeholder="2"
                                        value={val.decimalPlaces !== undefined ? val.decimalPlaces : 2}
                                        disabled={isPublished}
                                        onChange={(e) =>
                                            handleUpdate({
                                                decimalPlaces: e.target.value === "" ? 2 : Number(e.target.value),
                                            })
                                        }
                                        className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className={cn(
                        "grid grid-cols-1 gap-3",
                        isRepeater ? "sm:grid-cols-2" : "sm:grid-cols-3"
                    )}>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                {isRepeater ? "Minimum Iterations" : "Minimum Allowed Value"}
                            </Label>
                            <Input
                                type="number"
                                step={numberFormat === "integer" ? "1" : "0.01"}
                                placeholder={isRepeater ? "e.g. 1" : numberFormat === "integer" ? "e.g. 0" : "e.g. 0.01"}
                                value={val.minValue !== undefined ? val.minValue : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minValue: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className={cn(
                                    "h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                    val.minValue !== undefined && val.maxValue !== undefined && val.minValue > val.maxValue && "border-rose-500 dark:border-rose-500 focus-visible:ring-rose-500"
                                )}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                {isRepeater ? "Maximum Iterations" : "Maximum Allowed Value"}
                            </Label>
                            <Input
                                type="number"
                                step={numberFormat === "integer" ? "1" : "0.01"}
                                placeholder={isRepeater ? "e.g. 20" : numberFormat === "integer" ? "e.g. 100" : "e.g. 500.00"}
                                value={val.maxValue !== undefined ? val.maxValue : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxValue: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className={cn(
                                    "h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
                                    val.minValue !== undefined && val.maxValue !== undefined && val.minValue > val.maxValue && "border-rose-500 dark:border-rose-500 focus-visible:ring-rose-500"
                                )}
                            />
                        </div>

                        {!isRepeater && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Standard Unit
                                </Label>
                                <UnitSelector
                                    mode="single"
                                    value={val.unit || normalizeLegacyUnit(val.unitSuffix)}
                                    onChange={(uId) =>
                                        handleUpdate({
                                            unit: uId,
                                            unitMode: uId ? "fixed" : "none",
                                            unitSuffix: uId ? formatUnitShort(uId) : undefined,
                                        })
                                    }
                                    disabled={isPublished}
                                    placeholder="Choose standard unit..."
                                    allowClear={true}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. PATTERN & REGEX VALIDATION (PRESETS + CUSTOM REGEX + TESTER + HELP) */}
            {(isText || isNumeric || isQR) && (
                <PatternValidationSection
                    question={question}
                    val={val}
                    isPublished={isPublished}
                    onUpdate={handleUpdate}
                />
            )}

            {/* 5. DATE & CALENDAR / DATE RANGE SCHEDULING CONSTRAINTS */}
            {(isDate || isDateRange) && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        {isDateRange ? (
                            <CalendarDays className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        ) : (
                            <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                {isDateRange ? "Date Range Boundaries & Duration Constraints" : "Date Boundaries & Calendar Constraints"}
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                {isDateRange ? "Enforce valid start/end chronological order and bounds" : "Earliest / latest permissible dates for surveyor entry"}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Earliest Allowed Date
                            </Label>
                            <DatePicker
                                value={val.minDate || ""}
                                disabled={isPublished}
                                onChange={(dateStr) => handleUpdate({ minDate: dateStr || undefined })}
                                placeholder="Pick earliest date..."
                                size="sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Latest Allowed Date
                            </Label>
                            <DatePicker
                                value={val.maxDate || ""}
                                disabled={isPublished}
                                onChange={(dateStr) => handleUpdate({ maxDate: dateStr || undefined })}
                                placeholder="Pick latest date..."
                                size="sm"
                            />
                        </div>
                    </div>

                    {isDateRange && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Minimum Range Duration (Days)
                                </Label>
                                <Input
                                    type="number"
                                    min={1}
                                    placeholder="e.g. 1"
                                    value={val.minRangeDays !== undefined ? val.minRangeDays : ""}
                                    disabled={isPublished}
                                    onChange={(e) =>
                                        handleUpdate({
                                            minRangeDays: e.target.value === "" ? undefined : Number(e.target.value),
                                        })
                                    }
                                    className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Maximum Range Duration (Days)
                                </Label>
                                <Input
                                    type="number"
                                    min={1}
                                    placeholder="e.g. 30"
                                    value={val.maxRangeDays !== undefined ? val.maxRangeDays : ""}
                                    disabled={isPublished}
                                    onChange={(e) =>
                                        handleUpdate({
                                            maxRangeDays: e.target.value === "" ? undefined : Number(e.target.value),
                                        })
                                    }
                                    className="h-9 text-xs font-mono rounded-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Disallow Future Dates
                                </Label>
                                <p className="text-[11px] text-zinc-500">Cannot pick dates past today (e.g. past events)</p>
                            </div>
                            <Switch
                                checked={Boolean(val.disallowFutureDates)}
                                disabled={isPublished}
                                onCheckedChange={(checked) => handleUpdate({ disallowFutureDates: checked })}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Disallow Past Dates
                                </Label>
                                <p className="text-[11px] text-zinc-500">Cannot pick dates before today (e.g. scheduling)</p>
                            </div>
                            <Switch
                                checked={Boolean(val.disallowPastDates)}
                                disabled={isPublished}
                                onCheckedChange={(checked) => handleUpdate({ disallowPastDates: checked })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 6. MEDIA PHOTO / VIDEO CONSTRAINTS */}
            {isMedia && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <Image className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Photo / Video Capture Constraints
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Attachment limits, upload sources, and EXIF geolocation requirements
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Min Attachments</Label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                placeholder="1"
                                value={val.minPhotos !== undefined ? val.minPhotos : 1}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minPhotos: e.target.value === "" ? 1 : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Max Attachments</Label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                placeholder="3"
                                value={val.maxPhotos !== undefined ? val.maxPhotos : 3}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxPhotos: e.target.value === "" ? 3 : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Allowed Media Source</Label>
                            <Select
                                disabled={isPublished}
                                value={val.allowedMediaSource || "both"}
                                onValueChange={(sourceVal: any) => handleUpdate({ allowedMediaSource: sourceVal })}
                            >
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    <SelectItem value="both">Live Camera & Gallery Upload</SelectItem>
                                    <SelectItem value="camera">Live Camera Only</SelectItem>
                                    <SelectItem value="upload">Gallery Upload Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Enforce GPS Geotag in Photo EXIF
                            </Label>
                            <p className="text-[11px] text-zinc-500">Rejects images without valid device geolocation tags</p>
                        </div>
                        <Switch
                            checked={Boolean(val.requireGpsTag)}
                            disabled={isPublished}
                            onCheckedChange={(checked) => handleUpdate({ requireGpsTag: checked })}
                        />
                    </div>
                </div>
            )}

            {/* 7. GPS LOCATION POINT CONSTRAINTS */}
            {isGPS && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <MapPin className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                GPS Location Accuracy Requirements
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Enforce device GPS fix accuracy threshold for surveyor coordinates
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Maximum Acceptable GPS Accuracy (Meters)
                            </Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                placeholder="e.g. 15"
                                value={val.maxGpsAccuracyMeters !== undefined ? val.maxGpsAccuracyMeters : 15}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxGpsAccuracyMeters: e.target.value === "" ? 15 : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[11px] text-zinc-500">Rejects GPS fix if device error is greater than this threshold</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. POLYGON BOUNDARY CONSTRAINTS */}
            {isPolygon && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <Pentagon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Polygon Geodesic Vertex & Area Boundaries
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Geometric bounds on field vertex counts and polygon boundaries
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Minimum Vertices</Label>
                            <Input
                                type="number"
                                min={3}
                                max={50}
                                placeholder="3"
                                value={val.minVertices !== undefined ? val.minVertices : 3}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minVertices: e.target.value === "" ? 3 : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Maximum Vertices</Label>
                            <Input
                                type="number"
                                min={3}
                                max={100}
                                placeholder="20"
                                value={val.maxVertices !== undefined ? val.maxVertices : 20}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxVertices: e.target.value === "" ? 20 : Number(e.target.value),
                                    })
                                }
                                className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 9. QR / BARCODE PREFIX FILTER */}
            {isQR && (
                <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <QrCode className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                Barcode / QR Code Payload Constraints
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Mandatory string prefix validation for scanned physical assets
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Required Scanned Payload Prefix
                        </Label>
                        <Input
                            placeholder="e.g. MATI-FARM- or https://myorg.com/item/"
                            value={val.qrPrefix || ""}
                            disabled={isPublished}
                            onChange={(e) => handleUpdate({ qrPrefix: e.target.value || undefined })}
                            className="h-9 text-xs font-mono rounded-lg bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                        <p className="text-[11px] text-zinc-500">
                            Rejects scans that do not begin with this exact character prefix.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENT: REGEX PATTERN VALIDATION WITH PRESETS & LIVE TEST SANDBOX
// ---------------------------------------------------------------------------
interface PatternValidationSectionProps {
    question: QuestionModel;
    val: any;
    isPublished: boolean;
    onUpdate: (updatedVal: Partial<any>) => void;
}

function PatternValidationSection({
    question,
    val,
    isPublished,
    onUpdate,
}: PatternValidationSectionProps) {
    const presets = getPresetsForQuestionType(question.type);
    const selectedPreset = val.validationPresetId
        ? getPresetById(val.validationPresetId) || presets[0] || VALIDATION_PRESETS[0]
        : presets[0] || VALIDATION_PRESETS[0];

    // Pattern mode switcher: "none" | "preset" | "custom"
    const currentMode: "none" | "preset" | "custom" = val.validationPresetId
        ? val.validationPresetId === "custom"
            ? "custom"
            : "preset"
        : val.regexPattern
        ? "custom"
        : "none";

    const [testValue, setTestValue] = useState("");
    const activePattern = currentMode === "preset"
        ? (selectedPreset?.pattern || "")
        : (val.regexPattern || "");

    const regexSafety = validateRegexSafety(activePattern);

    // 4-state interactive regex tester evaluation (VAL-002)
    const getTesterStatus = () => {
        if (!activePattern || activePattern.trim().length === 0) {
            return { label: "No Pattern", statusClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" };
        }
        if (!regexSafety.isValid) {
            return { label: "Invalid Syntax", statusClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800" };
        }
        if (!testValue || testValue.trim().length === 0) {
            return { label: "Enter Sample Value", statusClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" };
        }
        const res = testRegexPattern(activePattern, testValue);
        if (res.matches) {
            return { label: "✓ Matches Pattern", statusClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" };
        }
        return { label: "✕ Does Not Match", statusClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800" };
    };

    const testerStatus = getTesterStatus();

    const handleSelectMode = (mode: "none" | "preset" | "custom") => {
        if (mode === "none") {
            onUpdate({
                validationPresetId: undefined,
                regexPattern: undefined,
                patternDescription: undefined,
            });
        } else if (mode === "preset") {
            const firstPreset = presets[0] || VALIDATION_PRESETS[0];
            onUpdate({
                validationPresetId: firstPreset.id,
                regexPattern: firstPreset.pattern,
                patternDescription: firstPreset.description,
            });
        } else {
            onUpdate({
                validationPresetId: "custom",
                regexPattern: val.regexPattern || "",
            });
        }
    };

    const handleSelectPreset = (presetId: string) => {
        const found = getPresetById(presetId);
        if (found) {
            onUpdate({
                validationPresetId: found.id,
                regexPattern: found.pattern,
                patternDescription: found.description,
            });
        }
    };

    return (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Pattern & Format Validation (Regex)
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                            Validate specific text structures (e.g. Phone, Aadhaar, PAN, Email, Khasra ID)
                        </p>
                    </div>
                </div>

                <RegexHelpPopover />
            </div>

            {/* Mode Selector - Full Width, No Outer Box */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Pattern Validation Mode
                </Label>
                <div className="flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 h-10 w-full">
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleSelectMode("none")}
                        className={cn(
                            "flex-1 h-full flex items-center justify-center text-xs font-medium rounded-md transition-all cursor-pointer",
                            currentMode === "none"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        No Pattern
                    </button>
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleSelectMode("preset")}
                        className={cn(
                            "flex-1 h-full flex items-center justify-center text-xs font-medium rounded-md transition-all cursor-pointer",
                            currentMode === "preset"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        Standard Preset
                    </button>
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => handleSelectMode("custom")}
                        className={cn(
                            "flex-1 h-full flex items-center justify-center text-xs font-medium rounded-md transition-all cursor-pointer",
                            currentMode === "custom"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        Custom Regex
                    </button>
                </div>
            </div>

            {/* MODE 1: STANDARD PRESET DETAILS & SANDBOX */}
            {currentMode === "preset" && (
                <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3.5 animate-in fade-in-50 duration-150">
                    {/* Select Preset Dropdown */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Select Validation Pattern Preset
                        </Label>
                        <Select
                            value={val.validationPresetId || presets[0]?.id || "phone_in"}
                            disabled={isPublished}
                            onValueChange={handleSelectPreset}
                        >
                            <SelectTrigger className="h-10 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs rounded-lg">
                                <SelectValue placeholder="Choose a preset..." />
                            </SelectTrigger>
                            <SelectContent className="text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                {presets.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{p.name}</span>
                                            <span className="text-zinc-400 text-[10px]">({p.description})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedPreset && (
                        <>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                        Regular Expression Pattern
                                    </span>
                                    <span className="text-[11px] text-zinc-500 font-medium">
                                        {selectedPreset.name} &bull; {selectedPreset.description}
                                    </span>
                                </div>
                                <div className="p-2.5 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all overflow-x-auto shadow-2xs">
                                    <code>{selectedPreset.pattern}</code>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3" /> Valid Input Example
                                    </span>
                                    <p className="font-mono text-xs text-emerald-900 dark:text-emerald-300">
                                        {selectedPreset.exampleValid}
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 space-y-1">
                                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlertCircle className="h-3 w-3" /> Invalid Input Example
                                    </span>
                                    <p className="font-mono text-xs text-rose-900 dark:text-rose-300">
                                        {selectedPreset.exampleInvalid}
                                    </p>
                                </div>
                            </div>

                            {/* Interactive Sandbox Test for Presets */}
                            <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                        Test Input Against Preset
                                    </Label>
                                    <span
                                        className={cn(
                                            "text-[10px] font-semibold px-2 py-0.5 rounded-md leading-none border transition-colors",
                                            testerStatus.statusClass
                                        )}
                                    >
                                        {testerStatus.label}
                                    </span>
                                </div>
                                <Input
                                    placeholder="Type a sample response value to test (e.g. 9876543210)..."
                                    value={testValue}
                                    onChange={(e) => setTestValue(e.target.value)}
                                    className="h-10 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs rounded-lg"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* MODE 2: CUSTOM REGEX VALIDATION & SANDBOX */}
            {currentMode === "custom" && (
                <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3.5 animate-in fade-in-50 duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Regular Expression Pattern
                                </Label>
                                {regexSafety.isValid ? (
                                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Valid syntax
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5" /> Invalid syntax
                                    </span>
                                )}
                            </div>
                            <Input
                                placeholder="e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$"
                                value={val.regexPattern || ""}
                                disabled={isPublished}
                                onChange={(e) => onUpdate({ regexPattern: e.target.value })}
                                className="h-10 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs rounded-lg"
                            />
                            {regexSafety.warning && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                    {regexSafety.warning}
                                </p>
                            )}
                            {regexSafety.error && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                    {regexSafety.error}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Test Pattern Interactively
                                </Label>
                                <span
                                    className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded-md leading-none border transition-colors",
                                        testerStatus.statusClass
                                    )}
                                >
                                    {testerStatus.label}
                                </span>
                            </div>
                            <Input
                                placeholder="Type a sample response value to test..."
                                value={testValue}
                                onChange={(e) => setTestValue(e.target.value)}
                                className="h-10 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
