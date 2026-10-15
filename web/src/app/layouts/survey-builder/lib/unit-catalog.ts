/**
 * Curated, standardized international unit catalogue for Number questions.
 * Built on BIPM SI base/derived units, accepted non-SI units, and Unicode CLDR categories.
 */

export type UnitCategory =
    | "mass"
    | "length"
    | "area"
    | "volume"
    | "temperature"
    | "speed"
    | "time"
    | "pressure"
    | "energy"
    | "power"
    | "angle"
    | "count"
    | "digital";

export type UnitSystem =
    | "SI"
    | "Non-SI (Accepted)"
    | "Imperial/US"
    | "Customary"
    | "Discrete"
    | "Digital";

export interface UnitDefinition {
    id: string; // Unique machine-readable id e.g. "kilogram", "hectare", "acre"
    code: string; // Machine-readable unit code e.g. "kg", "ha", "ac"
    ucumCode?: string; // Standard UCUM electronic interchange code e.g. "kg", "ha", "Cel"
    name: string; // International display name e.g. "Kilogram", "Hectare", "Acre"
    symbol: string; // Mathematical/unit symbol e.g. "kg", "ha", "ac", "m²", "°C"
    category: UnitCategory;
    system: UnitSystem;
    aliases: string[]; // Search aliases e.g. ["kg", "kilogram", "kilo"]
    description?: string;
}

export interface UnitCategoryMeta {
    id: UnitCategory;
    label: string;
    description: string;
}

export const UNIT_CATEGORIES: UnitCategoryMeta[] = [
    { id: "mass", label: "Mass / Weight", description: "Kilograms, grams, tonnes, pounds, ounces" },
    { id: "area", label: "Area", description: "Hectares, acres, square metres, square feet" },
    { id: "length", label: "Length & Distance", description: "Metres, kilometres, centimetres, feet, inches, miles" },
    { id: "volume", label: "Volume / Capacity", description: "Litres, millilitres, cubic metres, gallons" },
    { id: "count", label: "Quantity / Count", description: "Items, pieces, dozens, bags, bundles, percentages" },
    { id: "time", label: "Time / Duration", description: "Seconds, minutes, hours, days, weeks, months, years" },
    { id: "temperature", label: "Temperature", description: "Celsius, Fahrenheit, Kelvin" },
    { id: "speed", label: "Speed", description: "km/h, m/s, mph, knots" },
    { id: "pressure", label: "Pressure", description: "Bar, pascals, kPa, psi, atmospheres" },
    { id: "energy", label: "Energy", description: "Joules, kWh, watt-hours, calories, BTU" },
    { id: "power", label: "Power", description: "Watts, kilowatts, megawatts, horsepower" },
    { id: "angle", label: "Angle", description: "Degrees, radians, arcminutes" },
    { id: "digital", label: "Digital / Data", description: "Bytes, kilobytes, megabytes, gigabytes, terabytes" },
];

