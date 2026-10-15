"use client";

import React from "react";
import {
    ShieldCheck,
    Hash,
    Type,
    Image,
    QrCode,
    Pentagon,
    Calendar,
    CheckSquare,
    Star,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Asterisk,
    FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { QuestionModel } from "../../../types/survey-schema";
import { getPresetsForQuestionType, getPresetById, VALIDATION_PRESETS } from "../../../lib/validation-presets";
import { validateRegexSafety, testRegexPattern } from "../../../lib/regex-safety";
import { RegexHelpPopover } from "./regex-help-popover";
import { DatePicker } from "@/components/ui/date-picker";

interface ValidationTabProps {
    question: QuestionModel;
    onChangeQuestion: (updated: QuestionModel) => void;
    isPublished?: boolean;
}

const REGEX_PRESETS = [
    { label: "Free Text (No Format Restriction)", value: "custom", pattern: "" },
    { label: "Email Address", value: "email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    { label: "10-Digit Mobile / Phone Number", value: "phone", pattern: "^[6-9]\\d{9}$" },
    { label: "12-Digit Aadhaar Card Number", value: "aadhaar", pattern: "^\\d{12}$" },
    { label: "PAN Card Number (e.g. ABCDE1234F)", value: "pan", pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$" },
    { label: "Alphanumeric / Khasra Registry ID", value: "khasra", pattern: "^[A-Za-z0-9\\/\\-\\s]+$" },
];

export function ValidationTab({
    question,
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
    const isDate = question.type === "Date" || question.type === "CalendarWithDate";
    const isMedia = question.type === "Picture Input" || question.type === "Video";
    const isGPS = question.type === "Map";
    const isPolygon = question.type === "PolygonBoundary";
    const isQR = question.type === "QRCode";
    const isRating = question.type === "Rating";

    return (
        <div className="space-y-5">
            {/* 1. UNIVERSAL REQUIREMENT & ERROR MESSAGE SECTION */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Asterisk className="h-4 w-4 text-rose-500" />
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                                Mandatory Field Validation
                            </h3>
                            <p className="text-[11px] text-zinc-500">
                                Require surveyor response before form submission
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Label htmlFor="required-toggle" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {val.required ? "Required" : "Optional"}
                        </Label>
                        <Switch
                            id="required-toggle"
                            checked={Boolean(val.required)}
                            disabled={isPublished}
                            onCheckedChange={(checked) => handleUpdate({ required: checked })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Custom Error Message (English)
                        </Label>
                        <Input
                            placeholder="e.g. This question is required to proceed"
                            value={val.customErrorMessage?.en || ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                handleUpdate({
                                    customErrorMessage: {
                                        ...val.customErrorMessage,
                                        en: e.target.value,
                                    },
                                })
                            }
                            className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Custom Error Message (Hindi)
                        </Label>
                        <Input
                            placeholder="e.g. आगे बढ़ने के लिए यह उत्तर देना आवश्यक है"
                            value={val.customErrorMessage?.hi || ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                handleUpdate({
                                    customErrorMessage: {
                                        ...val.customErrorMessage,
                                        hi: e.target.value,
                                    },
                                })
                            }
                            className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-hindi"
                        />
                    </div>
                </div>
            </div>

            {/* 2. MULTI-SELECT CHECKBOX SELECTION LIMITS */}
            {isCheckbox && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Multi-Select Option Selection Constraints
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[10px] text-zinc-500">Surveyor must select at least this many options</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[10px] text-zinc-500">Prevents selecting more than this number of options</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. NUMERIC & MEASUREMENT BOUNDARIES */}
            {isNumeric && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            {isRepeater ? "Repeater Iteration Boundaries (Min / Max Counts)" : "Numeric Range & Measurement Limits"}
                        </h3>
                    </div>

                    <div className={cn(
                        "grid grid-cols-1 gap-3",
                        isRepeater ? "sm:grid-cols-2" : "sm:grid-cols-3"
                    )}>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {isRepeater ? "Minimum Iterations" : "Minimum Allowed Value"}
                            </Label>
                            <Input
                                type="number"
                                placeholder={isRepeater ? "e.g. 1" : "e.g. 0.01"}
                                value={val.minValue !== undefined ? val.minValue : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minValue: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {isRepeater ? "Maximum Iterations" : "Maximum Allowed Value"}
                            </Label>
                            <Input
                                type="number"
                                placeholder={isRepeater ? "e.g. 20" : "e.g. 500"}
                                value={val.maxValue !== undefined ? val.maxValue : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxValue: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        {!isRepeater && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Unit Label / Suffix
                                </Label>
                                <Input
                                    placeholder="e.g. Acres, Kg, ₹, %"
                                    value={val.unitSuffix || ""}
                                    disabled={isPublished}
                                    onChange={(e) =>
                                        handleUpdate({
                                            unitSuffix: e.target.value || undefined,
                                        })
                                    }
                                    className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pattern (regex) validation is set from the Validation toggle on the Basic tab. */}

            {/* 5. DATE & CALENDAR SCHEDULING CONSTRAINTS */}
            {isDate && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Date Boundaries & Calendar Constraints
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Disallow Future Dates
                                </Label>
                                <p className="text-[10px] text-zinc-500">Cannot pick dates past today (e.g. past events)</p>
                            </div>
                            <Switch
                                checked={Boolean(val.disallowFutureDates)}
                                disabled={isPublished}
                                onCheckedChange={(checked) => handleUpdate({ disallowFutureDates: checked })}
                            />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                    Disallow Past Dates
                                </Label>
                                <p className="text-[10px] text-zinc-500">Cannot pick dates before today (e.g. scheduling)</p>
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
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Photo / Video Capture Constraints
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Min Attachments</Label>
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Max Attachments</Label>
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Allowed Media Source</Label>
                            <Select
                                disabled={isPublished}
                                value={val.allowedMediaSource || "both"}
                                onValueChange={(sourceVal: any) => handleUpdate({ allowedMediaSource: sourceVal })}
                            >
                                <SelectTrigger className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
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

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                Enforce GPS Geotag in Photo EXIF
                            </Label>
                            <p className="text-[10px] text-zinc-500">Rejects images without valid device geolocation tags</p>
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
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            GPS Location Accuracy Requirements
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[10px] text-zinc-500">Rejects GPS fix if device error is greater than this threshold</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. POLYGON BOUNDARY CONSTRAINTS */}
            {isPolygon && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Pentagon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Polygon Geodesic Vertex & Area Boundaries
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Minimum Vertices</Label>
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
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Maximum Vertices</Label>
                            <Input
                                type="number"
                                min={3}
                                max={100}
                                placeholder="50"
                                value={val.maxVertices !== undefined ? val.maxVertices : 50}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxVertices: e.target.value === "" ? 50 : Number(e.target.value),
                                    })
                                }
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Min Area (Acres)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                placeholder="e.g. 0.1"
                                value={val.minAreaAcres !== undefined ? val.minAreaAcres : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        minAreaAcres: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Max Area (Acres)</Label>
                            <Input
                                type="number"
                                step="1"
                                placeholder="e.g. 500"
                                value={val.maxAreaAcres !== undefined ? val.maxAreaAcres : ""}
                                disabled={isPublished}
                                onChange={(e) =>
                                    handleUpdate({
                                        maxAreaAcres: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 9. BARCODE / QR SCANNER RULES */}
            {isQR && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Barcode / QR Scanner Validation Rules
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Required Prefix</Label>
                            <Input
                                placeholder="e.g. MATI-"
                                value={val.qrPrefix || ""}
                                disabled={isPublished}
                                onChange={(e) => handleUpdate({ qrPrefix: e.target.value })}
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                            <p className="text-[10px] text-zinc-500">Validation will reject scanned tags without this prefix</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Format Regex Pattern</Label>
                            <Input
                                placeholder="e.g. ^MATI-[A-Z0-9]+$"
                                value={val.qrValidationRegex || ""}
                                disabled={isPublished}
                                onChange={(e) => handleUpdate({ qrValidationRegex: e.target.value })}
                                className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 10. RATING SCALE CONSTRAINTS */}
            {isRating && (
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Rating Scale & Constraints
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Maximum Stars / Scale</Label>
                            <Select
                                disabled={isPublished}
                                value={String(val.ratingMax || 5)}
                                onValueChange={(v) => handleUpdate({ ratingMax: Number(v) })}
                            >
                                <SelectTrigger className="h-8 text-xs bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    <SelectItem value="5">5 Stars</SelectItem>
                                    <SelectItem value="10">10 Stars</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface PatternValidationSectionProps {
    question: QuestionModel;
    val: QuestionModel["validation"];
    isPublished: boolean;
    onUpdate: (updated: Partial<QuestionModel["validation"]>) => void;
}

function PatternValidationSection({
    question,
    val,
    isPublished,
    onUpdate,
}: PatternValidationSectionProps) {
    const isText = question.type === "Subjective" || question.type === "TextArea";
    const availablePresets = React.useMemo(() => {
        return getPresetsForQuestionType(question.type);
    }, [question.type]);

    // Determine current pattern mode: "none" | "preset" | "custom"
    const currentMode: "none" | "preset" | "custom" = React.useMemo(() => {
        if (!val.regexPattern && !val.presetId) return "none";
        if (val.presetId) return "preset";
        return "custom";
    }, [val.presetId, val.regexPattern]);

    const selectedPreset = React.useMemo(() => {
        return getPresetById(val.presetId) || availablePresets[0];
    }, [val.presetId, availablePresets]);

    // Live custom regex tester state
    const [testValue, setTestValue] = React.useState<string>("");
    const regexSafety = React.useMemo(() => {
        if (!val.regexPattern) return { isValid: true };
        return validateRegexSafety(val.regexPattern);
    }, [val.regexPattern]);

    const testResult = React.useMemo(() => {
        if (!val.regexPattern || !testValue) return null;
        return testRegexPattern(val.regexPattern, testValue);
    }, [val.regexPattern, testValue]);

    return (
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            {/* Header with Title and Regex Help button */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            Pattern & Format Validation
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                            Enforce structured inputs using built-in presets or custom regular expressions
                        </p>
                    </div>
                </div>

                <RegexHelpPopover />
            </div>

            {/* Character Limits for Text Fields */}
            {isText && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Minimum Character Length
                        </Label>
                        <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 2"
                            value={val.minChar !== undefined ? val.minChar : ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                onUpdate({
                                    minChar: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                            }
                            className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Maximum Character Length
                        </Label>
                        <Input
                            type="number"
                            min={1}
                            placeholder="e.g. 250"
                            value={val.maxChar !== undefined ? val.maxChar : ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                onUpdate({
                                    maxChar: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                            }
                            className="h-8 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>
                </div>
            )}

            {/* Pattern Validation Mode Selector */}
            <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Format & Pattern Validation
                </Label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() =>
                            onUpdate({
                                presetId: undefined,
                                regexPattern: undefined,
                                patternDescription: undefined,
                            })
                        }
                        className={cn(
                            "py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                            currentMode === "none"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        None
                    </button>

                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() => {
                            const defaultPreset = availablePresets[0] || getPresetById("positive_integer") || VALIDATION_PRESETS[0];
                            onUpdate({
                                presetId: defaultPreset.id,
                                regexPattern: defaultPreset.pattern,
                                patternDescription: defaultPreset.description,
                                customErrorMessage: {
                                    ...val.customErrorMessage,
                                    en: defaultPreset.defaultErrorMessage,
                                },
                            });
                        }}
                        className={cn(
                            "py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                            currentMode === "preset"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        Preset Pattern
                    </button>

                    <button
                        type="button"
                        disabled={isPublished}
                        onClick={() =>
                            onUpdate({
                                presetId: undefined,
                                regexPattern: val.regexPattern || "^[A-Za-z0-9]+$",
                                patternDescription: val.patternDescription || "Custom alphanumeric pattern",
                            })
                        }
                        className={cn(
                            "py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer",
                            currentMode === "custom"
                                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        )}
                    >
                        Custom Regex
                    </button>
                </div>
            </div>

            {/* MODE 1: USE BUILT-IN PRESET */}
            {currentMode === "preset" && (
                <div className="space-y-4 pt-1">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Select Validation Preset
                        </Label>
                        <Select
                            disabled={isPublished}
                            value={(val.presetId && availablePresets.some((p) => p.id === val.presetId)) ? val.presetId : (availablePresets[0]?.id ?? "")}
                            onValueChange={(presetId) => {
                                const preset = getPresetById(presetId);
                                if (preset) {
                                    onUpdate({
                                        presetId: preset.id,
                                        regexPattern: preset.pattern,
                                        patternDescription: preset.description,
                                        customErrorMessage: {
                                            ...val.customErrorMessage,
                                            en: preset.defaultErrorMessage,
                                        },
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <SelectValue placeholder="Choose a preset..." />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                {availablePresets.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedPreset && (
                        <div className="space-y-3.5 pt-1">
                            {/* What it validates */}
                            <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                                    What it validates
                                </span>
                                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    {selectedPreset.description}
                                </p>
                            </div>

                            {/* Pattern display */}
                            <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                                    Regular Expression Pattern
                                </span>
                                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200 select-all overflow-x-auto">
                                    <code>{selectedPreset.pattern}</code>
                                </div>
                            </div>

                            {/* Examples */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                                        Valid Input Example
                                    </span>
                                    <p className="font-mono text-xs text-emerald-900 dark:text-emerald-300">
                                        {selectedPreset.exampleValid}
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 space-y-1">
                                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                                        Invalid Input Example
                                    </span>
                                    <p className="font-mono text-xs text-rose-900 dark:text-rose-300">
                                        {selectedPreset.exampleInvalid}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODE 2: CUSTOM REGEX VALIDATION */}
            {currentMode === "custom" && (
                <div className="space-y-4 pt-1">
                    {/* Pattern Input & Live Syntax Badge */}
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
                            className="h-8.5 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
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

                    {/* Live Test Sandbox */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Test Pattern Interactively
                            </Label>
                            {testResult !== null && (
                                <span
                                    className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded-md leading-none border",
                                        testResult.matches
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                    )}
                                >
                                    {testResult.matches ? "✓ Matches" : "✕ Does not match"}
                                </span>
                            )}
                        </div>
                        <Input
                            placeholder="Type a sample response value to test..."
                            value={testValue}
                            onChange={(e) => setTestValue(e.target.value)}
                            className="h-8.5 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    {/* What this validation does */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Pattern Description (Optional)
                        </Label>
                        <Input
                            placeholder="e.g. Validates 10-digit customer identification code"
                            value={val.patternDescription || ""}
                            disabled={isPublished}
                            onChange={(e) => onUpdate({ patternDescription: e.target.value })}
                            className="h-8.5 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>

                    {/* Custom Error Message */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Custom Error Message
                        </Label>
                        <Input
                            placeholder="Value does not match the required format."
                            value={val.customErrorMessage?.en || ""}
                            disabled={isPublished}
                            onChange={(e) =>
                                onUpdate({
                                    customErrorMessage: {
                                        ...val.customErrorMessage,
                                        en: e.target.value,
                                    },
                                })
                            }
                            className="h-8.5 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

