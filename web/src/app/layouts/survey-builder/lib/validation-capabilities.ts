import { BackendQuestionType } from "../types/survey-schema";

export interface QuestionValidationCapabilities {
    supportsRequired: boolean;
    supportsLength: boolean; // minChar, maxChar
    supportsNumericLimits: boolean; // minValue, maxValue, decimalPlaces, unitSuffix
    supportsPattern: boolean; // presets and custom regex
    supportsDateLimits: boolean; // minDate, maxDate, disallowFuture, disallowPast
    supportsSelections: boolean; // minSelections, maxSelections (Checkbox)
    supportsMediaLimits: boolean; // minPhotos, maxPhotos, allowedMediaSource
    supportsGpsLimits: boolean; // requireGpsTag, maxGpsAccuracyMeters
    supportsPolygonLimits: boolean; // minVertices, maxVertices, minAreaAcres, maxAreaAcres
    supportsQrLimits: boolean; // qrPrefix, qrValidationRegex, disallowDuplicateScans
    supportsRatingLimits: boolean; // ratingMax, ratingStep
}

export function getValidationCapabilities(type: BackendQuestionType): QuestionValidationCapabilities {
    const isText = type === "Subjective" || type === "TextArea";
    const isNumeric =
        type.includes("Decimal") ||
        type.includes("WholeNum") ||
        type.includes("NaturalNum") ||
        type === "Number" ||
        type === "Repeater_QT";
    const isDate = type === "Date" || type === "CalendarWithDate";
    const isCheckbox = type === "Checkbox";
    const isMedia = type === "Picture Input" || type === "Video";
    const isGPS = type === "Map";
    const isPolygon = type === "PolygonBoundary";
    const isQR = type === "QRCode";
    const isRating = type === "Rating";

    return {
        supportsRequired: true, // All question types support mandatory validation
        supportsLength: isText,
        supportsNumericLimits: isNumeric,
        supportsPattern: isText || isNumeric || isQR,
        supportsDateLimits: isDate,
        supportsSelections: isCheckbox,
        supportsMediaLimits: isMedia,
        supportsGpsLimits: isGPS || isPolygon,
        supportsPolygonLimits: isPolygon,
        supportsQrLimits: isQR,
        supportsRatingLimits: isRating,
    };
}
