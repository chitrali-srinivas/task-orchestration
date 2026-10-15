import { LocaleDefinition } from "../types/survey-schema";

export interface LanguageCatalogItem {
    code: string;
    name: string;
    nativeName: string;
    label: string; // e.g. "Punjabi (ਪੰਜਾਬੀ)"
    region: "India (Regional)" | "Global" | "Custom";
    direction?: "ltr" | "rtl";
}

export const SUPPORTED_LANGUAGES_CATALOG: LanguageCatalogItem[] = [
    // Core English
    { code: "en", name: "English", nativeName: "English", label: "English (EN)", region: "Global" },
    
    // Indian Regional Languages (Agricultural priority)
    { code: "hi", name: "Hindi", nativeName: "हिंदी", label: "Hindi (हिंदी)", region: "India (Regional)" },
    { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", label: "Punjabi (ਪੰਜਾਬੀ)", region: "India (Regional)" },
    { code: "mr", name: "Marathi", nativeName: "मराठी", label: "Marathi (मराठी)", region: "India (Regional)" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", label: "Gujarati (ગુજરાતી)", region: "India (Regional)" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు", label: "Telugu (తెలుగు)", region: "India (Regional)" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்", label: "Tamil (தமிழ்)", region: "India (Regional)" },
    { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", label: "Kannada (ಕನ್ನಡ)", region: "India (Regional)" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা", label: "Bengali (বাংলা)", region: "India (Regional)" },
    { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", label: "Odia (ଓଡ଼ିଆ)", region: "India (Regional)" },
    { code: "ml", name: "Malayalam", nativeName: "മലയാളം", label: "Malayalam (മലയാളം)", region: "India (Regional)" },
    { code: "as", name: "Assamese", nativeName: "অসমীয়া", label: "Assamese (অসমীয়া)", region: "India (Regional)" },
    
    // Global Languages
    { code: "es", name: "Spanish", nativeName: "Español", label: "Spanish (Español)", region: "Global" },
    { code: "fr", name: "French", nativeName: "Français", label: "French (Français)", region: "Global" },
    { code: "sw", name: "Swahili", nativeName: "Kiswahili", label: "Swahili (Kiswahili)", region: "Global" },
    { code: "pt", name: "Portuguese", nativeName: "Português", label: "Portuguese (Português)", region: "Global" },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", label: "Indonesian (Bahasa Indonesia)", region: "Global" },
    { code: "ar", name: "Arabic", nativeName: "العربية", label: "Arabic (العربية)", region: "Global", direction: "rtl" },
    { code: "de", name: "German", nativeName: "Deutsch", label: "German (Deutsch)", region: "Global" },
];
