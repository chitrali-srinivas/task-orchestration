"use client";

import React, { useState } from "react";
import { ArrowLeft, MapPin, Calendar, DollarSign, Check, X, Star, Image as ImageIcon, Video, FileText, Download, Play, Phone, Mail, Copy, Ruler, Package, AlertCircle, Clock, Smile, ListOrdered, Mic, QrCode, Layers, Pause, Info, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { env } from "@/platform/env";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// --- Types ---
export type VariantType =
    | "text"
    | "badge"
    | "image"
    | "video"
    | "file"
    | "map"
    | "rating"
    | "currency"
    | "date"
    | "boolean"
    | "long-text"
    | "phone"
    | "email"
    | "area"
    | "quantity"
    | "time"
    | "emoji"
    | "rank"
    | "audio"
    | "qrcode"
    | "repeater"
    | "tree";

export interface TreeResponse {
    id: string;
    label: string;
    value?: any;
    type?: VariantType;
    meta?: string;
    children?: TreeResponse[];
}

export interface SurveyItem {
    id: string;
    question: string;
    type: VariantType;
    answer: 
        | string 
        | number 
        | boolean 
        | string[] 
        | { name: string; size: string } 
        | { label: string; rank: number }[] 
        | { id: string; fields: SurveyItem[] }[]
        | TreeResponse[];
    meta?: string;
    label: string;
    description?: string;
    required?: boolean;
}

// --- Dummy Data ---
export const translations: Record<string, Record<string, string>> = {
    hi: {
        "What is your primary feedback on the MRV system?": "MRV प्रणाली पर आपकी प्राथमिक प्रतिक्रिया क्या है?",
        "Describe any pest issues observed:": "देखे गए किसी भी कीट के मुद्दों का वर्णन करें:",
        "Select the crops currently being harvested:": "वर्तमान में काटी जा रही फसलों का चयन करें:",
        "Upload a photo of the soil sample:": "मिट्टी के नमूने की एक तस्वीर अपलोड करें:",
        "Record a video of the crop health:": "फसल स्वास्थ्य का एक वीडियो रिकॉर्ड करें:",
        "Attach the soil test report (PDF):": "मिट्टी परीक्षण रिपोर्ट (PDF) संलग्न करें:",
        "Confirm the location of the field:": "खेत के स्थान की पुष्टि करें:",
        "Measure the total cultivated area:": "कुल खेती वाले क्षेत्र को मापें:",
        "Measure the total cultivated area: (in Acres)": "कुल खेती वाले क्षेत्र को मापें: (एकड़ में)",
        "Enter the quantity of seeds used:": "उपयोग किए गए बीजों की मात्रा दर्ज करें:",
        "Enter the quantity of seeds used: (in Tons)": "उपयोग किए गए बीजों की मात्रा दर्ज करें: (टन में)",
        "How would you rate the new fertilizer efficiency?": "आप नई उर्वरक दक्षता को कैसे रेट करेंगे?",
        "Estimated cost of inputs per acre:": "प्रति एकड़ इनपुट की अनुमानित लागत:",
        "Estimated cost of inputs per acre: (in INR)": "प्रति एकड़ इनपुट की अनुमानित लागत: (INR में)",
        "Date of sowing:": "बुवाई की तारीख:",
        "Did you verify the soil pH level?": "क्या आपने मिट्टी के पीएच स्तर को सत्यापित किया?",
        "Provided Contact Number:": "प्रदान किया गया संपर्क नंबर:",
        "Provided Email Address:": "प्रदान किया गया ईमेल पता:",
        "Primary Contact Number:": "प्राथमिक संपर्क नंबर:",
        "Number of storage units available:": "उपलब्ध भंडारण इकाइयों की संख्या:",
        "Average soil moisture content:": "औसत मिट्टी की नमी की मात्रा:",
        "Total number of livestock:": "पशुधन की कुल संख्या:",
        "Preferred contact method:": "पसंद का संपर्क तरीका:",
        "Equipment available for rent:": "किराये के लिए उपलब्ध उपकरण:",
        "Current crop season:": "वर्तमान फसल का मौसम:",
        "Preferred time for field visit:": "खेत के दौरे के लिए पसंदीदा समय:",
        "Overall satisfaction with the process:": "प्रक्रिया के साथ कुल संतुष्टि:",
        "Rank the following priorities (1-3):": "निम्नलिखित प्राथमिकताओं को रैंक करें (1-3):",
        "Voice note from the surveyor:": "सर्वेक्षक से वॉयस नोट:",
        "Scan Farmer ID (QR Code):": "किसान आईडी (QR कोड) स्कैन करें:",
        "Hierarchical Survey Structure (4 Levels):": "पदानुक्रमित सर्वेक्षण संरचना (4 स्तर):",
        "Yes": "हाँ",
        "No": "नहीं",
        "Not available": "उपलब्ध नहीं",
        "Acres": "एकड़",
        "tons": "टन",
        "Units": "इकाइयाँ",
        "INR": "रुपये",
        "Rice (Basmati)": "चावल (बासमती)",
        "Wheat": "गेहूं",
        "Mustard": "सरसों",
        "WhatsApp": "व्हाट्सएप",
        "Tractor": "ट्रैक्टर",
        "Seeder": "सीडर",
        "Harvester": "हार्वेस्टर",
        "Kharif": "खरीफ",
        "Water Management": "जल प्रबंधन",
        "Soil Health": "मृदा स्वास्थ्य",
        "Pest Control": "कीट नियंत्रण",
        "Logged in successfully!": "सफलतापूर्वक लॉग इन किया गया!",
        "Continue": "जारी रखें",
        "Login to your account": "अपने खाते में लॉगिन करें",
        "Login with your registered email id.": "अपने पंजीकृत ईमेल आईडी के साथ लॉगिन करें।",
        "The real-time data accuracy is excellent for our needs.": "वास्तविक समय डेटा सटीकता हमारी आवश्यकताओं के लिए उत्कृष्ट है।",
        "During the initial inspection of the north-east quad, we observed significant yellowing of the lower leaves on approximately 15% of the crop. Further examination revealed small entrance holes near the base of the stalks, which strongly suggests an early-stage infestation of stem borers. Additionally, there are minor traces of aphid activity on the younger shoots. We recommend an immediate application of organic neem-based pesticides followed by a secondary review in 48 hours to prevent further spread to the adjacent healthy quadrants.": "उत्तर-पूर्वी क्वाड के प्रारंभिक निरीक्षण के दौरान, हमने लगभग 15% फसल के निचले पत्तों पर महत्वपूर्ण पीलापन देखा। आगे की जांच में डंठल के आधार के पास छोटे प्रवेश छिद्र मिले, जो दृढ़ता से तना छेदक के शुरुआती चरण के संक्रमण का सुझाव देते हैं। इसके अतिरिक्त, युवा टहनियों पर एफिड गतिविधि के मामूली निशान हैं। हम आस-पास के स्वस्थ चतुर्थांशों में आगे फैलने से रोकने के लिए 48 घंटों में माध्यमिक समीक्षा के बाद जैविक नीम-आधारित कीटनाशकों के तत्काल उपयोग की सलाह देते हैं।",
        "Add Comment": "टिप्पणी जोड़ें",
        "optional": "वैकल्पिक",
        "Share any additional observations or feedback regarding this survey.": "इस सर्वेक्षण के संबंध में कोई अतिरिक्त अवलोकन या प्रतिक्रिया साझा करें।",
        "Type your comment here . . .": "अपनी टिप्पणी यहाँ टाइप करें . . .",
        "Save": "सहेजें",
        "Cancel": "रद्द करें",
        "Report": "रिपोर्ट करें",
        "Approving...": "अनुमोदन हो रहा है...",
        "Approve": "अनुमोदन करें",
        "Report Selected": "चयनित रिपोर्ट करें",
        "Usage": "उपयोग",
        "Preview": "पूर्वावलोकन",
        "Entries Recorded": "प्रविष्टियाँ दर्ज की गईं",
        "Entry Details": "प्रविष्टि विवरण"
    }
};

export const surveyData: SurveyItem[] = [
    {
        id: "1",
        question: "What is your primary feedback on the MRV system?",
        type: "text",
        answer: "The real-time data accuracy is excellent for our needs.",
        label: "Text Input",
        description: "Best for displaying concise, single-line text data like names, titles, or short comments.",
        required: false,
    },
    {
        id: "2",
        question: "Describe any pest issues observed:",
        type: "long-text",
        answer: "During the initial inspection of the north-east quad, we observed significant yellowing of the lower leaves on approximately 15% of the crop. Further examination revealed small entrance holes near the base of the stalks, which strongly suggests an early-stage infestation of stem borers. Additionally, there are minor traces of aphid activity on the younger shoots. We recommend an immediate application of organic neem-based pesticides followed by a secondary review in 48 hours to prevent further spread to the adjacent healthy quadrants.",
        label: "Text Area",
        description: "Optimal for displaying long-form content, paragraphs, or detailed descriptions.",
    },
    {
        id: "3",
        question: "Select the crops currently being harvested:",
        type: "badge",
        answer: ["Rice (Basmati)", "Wheat", "Mustard"],
        label: "Multi-Select",
        description: "Ideal for rendering lists of tags, categories, or multiple selected attributes.",
    },
    {
        id: "4",
        question: "Upload a photo of the soil sample:",
        type: "image",
        answer: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop", // Placeholder
        label: "Image Upload",
        description: "Used to present visual assets, thumbnails, or document scans with a full-screen preview option.",
    },
    {
        id: "5",
        question: "Record a video of the crop health:",
        type: "video",
        answer: "https://www.w3schools.com/html/mov_bbb.mp4", // Test video for fallback
        label: "Video Upload",
        description: "Suitable for showcasing video content, replays, or dynamic visual reports.",
    },
    {
        id: "6",
        question: "Attach the soil test report (PDF):",
        type: "file",
        answer: { name: "Soil_Analysis_Report_2024.pdf", size: "2.4 MB" },
        label: "File Attachment",
        description: "Best for listing downloadable documents, reports, or external references.",
    },
    {
        id: "7",
        question: "Confirm the location of the field:",
        type: "map",
        answer: "Anekal, Karnataka",
        meta: "20.5025° N, 78.9035° E",
        label: "Geolocation",
        description: "Designed to display geospatial coordinates or location names with an interactive map preview.",
    },
    {
        id: "8",
        question: "Measure the total cultivated area:",
        type: "area",
        answer: 4.5,
        meta: "Acres",
        label: "Area Measurement",
        description: "Used for displaying surface area measurements in specific units (e.g., Acres, Hectares).",
    },
    {
        id: "9",
        question: "Enter the quantity of seeds used:",
        type: "quantity",
        answer: 50,
        meta: "tons",
        label: "Quantity Input",
        description: "Best for weight, volume, or unit counts of materials or produce.",
    },
    {
        id: "10",
        question: "How would you rate the new fertilizer efficiency?",
        type: "rating",
        answer: 4, // out of 5
        label: "Rating Scale",
        description: "Perfect for visualizing satisfaction scores, product ratings, or quality levels.",
        required: false,
    },
    {
        id: "11",
        question: "Estimated cost of inputs per acre:",
        type: "currency",
        answer: 12500,
        meta: "INR",
        label: "Currency Input",
        description: "Use this format to display monetary values, prices, or financial figures clearly.",
    },
    {
        id: "12",
        question: "Date of sowing:",
        type: "date",
        answer: "2023-06-15",
        label: "Date Picker",
        description: "Standard format for presenting calendar dates, deadlines, or timestamps.",
    },
    {
        id: "13",
        question: "Did you verify the soil pH level?",
        type: "boolean",
        answer: true,
        label: "Boolean Toggle",
        description: "Best for indicating binary states like Yes/No, On/Off, or Active/Inactive.",
    },
    {
        id: "14",
        question: "Provided Contact Number:",
        type: "phone",
        answer: "+91 98765 43210",
        label: "Phone Number",
        description: "Standard layout for displaying contact phone numbers.",
    },
    {
        id: "15",
        question: "Provided Email Address:",
        type: "email",
        answer: "agro.support@example.com",
        label: "Email Address",
        description: "Standard layout for displaying email addresses.",
    },
    {
        id: "16",
        question: "Primary Contact Number:",
        type: "phone",
        answer: "+91 98765 43210",
        label: "Mobile Number",
        description: "MobileNumMAX10: Standard layout for displaying contact phone numbers.",
    },
    {
        id: "17",
        question: "Number of storage units available:",
        type: "quantity",
        answer: 12,
        meta: "Units",
        label: "Whole Number",
        description: "WholeNum: Best for displaying non-negative integers.",
    },
    {
        id: "18",
        question: "Average soil moisture content:",
        type: "area",
        answer: 24.85,
        meta: "%",
        label: "Decimal",
        description: "Decimal: Used for displaying values with floating point precision.",
    },
    {
        id: "19",
        question: "Total number of livestock:",
        type: "quantity",
        answer: 8,
        label: "Natural Number",
        description: "NaturalNum: Used for simple counting of items.",
    },
    {
        id: "20",
        question: "Preferred contact method:",
        type: "badge",
        answer: ["WhatsApp"],
        label: "Radio Selection",
        description: "Radio: Displays the single selected choice as a badge.",
    },
    {
        id: "21",
        question: "Equipment available for rent:",
        type: "badge",
        answer: ["Tractor", "Seeder", "Harvester"],
        label: "Checkbox Selection",
        description: "Checkbox: Displays multiple selected options as badges.",
    },
    {
        id: "22",
        question: "Current crop season:",
        type: "badge",
        answer: ["Kharif"],
        label: "Dropdown Selection",
        description: "Selected Dropdown: Displays the option selected from a dropdown menu.",
    },
    {
        id: "23",
        question: "Preferred time for field visit:",
        type: "time",
        answer: "10:30 AM",
        label: "Time Selection",
        description: "Time: Selected time shown in AM/PM format.",
    },
    {
        id: "24",
        question: "Overall satisfaction with the process:",
        type: "emoji",
        answer: "😊",
        label: "Emoji Feedback",
        description: "Emoji: Selected emoji feedback.",
    },
    {
        id: "25",
        question: "Rank the following priorities (1-3):",
        type: "rank",
        answer: [
            { label: "Water Management", rank: 1 },
            { label: "Soil Health", rank: 2 },
            { label: "Pest Control", rank: 3 }
        ],
        label: "Ranking",
        description: "Rank: Surveyor ranks the options in order of priority.",
    },
    {
        id: "26",
        question: "Voice note from the surveyor:",
        type: "audio",
        answer: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
        label: "Audio Recording",
        description: "Audio: Custom player to listen to the recorded audio.",
    },
    {
        id: "27",
        question: "Scan Farmer ID (QR Code):",
        type: "qrcode",
        answer: "FYKDBC-2024",
        label: "QR Code Scan",
        description: "QRCode: Scanned ID from the farmer's documentation.",
    },
    {
        id: "28",
        question: "Hierarchical Survey Structure (4 Levels):",
        type: "tree",
        answer: [
            {
                id: "root-1",
                label: "Identifier: Record Group A",
                children: [
                    { id: "q1-l1", label: "Question Label (Text)", value: "Response Content", type: "text" },
                    { id: "q2-l1", label: "Question Label (Date)", value: "2024-03-25", type: "date" },
                    {
                        id: "q3-l1",
                        label: "Expandable Question (Level 2)",
                        value: "Initial Response Content",
                        type: "text",
                        children: [
                            { id: "q1-l2", label: "Question Label (Quantity)", value: 150, type: "quantity" },
                            { id: "q2-l2", label: "Question Label (Image)", value: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=300&auto=format&fit=crop", type: "image" },
                            {
                                id: "q3-l2",
                                label: "Expandable Question (Level 3)",
                                value: "2024-03-26",
                                type: "date",
                                children: [
                                    { id: "q1-l3", label: "Question Label (Boolean)", value: true, type: "boolean" },
                                    { id: "q2-l3", label: "Question Label (Rating)", value: 5, type: "rating" },
                                    {
                                        id: "q3-l3",
                                        label: "Expandable Question (Level 4)",
                                        value: 75,
                                        type: "quantity",
                                        children: [
                                            { id: "q1-l4", label: "Question Label (Currency)", value: 5000, type: "currency" },
                                            { id: "q2-l4", label: "Question Label (Video)", value: "https://www.w3schools.com/html/mov_bbb.mp4", type: "video" },
                                            { id: "q3-l4", label: "Question Label (Badge)", value: ["Option A", "Option B"], type: "badge" }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        label: "Tree Structure",
        description: "Tree: 4-level hierarchical response structure following a generic formula for identifiers, questions, and multi-type responses.",
    }
];

// --- Copy Button Helper ---
const CopyableText = ({ text, children, icon }: { text: string; children: React.ReactNode; icon?: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="group flex items-center gap-2 relative w-full min-w-0">
            {icon && <div className="flex-shrink-0 text-zinc-500">{icon}</div>}
            <div className="flex-1 min-w-0 pr-10">
                {children}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    onClick={handleCopy}
                >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                </Button>
            </div>
        </div>
    );
};


// --- Expandable Text for Long Responses ---
const ExpandableText = ({ text, style }: { text: string; style: string }) => {
    return (
        <div className="w-full">
            <p className={cn(
                "text-zinc-500 dark:text-zinc-400 leading-relaxed",
                (style === "style-5" || style === "style-5-feedback") ? "text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug" : "text-sm"
            )}>
                {text}
            </p>
        </div>
    );
};

// --- Value Only Renderer for Tree/Repeater ---
const renderValueOnly = (item: SurveyItem, style: string) => {
    const isStyle5 = style === "style-5" || style === "style-5-feedback";
    const isEmpty = !item.answer || 
        (Array.isArray(item.answer) && item.answer.length === 0) ||
        (typeof item.answer === 'object' && Object.keys(item.answer).length === 0);

    if (isEmpty) {
        return (
            <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 transition-all duration-300",
                isStyle5 ? "mt-0.5" : "mt-1"
            )}>
                <AlertCircle className="w-3 h-3 text-zinc-300 dark:text-zinc-600" />
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Not available
                </span>
            </div>
        );
    }

    switch (item.type) {
        case "text":
            return (
                <CopyableText text={item.answer as string}>
                    <p className={cn(
                        "text-zinc-500 dark:text-zinc-400 leading-relaxed",
                        style === "style-5" ? "text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug" : "text-sm",
                        style === "style-5-feedback" && "text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug"
                    )}>{item.answer as string}</p>
                </CopyableText>
            );
        case "date":
            return (
                <div className={cn(
                    "flex items-center gap-2 text-zinc-700 dark:text-zinc-300",
                    isStyle5 && "text-zinc-900 dark:text-zinc-100 font-semibold text-base"
                )}>
                    {isStyle5
                        ? new Date(item.answer as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : new Date(item.answer as string).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    }
                </div>
            );
        case "quantity":
        case "area":
        case "currency":
            return (
                <div className={cn(
                    "flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                    isStyle5 && "text-base"
                )}>
                    {item.answer as number} {item.meta && <span className="text-xs font-normal text-zinc-500 uppercase">{item.meta}</span>}
                </div>
            );
        case "boolean":
            return (
                <div className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
                    item.answer
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                    {item.answer ? "Yes" : "No"}
                </div>
            );
        case "rating":
            return (
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                            key={star}
                            className={cn(
                                "w-4 h-4",
                                star <= (item.answer as number) ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700"
                            )}
                        />
                    ))}
                </div>
            );
        case "badge":
            return (
                <div className="flex flex-wrap gap-1.5">
                    {(item.answer as string[]).map((badge, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                            {badge}
                        </Badge>
                    ))}
                </div>
            );
        case "image":
            const imgFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "image.jpg";
            return (
                <div className="mt-1 w-full max-w-md">
                    <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10 attachment-preview-trigger">
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-200 mr-3">
                            <img src={item.answer as string} alt="Thumbnail" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{imgFileName}</p>
                            <p className="text-xs text-zinc-500">2.4 MB</p>
                        </div>
                    </div>
                </div>
            );
        case "video":
            const vidFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "video.mp4";
            return (
                <div className="mt-1 w-full max-w-md">
                    <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10 attachment-preview-trigger">
                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-200 mr-3">
                            <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{vidFileName}</p>
                            <p className="text-xs text-zinc-500">12.8 MB</p>
                        </div>
                    </div>
                </div>
            );
        case "phone":
            return (
                <CopyableText text={item.answer as string}>
                    <span className={cn(
                        "font-medium text-zinc-900 dark:text-zinc-100",
                        isStyle5 && "font-semibold text-base"
                    )}>{item.answer as string}</span>
                </CopyableText>
            );
        case "email":
            return (
                <CopyableText text={item.answer as string}>
                    <span className={cn(
                        "font-medium text-zinc-900 dark:text-zinc-100",
                        isStyle5 && "font-semibold text-base"
                    )}>{item.answer as string}</span>
                </CopyableText>
            );
        case "time":
            return (
                <div className={cn(
                    "flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-base",
                    !isStyle5 && "text-lg"
                )}>
                    {item.answer as string}
                </div>
            );
        case "emoji":
            return (
                <div className="flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-2xl">
                    {item.answer as string}
                </div>
            );
        default:
            return <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug">{item.answer?.toString()}</p>;
    }
};


// --- Video Highlights Preview on Hover ---
const VideoHighlightsPreview = ({ src }: { src: string }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    // Auto-play whenever this component is mounted (which happens when HoverCard opens)

    React.useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 2.0; // Play at 2x speed
            videoRef.current.play().catch(() => { });
        }

        return () => {
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        };
    }, []); // Run once on mount

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium backdrop-blur-sm">
                Previewing
            </div>
        </div>
    );
};



// --- Audio Player Component ---
const AudioPlayer = ({ src, style, isReporting, isSelected, onToggleSelect, id }: { src: string, style: string, isReporting?: boolean, isSelected?: boolean, onToggleSelect?: (id: string) => void, id: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (audioRef.current && duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            audioRef.current.currentTime = percentage * duration;
            setCurrentTime(percentage * duration);
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const fileName = src.split('/').pop()?.split('?')[0] || "audio_note.mp3";

    return (
        <div className="group relative w-full">
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)} 
                preload="auto"
            />
            
            <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors pr-10">
                {/* Play/Pause Button */}
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-lg flex-shrink-0 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center mr-3 transition-all active:scale-95 shadow-md group/btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                    }}
                >
                    {isPlaying ? (
                        <Pause className="h-4 w-4 text-white fill-white dark:text-zinc-900 dark:fill-zinc-900" />
                    ) : (
                        <div className="relative h-4 w-4 flex items-center justify-center">
                            <Mic className="h-4 w-4 absolute transition-all duration-300 group-hover/btn:opacity-0 group-hover/btn:scale-50" />
                            <Play className="h-4 w-4 absolute opacity-0 scale-50 transition-all duration-300 group-hover/btn:opacity-100 group-hover/btn:scale-100 fill-current ml-0.5" />
                        </div>
                    )}
                </Button>

                {/* Info & Progress */}
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fileName}</p>
                        <span className="text-[10px] font-bold text-zinc-400 tabular-nums uppercase whitespace-nowrap">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div 
                        className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer group/progress relative overflow-hidden"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleProgressClick(e);
                        }}
                    >
                        <div 
                            className="h-full bg-zinc-900 dark:bg-zinc-100 transition-none" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                </div>
            </div>

            {/* Download Button - Matches Image/Video/File style */}
            <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700" onClick={(e) => e.stopPropagation()}>
                    <a href={src} download title="Download Audio">
                        <Download className="h-4 w-4 text-zinc-500" />
                    </a>
                </Button>
            </div>
        </div>
    );
};