export const UNIT_CATALOGUE: UnitDefinition[] = [
    // --- 1. MASS / WEIGHT ---
    {
        id: "kilogram",
        code: "kg",
        ucumCode: "kg",
        name: "Kilogram",
        symbol: "kg",
        category: "mass",
        system: "SI",
        aliases: ["kg", "kilogram", "kilograms", "kilo", "kilos", "kgs"],
        description: "SI base unit of mass",
    },
    {
        id: "gram",
        code: "g",
        name: "Gram",
        symbol: "g",
        category: "mass",
        system: "SI",
        aliases: ["g", "gram", "grams", "gm"],
        description: "1/1000th of a kilogram",
    },
    {
        id: "milligram",
        code: "mg",
        name: "Milligram",
        symbol: "mg",
        category: "mass",
        system: "SI",
        aliases: ["mg", "milligram", "milligrams"],
    },
    {
        id: "microgram",
        code: "ug",
        name: "Microgram",
        symbol: "µg",
        category: "mass",
        system: "SI",
        aliases: ["ug", "µg", "microgram", "micrograms"],
    },
    {
        id: "metric_ton",
        code: "t",
        name: "Tonne (Metric ton)",
        symbol: "t",
        category: "mass",
        system: "Non-SI (Accepted)",
        aliases: ["t", "tonne", "tonnes", "metric ton", "ton", "tons", "mt"],
        description: "1,000 kilograms",
    },
    {
        id: "quintal",
        code: "q",
        name: "Quintal",
        symbol: "q",
        category: "mass",
        system: "Non-SI (Accepted)",
        aliases: ["q", "quintal", "quintals", "100kg"],
        description: "100 kilograms",
    },
    {
        id: "pound",
        code: "lb",
        name: "Pound",
        symbol: "lb",
        category: "mass",
        system: "Imperial/US",
        aliases: ["lb", "lbs", "pound", "pounds"],
    },
    {
        id: "ounce",
        code: "oz",
        name: "Ounce",
        symbol: "oz",
        category: "mass",
        system: "Imperial/US",
        aliases: ["oz", "ounce", "ounces"],
    },
    {
        id: "stone",
        code: "st",
        name: "Stone",
        symbol: "st",
        category: "mass",
        system: "Imperial/US",
        aliases: ["st", "stone", "stones"],
    },

    // --- 2. AREA ---
    {
        id: "hectare",
        code: "ha",
        name: "Hectare",
        symbol: "ha",
        category: "area",
        system: "Non-SI (Accepted)",
        aliases: ["ha", "hectare", "hectares", "hec"],
        description: "10,000 square metres",
    },
    {
        id: "acre",
        code: "ac",
        name: "Acre",
        symbol: "ac",
        category: "area",
        system: "Imperial/US",
        aliases: ["ac", "acre", "acres"],
        description: "4,046.86 square metres",
    },
    {
        id: "square_metre",
        code: "m2",
        name: "Square metre",
        symbol: "m²",
        category: "area",
        system: "SI",
        aliases: ["m2", "m²", "sq m", "sqm", "square metre", "square meter"],
    },
    {
        id: "square_kilometre",
        code: "km2",
        name: "Square kilometre",
        symbol: "km²",
        category: "area",
        system: "SI",
        aliases: ["km2", "km²", "sq km", "sqkm", "square kilometre", "square kilometer"],
    },
    {
        id: "square_foot",
        code: "ft2",
        name: "Square foot",
        symbol: "ft²",
        category: "area",
        system: "Imperial/US",
        aliases: ["ft2", "ft²", "sq ft", "sqft", "square foot", "square feet"],
    },
    {
        id: "square_yard",
        code: "yd2",
        name: "Square yard",
        symbol: "yd²",
        category: "area",
        system: "Imperial/US",
        aliases: ["yd2", "yd²", "sq yd", "square yard", "square yards"],
    },
    {
        id: "square_centimetre",
        code: "cm2",
        name: "Square centimetre",
        symbol: "cm²",
        category: "area",
        system: "SI",
        aliases: ["cm2", "cm²", "sq cm", "square centimetre", "square centimeter"],
    },
    {
        id: "square_millimetre",
        code: "mm2",
        name: "Square millimetre",
        symbol: "mm²",
        category: "area",
        system: "SI",
        aliases: ["mm2", "mm²", "sq mm", "square millimetre", "square millimeter"],
    },
    {
        id: "guntha",
        code: "guntha",
        name: "Guntha",
        symbol: "guntha",
        category: "area",
        system: "Customary",
        aliases: ["guntha", "guntas", "gunta"],
        description: "1/40th of an acre (1,089 sq ft)",
    },
    {
        id: "bigha",
        code: "bigha",
        name: "Bigha",
        symbol: "bigha",
        category: "area",
        system: "Customary",
        aliases: ["bigha", "bighas"],
    },
    {
        id: "cent_area",
        code: "cent",
        name: "Cent",
        symbol: "cent",
        category: "area",
        system: "Customary",
        aliases: ["cent", "cents"],
        description: "1/100th of an acre (435.6 sq ft)",
    },

    // --- 3. LENGTH & DISTANCE ---
    {
        id: "metre",
        code: "m",
        name: "Metre",
        symbol: "m",
        category: "length",
        system: "SI",
        aliases: ["m", "metre", "meter", "meters", "metres"],
        description: "SI base unit of length",
    },
    {
        id: "kilometre",
        code: "km",
        name: "Kilometre",
        symbol: "km",
        category: "length",
        system: "SI",
        aliases: ["km", "kilometre", "kilometer", "km", "kilo"],
    },
    {
        id: "centimetre",
        code: "cm",
        name: "Centimetre",
        symbol: "cm",
        category: "length",
        system: "SI",
        aliases: ["cm", "centimetre", "centimeter", "centi"],
    },
    {
        id: "millimetre",
        code: "mm",
        name: "Millimetre",
        symbol: "mm",
        category: "length",
        system: "SI",
        aliases: ["mm", "millimetre", "millimeter", "milli"],
    },
    {
        id: "inch",
        code: "in",
        name: "Inch",
        symbol: "in",
        category: "length",
        system: "Imperial/US",
        aliases: ["in", "inch", "inches", "\""],
    },
    {
        id: "foot",
        code: "ft",
        name: "Foot",
        symbol: "ft",
        category: "length",
        system: "Imperial/US",
        aliases: ["ft", "foot", "feet", "'"],
    },
    {
        id: "yard",
        code: "yd",
        name: "Yard",
        symbol: "yd",
        category: "length",
        system: "Imperial/US",
        aliases: ["yd", "yard", "yards"],
    },
    {
        id: "mile",
        code: "mi",
        name: "Mile",
        symbol: "mi",
        category: "length",
        system: "Imperial/US",
        aliases: ["mi", "mile", "miles"],
    },
    {
        id: "nautical_mile",
        code: "nmi",
        name: "Nautical mile",
        symbol: "nmi",
        category: "length",
        system: "Non-SI (Accepted)",
        aliases: ["nmi", "nautical mile", "sea mile"],
    },

    // --- 4. VOLUME / CAPACITY ---
    {
        id: "litre",
        code: "L",
        name: "Litre",
        symbol: "L",
        category: "volume",
        system: "Non-SI (Accepted)",
        aliases: ["l", "L", "litre", "liter", "litres", "liters", "ltr"],
    },
    {
        id: "millilitre",
        code: "mL",
        name: "Millilitre",
        symbol: "mL",
        category: "volume",
        system: "SI",
        aliases: ["ml", "mL", "millilitre", "milliliter", "cc"],
    },
    {
        id: "cubic_metre",
        code: "m3",
        name: "Cubic metre",
        symbol: "m³",
        category: "volume",
        system: "SI",
        aliases: ["m3", "m³", "cubic metre", "cubic meter", "cbm"],
    },
    {
        id: "cubic_centimetre",
        code: "cm3",
        name: "Cubic centimetre",
        symbol: "cm³",
        category: "volume",
        system: "SI",
        aliases: ["cm3", "cm³", "cubic centimetre", "cubic centimeter", "cc"],
    },
    {
        id: "gallon_us",
        code: "gal",
        name: "US Gallon",
        symbol: "gal",
        category: "volume",
        system: "Imperial/US",
        aliases: ["gal", "gallon", "gallons", "us gallon"],
    },
    {
        id: "gallon_uk",
        code: "imp_gal",
        name: "Imperial Gallon",
        symbol: "imp gal",
        category: "volume",
        system: "Imperial/US",
        aliases: ["imp gal", "uk gallon", "imperial gallon"],
    },
    {
        id: "fluid_ounce",
        code: "fl_oz",
        name: "Fluid ounce",
        symbol: "fl oz",
        category: "volume",
        system: "Imperial/US",
        aliases: ["fl oz", "fluid ounce", "fluid ounces"],
    },
    {
        id: "cup",
        code: "cup",
        name: "Cup",
        symbol: "cup",
        category: "volume",
        system: "Customary",
        aliases: ["cup", "cups"],
    },
    {
        id: "pint",
        code: "pt",
        name: "Pint",
        symbol: "pt",
        category: "volume",
        system: "Customary",
        aliases: ["pt", "pint", "pints"],
    },
    {
        id: "quart",
        code: "qt",
        name: "Quart",
        symbol: "qt",
        category: "volume",
        system: "Customary",
        aliases: ["qt", "quart", "quarts"],
    },

    // --- 5. QUANTITY / COUNT ---
    {
        id: "item",
        code: "item",
        name: "Item / Count",
        symbol: "item",
        category: "count",
        system: "Discrete",
        aliases: ["item", "items", "unit", "units", "count", "qty", "quantity"],
    },
    {
        id: "piece",
        code: "pcs",
        name: "Piece",
        symbol: "pcs",
        category: "count",
        system: "Discrete",
        aliases: ["pcs", "pc", "piece", "pieces"],
    },
    {
        id: "pair",
        code: "pair",
        name: "Pair",
        symbol: "pair",
        category: "count",
        system: "Discrete",
        aliases: ["pair", "pairs", "2"],
    },
    {
        id: "dozen",
        code: "doz",
        name: "Dozen",
        symbol: "doz",
        category: "count",
        system: "Discrete",
        aliases: ["doz", "dozen", "dozens", "12"],
    },
    {
        id: "hundred",
        code: "hundred",
        name: "Hundred",
        symbol: "hundred",
        category: "count",
        system: "Discrete",
        aliases: ["hundred", "hundreds", "100"],
    },
    {
        id: "thousand",
        code: "thousand",
        name: "Thousand",
        symbol: "thousand",
        category: "count",
        system: "Discrete",
        aliases: ["thousand", "thousands", "1000", "k"],
    },
    {
        id: "bag",
        code: "bag",
        name: "Bag / Sack",
        symbol: "bag",
        category: "count",
        system: "Discrete",
        aliases: ["bag", "bags", "sack", "sacks"],
        description: "Standard agricultural packaging unit",
    },
    {
        id: "box",
        code: "box",
        name: "Box / Carton",
        symbol: "box",
        category: "count",
        system: "Discrete",
        aliases: ["box", "boxes", "carton", "cartons"],
    },
    {
        id: "bundle",
        code: "bundle",
        name: "Bundle",
        symbol: "bundle",
        category: "count",
        system: "Discrete",
        aliases: ["bundle", "bundles"],
    },
    {
        id: "plant",
        code: "plant",
        name: "Plant / Tree",
        symbol: "plant",
        category: "count",
        system: "Discrete",
        aliases: ["plant", "plants", "tree", "trees", "seedling", "seedlings"],
    },
    {
        id: "percentage",
        code: "percent",
        name: "Percentage",
        symbol: "%",
        category: "count",
        system: "Discrete",
        aliases: ["%", "percent", "percentage", "pct", "portion"],
    },

    // --- 6. TIME / DURATION ---
    {
        id: "second",
        code: "s",
        name: "Second",
        symbol: "s",
        category: "time",
        system: "SI",
        aliases: ["s", "sec", "second", "seconds"],
        description: "SI base unit of time",
    },
    {
        id: "minute",
        code: "min",
        name: "Minute",
        symbol: "min",
        category: "time",
        system: "Non-SI (Accepted)",
        aliases: ["min", "mins", "minute", "minutes"],
    },
    {
        id: "hour",
        code: "h",
        name: "Hour",
        symbol: "h",
        category: "time",
        system: "Non-SI (Accepted)",
        aliases: ["h", "hr", "hrs", "hour", "hours"],
    },
    {
        id: "day",
        code: "d",
        name: "Day",
        symbol: "d",
        category: "time",
        system: "Non-SI (Accepted)",
        aliases: ["d", "day", "days"],
    },
    {
        id: "week",
        code: "wk",
        name: "Week",
        symbol: "wk",
        category: "time",
        system: "Customary",
        aliases: ["wk", "wks", "week", "weeks"],
    },
    {
        id: "month",
        code: "mo",
        name: "Month",
        symbol: "mo",
        category: "time",
        system: "Customary",
        aliases: ["mo", "mos", "month", "months"],
    },
    {
        id: "year",
        code: "yr",
        name: "Year",
        symbol: "yr",
        category: "time",
        system: "Customary",
        aliases: ["yr", "yrs", "year", "years"],
    },
    {
        id: "millisecond",
        code: "ms",
        name: "Millisecond",
        symbol: "ms",
        category: "time",
        system: "SI",
        aliases: ["ms", "millisecond", "milliseconds"],
    },

    // --- 7. TEMPERATURE ---
    {
        id: "celsius",
        code: "Cel",
        name: "Degree Celsius",
        symbol: "°C",
        category: "temperature",
        system: "SI",
        aliases: ["c", "°c", "celsius", "centigrade", "deg c", "deg_c", "degc", "degree celsius"],
    },
    {
        id: "fahrenheit",
        code: "degF",
        name: "Degree Fahrenheit",
        symbol: "°F",
        category: "temperature",
        system: "Imperial/US",
        aliases: ["f", "°f", "fahrenheit", "deg f", "deg_f", "degf", "degree fahrenheit"],
    },
    {
        id: "kelvin",
        code: "K",
        name: "Kelvin",
        symbol: "K",
        category: "temperature",
        system: "SI",
        aliases: ["k", "kelvin", "deg k", "deg_k", "degk"],
        description: "SI base unit of thermodynamic temperature",
    },

    // --- 8. SPEED ---
    {
        id: "kilometre_per_hour",
        code: "km/h",
        name: "Kilometre per hour",
        symbol: "km/h",
        category: "speed",
        system: "Non-SI (Accepted)",
        aliases: ["km/h", "kmh", "kph", "kilometre per hour", "kilometer per hour"],
    },
    {
        id: "metre_per_second",
        code: "m/s",
        name: "Metre per second",
        symbol: "m/s",
        category: "speed",
        system: "SI",
        aliases: ["m/s", "mps", "metre per second", "meter per second"],
    },
    {
        id: "mile_per_hour",
        code: "mph",
        name: "Mile per hour",
        symbol: "mph",
        category: "speed",
        system: "Imperial/US",
        aliases: ["mph", "mile per hour", "miles per hour"],
    },
    {
        id: "knot",
        code: "kn",
        name: "Knot",
        symbol: "kn",
        category: "speed",
        system: "Non-SI (Accepted)",
        aliases: ["kn", "knot", "knots", "kt"],
    },

    // --- 9. PRESSURE ---
    {
        id: "bar",
        code: "bar",
        name: "Bar",
        symbol: "bar",
        category: "pressure",
        system: "Non-SI (Accepted)",
        aliases: ["bar", "bars"],
        description: "100,000 pascals",
    },
    {
        id: "kilopascal",
        code: "kPa",
        name: "Kilopascal",
        symbol: "kPa",
        category: "pressure",
        system: "SI",
        aliases: ["kpa", "kilopascal", "kilopascals"],
    },
    {
        id: "megapascal",
        code: "MPa",
        name: "Megapascal",
        symbol: "MPa",
        category: "pressure",
        system: "SI",
        aliases: ["mpa", "megapascal", "megapascals"],
    },
    {
        id: "pascal",
        code: "Pa",
        name: "Pascal",
        symbol: "Pa",
        category: "pressure",
        system: "SI",
        aliases: ["pa", "pascal", "pascals"],
    },
    {
        id: "psi",
        code: "psi",
        name: "Pound per square inch",
        symbol: "psi",
        category: "pressure",
        system: "Imperial/US",
        aliases: ["psi", "pound per square inch", "pounds per square inch", "pound_per_square_inch", "lb/in2", "psi"],
    },
    {
        id: "atmosphere",
        code: "atm",
        name: "Atmosphere",
        symbol: "atm",
        category: "pressure",
        system: "Non-SI (Accepted)",
        aliases: ["atm", "atmosphere", "atmospheres"],
    },

    // --- 10. ENERGY ---
    {
        id: "kilowatt_hour",
        code: "kWh",
        name: "Kilowatt-hour",
        symbol: "kWh",
        category: "energy",
        system: "Non-SI (Accepted)",
        aliases: ["kwh", "kilowatt-hour", "kilowatt hour", "units"],
    },
    {
        id: "watt_hour",
        code: "Wh",
        name: "Watt-hour",
        symbol: "Wh",
        category: "energy",
        system: "Non-SI (Accepted)",
        aliases: ["wh", "watt-hour", "watt hour"],
    },
    {
        id: "megawatt_hour",
        code: "MWh",
        name: "Megawatt-hour",
        symbol: "MWh",
        category: "energy",
        system: "Non-SI (Accepted)",
        aliases: ["mwh", "megawatt-hour", "megawatt hour"],
    },
    {
        id: "joule",
        code: "J",
        name: "Joule",
        symbol: "J",
        category: "energy",
        system: "SI",
        aliases: ["j", "joule", "joules"],
    },
    {
        id: "kilojoule",
        code: "kJ",
        name: "Kilojoule",
        symbol: "kJ",
        category: "energy",
        system: "SI",
        aliases: ["kj", "kilojoule", "kilojoules"],
    },
    {
        id: "megajoule",
        code: "MJ",
        name: "Megajoule",
        symbol: "MJ",
        category: "energy",
        system: "SI",
        aliases: ["mj", "megajoule", "megajoules"],
    },
    {
        id: "calorie",
        code: "cal",
        name: "Calorie",
        symbol: "cal",
        category: "energy",
        system: "Non-SI (Accepted)",
        aliases: ["cal", "calorie", "calories"],
    },
    {
        id: "kilocalorie",
        code: "kcal",
        name: "Kilocalorie",
        symbol: "kcal",
        category: "energy",
        system: "Non-SI (Accepted)",
        aliases: ["kcal", "kilocalorie", "kilocalories"],
    },
    {
        id: "btu",
        code: "BTU",
        name: "British thermal unit",
        symbol: "BTU",
        category: "energy",
        system: "Imperial/US",
        aliases: ["btu", "british thermal unit"],
    },

    // --- 11. POWER ---
    {
        id: "watt",
        code: "W",
        name: "Watt",
        symbol: "W",
        category: "power",
        system: "SI",
        aliases: ["w", "watt", "watts"],
    },
    {
        id: "kilowatt",
        code: "kW",
        name: "Kilowatt",
        symbol: "kW",
        category: "power",
        system: "SI",
        aliases: ["kw", "kilowatt", "kilowatts"],
    },
    {
        id: "megawatt",
        code: "MW",
        name: "Megawatt",
        symbol: "MW",
        category: "power",
        system: "SI",
        aliases: ["mw", "megawatt", "megawatts"],
    },
    {
        id: "gigawatt",
        code: "GW",
        name: "Gigawatt",
        symbol: "GW",
        category: "power",
        system: "SI",
        aliases: ["gw", "gigawatt", "gigawatts"],
    },
    {
        id: "horsepower",
        code: "hp",
        name: "Horsepower",
        symbol: "hp",
        category: "power",
        system: "Imperial/US",
        aliases: ["hp", "horsepower", "horse power"],
    },

    // --- 12. ANGLE ---
    {
        id: "degree",
        code: "deg",
        name: "Degree",
        symbol: "°",
        category: "angle",
        system: "Non-SI (Accepted)",
        aliases: ["deg", "degree", "degrees", "°"],
    },
    {
        id: "radian",
        code: "rad",
        name: "Radian",
        symbol: "rad",
        category: "angle",
        system: "SI",
        aliases: ["rad", "radian", "radians"],
    },
    {
        id: "arcminute",
        code: "arcmin",
        name: "Minute of arc",
        symbol: "arcmin",
        category: "angle",
        system: "Non-SI (Accepted)",
        aliases: ["arcmin", "minute of arc", "'"],
    },
    {
        id: "arcsecond",
        code: "arcsec",
        name: "Second of arc",
        symbol: "arcsec",
        category: "angle",
        system: "Non-SI (Accepted)",
        aliases: ["arcsec", "second of arc", "\""],
    },

    // --- 13. DIGITAL / DATA ---
    {
        id: "byte",
        code: "B",
        name: "Byte",
        symbol: "B",
        category: "digital",
        system: "Digital",
        aliases: ["byte", "bytes", "b"],
    },
    {
        id: "kilobyte",
        code: "kB",
        name: "Kilobyte",
        symbol: "kB",
        category: "digital",
        system: "Digital",
        aliases: ["kb", "kB", "kilobyte", "kilobytes"],
    },
    {
        id: "megabyte",
        code: "MB",
        name: "Megabyte",
        symbol: "MB",
        category: "digital",
        system: "Digital",
        aliases: ["mb", "MB", "megabyte", "megabytes"],
    },
    {
        id: "gigabyte",
        code: "GB",
        name: "Gigabyte",
        symbol: "GB",
        category: "digital",
        system: "Digital",
        aliases: ["gb", "GB", "gigabyte", "gigabytes"],
    },
    {
        id: "terabyte",
        code: "TB",
        name: "Terabyte",
        symbol: "TB",
        category: "digital",
        system: "Digital",
        aliases: ["tb", "TB", "terabyte", "terabytes"],
    },
];

