// Question types and categories, as in mati-carbon-demo's survey-builder-simplified
// (registry/question-type-registry.ts → SIMPLIFIED_QUESTION_TYPES / QUESTION_CATEGORIES).
export const CATEGORIES = [
  { id: "choice",    name: "Choice & Selection",    description: "Single and multi-select options" },
  { id: "text",      name: "Text Input",            description: "Short and multi-line responses" },
  { id: "numeric",   name: "Numeric & Precision",   description: "Integers, decimals, and bounded numbers" },
  { id: "datetime",  name: "Date & Time",           description: "Dates, calendar selectors and time" },
  { id: "media",     name: "Media Capture",         description: "Photos, video records and attachments" },
  { id: "location",  name: "Location & Boundary",   description: "GPS points and plot polygon boundaries" },
  { id: "utilities", name: "Operational Utilities", description: "QR code scanners and satisfaction ratings" },
  { id: "advanced",  name: "Dynamic Containers",    description: "Repeater blocks and grouped iterations" },
];

// options: the type has an option list · numeric: min/max are numbers · text: min/max length + regex
export const QUESTION_TYPES = [
  { id: "Radio",             label: "Radio",             category: "choice",    options: true,  description: "Respondent selects exactly one option from a list." },
  { id: "Checkbox",          label: "Checkbox",          category: "choice",    options: true,  description: "Respondent can select one or more applicable options." },
  { id: "Dropdown",          label: "Dropdown",          category: "choice",    options: true,  description: "Compact dropdown list for selecting a single item." },
  { id: "Selected Dropdown", label: "Searchable Dropdown", category: "choice",  options: true,  description: "Search-filtered select for large lists of options." },
  { id: "Rank",              label: "Rank",              category: "choice",    options: true,  description: "Order options by preference, priority, or importance." },
  { id: "Emoji",             label: "Emoji Scale",       category: "choice",                    description: "Visual emoji sentiment scale (5-point smile / neutral / frown)." },
  { id: "Subjective",        label: "Short Text",        category: "text",      text: true,     description: "Single-line textual input for names, IDs, remarks." },
  { id: "TextArea",          label: "Long Text",         category: "text",      text: true,     description: "Multi-line text area for extensive notes or observations." },
  { id: "Number",            label: "Number",            category: "numeric",   numeric: true,  description: "Numerical response with integer / decimal format and range boundaries." },
  { id: "Date",              label: "Date",              category: "datetime",                  description: "Standard single date selection field." },
  { id: "DateRange",         label: "Date Range",        category: "datetime",                  description: "Select a continuous start date and end date range." },
  { id: "Time",              label: "Time",              category: "datetime",                  description: "Time of day selection." },
  { id: "Picture Input",     label: "Picture",           category: "media",                     description: "Camera snapshot or gallery photo upload (e.g. NoC document, plot photo)." },
  { id: "Audio",             label: "Audio",             category: "media",                     description: "Audio recording or voice memo upload for field observations." },
  { id: "Video",             label: "Video",             category: "media",                     description: "Short video clip recording for field condition audits." },
  { id: "Document",          label: "Document",          category: "media",                     description: "Attach PDF, Word doc, or spreadsheet file records." },
  { id: "Map",               label: "GPS Point",         category: "location",                  description: "Capture exact latitude / longitude coordinates." },
  { id: "PolygonBoundary",   label: "Plot Boundary",     category: "location",                  description: "Draw or walk plot vertices to generate a GPS polygon." },
  { id: "QRCode",            label: "QR / Barcode",      category: "utilities",                 description: "Scan a sample barcode or QR code, with manual fallback." },
  { id: "Rating",            label: "Rating",            category: "utilities",                 description: "1 to 5 star / number rating scale." },
  { id: "Repeater_QT",       label: "Repeater",          category: "advanced",                  description: "Repeats a group of questions based on a count or answer." },
];

export const typeOf = (id) => QUESTION_TYPES.find((t) => t.id === id) ?? QUESTION_TYPES[0];