// --- Survey Card Component ---
export const SurveyCard = ({
    item,
    style,
    showDetails,
    isReporting = false,
    isSelected = false,
    onToggleSelect,
    disableDialog = false,
    isInvalid = false,
    onMapClick,
    language = "en"
}: {
    item: SurveyItem;
    style: string;
    showDetails: boolean;
    isReporting?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    disableDialog?: boolean;
    isInvalid?: boolean;
    onMapClick?: (item: SurveyItem) => void;
    language?: "en" | "hi";
}) => {
    // Helper function to translate text
    const t = (text: string) => {
        if (language === "en") return text;
        return translations[language]?.[text] || text;
    };

    // Dynamic Styles based on selection
    const cardStyles = cn(
        "relative overflow-hidden transition-all duration-300",
        style === "current" && "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-xl flex",
        style === "style-1" && "bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border-transparent shadow-lg hover:scale-[1.02] rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 p-5",
        style === "style-2" && "bg-transparent border border-zinc-200 dark:border-zinc-800 shadow-none rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 p-5",
        style === "style-3" && "bg-transparent border-0 border-b border-zinc-200 dark:border-zinc-800 shadow-none rounded-none p-4 px-0",
        style === "style-5" && "bg-transparent border-0 border-b border-zinc-100 dark:border-zinc-800 shadow-none rounded-none py-2 px-0",
        style === "style-5-feedback" && cn(
            "bg-transparent border-0 border-b border-zinc-100 dark:border-zinc-800 shadow-none rounded-none py-2 px-0 transition-all duration-200",
            !isSelected && "hover:bg-white dark:hover:bg-zinc-900/50"
        )
    );

    const questionStyles = cn(
        "font-bold leading-snug",
        (style !== "style-5" && style !== "style-5-feedback") && "mb-2",
        style === "current" && "text-base text-zinc-900 dark:text-zinc-50",
        style === "style-1" && "text-lg text-zinc-800 dark:text-zinc-100",
        style === "style-2" && "text-sm text-zinc-900 dark:text-zinc-50 font-semibold mb-3",
        style === "style-3" && "text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1",
        style === "style-5" && "text-[14px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight",
        style === "style-5-feedback" && "text-[14px] font-normal text-zinc-500 dark:text-zinc-400 leading-tight"
    );

    const renderContent = () => {
        const isStyle5 = style === "style-5" || style === "style-5-feedback";

        // Handle empty states for all types
        const isEmpty = !item.answer || 
            (Array.isArray(item.answer) && item.answer.length === 0) ||
            (typeof item.answer === 'object' && Object.keys(item.answer).length === 0);

        if (isEmpty) {
            return (
                <div className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 transition-all duration-300",
                    isStyle5 ? "mt-0.5" : "mt-1"
                )}>
                    <AlertCircle className="w-3 h-3 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                        {t("Not available")}
                    </span>
                </div>
            );
        }

        switch (item.type) {
            case "text":
                return (
                    <CopyableText text={item.answer as string}>
                        <p className={cn(
                            "text-zinc-500 dark:text-zinc-400 leading-relaxed",
                            style === "style-5" ? "text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug" : "text-sm",
                            style === "style-5-feedback" && "text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug"
                        )}>{t(item.answer as string)}</p>
                    </CopyableText>
                );

            case "long-text":
                return (
                    <CopyableText text={item.answer as string}>
                        <ExpandableText text={t(item.answer as string)} style={style} />
                    </CopyableText>
                );

            case "badge":
                return (
                    <div className="flex flex-wrap gap-1.5">
                        {(item.answer as string[]).map((badge, idx) => (
                            <Badge key={idx} variant="outline" className={cn(
                                "text-xs border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300",
                                !isStyle5 && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            )}>
                                {t(badge)}
                            </Badge>
                        ))}
                    </div>
                );

            case "image":
                if (style === "style-5" || style === "style-5-feedback") {
                    const decodedUrl = decodeURIComponent(item.answer as string);
                    const fileName = decodedUrl.split('/').pop()?.split('?')[0] || "image.jpg";
                                    const imageContent = (
                        <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                                <div className="group relative w-full max-w-full overflow-hidden">
                                    <div 
                                        className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10 attachment-preview-trigger w-full max-w-full overflow-hidden"
                                    >
                                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-200 mr-3">
                                            <img src={item.answer as string} alt="Thumbnail" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fileName}</p>
                                            <p className="text-xs text-zinc-500">2.4 MB</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            <Download className="h-4 w-4 text-zinc-500" />
                                        </Button>
                                    </div>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-0 overflow-hidden border-none shadow-xl z-[300]" side="left" align="start" sideOffset={10}>
                                <img src={item.answer as string} alt="Preview" className="w-full h-auto" />
                            </HoverCardContent>
                        </HoverCard>
                    );

                    if (disableDialog) return imageContent;

                    return (
                        <Dialog>
                            <DialogTrigger asChild>
                                {imageContent}
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                                <DialogTitle className="sr-only">Full Image View</DialogTitle>
                                <DialogDescription className="sr-only">Detailed view of the uploaded survey image</DialogDescription>
                                <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50">
                                    <img src={item.answer as string} alt="Full" className="max-w-full max-h-full object-contain shadow-2xl" />
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                }
                return (
                    <Dialog>
                        <div className="space-y-2 group relative">
                            <DialogTrigger asChild>
                                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800 cursor-zoom-in">
                                    <img src={item.answer as string} alt="Survey upload" className="object-cover w-full h-full" />
                                </div>
                            </DialogTrigger>

                            {/* Download Button - Top Right */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <Button variant="secondary" size="icon" className="h-8 w-8 shadow-sm bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-700">
                                    <Download className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
                                </Button>
                            </div>
                        </div>
                        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                            <DialogTitle className="sr-only">Survey Image Zoom</DialogTitle>
                            <DialogDescription className="sr-only">Zoomed in view of the submission image</DialogDescription>
                            <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50">
                                <img src={item.answer as string} alt="Survey upload full" className="max-w-full max-h-full object-contain shadow-2xl" />
                            </div>
                        </DialogContent>
                    </Dialog>
                );

            case "video":
                if (style === "style-5-feedback") {
                    const decodedUrl = decodeURIComponent(item.answer as string);
                    const fileName = decodedUrl.split('/').pop()?.split('?')[0] || "video.mp4";
                    const videoContent = (
                        <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                                <div className="group relative w-full max-w-full overflow-hidden">
                                    <div 
                                        className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10 attachment-preview-trigger w-full max-w-full overflow-hidden"
                                    >
                                        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-900 flex items-center justify-center mr-3">
                                            <Play className="w-4 h-4 text-white fill-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fileName}</p>
                                            <p className="text-xs text-zinc-500">12.8 MB</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            <Download className="h-4 w-4 text-zinc-500" />
                                        </Button>
                                    </div>
                                </div>
                            </HoverCardTrigger>
                                <HoverCardContent className="w-80 p-0 overflow-hidden border-none shadow-xl z-[300]" side="left" align="start" sideOffset={10}>
                                    <VideoHighlightsPreview src={item.answer as string} />
                                </HoverCardContent>
                        </HoverCard>
                    );

                    if (disableDialog) return videoContent;

                    return (
                        <Dialog>
                            <DialogTrigger asChild>
                                {videoContent}
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                                <DialogTitle className="sr-only">Video Player</DialogTitle>
                                <DialogDescription className="sr-only">Full screen survey video player</DialogDescription>
                                <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black">
                                    <video
                                        key={item.answer as string}
                                        src={item.answer as string}
                                        controls
                                        autoPlay
                                        playsInline
                                        preload="auto"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                }

                if (style === "style-5") {
                    const fileName = (item.answer as string).split('/').pop()?.split('?')[0] || "video.mp4";
                    return (
                        <Dialog>
                            <HoverCard openDelay={200}>
                                <HoverCardTrigger asChild>
                                    <div className="group relative w-full">
                                        <DialogTrigger asChild>
                                            <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10">
                                                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-900 flex items-center justify-center mr-3">
                                                    <Play className="w-4 h-4 text-white fill-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fileName}</p>
                                                    <p className="text-xs text-zinc-500">12.8 MB</p>
                                                </div>
                                            </div>
                                        </DialogTrigger>
                                        <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                                <Download className="h-4 w-4 text-zinc-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80 p-0 overflow-hidden border-none shadow-xl z-[300]" side="left" align="start" sideOffset={10}>
                            <div className="relative w-full aspect-video bg-black">
                                <video
                                    key={item.answer as string}
                                    src={item.answer as string}
                                    className="w-full h-full object-cover"
                                    playsInline
                                    muted
                                    loop
                                    preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white/50" />
                                </div>
                            </div>
                        </HoverCardContent>
                            </HoverCard>
                            <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                                <DialogTitle className="sr-only">Video Preview</DialogTitle>
                                <DialogDescription className="sr-only">Watching the uploaded survey video in full size</DialogDescription>
                                <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black">
                                    <video
                                        key={item.answer as string}
                                        src={item.answer as string}
                                        controls
                                        autoPlay
                                        playsInline
                                        preload="auto"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    );
                }
                return (
                    <Dialog>
                        <div className="space-y-2 group relative">
                            <DialogTrigger asChild>
                                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-zinc-900 flex items-center justify-center cursor-pointer">
                                    <video
                                        key={item.answer as string}
                                        src={item.answer as string}
                                        className="w-full h-full object-cover opacity-80"
                                        playsInline
                                        muted
                                        preload="metadata"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full group-hover:scale-110 transition-transform">
                                            <Play className="h-6 w-6 text-white fill-white" />
                                        </div>
                                    </div>
                                </div>
                            </DialogTrigger>

                            {/* Download Button - Top Right */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <Button variant="secondary" size="icon" className="h-8 w-8 shadow-sm bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-700">
                                    <Download className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
                                </Button>
                            </div>
                        </div>
                        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                            <DialogTitle className="sr-only">Video Player</DialogTitle>
                            <DialogDescription className="sr-only">Full screen survey video player</DialogDescription>
                            <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black">
                                <video
                                    key={item.answer as string}
                                    src={item.answer as string}
                                    controls
                                    autoPlay
                                    playsInline
                                    preload="auto"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                );

            case "file":
                return (
                    <div className="group relative">
                        <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10 attachment-preview-trigger">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md mr-3">
                                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{(item.answer as { name: string }).name}</p>
                                <p className="text-xs text-zinc-500">{(item.answer as { size: string }).size}</p>
                            </div>
                        </div>
                        {/* Download Button - Top Right (inside the card technically, but absolutely positioned relative to container) */}
                        <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                <Download className="h-4 w-4 text-zinc-500" />
                            </Button>
                        </div>
                    </div>
                );

            case "map":
                return (
                    <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                            <div className="flex items-start gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-md text-blue-600 dark:text-blue-400">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t(item.answer as string)}</p>
                                    {item.meta && <p className="text-xs text-zinc-500">{t(item.meta)}</p>}
                                </div>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent 
                            className="w-80 p-0 overflow-hidden border-none shadow-2xl z-[300] cursor-pointer" 
                            side="left" 
                            align="start" 
                            sideOffset={10}
                            onClick={() => onMapClick?.(item)}
                        >
                            <div className="relative h-48 bg-zinc-100 dark:bg-zinc-900">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    src={`https://www.google.com/maps/embed/v1/view?key=${env.googleMapsApiKey}&center=${item.meta?.replace(/[^\d.,-]/g, '') || '20.5025,78.9035'}&zoom=18&maptype=satellite`}
                                    allowFullScreen
                                />
                                <div className="absolute inset-0 bg-transparent" />
                                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-white font-bold uppercase tracking-widest pointer-events-none">
                                    {t("Preview")}
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800">
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t(item.answer as string)}</p>
                                <p className="text-[10px] text-zinc-500 font-medium mt-1 uppercase tracking-tight">{t(item.meta || "GEO COORD")}</p>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );

            case "rating":
                return (
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={cn(
                                    "w-5 h-5",
                                    star <= (item.answer as number) ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-700"
                                )}
                            />
                        ))}
                    </div>
                );

            case "currency":
                return (
                    <div className={cn(
                        "flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                        isStyle5 && "text-base"
                    )}>
                        {!isStyle5 && <DollarSign className={cn("w-5 h-5 text-zinc-500", isStyle5 && "w-4 h-4")} />}
                        {(item.answer as number).toLocaleString('en-US')} {!isStyle5 && <span className="text-xs font-normal text-zinc-500 uppercase">{t(item.meta || "INR")}</span>}
                    </div>
                );

            case "date":
                return (
                    <div className={cn(
                        "flex items-center gap-2 text-zinc-700 dark:text-zinc-300",
                        isStyle5 && "text-zinc-900 dark:text-zinc-100 font-semibold text-base"
                    )}>
                        {!isStyle5 && <Calendar className="w-4 h-4 text-zinc-500" />}
                        {isStyle5
                            ? new Date(item.answer as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            : new Date(item.answer as string).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        }
                    </div>
                );

            case "boolean":
                return (
                    <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
                        item.answer
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        !isStyle5 && "px-3 py-1.5 rounded-full text-sm font-medium"
                    )}>
                        {!isStyle5 && (item.answer ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />)}
                        {item.answer ? t("Yes") : t("No")}
                    </div>
                );

            case "phone":
                return (
                    <CopyableText text={item.answer as string} icon={!isStyle5 && <Phone className="w-4 h-4" />}>
                        <span className={cn(
                            "font-medium text-zinc-900 dark:text-zinc-100",
                            isStyle5 && "font-semibold text-base"
                        )}>{item.answer as string}</span>
                    </CopyableText>
                );

            case "email":
                return (
                    <CopyableText text={item.answer as string} icon={!isStyle5 && <Mail className="w-4 h-4" />}>
                        <span className={cn(
                            "font-medium text-zinc-900 dark:text-zinc-100",
                            isStyle5 && "font-semibold text-base"
                        )}>{item.answer as string}</span>
                    </CopyableText>
                );

            case "area":
                return (
                    <div className={cn(
                        "flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                        isStyle5 && "text-base"
                    )}>
                        {!isStyle5 && <Ruler className={cn("w-5 h-5 text-zinc-500", isStyle5 && "w-4 h-4")} />}
                        {item.answer as number} {!isStyle5 && <span className="text-xs font-normal text-zinc-500 uppercase">{t(item.meta || "Acres")}</span>}
                    </div>
                );

            case "quantity":
                return (
                    <div className={cn(
                        "flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                        isStyle5 && "text-base"
                    )}>
                        {!isStyle5 && <Package className={cn("w-5 h-5 text-zinc-500", isStyle5 && "w-4 h-4")} />}
                        {item.answer as number} {!isStyle5 && <span className="text-xs font-normal text-zinc-500 uppercase">{t(item.meta || "Units")}</span>}
                    </div>
                );

            case "time":
                return (
                    <div className={cn(
                        "flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-base",
                        !isStyle5 && "text-lg"
                    )}>
                        {!isStyle5 && <Clock className="w-4 h-4 text-zinc-500" />}
                        {item.answer as string}
                    </div>
                );

            case "emoji":
                return (
                    <div className="flex items-center justify-center w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-2xl">
                        {item.answer as string}
                    </div>
                );

            case "rank":
                return (
                    <div className="space-y-2 w-full">
                        {(item.answer as { label: string; rank: number }[]).sort((a, b) => a.rank - b.rank).map((rankItem, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-lg">
                                <div className="w-6 h-6 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold rounded-md">
                                    {rankItem.rank}
                                </div>
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t(rankItem.label)}</span>
                            </div>
                        ))}
                    </div>
                );

            case "audio":
                return <AudioPlayer 
                    src={item.answer as string} 
                    style={style} 
                    isReporting={isReporting} 
                    isSelected={isSelected} 
                    onToggleSelect={onToggleSelect} 
                    id={item.id} 
                />;

            case "qrcode":
                return (
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-lg w-fit">
                        <QrCode className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-100">{item.answer as string}</span>
                    </div>
                );

            case "repeater":
                const entries = item.answer as { id: string; fields: SurveyItem[] }[];
                return (
                    <div className="space-y-6 w-full">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-md">
                                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{entries.length} {t("Entries Recorded")}</span>
                        </div>
                        <div className="space-y-4">
                            {entries.map((entry, idx) => (
                                <div key={entry.id} className="relative pl-4 border-l-2 border-zinc-100 dark:border-zinc-800 py-1">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold">
                                                {idx + 1}
                                            </span>
                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{t("Entry Details")}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] font-bold bg-white dark:bg-zinc-950 px-1.5 h-5">ID: {entry.id}</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {entry.fields.map((field) => (
                                            <div key={field.id} className="group/repeater-field">
                                                <SurveyCard 
                                                    item={field}
                                                    style="style-5"
                                                    showDetails={false}
                                                    disableDialog={false}
                                                    language={language}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case "tree":
                const treeData = item.answer as TreeResponse[];
                const TreeNode = ({ node, level = 0 }: { node: TreeResponse, level?: number }) => {
                    const [isExpanded, setIsExpanded] = React.useState(level < 1);
                    const hasChildren = node.children && node.children.length > 0;
                    const hasValue = node.value !== undefined;
                    
                    return (
                        <div key={node.id} className={cn(
                            "relative",
                            level > 0 && "ml-2.5 pl-4 border-l border-zinc-100 dark:border-zinc-800"
                        )}>
                            <div 
                                className={cn(
                                    "flex flex-col py-2 group select-none transition-all duration-200",
                                    hasChildren && "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -ml-2 pl-2 rounded-lg"
                                )}
                                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-5 flex-shrink-0 flex items-center justify-center">
                                        {hasChildren ? (
                                            <div className={cn(
                                                "w-5 h-5 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 transition-transform duration-200",
                                                isExpanded ? "rotate-0" : "-rotate-90"
                                            )}>
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                                                level === 0 && "bg-zinc-900 dark:bg-zinc-100 w-2 h-2",
                                                level > 0 && "bg-zinc-300 dark:bg-zinc-700"
                                            )} />
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[14px] tracking-tight leading-tight",
                                        level === 0 ? "font-bold text-zinc-900 dark:text-zinc-50" : "font-normal text-zinc-500 dark:text-zinc-400"
                                    )}>
                                        {t(node.label)}
                                    </span>
                                </div>

                                {hasValue && (
                                    <div className="mt-1 pl-[28px]">
                                        {renderValueOnly({
                                            id: node.id,
                                            question: "",
                                            type: node.type || "text",
                                            answer: node.value,
                                            meta: node.meta,
                                            label: "",
                                            description: ""
                                        }, "style-5")}
                                    </div>
                                )}
                            </div>
                            {hasChildren && isExpanded && (
                                <div className="mt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {node.children!.map(child => <TreeNode key={child.id} node={child} level={level + 1} />)}
                                </div>
                            )}
                        </div>
                    );
                };

                return (
                    <div className="w-full mt-2">
                        <div className="space-y-0 bg-transparent py-0 px-0">
                            {treeData.map(rootNode => <TreeNode key={rootNode.id} node={rootNode} />)}
                        </div>
                    </div>
                );

            default:
                // Text, long-text, phone, email, etc.
                return <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug">{t(item.answer as string)}</p>;
        }
    };


    // Unified render structure for all styles

    const renderCardContent = () => {
        if (style === "current") {
            return (
                <>
                    <div className="w-14 flex-shrink-0 flex items-center justify-center border-r border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{item.id}</span>
                    </div>
                    <div className="flex-1 p-4 min-w-0">
                        <h3 className={questionStyles}>
                            {t(item.question)}
                        </h3>
                        <div>
                            {renderContent()}
                        </div>
                    </div>
                </>
            );
        }

        // Standard layout for Modern/Minimal
        return (
            <div className="w-full">
                <div className={cn(
                    "flex items-center gap-2",
                    (style === "style-5" || style === "style-5-feedback") ? "mb-1" : "mb-3"
                )}>
                    {/* Only show ID if NOT Style 3 or Style 5. For Style 5 Feedback, hide it when reporting to match Style 5 alignment */}
                    {(style !== "style-3" && style !== "style-5" && style !== "style-5-feedback" && !(style === "style-5-feedback" && isReporting)) && (
                        <span className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                            style === "style-1" && "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
                            style === "style-2" && "text-zinc-400 border border-zinc-200 dark:border-zinc-800",
                            style === "style-5-feedback" && "text-zinc-400 dark:text-zinc-500 text-[13px] font-normal w-auto h-auto rounded-none justify-start mr-0"
                        )}>
                            {style === "style-5-feedback" ? `${item.id}.` : item.id}
                        </span>
                    )}
                    <h3 className={cn(questionStyles, style === "style-5-feedback" && "relative z-10")}>
                        {t(item.question)}
                    </h3>
                </div>
                <div className={cn((style !== "style-3" && style !== "style-5" && style !== "style-5-feedback") && "pl-8")}>
                    {renderContent()}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("w-full transition-all", (style === "style-5" || style === "style-5-feedback") ? "mb-0" : "mb-2")}>
            {(showDetails && style !== "style-5" && style !== "style-5-feedback") && (
                <div className="mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pl-1">{t(item.label)}</span>
                </div>
            )}

            <Card className={cn(
                cardStyles,
                (style !== "current" && style !== "style-3" && style !== "style-5" && style !== "style-5-feedback") && "p-4",
                isReporting && isSelected && (
                    (style === "style-5" || style === "style-5-feedback")
                        ? "bg-red-50/50 dark:bg-red-900/10 border-l-2 border-l-red-500 pl-3 -ml-1 transition-all"
                        : "ring-1 ring-red-500 bg-red-50/30 dark:bg-red-900/10"
                )
            )}>
                {isReporting ? (
                    <div className={cn("flex items-start", (style === "style-5" || style === "style-5-feedback") ? "gap-3" : "gap-4")}>
                        <div className="pt-1 flex-shrink-0 checkbox-container">
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggleSelect?.(item.id)}
                                className="w-4 h-4 border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            {renderCardContent()}
                        </div>
                    </div>
                ) : renderCardContent()}
            </Card>

            {(showDetails && style !== "style-5") && (
                <div className="mt-2">
                    <p className="text-xs text-zinc-400 italic pl-1">
                        <span className="font-semibold not-italic">{t("Usage")}:</span> {t(item.description || "")}
                    </p>
                </div>
            )}
        </div>
    );
};