/**
 * Fast lookup map by unit ID
 */
const UNIT_MAP_BY_ID = new Map<string, UnitDefinition>();
UNIT_CATALOGUE.forEach((u) => {
    UNIT_MAP_BY_ID.set(u.id, u);
    if (!UNIT_MAP_BY_ID.has(u.code)) {
        UNIT_MAP_BY_ID.set(u.code, u);
    }
});

export function getUnitById(idOrCode: string): UnitDefinition | undefined {
    if (!idOrCode) return undefined;
    const direct = UNIT_MAP_BY_ID.get(idOrCode);
    if (direct) return direct;
    const lower = idOrCode.toLowerCase();
    return UNIT_CATALOGUE.find(
        (u) =>
            u.id.toLowerCase() === lower ||
            u.code.toLowerCase() === lower ||
            u.symbol.toLowerCase() === lower ||
            u.aliases.some((a) => a.toLowerCase() === lower || a.toLowerCase().replace(/[_\s-]+/g, "_") === lower)
    );
}

export function getUnitsByCategory(category: UnitCategory): UnitDefinition[] {
    return UNIT_CATALOGUE.filter((u) => u.category === category);
}

export function searchUnits(query: string, categoryFilter?: UnitCategory): UnitDefinition[] {
    const rawQ = (query || "").trim().toLowerCase();
    if (!rawQ) {
        return categoryFilter ? UNIT_CATALOGUE.filter((u) => u.category === categoryFilter) : UNIT_CATALOGUE;
    }
    const cleanQ = rawQ.replace(/[_\s-]+/g, " ");
    const compactQ = rawQ.replace(/[^a-z0-9]/g, "");

    return UNIT_CATALOGUE.filter((unit) => {
        if (categoryFilter && unit.category !== categoryFilter) {
            return false;
        }

        const nameLower = unit.name.toLowerCase();
        const symbolLower = unit.symbol.toLowerCase();
        const codeLower = unit.code.toLowerCase();
        const idLower = unit.id.toLowerCase();
        const idClean = idLower.replace(/[_\s-]+/g, " ");
        const ucumLower = (unit.ucumCode || "").toLowerCase();

        if (
            nameLower.includes(rawQ) ||
            symbolLower.includes(rawQ) ||
            codeLower.includes(rawQ) ||
            idLower.includes(rawQ) ||
            ucumLower.includes(rawQ)
        ) {
            return true;
        }

        if (nameLower.includes(cleanQ) || idClean.includes(cleanQ)) {
            return true;
        }

        if (compactQ && (idLower.replace(/[^a-z0-9]/g, "").includes(compactQ) || codeLower.replace(/[^a-z0-9]/g, "").includes(compactQ))) {
            return true;
        }

        if (
            unit.aliases.some((alias) => {
                const aLower = alias.toLowerCase();
                return (
                    aLower === rawQ ||
                    aLower.includes(rawQ) ||
                    aLower.replace(/[_\s-]+/g, " ").includes(cleanQ) ||
                    (compactQ.length >= 2 && aLower.replace(/[^a-z0-9]/g, "").includes(compactQ))
                );
            })
        ) {
            return true;
        }

        return false;
    });
}

export function formatUnitLabel(unitOrId: UnitDefinition | string | undefined): string {
    if (!unitOrId) return "";
    const def = typeof unitOrId === "string" ? getUnitById(unitOrId) : unitOrId;
    if (!def) {
        return typeof unitOrId === "string" ? unitOrId : "";
    }
    return `${def.name} (${def.symbol})`;
}

export function formatUnitShort(unitOrId: UnitDefinition | string | undefined): string {
    if (!unitOrId) return "";
    const def = typeof unitOrId === "string" ? getUnitById(unitOrId) : unitOrId;
    if (!def) {
        return typeof unitOrId === "string" ? unitOrId : "";
    }
    return def.symbol || def.code;
}

export function normalizeLegacyUnit(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const directMatch = getUnitById(trimmed);
    if (directMatch) return directMatch.id;

    const lower = trimmed.toLowerCase();
    const aliasMatch = UNIT_CATALOGUE.find(
        (u) =>
            u.id.toLowerCase() === lower ||
            u.code.toLowerCase() === lower ||
            u.symbol.toLowerCase() === lower ||
            u.name.toLowerCase() === lower ||
            u.aliases.some((a) => a.toLowerCase() === lower)
    );

    if (aliasMatch) return aliasMatch.id;
    return trimmed;
}

export const UNIT_CATALOG = UNIT_CATALOGUE;