// --- Style 4: Bulk Selection Card ---
export const BulkSubmissionCard = ({
    submissionId,
    data,
    showHeader = true,
    compact = false,
    isReporting = false,
    selectedIds = [],
    onToggleId
}: {
    submissionId: number;
    data: SurveyItem[];
    showHeader?: boolean;
    compact?: boolean;
    isReporting?: boolean;
    selectedIds?: string[];
    onToggleId?: (id: string) => void;
}) => {

    const renderCompactValue = (item: SurveyItem) => {
        switch (item.type) {
            case "image":
                const imgFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "image.jpg";
                return (
                    <Dialog>
                        <HoverCard openDelay={200} closeDelay={0}>
                            <HoverCardTrigger asChild>
                                <div className="group relative w-full">
                                    <DialogTrigger asChild>
                                        <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10">
                                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-200 mr-3">
                                                <img src={item.answer as string} alt="Thumbnail" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{imgFileName}</p>
                                                <p className="text-xs text-zinc-500 uppercase">2.4 MB</p>
                                            </div>
                                        </div>
                                    </DialogTrigger>
                                    <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            <Download className="h-4 w-4 text-zinc-500" />
                                        </Button>
                                    </div>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-0 overflow-hidden border-none shadow-xl z-[300]" side="left" align="start" sideOffset={10}>
                                <img src={item.answer as string} alt="Preview" className="w-full h-auto" />
                            </HoverCardContent>
                        </HoverCard>
                        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                            <DialogTitle className="sr-only">Bulk Image View</DialogTitle>
                            <DialogDescription className="sr-only">Enlarged view of the bulk submitted image</DialogDescription>
                            <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900/50">
                                <img src={item.answer as string} alt="Full" className="max-w-full max-h-full object-contain shadow-2xl" />
                            </div>
                        </DialogContent>
                    </Dialog>
                );
            case "video":
                const vidFileName = (item.answer as string).split('/').pop()?.split('?')[0] || "video.mp4";
                return (
                    <Dialog>
                        <HoverCard openDelay={200} closeDelay={0}>
                            <HoverCardTrigger asChild>
                                <div className="group relative w-full">
                                    <DialogTrigger asChild>
                                        <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10">
                                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 bg-zinc-900 flex items-center justify-center mr-3">
                                                <Play className="w-4 h-4 text-white fill-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{vidFileName}</p>
                                                <p className="text-xs text-zinc-500 uppercase">12.8 MB</p>
                                            </div>
                                        </div>
                                    </DialogTrigger>
                                    <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            <Download className="h-4 w-4 text-zinc-500" />
                                        </Button>
                                    </div>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-0 overflow-hidden border-none shadow-xl" side="left" align="start" sideOffset={10}>
                                <div className="relative w-full aspect-video bg-black">
                                    <video
                                        key={item.answer as string}
                                        src={item.answer as string}
                                        className="w-full h-full object-cover"
                                        playsInline
                                        muted
                                        loop
                                        preload="metadata"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Play className="w-8 h-8 text-white/50" />
                                    </div>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-[500] sm:rounded-xl flex flex-col">
                            <DialogTitle className="sr-only">Bulk Video View</DialogTitle>
                            <DialogDescription className="sr-only">Full screen playback of the bulk submitted video</DialogDescription>
                            <div className="flex-1 overflow-hidden p-0 flex items-center justify-center bg-black">
                                <video
                                    key={item.answer as string}
                                    src={item.answer as string}
                                    controls
                                    autoPlay
                                    loop
                                    playsInline
                                    preload="auto"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                );
            case "file":
                return (
                    <div className="group relative w-full">
                        <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer pr-10">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded flex-shrink-0 text-blue-600 dark:text-blue-400 mr-3">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{(item.answer as { name: string }).name}</p>
                                <p className="text-xs text-zinc-500 uppercase">{(item.answer as { size: string }).size}</p>
                            </div>
                        </div>
                        <div className="absolute top-[50%] -translate-y-[50%] right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                <Download className="h-4 w-4 text-zinc-500" />
                            </Button>
                        </div>
                    </div>
                );
            case "map":
                return (
                    <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                            <div className="flex items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-full cursor-help group">
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded flex-shrink-0 text-green-600 dark:text-green-400 mr-3">
                                    <MapPin className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{item.answer as string}</p>
                                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight truncate">{item.meta || "GEO COORD"}</p>
                                </div>
                            </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-0 overflow-hidden border-none shadow-2xl" side="left" align="start" sideOffset={10}>
                            <div className="relative h-40 bg-zinc-100">
                                <img
                                    src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1000&auto=format&fit=crop"
                                    alt="Map Preview"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="bg-black/50 text-white px-2 py-1 rounded text-xs">Map View</span>
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-zinc-950">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.answer as string}</p>
                                <p className="text-xs text-zinc-500 mt-1">{item.meta || "GEO COORD"}</p>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            case "badge":
                return (
                    <div className="flex flex-wrap gap-1.5">
                        {(item.answer as string[]).map((badge, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 font-semibold px-2">
                                {badge}
                            </Badge>
                        ))}
                    </div>
                );
            case "rating":
                return (
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={cn(
                                    "w-4 h-4",
                                    star <= (item.answer as number) ? "fill-amber-400 text-amber-400" : "text-zinc-200 dark:text-zinc-800"
                                )}
                            />
                        ))}
                    </div>
                );
            case "boolean":
                return (
                    <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider",
                        item.answer
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                        {item.answer ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {item.answer ? "Yes" : "No"}
                    </div>
                );
            case "currency":
            case "area":
            case "quantity":
                return (
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        {item.type === "area" && <Ruler className="w-4 h-4 text-zinc-500" />}
                        {item.type === "quantity" && <Package className="w-4 h-4 text-zinc-500" />}
                        {item.type === "currency" && <DollarSign className="w-4 h-4 text-zinc-500" />}
                        <span className="text-lg tabular-nums tracking-tight">{item.answer as number}</span>
                        {(item.meta || item.type === "currency") && (
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{item.meta || "USD"}</span>
                        )}
                    </div>
                );
            case "date":
                return (
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        <span className="font-semibold text-base leading-snug">
                            {new Date(item.answer as string).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </span>
                    </div>
                );
            case "phone":
                return (
                    <CopyableText text={item.answer as string} icon={<Phone className="w-4 h-4 text-zinc-500" />}>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug break-all">
                            {item.answer as string}
                        </p>
                    </CopyableText>
                );
            case "email":
                return (
                    <CopyableText text={item.answer as string} icon={<Mail className="w-4 h-4 text-zinc-500" />}>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug break-all">
                            {item.answer as string}
                        </p>
                    </CopyableText>
                );
            case "long-text":
                return (
                    <CopyableText text={item.answer as string}>
                        <ExpandableText text={item.answer as string} style="style-4" />
                    </CopyableText>
                );
            default:
                // Text, phone, email, etc.
                return (
                    <CopyableText text={item.answer as string}>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-snug">
                            {item.answer as string}
                        </p>
                    </CopyableText>
                );
        }
    };

    return (
        <Card className={cn(
            "p-0 md:p-4 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-sm transition-shadow",
            compact ? "border-0 shadow-none bg-transparent" : "border hover:shadow-md"
        )}>
            {showHeader && (
                <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-900 pb-3 p-4 md:p-0">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 h-6 px-2 min-w-8 justify-center font-bold">#{submissionId}</Badge>
                        <span className="text-xs text-zinc-400 font-medium">Submitted 2 mins ago</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"><Check className="w-3 h-3 mr-1" /> Approve</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"><X className="w-3 h-3 mr-1" /> Reject</Button>
                    </div>
                </div>
            )}

            <div className={cn(
                "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5",
                compact ? "p-0" : "p-4 md:p-0"
            )}>
                {data.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                        <div key={item.id} className={cn(
                            "flex flex-col gap-1 min-w-0 transition-colors p-2 -m-2 rounded-lg",
                            isReporting && isSelected && "bg-red-50/50 dark:bg-red-900/10"
                        )}>
                            <div className="flex items-start gap-3">
                                {isReporting && (
                                    <div className="pt-1 flex-shrink-0">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => onToggleId?.(item.id)}
                                            className="w-4 h-4 border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                        />
                                    </div>
                                )}
                                <div className={cn(
                    "flex-1 min-w-0 flex flex-col gap-2"
                )}>
                    <span className="text-[14px] text-zinc-500 font-normal pr-2" title={item.question}>
                        {item.question}
                    </span>
                    <div className="min-h-[24px] flex items-center">
                        {renderCompactValue(item)}
                    </div>
                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

