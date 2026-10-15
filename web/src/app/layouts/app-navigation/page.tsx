"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    Smartphone, 
    ArrowLeft, 
    User, 
    Home, 
    Tractor, 
    Warehouse, 
    FlaskConical, 
    MapPin, 
    Search, 
    Menu, 
    Settings, 
    LogOut, 
    Check, 
    ChevronRight, 
    ChevronDown, 
    ChevronUp,
    Bell, 
    FileText, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Info, 
    RefreshCw, 
    Layers, 
    ShieldCheck,
    X,
    Filter,
    Compass,
    Share2,
    Globe,
    Calendar,
    Box,
    Truck,
    HelpCircle,
    BookOpen,
    Lock
} from "lucide-react"

// Types for Simulator States
type Platform = "ios" | "android"
type NavOption = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
// 1: Hub & Spoke
// 2: Unified Tabs (Switcher center)
// 3: Hierarchical Drawer
// 4: Task-Centric Feed
// 5: Profile-Centric Switcher + Clean Pages
// 6: Hybrid Drawer + Bottom Arrow Switcher + Clean Pages
// 7: Header-Centric Switcher + Clean Pages
// 8: Hamburger + Header App/Location Titles + Center Location Popup Dialog + App Links Drawer + Profile Dropdown
type AppType = "hub" | "farm" | "warehouse" | "lab"

export default function AppNavigationShowcase() {
    // ----------------------------------------------------
    // State Management
    // ----------------------------------------------------
    const [platform, setPlatform] = React.useState<Platform>("ios")
    const [navOption, setNavOption] = React.useState<NavOption>(8)
    
    // User Access Configurations
    const [accessFarm, setAccessFarm] = React.useState(true)
    const [accessWarehouse, setAccessWarehouse] = React.useState(true)
    const [accessLab, setAccessLab] = React.useState(true)
    
    // Locations Configurations
    const [selectedFranchise, setSelectedFranchise] = React.useState("North India")
    const [selectedBase, setSelectedBase] = React.useState("Rohtak")
    const [selectedVillage, setSelectedVillage] = React.useState("Kheri")
    const [selectedWarehouse, setSelectedWarehouse] = React.useState("Rohtak-A")
    const [selectedLab, setSelectedLab] = React.useState("Chandigarh")

    // Active App / Page inside the Simulator
    const [currentApp, setCurrentApp] = React.useState<AppType>("hub")
    const [currentPage, setCurrentPage] = React.useState<string>("home")
    
    // Overlays inside the Simulator
    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
    const [isSwitcherOpen, setIsSwitcherOpen] = React.useState(false)
    const [isProfileOpen, setIsProfileOpen] = React.useState(false)
    const [isLocationSelectorOpen, setIsLocationSelectorOpen] = React.useState(false)
    const [activeTaskDetail, setActiveTaskDetail] = React.useState<string | null>(null)
    
    // Option 5, 6, 7, 8 & 9 Specific Overlays
    const [isOption5ProfileMenuOpen, setIsOption5ProfileMenuOpen] = React.useState(false)
    const [isOption6AppMenuOpen, setIsOption6AppMenuOpen] = React.useState(false)
    const [isOption7SelectorOpen, setIsOption7SelectorOpen] = React.useState(false)
    const [isOption8LocationModalOpen, setIsOption8LocationModalOpen] = React.useState(false)
    const [isOption9AppModalOpen, setIsOption9AppModalOpen] = React.useState(false)
    const [isPageInfoOpen, setIsPageInfoOpen] = React.useState(false)
    const [selectedInfoText, setSelectedInfoText] = React.useState("")
    
    // Static link pages simulated
    const [activeStaticPage, setActiveStaticPage] = React.useState<"about" | "privacy" | "help" | "link1" | "link2" | "link3" | null>(null)

    // Custom Searchable Dropdown States
    const [isFranchiseDropdownOpen, setIsFranchiseDropdownOpen] = React.useState(false)
    const [isBaseDropdownOpen, setIsBaseDropdownOpen] = React.useState(false)
    const [isSubLocationDropdownOpen, setIsSubLocationDropdownOpen] = React.useState(false)

    const [franchiseSearch, setFranchiseSearch] = React.useState("")
    const [baseSearch, setBaseSearch] = React.useState("")
    const [subLocationSearch, setSubLocationSearch] = React.useState("")

    // Reset simulator view when changing navigation strategies
    React.useEffect(() => {
        setIsOption5ProfileMenuOpen(false)
        setIsOption6AppMenuOpen(false)
        setIsOption7SelectorOpen(false)
        setIsOption8LocationModalOpen(false)
        setIsOption9AppModalOpen(false)
        setIsPageInfoOpen(false)
        setActiveStaticPage(null)
        setIsFranchiseDropdownOpen(false)
        setIsBaseDropdownOpen(false)
        setIsSubLocationDropdownOpen(false)
        setFranchiseSearch("")
        setBaseSearch("")
        setSubLocationSearch("")
        
        // Default to first accessible app
        if (accessFarm) setCurrentApp("farm")
        else if (accessWarehouse) setCurrentApp("warehouse")
        else if (accessLab) setCurrentApp("lab")
        else setCurrentApp("hub")
        setCurrentPage("home")
        setIsDrawerOpen(false)
        setIsSwitcherOpen(false)
        setIsProfileOpen(false)
        setIsLocationSelectorOpen(false)
        setActiveTaskDetail(null)
    }, [navOption, accessFarm, accessWarehouse, accessLab])

    // Get count of allowed apps
    const allowedAppsCount = [accessFarm, accessWarehouse, accessLab].filter(Boolean).length

    // Simulated Lists for location switchers
    const bases = ["Rohtak", "Karnal", "Sonipat"]
    const villages = ["Kheri", "Sampla", "Kalanaur"]
    const warehouses = ["Rohtak-A", "Rohtak-B", "Karnal-Main"]
    const labs = ["Chandigarh", "Delhi-NCR", "Ludhiana"]

    // ----------------------------------------------------
    // Mock Data for Pages inside the Simulator
    // ----------------------------------------------------
    const farmersList = [
        { id: "F-01", name: "Satish Kumar", landSize: "4.5 Acres", crop: "Paddy", status: "Surveyed" },
        { id: "F-02", name: "Baldev Singh", landSize: "6.2 Acres", crop: "Basmati Rice", status: "Pending Verification" },
        { id: "F-03", name: "Jaipal Reddy", landSize: "3.8 Acres", crop: "Wheat", status: "Surveyed" },
        { id: "F-04", name: "Mahendra Singh", landSize: "7.1 Acres", crop: "Paddy", status: "Invalidated" },
    ]

    const equipmentList = [
        { name: "Laser Leveler #3", id: "EQ-104", status: "Available", operator: "Ramesh P." },
        { name: "Biochar Spreader #2", id: "EQ-209", status: "In Use", operator: "Suresh K." },
        { name: "pH Soil Probe #12", id: "EQ-088", status: "In Maintenance", operator: "None" },
    ]

    const requestsList = [
        { id: "REQ-402", type: "Bagging Material", qty: "1,200 Bags", base: "Base Rohtak", status: "Pending Approval" },
        { id: "REQ-399", type: "Biochar Dispatch", qty: "15 Tons", base: "Base Karnal", status: "In Transit" },
        { id: "REQ-390", type: "Tractor Allocation", qty: "1 Unit", base: "Base Rohtak", status: "Approved" },
    ]

    const samplesList = [
        { id: "SMP-881", code: "PH-992A", type: "Soil Core", status: "Received", date: "24 Jul" },
        { id: "SMP-879", code: "BC-101X", type: "Biochar Assay", status: "Testing", date: "23 Jul" },
        { id: "SMP-870", code: "WD-048B", type: "Water Quality", status: "Completed", date: "22 Jul" },
    ]

    const cratesList = [
        { id: "CRT-09", samplesCount: 24, dest: "Lab Chandigarh", status: "Sealed" },
        { id: "CRT-12", samplesCount: 18, dest: "Lab Delhi-NCR", status: "Dispatched" },
    ]

    const shipmentsList = [
        { id: "SHP-104", carrier: "Mati Logistics", status: "Dispatched", date: "24 Jul" },
        { id: "SHP-098", carrier: "DHL Express", status: "Delivered", date: "20 Jul" },
    ]

    const tasksFeed = [
        { id: "T1", app: "farm", title: "Conduct Baseline Survey", detail: "Farmer: Baldev Singh • Village Kheri", icon: Tractor, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
        { id: "T2", app: "warehouse", title: "Approve Material Transfer", detail: "1,200 Bags to Base Rohtak", icon: Warehouse, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
        { id: "T3", app: "lab", title: "Verify Soil Sample pH-992A", detail: "Assigned by Lab Chandigarh", icon: FlaskConical, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" },
        { id: "T4", app: "farm", title: "Equipment Check: pH Soil Probe", detail: "Overdue maintenance check", icon: Tractor, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
    ]

    // Page Info Content Map
    const getPageInfoText = (app: string, page: string) => {
        if (app === "farm") {
            if (page === "home") return "Farm Home page allows field agents to track total farmers surveyed, monitor device health and view checklist reminders."
            if (page === "farmers") return "Farmers directory logs registrations, crop details, land scope, and validation records."
            if (page === "equipment") return "Equipment checks help manage local instrumentation and coordinate spreader, tractor, and probe availability."
            if (page === "villages") return "Villages page lists active project territories and displays farmer density scopes."
        }
        if (app === "warehouse") {
            if (page === "home") return "Warehouse Home shows materials inventory status, active dispatches, and incoming transfers."
            if (page === "requests") return "Material requests tracks stock shifting commands, bagging requests, and dispatch logs."
        }
        if (app === "lab") {
            if (page === "home") return "Lab Home tracks received assays, samples analysis backlogs, and recent shipment tallies."
            if (page === "samples") return "Samples grid logs soil cores, biochar assays, and coordinates analysis results uploading."
            if (page === "crates") return "Crates logs shipping bins which group multiple soil assays for freight routing."
            if (page === "shipments") return "Shipments monitors active transit carriers, cargo dispatches, and delivery sign-offs."
        }
        return "Clean page placeholder designed for distraction-free data entry and clean overview operations."
    }

    const triggerPageInfo = (app: string, page: string) => {
        setSelectedInfoText(getPageInfoText(app, page))
        setIsPageInfoOpen(true)
    }

    // ----------------------------------------------------
    // Component Helpers for Screen Renderers
    // ----------------------------------------------------
    const getAppHeaderColor = (app: AppType) => {
        switch(app) {
            case "farm": return "bg-[#2D7F4B] text-white"
            case "warehouse": return "bg-[#C08A0E] text-white"
            case "lab": return "bg-[#6B46C1] text-white"
            default: return "bg-[#1B1614] text-white"
        }
    }

    const getAppThemeColor = (app: AppType) => {
        switch(app) {
            case "farm": return "emerald"
            case "warehouse": return "amber"
            case "lab": return "indigo"
            default: return "zinc"
        }
    }

    const handleAppSwitch = (app: AppType) => {
        setCurrentApp(app)
        setCurrentPage("home")
        setIsSwitcherOpen(false)
        setIsDrawerOpen(false)
        setIsOption5ProfileMenuOpen(false)
        setIsOption6AppMenuOpen(false)
    }

    return (
        <div className="min-h-screen bg-[#F5EBE6] dark:bg-[#1B1614] p-4 sm:p-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center space-x-4">
                        <Link href="/layouts">
                            <Button variant="ghost" size="icon" className="rounded-full border border-zinc-200 dark:border-zinc-800">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">App Navigation Layouts</h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Compare & simulate iOS & Android navigation designs for merged operational apps.
                            </p>
                        </div>
                    </div>
                    
                    {/* Platform Selector Button */}
                    <div className="bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl flex gap-1 self-stretch sm:self-auto">
                        <button 
                            onClick={() => setPlatform("ios")}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${platform === "ios" ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200"}`}
                        >
                            <span>iOS Styling</span>
                        </button>
                        <button 
                            onClick={() => setPlatform("android")}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${platform === "android" ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-200"}`}
                        >
                            <span>Android Styling</span>
                        </button>
                    </div>
                </div>

                {/* Main 3-Column Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* COLUMN 1: Configuration & Simulator Settings (Col Span 4) */}
                    <div className="lg:col-span-4 space-y-6">
                                               {/* Nav Option Selector Card */}
                        <Card className="border-zinc-200 dark:border-zinc-800 shadow-md">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-[#559BE1]" />
                                    Navigation Strategies
                                </CardTitle>
                                <CardDescription>Select which pattern to test in the simulator.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    { id: 8, title: "Variant 1: Drawer & Header Dialog", desc: "Hamburger menu drawer hosts App Links and information links. Header displays active app and location details with a reset arrows icon to trigger a centered context change dialog." },
                                    { id: 9, title: "Variant 2: Hamburger + Profile Swapper Page", desc: "Drawer hosts App Links (routing to dedicated details page) and static pages. Profile initials button navigates to settings screen containing an active app switcher card. Card triggers a centered swapper popup." }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setNavOption(opt.id as NavOption)}
                                        className={`w-full text-left p-3 rounded-xl border text-sm transition-all flex flex-col gap-1 ${
                                            navOption === opt.id 
                                                ? "border-[#559BE1] bg-[#559BE1]/5 dark:bg-[#559BE1]/5 ring-1 ring-[#559BE1] text-zinc-900 dark:text-zinc-100 font-medium" 
                                                : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400"
                                        }`}
                                    >
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center justify-between">
                                            {opt.title}
                                            {navOption === opt.id && <Check className="h-4 w-4 text-[#559BE1]" />}
                                        </div>
                                        <p className="text-[11px] text-zinc-500 leading-normal">{opt.desc}</p>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>

                        {/* App Permissions / User Role Configurator */}
                        <Card className="border-zinc-200 dark:border-zinc-800 shadow-md">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-[#559BE1]" />
                                    User Access Configuration
                                </CardTitle>
                                <CardDescription>Toggle app permissions to simulate users with restricted access.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer select-none">
                                        <div className="flex items-center gap-2.5">
                                            <Tractor className="h-4 w-4 text-[#2D7F4B]" />
                                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Farm App Access</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={accessFarm} 
                                            onChange={(e) => {
                                                if (!e.target.checked && allowedAppsCount === 1) return
                                                setAccessFarm(e.target.checked)
                                            }}
                                            className="h-4 w-4 rounded border-zinc-350 text-[#559BE1] focus:ring-[#559BE1] accent-[#559BE1]"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer select-none">
                                        <div className="flex items-center gap-2.5">
                                            <Warehouse className="h-4 w-4 text-[#C08A0E]" />
                                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Warehouse App Access</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={accessWarehouse} 
                                            onChange={(e) => {
                                                if (!e.target.checked && allowedAppsCount === 1) return
                                                setAccessWarehouse(e.target.checked)
                                            }}
                                            className="h-4 w-4 rounded border-zinc-355 text-[#559BE1] focus:ring-[#559BE1] accent-[#559BE1]"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer select-none">
                                        <div className="flex items-center gap-2.5">
                                            <FlaskConical className="h-4 w-4 text-[#6B46C1]" />
                                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">LAB App Access</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={accessLab} 
                                            onChange={(e) => {
                                                if (!e.target.checked && allowedAppsCount === 1) return
                                                setAccessLab(e.target.checked)
                                            }}
                                            className="h-4 w-4 rounded border-zinc-360 text-[#559BE1] focus:ring-[#559BE1] accent-[#559BE1]"
                                        />
                                    </label>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* COLUMN 2: Mobile Phone Simulator (Col Span 4) */}
                    <div className="lg:col-span-4 flex justify-center py-2">
                        <div className="relative">
                            
                            {/* Ambient Glow mesh background behind the phone */}
                            <div className="absolute -inset-4 bg-gradient-to-tr from-[#559BE1]/10 to-[#2D7F4B]/10 rounded-[54px] blur-xl opacity-80" />
                            
                            {/* Outer Phone Shell */}
                            <div className="relative z-10 w-[360px] h-[720px] bg-zinc-950 rounded-[48px] p-3 shadow-2xl border-[4px] border-zinc-800 flex flex-col select-none ring-1 ring-zinc-800">
                                
                                {/* Dynamic Island / Notch */}
                                <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-between px-3 text-[10px] text-white">
                                    <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                                    <span className="text-[9px] text-zinc-400 font-mono tracking-tight">10:04 AM</span>
                                    <div className="w-1.5 h-1.5 bg-zinc-850 rounded-full" />
                                </div>

                                {/* iOS Ear Speaker Grill Slot */}
                                {platform === "ios" && (
                                    <div className="absolute top-3.5 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-zinc-900 rounded-full z-50" />
                                )}

                                {/* Inner Screen Container */}
                                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[38px] overflow-hidden flex flex-col relative text-zinc-900 dark:text-zinc-100">
                                    
                                    {/* SIMULATED APP CONTENT */}
                                    <div className={`flex-1 flex flex-col overflow-y-auto pt-9 scrollbar-none relative ${
                                        platform === "ios" ? "pb-14" : "pb-[80px]"
                                    }`}>
                                        {renderSimulatorContent()}
                                    </div>

                                    {/* SIMULATED OVERLAYS */}
                                    {renderSimulatorOverlays()}

                                    {/* SIMULATED BOTTOM BAR */}
                                    {renderSimulatorBottomBar()}

                                    {/* iOS Home Indicator Bar Overlay */}
                                    {platform === "ios" && (
                                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-28 h-1 bg-zinc-800 dark:bg-zinc-200 rounded-full opacity-60 pointer-events-none z-50" />
                                    )}

                                    {/* Android System Nav Bar Buttons */}
                                    {platform === "android" && (
                                        <div className="absolute bottom-0 w-full h-8 bg-zinc-950 text-zinc-400 flex items-center justify-around text-[10px] select-none z-50 border-t border-zinc-800">
                                            <button className="hover:text-white transition-colors" onClick={() => {
                                                if (isDrawerOpen) setIsDrawerOpen(false)
                                                else if (isSwitcherOpen) setIsSwitcherOpen(false)
                                                else if (isProfileOpen) setIsProfileOpen(false)
                                                else if (isLocationSelectorOpen) setIsLocationSelectorOpen(false)
                                                else if (activeTaskDetail) setActiveTaskDetail(null)
                                                else if (isOption5ProfileMenuOpen) setIsOption5ProfileMenuOpen(false)
                                                else if (isOption6AppMenuOpen) setIsOption6AppMenuOpen(false)
                                                else if (isPageInfoOpen) setIsPageInfoOpen(false)
                                                else if (activeStaticPage) setActiveStaticPage(null)
                                                else if (currentApp !== "hub" && navOption === 1) setCurrentApp("hub")
                                            }}>◀</button>
                                            <button className="hover:text-white transition-colors" onClick={() => {
                                                setIsDrawerOpen(false)
                                                setIsSwitcherOpen(false)
                                                setIsProfileOpen(false)
                                                setIsLocationSelectorOpen(false)
                                                setActiveTaskDetail(null)
                                                setIsOption5ProfileMenuOpen(false)
                                                setIsOption6AppMenuOpen(false)
                                                setIsPageInfoOpen(false)
                                                setActiveStaticPage(null)
                                                if (navOption === 1) setCurrentApp("hub")
                                            }}>●</button>
                                            <button className="hover:text-white transition-colors" onClick={() => {
                                                if (navOption === 6) setIsOption6AppMenuOpen(true)
                                                else setIsSwitcherOpen(true)
                                            }}>■</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 3: Design Breakdown & Trade-offs (Col Span 4) */}
                    <div className="lg:col-span-4 space-y-6">
                                          {/* Location Context Selector Card */}
                        <Card className="border-zinc-200 dark:border-zinc-800 shadow-md">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-[#559BE1]" />
                                    Simulated Location Context
                                </CardTitle>
                                <CardDescription className="text-xs">Adjust location selections to verify dynamic context displays.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="space-y-1 text-left">
                                        <span className="text-zinc-400">Base:</span>
                                        <select 
                                            value={selectedBase} 
                                            onChange={(e) => setSelectedBase(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-1.5 outline-none font-semibold"
                                        >
                                            {bases.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <span className="text-zinc-400">Village:</span>
                                        <select 
                                            value={selectedVillage} 
                                            onChange={(e) => setSelectedVillage(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded p-1.5 outline-none font-semibold"
                                        >
                                            {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <span className="text-zinc-400">Source:</span>
                                        <select 
                                            value={selectedWarehouse} 
                                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded p-1.5 outline-none font-semibold"
                                        >
                                            {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <span className="text-zinc-400">Lab:</span>
                                        <select 
                                            value={selectedLab} 
                                            onChange={(e) => setSelectedLab(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded p-1.5 outline-none font-semibold"
                                        >
                                            {labs.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>

            </div>
        </div>
    )

    // ----------------------------------------------------
    // Screen Renders based on active App and active Page
    // ----------------------------------------------------
    function renderSimulatorContent() {
        if (activeStaticPage) {
            return renderStaticPageContent()
        }

        if (activeTaskDetail) {
            return renderTaskDetail(activeTaskDetail)
        }

        // Global Profile Page
        if (isProfileOpen) {
            return renderProfileScreen()
        }

        // Render Clean blank layout for Variant 1 & Variant 2
        if (navOption === 8 || navOption === 9) {
            return renderCleanLayout()
        }

        return (
            <div className="p-4 text-center text-xs text-zinc-400 flex flex-col items-center justify-center h-full gap-2">
                <Smartphone className="h-8 w-8 text-zinc-300" />
                <span>Select Variant 1 or Variant 2 to begin testing.</span>
            </div>
        )
    }

    // --- HUB Launcher (For Option 1) ---
    function renderHubScreen() {
        return (
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Mati Operations</span>
                        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-50">App Hub</h3>
                    </div>
                    <button 
                        onClick={() => setIsProfileOpen(true)}
                        className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
                    >
                        <User className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </div>

                {/* Location Context Summary */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-mati-gold" />
                        <div className="text-left">
                            <p className="text-[10px] text-zinc-400 leading-none">Franchise & Base</p>
                            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{selectedFranchise} • {selectedBase}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsLocationSelectorOpen(true)}>
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                {/* App Cards List */}
                <div className="space-y-3">
                    <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider block">My Assigned Modules</span>
                    
                    {accessFarm && (
                        <button 
                            onClick={() => handleAppSwitch("farm")}
                            className="w-full text-left p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-955 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                    <Tractor className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:underline">Farm App</span>
                                    <p className="text-xs text-zinc-550 dark:text-zinc-450 mt-0.5">Surveys, field checks, equipment</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-emerald-600" />
                        </button>
                    )}

                    {accessWarehouse && (
                        <button 
                            onClick={() => handleAppSwitch("warehouse")}
                            className="w-full text-left p-4 rounded-2xl border border-amber-100 dark:border-amber-955/40 bg-amber-50/30 dark:bg-amber-955/10 hover:bg-amber-50/60 dark:hover:bg-amber-955/20 transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-100 dark:bg-amber-955 text-amber-600 dark:text-amber-400 rounded-xl">
                                    <Warehouse className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:underline">Warehouse App</span>
                                    <p className="text-xs text-zinc-550 dark:text-zinc-455 mt-0.5">Shifts, dispatches, material checks</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-amber-600" />
                        </button>
                    )}

                    {accessLab && (
                        <button 
                            onClick={() => handleAppSwitch("lab")}
                            className="w-full text-left p-4 rounded-2xl border border-indigo-100 dark:border-indigo-960/40 bg-indigo-50/30 dark:bg-indigo-960/10 hover:bg-indigo-50/60 dark:hover:bg-indigo-960/20 transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-960 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                    <FlaskConical className="h-5 w-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:underline">LAB App</span>
                                    <p className="text-xs text-zinc-550 dark:text-zinc-460 mt-0.5">Samples analysis, crates, shipments</p>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-indigo-600" />
                        </button>
                    )}

                    {!accessFarm && !accessWarehouse && !accessLab && (
                        <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                            No modules assigned. Grant access in the config panel on the left.
                        </div>
                    )}
                </div>

                {/* Profile section preview & quick stats */}
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 p-4 rounded-2xl space-y-3">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Sync Operations</span>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">Offline Cache</span>
                        <span className="font-mono text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Sync Completed
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400">Pending Sync Items</span>
                        <span className="font-bold font-mono">0 uploads</span>
                    </div>
                </div>
            </div>
        )
    }

    // --- Profile & Settings Screen ---
    function renderProfileScreen() {
        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => setIsProfileOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                        <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                    <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-50">Profile & Settings</h3>
                </div>

                {/* User Details */}
                <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="h-12 w-12 rounded-full bg-mati-gold flex items-center justify-center text-white font-bold text-base">
                        RK
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">Ramesh Kumar</h4>
                        <p className="text-xs text-zinc-500">Mati Senior Field Officer</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">ID: M-998A-32</p>
                    </div>
                </div>

                {/* App Switching Card for Option 9 */}
                {navOption === 9 && (
                    <button
                        onClick={() => setIsOption9AppModalOpen(true)}
                        className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between text-left transition-all hover:bg-zinc-100 dark:hover:bg-zinc-855"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg text-white shrink-0 ${currentApp === 'farm' ? 'bg-[#2D7F4B]' : currentApp === 'warehouse' ? 'bg-[#C08A0E]' : 'bg-[#6B46C1]'}`}>
                                {currentApp === 'farm' ? <Tractor className="h-3.5 w-3.5" /> : currentApp === 'warehouse' ? <Warehouse className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
                            </div>
                            <div>
                                <span className="text-[10px] text-zinc-400 block font-bold uppercase">Active App Module</span>
                                <span className="font-bold text-xs text-zinc-850 dark:text-zinc-150 block mt-0.5">
                                    {currentApp === "farm" ? "Mati Farm Module" : currentApp === "warehouse" ? "Mati Warehouse Module" : "Mati Lab Module"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10.5px] font-bold text-[#559BE1]">Switch App</span>
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                        </div>
                    </button>
                )}

                <Button 
                    variant="outline" 
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-zinc-200 dark:border-zinc-800 dark:hover:bg-red-955/20 text-xs"
                    onClick={() => {
                        setIsProfileOpen(false)
                        if (navOption === 1) setCurrentApp("hub")
                    }}
                >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" /> Logout Session
                </Button>
            </div>
        )
    }

    // --- Task Details Sheet ---
    function renderTaskDetail(taskId: string) {
        const task = tasksFeed.find(t => t.id === taskId)
        if (!task) return null

        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => setActiveTaskDetail(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-805 rounded">
                        <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                    <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-100">Task Detail Summary</h3>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${task.color}`}>
                            <task.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">{task.app.toUpperCase()} OPERATION</span>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{task.title}</h4>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-2">
                        This operation requires physical on-site verification. Make sure your GPS is calibrated and matches the target coordinates.
                    </p>

                    <div className="border-t border-zinc-200 dark:border-zinc-900 pt-3 space-y-1.5 text-xs text-zinc-500">
                        <div className="flex justify-between"><span className="text-zinc-400">Context:</span> <span className="font-semibold text-zinc-700 dark:text-zinc-300">{task.detail}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Assigned Base:</span> <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedBase}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Date:</span> <span className="font-semibold text-zinc-700 dark:text-zinc-300">24 July 2026</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Offline Ready:</span> <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><Check className="h-3 w-3" /> Yes</span></div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Button className="w-full bg-mati-gold hover:bg-yellow-600 text-white font-semibold text-xs py-5 rounded-xl transition-all shadow-md">
                        Start Task Execution
                    </Button>
                    <Button variant="outline" className="w-full border-zinc-200 dark:border-zinc-800 text-xs py-5 rounded-xl text-zinc-650 dark:text-zinc-300" onClick={() => setActiveTaskDetail(null)}>
                        Cancel & Return
                    </Button>
                </div>
            </div>
        )
    }

    // --- Unified Feed (For Option 4) ---
    function renderUnifiedFeed() {
        return (
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Mati Consolidated Feed</span>
                        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-50">Task Workspace</h3>
                    </div>
                    <button 
                        onClick={() => setIsProfileOpen(true)}
                        className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
                    >
                        <User className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </div>

                {/* Location Context summary */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-mati-gold" />
                        <div className="text-left">
                            <p className="text-[10px] text-zinc-400 leading-none">Global Active Context</p>
                            <p className="text-xs font-semibold text-zinc-850 dark:text-zinc-200 mt-0.5">{selectedFranchise} • {selectedBase}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsLocationSelectorOpen(true)}>
                        <ChevronRight className="h-4.5 w-4.5 text-zinc-400" />
                    </button>
                </div>

                {/* Combined Tasks list */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-zinc-405 dark:text-zinc-500 uppercase tracking-wider">Action Required</span>
                        <span className="bg-mati-gold/10 text-mati-gold text-[10px] font-bold px-2 py-0.5 rounded-full">4 Pending</span>
                    </div>

                    <div className="space-y-2.5">
                        {tasksFeed
                            .filter(t => {
                                if (t.app === "farm" && !accessFarm) return false
                                if (t.app === "warehouse" && !accessWarehouse) return false
                                if (t.app === "lab" && !accessLab) return false
                                return true
                            })
                            .map((task) => (
                                <button 
                                    key={task.id}
                                    onClick={() => setActiveTaskDetail(task.id)}
                                    className="w-full text-left p-3.5 rounded-2xl bg-white dark:bg-zinc-950 hover:shadow-sm border border-zinc-150 dark:border-zinc-800/60 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${task.color} shrink-0`}>
                                            <task.icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 block">{task.app} app</span>
                                            <h4 className="font-bold text-xs text-zinc-850 dark:text-zinc-100 truncate">{task.title}</h4>
                                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{task.detail}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 shrink-0 ml-2" />
                                </button>
                            ))
                        }
                    </div>
                </div>

                {/* Stats Widget */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-50 dark:bg-zinc-955 p-3 rounded-2xl border border-zinc-105 dark:border-zinc-805">
                        <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Today's Surveys</span>
                        <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 block">14 / 20</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-960 p-3 rounded-2xl border border-zinc-110 dark:border-zinc-810">
                        <span className="text-[10px] text-zinc-405 block uppercase font-semibold">Offline Sync</span>
                        <span className="text-xs font-semibold text-emerald-600 mt-2 block flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> All Uploaded
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    // --- Options 5 & 6 Clean Layout Screen ---
    function renderCleanLayout() {
        // Find current page title text
        let pageTitle = "Home Dashboard"
        if (currentPage === "farmers") pageTitle = "Farmers Directory"
        if (currentPage === "equipment") pageTitle = "Equipment Inventory"
        if (currentPage === "villages") pageTitle = "Villages Scope"
        if (currentPage === "requests") pageTitle = "Shift Requests"
        if (currentPage === "samples") pageTitle = "Samples Queue"
        if (currentPage === "crates") pageTitle = "Active Crates"
        if (currentPage === "shipments") pageTitle = "Shipments Log"

        const appTheme = getAppThemeColor(currentApp)
        const headerColor = getAppHeaderColor(currentApp)

        // Text color styling mapped to brand guidelines
        let badgeColor = "bg-[#2D7F4B]/10 text-[#2D7F4B] border-[#2D7F4B]/20"
        let iconBg = "bg-[#2D7F4B]/10 text-[#2D7F4B]"
        if (currentApp === "warehouse") {
            badgeColor = "bg-[#C08A0E]/10 text-[#C08A0E] border-[#C08A0E]/20"
            iconBg = "bg-[#C08A0E]/10 text-[#C08A0E]"
        } else if (currentApp === "lab") {
            badgeColor = "bg-[#6B46C1]/10 text-[#6B46C1] border-[#6B46C1]/20"
            iconBg = "bg-[#6B46C1]/10 text-[#6B46C1]"
        } else if (currentApp === "hub") {
            badgeColor = "bg-[#3182CE]/10 text-[#3182CE] border-[#3182CE]/20"
            iconBg = "bg-[#3182CE]/10 text-[#3182CE]"
        }

        return (
            <div className="p-4 space-y-4 flex-1 flex flex-col justify-start">
                     {/* 1. Simulator top app header block for Variant 1 & Variant 2 */}
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Hamburger Menu trigger */}
                        <button 
                            onClick={() => setIsDrawerOpen(true)} 
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg shrink-0"
                        >
                            <Menu className="h-4 w-4 text-zinc-550 dark:text-zinc-300" />
                        </button>
                        
                        {/* Heading block with location details and change button */}
                        <div className="min-w-0 flex flex-col leading-tight pr-1">
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {currentApp === "farm" ? "Mati Farm" : currentApp === "warehouse" ? "Mati Warehouse" : "Mati Lab"}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[9px] text-zinc-500 font-medium truncate max-w-[110px]">
                                    {currentApp === "farm" ? `${selectedVillage}, ${selectedBase}` : 
                                     currentApp === "warehouse" ? selectedWarehouse : selectedLab}
                                </span>
                                {/* Location Change Icon Button */}
                                <button 
                                    onClick={() => setIsOption8LocationModalOpen(true)}
                                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-[#559BE1] transition-colors shrink-0"
                                    title="Change Location"
                                >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Profile Avatar trigger */}
                    <button 
                        onClick={() => {
                            if (navOption === 9) {
                                setIsProfileOpen(true)
                            } else {
                                setIsOption5ProfileMenuOpen(true)
                            }
                        }}
                        className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-650 dark:text-zinc-300 shrink-0"
                    >
                        RK
                    </button>
                </div>

                {/* 2. Space for page name and 'i' info button */}
                <div className="flex items-center gap-2 py-1 select-none text-left">
                    <h2 className="text-base font-extrabold text-zinc-850 dark:text-zinc-50 tracking-tight">{pageTitle}</h2>
                    <button 
                        onClick={() => triggerPageInfo(currentApp, currentPage)}
                        className={`p-1 rounded-full border hover:scale-105 transition-transform ${badgeColor}`}
                    >
                        <Info className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* 3. Completely Empty Clean Page Workspace */}
                <div className="flex-1" />
            </div>
        )
    }

    // --- Render Static Pages (About, Privacy, Help) inside simulator ---
    function renderStaticPageContent() {
        let title = "Help & Support"
        let text = "Help and support portal provides offline documentation guidelines, contact details for Mati Carbon developers, and field validation checklists."
        
        if (activeStaticPage === "about") {
            title = "About Mati Carbon"
            text = "Mati Carbon removes carbon dioxide from the atmosphere through Enhanced Rock Weathering (ERW). We apply finely crushed basalt to agricultural soils, capturing CO₂ permanently while enriching crop nutrition."
        } else if (activeStaticPage === "privacy") {
            title = "Privacy Policy"
            text = "Your telemetry details, surveyor coordinates, and farmer registration surveys are safely encrypted under local compliance regulations. All data uploads require secure authorization tokens."
        } else if (activeStaticPage === "link1") {
            title = "App Link 1 Content"
            text = "This simulates a custom web link or specialized service module mapped into the Mati Carbon suite, such as external data sources, land registries, or equipment manuals."
        } else if (activeStaticPage === "link2") {
            title = "App Link 2 Content"
            text = "This simulates telemetry metrics, real-time weather integration charts, and sensor network diagnostic settings."
        } else if (activeStaticPage === "link3") {
            title = "App Link 3 Content"
            text = "This simulates localized user support FAQs, feedback tickets, offline database exports, and application version configurations."
        }

        return (
            <div className="p-4 space-y-4 flex-1 flex flex-col justify-start">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <button onClick={() => setActiveStaticPage(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-805 rounded">
                        <ArrowLeft className="h-4 w-4 text-zinc-655 dark:text-zinc-300" />
                    </button>
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{title}</h3>
                </div>

                {/* 2. Space for page name and 'i' info button */}
                <div className="flex items-center gap-2 py-1 select-none text-left">
                    <h2 className="text-base font-extrabold text-zinc-850 dark:text-zinc-50 tracking-tight">{title}</h2>
                    <button 
                        onClick={() => triggerPageInfo(currentApp, activeStaticPage || "")}
                        className="p-1 rounded-full border hover:scale-105 transition-transform bg-[#559BE1]/10 text-[#559BE1] border-[#559BE1]/20"
                    >
                        <Info className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="flex-1" />
            </div>
        )
    }

    // 1. FARM APP (Original full options)
    function renderFarmApp() {
        const renderSubPage = () => {
            switch(currentPage) {
                case "farmers":
                    return (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Registered Farmers</h4>
                                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded-lg">
                                    <Plus className="h-3 w-3 mr-0.5" /> Add Farmer
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {farmersList.map(f => (
                                    <div key={f.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-855 dark:text-zinc-100">{f.name}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Crop: {f.crop} • Land: {f.landSize}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            f.status === "Surveyed" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : 
                                            f.status === "Invalidated" ? "bg-red-50 text-red-600 dark:bg-red-950/20" : "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                                        }`}>{f.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                case "equipment":
                    return (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Equipment Inventory</h4>
                            <div className="space-y-2">
                                {equipmentList.map(e => (
                                    <div key={e.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-860 dark:text-zinc-100">{e.name}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">ID: {e.id} • Operator: {e.operator}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            e.status === "Available" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : 
                                            e.status === "In Use" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                                        }`}>{e.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                case "villages":
                    return (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Villages Scope</h4>
                            <div className="space-y-2">
                                {villages.map(v => (
                                    <div key={v} className="p-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-105 dark:border-zinc-805 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                                            <span className="font-semibold text-zinc-850 dark:text-zinc-200">{v}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-zinc-400">12 Farmers Surveyed</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                default: // Home Page
                    return (
                        <div className="space-y-4">
                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="text-[9px] text-zinc-400 block font-bold uppercase">Total Farmers</span>
                                    <span className="text-base font-bold text-zinc-855 dark:text-zinc-100 mt-1 block">184 Farmers</span>
                                </div>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-955 rounded-2xl border border-zinc-105 dark:border-zinc-805">
                                    <span className="text-[9px] text-zinc-405 block font-bold uppercase">Base Location</span>
                                    <span className="text-xs font-semibold text-zinc-855 dark:text-zinc-100 mt-1.5 block truncate">{selectedBase}</span>
                                </div>
                            </div>

                            {/* Active Village Selection Widget */}
                            <div className="p-3 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900 rounded-xl flex justify-between items-center">
                                <div className="text-left">
                                    <span className="text-[9px] uppercase font-bold text-emerald-600 block">Active Survey Scope</span>
                                    <span className="text-xs font-bold text-zinc-860 dark:text-zinc-100 mt-0.5 block">{selectedVillage}</span>
                                </div>
                                <button className="text-[10px] text-emerald-600 font-bold hover:underline" onClick={() => setIsLocationSelectorOpen(true)}>
                                    Change
                                </button>
                            </div>

                            {/* Action Feed */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Field Checklist</span>
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                    <span className="text-zinc-650 dark:text-zinc-300">Submit survey uploads</span>
                                    <span className="text-amber-500 font-bold font-mono">2 left</span>
                                </div>
                            </div>
                        </div>
                    )
            }
        }

        return (
            <div className="p-4 space-y-4">
                {renderAppSubHeader("Farm App", "bg-emerald-600", Tractor)}
                {renderSubPage()}
            </div>
        )
    }

    // 2. WAREHOUSE APP (Original full options)
    function renderWarehouseApp() {
        const renderSubPage = () => {
            switch(currentPage) {
                case "requests":
                    return (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Material Shift Requests</h4>
                                <Button size="sm" className="h-7 bg-amber-600 hover:bg-amber-700 text-white text-[10px] rounded-lg">
                                    <Plus className="h-3 w-3 mr-0.5" /> New Request
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {requestsList.map(r => (
                                    <div key={r.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-855 dark:text-zinc-100">{r.type} ({r.qty})</p>
                                            <p className="text-[10px] text-zinc-550 mt-0.5">ID: {r.id} • Base: {r.base}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            r.status === "Approved" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : 
                                            r.status === "In Transit" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20" : "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                                        }`}>{r.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                default: // Home Page
                    return (
                        <div className="space-y-4">
                            {/* Location Context summary */}
                            <div className="p-3.5 bg-amber-50/20 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900 rounded-xl flex justify-between items-center text-left">
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-amber-600 block">Active Warehouse Context</span>
                                    <span className="text-xs font-bold text-zinc-860 dark:text-zinc-100 mt-0.5 block">{selectedWarehouse}</span>
                                </div>
                                <button className="text-[10px] text-amber-600 font-bold hover:underline" onClick={() => setIsLocationSelectorOpen(true)}>
                                    Change
                                </button>
                            </div>

                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 text-left">
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="text-[9px] text-zinc-400 block font-bold uppercase">Pending Shifts</span>
                                    <span className="text-lg font-bold text-zinc-865 dark:text-zinc-100 mt-1 block">5 Shipments</span>
                                </div>
                            </div>
                        </div>
                    )
            }
        }

        return (
            <div className="p-4 space-y-4">
                {renderAppSubHeader("Warehouse App", "bg-amber-600", Warehouse)}
                {renderSubPage()}
            </div>
        )
    }

    // 3. LAB APP (Original full options)
    function renderLabApp() {
        const renderSubPage = () => {
            switch(currentPage) {
                case "samples":
                    return (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-zinc-855 dark:text-zinc-200">Soil Samples</h4>
                                <Button size="sm" className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-lg">
                                    <Plus className="h-3 w-3 mr-0.5" /> Log Sample
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {samplesList.map(s => (
                                    <div key={s.id} className="p-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-105 dark:border-zinc-805 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-860 dark:text-zinc-100">{s.code} ({s.type})</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">ID: {s.id} • Received: {s.date}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            s.status === "Completed" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : 
                                            s.status === "Testing" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20" : "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                                        }`}>{s.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                case "crates":
                    return (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Active Crates</h4>
                            <div className="space-y-2">
                                {cratesList.map(c => (
                                    <div key={c.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-855 dark:text-zinc-100">{c.id} ({c.samplesCount} Samples)</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Destination: {c.dest}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20`}>{c.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                case "shipments":
                    return (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Lab Shipments</h4>
                            <div className="space-y-2">
                                {shipmentsList.map(s => (
                                    <div key={s.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-zinc-855 dark:text-zinc-100">{s.id}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Carrier: {s.carrier} • Date: {s.date}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                            s.status === "Delivered" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20" : "bg-blue-50 text-blue-600 dark:bg-blue-950/20"
                                        }`}>{s.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                default: // Home Page
                    return (
                        <div className="space-y-4">
                            <div className="p-3.5 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900 rounded-xl flex justify-between items-center text-left">
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-indigo-600 block">Active Lab Context</span>
                                    <span className="text-xs font-bold text-zinc-860 dark:text-zinc-100 mt-0.5 block">{selectedLab}</span>
                                </div>
                                <button className="text-[10px] text-indigo-600 font-bold hover:underline" onClick={() => setIsLocationSelectorOpen(true)}>
                                    Change
                                </button>
                            </div>
                        </div>
                    )
            }
        }

        return (
            <div className="p-4 space-y-4">
                {renderAppSubHeader("LAB Testing App", "bg-indigo-600", FlaskConical)}
                {renderSubPage()}
            </div>
        )
    }

    // App header wrapper inside simulator (original tabs mode)
    function renderAppSubHeader(title: string, color: string, Icon: React.ComponentType<{className?: string}>) {
        return (
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    {/* If Hub & Spoke is active, show Back to Hub button */}
                    {navOption === 1 && (
                        <button onClick={() => setCurrentApp("hub")} className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-850 rounded">
                            <ArrowLeft className="h-4 w-4 text-zinc-500" />
                        </button>
                    )}
                    
                    {/* Hamburger menu for Option 3 */}
                    {navOption === 3 && (
                        <button onClick={() => setIsDrawerOpen(true)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg mr-0.5">
                            <Menu className="h-4 w-4 text-zinc-650 dark:text-zinc-300" />
                        </button>
                    )}

                    <div className={`p-1.5 rounded-lg text-white ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-left">
                        <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Mati Consolidated</span>
                        <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{title}</h3>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {(navOption === 1 || navOption === 2) && (
                        <button 
                            onClick={() => setIsSwitcherOpen(true)}
                            className="p-1 hover:bg-zinc-105 dark:hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-zinc-600"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button 
                        onClick={() => setIsProfileOpen(true)}
                        className="h-7 w-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
                    >
                        <User className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />
                    </button>
                </div>
            </div>
        )
    }

    // ----------------------------------------------------
    // Overlays inside the phone screen
    // ----------------------------------------------------
    function renderSimulatorOverlays() {
        return (
            <>
                {/* 1. App Switcher Sheet (Option 2 center tab triggers this) */}
                {isSwitcherOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[90] flex flex-col justify-end transition-all duration-350">
                        <div className="bg-white dark:bg-zinc-900 rounded-t-[28px] p-4 space-y-4 max-h-[85%] overflow-y-auto border-t border-zinc-200 dark:border-zinc-800">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">Select Active Module</h4>
                                <button 
                                    onClick={() => setIsSwitcherOpen(false)}
                                    className="p-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-full"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <p className="text-[11px] text-zinc-400 leading-tight">Switch between your assigned operational interfaces below:</p>
                            
                            <div className="space-y-2">
                                {accessFarm && (
                                    <button 
                                        onClick={() => handleAppSwitch("farm")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "farm" 
                                                ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20" 
                                                : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-955"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Tractor className="h-4 w-4 text-emerald-600" />
                                            <div>
                                                <span className="font-bold text-zinc-850 dark:text-zinc-150">Farm Operations</span>
                                                <p className="text-[10px] text-zinc-400 mt-0.5">{selectedVillage}</p>
                                            </div>
                                        </div>
                                        {currentApp === "farm" && <Check className="h-4 w-4 text-emerald-600" />}
                                    </button>
                                )}

                                {accessWarehouse && (
                                    <button 
                                        onClick={() => handleAppSwitch("warehouse")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "warehouse" 
                                                ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/20" 
                                                : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-955"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Warehouse className="h-4 w-4 text-amber-600" />
                                            <div>
                                                <span className="font-bold text-zinc-850 dark:text-zinc-150">Warehouse Operations</span>
                                                <p className="text-[10px] text-zinc-400 mt-0.5">{selectedWarehouse}</p>
                                            </div>
                                        </div>
                                        {currentApp === "warehouse" && <Check className="h-4 w-4 text-amber-600" />}
                                    </button>
                                )}

                                {accessLab && (
                                    <button 
                                        onClick={() => handleAppSwitch("lab")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "lab" 
                                                ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20" 
                                                : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-955"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <FlaskConical className="h-4 w-4 text-indigo-600" />
                                            <div>
                                                <span className="font-bold text-zinc-850 dark:text-zinc-150">LAB Operations</span>
                                                <p className="text-[10px] text-zinc-400 mt-0.5">{selectedLab}</p>
                                            </div>
                                        </div>
                                        {currentApp === "lab" && <Check className="h-4 w-4 text-indigo-600" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Hierarchical Sidebar Navigation Drawer (Variant 1 & Variant 2) */}
                {isDrawerOpen && (navOption === 8 || navOption === 9) && (
                    <div className="absolute inset-0 bg-black/60 z-[95] flex transition-all duration-300">
                        <div className="w-[280px] bg-white dark:bg-zinc-900 rounded-r-[28px] h-full p-5 flex flex-col justify-between border-r border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-y-auto">
                            <div className="space-y-6">
                                
                                {/* Header / Profile info card */}
                                <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2.5 text-left">
                                        <div className="h-8 w-8 rounded-full bg-[#559BE1] flex items-center justify-center text-white font-extrabold text-xs">RK</div>
                                        <div className="leading-tight">
                                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-50 block">Ramesh Kumar</span>
                                            <span className="text-[9px] text-zinc-400 font-medium block">Field Officer</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                        <X className="h-4 w-4 text-zinc-400" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* M3 Style Change Location Container Card */}
                                    <button 
                                        onClick={() => {
                                            setIsOption8LocationModalOpen(true)
                                            setIsDrawerOpen(false)
                                        }}
                                        className="w-full p-3.5 rounded-[20px] border border-zinc-150 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-955 flex items-center justify-between text-left text-xs font-semibold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <MapPin className="h-4.5 w-4.5 text-[#559BE1] shrink-0" />
                                            <div className="min-w-0">
                                                <span className="text-zinc-850 dark:text-zinc-200 block text-[11px]">Change Location</span>
                                                <span className="text-[9px] text-zinc-405 font-medium block truncate mt-0.5">{selectedFranchise} • {selectedBase}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                    </button>

                                    {/* App Links Section (Rendered ABOVE Information section) */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-3 mb-1.5">App Links</span>
                                        {[
                                            { id: "link1", label: "App Link 1", icon: Globe },
                                            { id: "link2", label: "App Link 2", icon: Layers },
                                            { id: "link3", label: "App Link 3", icon: FileText }
                                        ].map(link => {
                                            const isActive = activeStaticPage === link.id
                                            return (
                                                <button
                                                    key={link.id}
                                                    onClick={() => {
                                                        setActiveStaticPage(link.id as any)
                                                        setIsDrawerOpen(false)
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-full flex items-center justify-between text-xs transition-all ${
                                                        isActive 
                                                            ? "bg-[#559BE1]/10 text-[#559BE1] font-bold" 
                                                            : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <link.icon className={`h-4 w-4 ${isActive ? "text-[#559BE1]" : "text-zinc-400"}`} />
                                                        <span>{link.label}</span>
                                                    </span>
                                                    <ChevronRight className={`h-3.5 w-3.5 transition-opacity ${isActive ? "text-[#559BE1] opacity-100" : "text-zinc-300 opacity-60"}`} />
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Static Links Menu (Information) */}
                                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-850 space-y-1">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-3 mb-1.5">Information</span>
                                        {[
                                            { id: "about", label: "About Us", icon: BookOpen },
                                            { id: "privacy", label: "Privacy Policy", icon: Lock },
                                            { id: "help", label: "Help & Support", icon: HelpCircle }
                                        ].map(link => {
                                            const isActive = activeStaticPage === link.id
                                            return (
                                                <button
                                                    key={link.id}
                                                    onClick={() => {
                                                        setActiveStaticPage(link.id as any)
                                                        setIsDrawerOpen(false)
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-full flex items-center justify-between text-xs transition-all ${
                                                        isActive 
                                                            ? "bg-[#559BE1]/10 text-[#559BE1] font-bold" 
                                                            : "text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <link.icon className={`h-4 w-4 ${isActive ? "text-[#559BE1]" : "text-zinc-400"}`} />
                                                        <span>{link.label}</span>
                                                    </span>
                                                    <ChevronRight className={`h-3.5 w-3.5 transition-opacity ${isActive ? "text-[#559BE1] opacity-100" : "text-zinc-300 opacity-60"}`} />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Logout & App Version Footer */}
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                <button 
                                    onClick={() => {
                                        setIsDrawerOpen(false)
                                        setIsProfileOpen(true)
                                    }}
                                    className="w-full py-1.5 text-left text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-2"
                                >
                                    <LogOut className="h-4 w-4" /> Log Out Session
                                </button>
                                <div className="text-[10px] text-zinc-400 font-medium px-1 flex items-center justify-between">
                                    <span>Mati Platform</span>
                                    <span>v2.1.0-stable</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
                    </div>
                )}

                {/* 3. Option 5 Specific Profile Top-Right Dropdown Modal */}
                {isOption5ProfileMenuOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[96] flex flex-col justify-end">
                        <div className="bg-white dark:bg-zinc-900 rounded-t-[28px] p-5 space-y-4 max-h-[85%] overflow-y-auto border-t border-zinc-200 dark:border-zinc-800 text-left">
                            
                            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2.5 text-left">
                                    <div className="h-9 w-9 rounded-full bg-[#559BE1] flex items-center justify-center text-white font-extrabold text-sm">RK</div>
                                    <div>
                                        <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-50">Ramesh Kumar</h4>
                                        <span className="text-[9px] text-zinc-400 block mt-0.5">Senior Field Officer</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsOption5ProfileMenuOpen(false)}
                                    className="p-1.5 bg-zinc-100 dark:bg-zinc-805 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {/* Details button */}
                                <button 
                                    onClick={() => {
                                        setIsProfileOpen(true)
                                        setIsOption5ProfileMenuOpen(false)
                                    }}
                                    className="w-full text-left p-3.5 rounded-[20px] hover:bg-zinc-50 dark:hover:bg-zinc-850 flex items-center gap-3 text-xs border border-zinc-150 dark:border-zinc-800 font-semibold"
                                >
                                    <User className="h-4.5 w-4.5 text-[#559BE1]" />
                                    <span className="text-zinc-855 dark:text-zinc-200">View Profile Details</span>
                                </button>
                            </div>

                            {/* App swapper buttons inside Option 5 profile dropdown */}
                            <div className="space-y-2 pt-1">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block px-1">Switch App Module</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {accessFarm && (
                                        <button 
                                            onClick={() => handleAppSwitch("farm")}
                                            className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                                currentApp === "farm" 
                                                    ? "border-[#2D7F4B] bg-[#2D7F4B]/10 text-[#2D7F4B]" 
                                                    : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <Tractor className="h-4.5 w-4.5 text-[#2D7F4B]" />
                                            <span>Farm App</span>
                                        </button>
                                    )}

                                    {accessWarehouse && (
                                        <button 
                                            onClick={() => handleAppSwitch("warehouse")}
                                            className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                                currentApp === "warehouse" 
                                                    ? "border-[#C08A0E] bg-[#C08A0E]/10 text-[#C08A0E]" 
                                                    : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <Warehouse className="h-4.5 w-4.5 text-[#C08A0E]" />
                                            <span>Warehouse</span>
                                        </button>
                                    )}

                                    {accessLab && (
                                        <button 
                                            onClick={() => handleAppSwitch("lab")}
                                            className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                                currentApp === "lab" 
                                                    ? "border-[#6B46C1] bg-[#6B46C1]/10 text-[#6B46C1]" 
                                                    : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <FlaskConical className="h-4.5 w-4.5 text-[#6B46C1]" />
                                            <span>Lab Testing</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={() => {
                                    setIsOption5ProfileMenuOpen(false)
                                    setIsProfileOpen(true)
                                }}
                                className="w-full py-3.5 border-t border-zinc-100 dark:border-zinc-800 text-left text-xs font-semibold text-red-500 hover:text-red-655 flex items-center gap-2"
                            >
                                <LogOut className="h-4.5 w-4.5" /> Log Out Session
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. Option 6 App Switcher bottom sheet (triggered by bottom-nav arrow button) */}
                {isOption6AppMenuOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[96] flex flex-col justify-end">
                        <div className="bg-white dark:bg-zinc-900 rounded-t-[28px] p-4 space-y-4 border-t border-zinc-200 dark:border-zinc-800">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Allowed App Access</h4>
                                <button 
                                    onClick={() => setIsOption6AppMenuOpen(false)}
                                    className="p-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-full"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <div className="space-y-2 text-left">
                                {accessFarm && (
                                    <button 
                                        onClick={() => handleAppSwitch("farm")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "farm" ? "border-emerald-500 bg-emerald-50/20 text-emerald-600 font-bold" : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <span className="flex items-center gap-2"><Tractor className="h-4 w-4" /> Farm Operations</span>
                                        {currentApp === "farm" && <Check className="h-4 w-4 text-emerald-600" />}
                                    </button>
                                )}

                                {accessWarehouse && (
                                    <button 
                                        onClick={() => handleAppSwitch("warehouse")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "warehouse" ? "border-amber-500 bg-amber-50/20 text-amber-600 font-bold" : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <span className="flex items-center gap-2"><Warehouse className="h-4 w-4" /> Warehouse Operations</span>
                                        {currentApp === "warehouse" && <Check className="h-4 w-4 text-amber-600" />}
                                    </button>
                                )}

                                {accessLab && (
                                    <button 
                                        onClick={() => handleAppSwitch("lab")}
                                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                                            currentApp === "lab" ? "border-indigo-500 bg-indigo-50/20 text-indigo-600 font-bold" : "border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> LAB Testing Assay</span>
                                        {currentApp === "lab" && <Check className="h-4 w-4 text-indigo-600" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Central Location Context Selector Modal */}
                {isLocationSelectorOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[100] flex flex-col justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 space-y-4 shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90%] overflow-y-auto">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-405">Context Switcher</h4>
                                <button onClick={() => setIsLocationSelectorOpen(false)} className="p-1 hover:bg-zinc-100 rounded-full">
                                    <X className="h-4 w-4 text-zinc-405" />
                                </button>
                            </div>

                            <div className="space-y-3 text-left">
                                <div className="space-y-1 text-xs">
                                    <span className="text-zinc-500 font-medium">Franchise</span>
                                    <select 
                                        value={selectedFranchise} 
                                        onChange={(e) => setSelectedFranchise(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100"
                                    >
                                        <option value="North India">North India Operations</option>
                                        <option value="South India">South India Operations</option>
                                    </select>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="text-zinc-500 font-medium">Active Base</span>
                                    <select 
                                        value={selectedBase} 
                                        onChange={(e) => setSelectedBase(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100"
                                    >
                                        {bases.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="text-zinc-500 font-medium">Active Village (Farm App Scope)</span>
                                    <select 
                                        value={selectedVillage} 
                                        onChange={(e) => setSelectedVillage(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100"
                                    >
                                        {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="text-zinc-500 font-medium">Active Warehouse Context</span>
                                    <select 
                                        value={selectedWarehouse} 
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100"
                                    >
                                        {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <span className="text-zinc-500 font-medium">Active Lab Context</span>
                                    <select 
                                        value={selectedLab} 
                                        onChange={(e) => setSelectedLab(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-960 border border-zinc-210 dark:border-zinc-810 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100"
                                    >
                                        {labs.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <Button 
                                className="w-full bg-mati-gold hover:bg-yellow-600 text-white text-xs font-semibold rounded-xl"
                                onClick={() => setIsLocationSelectorOpen(false)}
                            >
                                Apply Location Context
                            </Button>
                        </div>
                    </div>
                )}

                {/* 6. Page Info Modal Popover (when clicking 'i' button next to page title) */}
                {isPageInfoOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[101] flex flex-col justify-center p-4 select-none">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 space-y-4 shadow-xl border border-zinc-200 dark:border-zinc-800">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Page Information</h4>
                                <button onClick={() => setIsPageInfoOpen(false)} className="p-1 hover:bg-zinc-100 rounded-full">
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl text-xs space-y-2 text-left">
                                <span className="text-[10px] uppercase font-bold text-mati-gold flex items-center gap-1">
                                    <Info className="h-3.5 w-3.5" /> Operations Scope
                                </span>
                                <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed font-medium">
                                    {selectedInfoText}
                                </p>
                            </div>

                            <Button 
                                className="w-full bg-mati-gold hover:bg-yellow-600 text-white text-xs font-semibold rounded-xl"
                                onClick={() => setIsPageInfoOpen(false)}
                            >
                                Got it
                            </Button>
                        </div>
                    </div>
                )}

                {/* 7. Option 7 App and Location Selector Modal */}
                {isOption7SelectorOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[100] flex flex-col justify-end transition-all duration-300">
                        <div className="bg-white dark:bg-zinc-900 rounded-t-[28px] p-4 space-y-4 max-h-[90%] overflow-y-auto border-t border-zinc-200 dark:border-zinc-800 text-left">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                                    <Settings className="h-4 w-4 text-mati-gold" />
                                    Mati Module Switcher
                                </h4>
                                <button 
                                    onClick={() => setIsOption7SelectorOpen(false)}
                                    className="p-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-full"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-400 leading-tight">Switch your active app module and update your location coordinates.</p>
                            
                            {/* App Selector Grid */}
                            <div className="space-y-1.5">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block px-1">Application Module</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {accessFarm && (
                                        <button 
                                            onClick={() => {
                                                handleAppSwitch("farm")
                                                setIsOption7SelectorOpen(false)
                                            }}
                                            className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-semibold transition-all ${
                                                currentApp === "farm" ? "border-emerald-500 bg-emerald-50/10 text-emerald-600 font-bold" : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <Tractor className="h-4 w-4 text-emerald-600" />
                                            <span>Mati Farm</span>
                                        </button>
                                    )}

                                    {accessWarehouse && (
                                        <button 
                                            onClick={() => {
                                                handleAppSwitch("warehouse")
                                                setIsOption7SelectorOpen(false)
                                            }}
                                            className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-semibold transition-all ${
                                                currentApp === "warehouse" ? "border-amber-500 bg-amber-50/10 text-amber-600 font-bold" : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <Warehouse className="h-4 w-4 text-amber-600" />
                                            <span>Warehouse</span>
                                        </button>
                                    )}

                                    {accessLab && (
                                        <button 
                                            onClick={() => {
                                                handleAppSwitch("lab")
                                                setIsOption7SelectorOpen(false)
                                            }}
                                            className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-semibold transition-all ${
                                                currentApp === "lab" ? "border-indigo-500 bg-indigo-50/10 text-indigo-600 font-bold" : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50"
                                            }`}
                                        >
                                            <FlaskConical className="h-4 w-4 text-indigo-600" />
                                            <span>Mati LAB</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Location Context Selector */}
                            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block px-1">Location Coordinates</span>
                                
                                <div className="space-y-1 text-[11.5px]">
                                    <span className="text-zinc-500 font-medium px-1">Franchise Territory</span>
                                    <select 
                                        value={selectedFranchise} 
                                        onChange={(e) => setSelectedFranchise(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100 text-xs"
                                    >
                                        <option value="North India">North India Operations</option>
                                        <option value="South India">South India Operations</option>
                                    </select>
                                </div>

                                <div className="space-y-1 text-[11.5px]">
                                    <span className="text-zinc-500 font-medium px-1">Regional Base</span>
                                    <select 
                                        value={selectedBase} 
                                        onChange={(e) => setSelectedBase(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100 text-xs"
                                    >
                                        {bases.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                {currentApp === "farm" && (
                                    <div className="space-y-1 text-[11.5px]">
                                        <span className="text-zinc-500 font-medium px-1">Assigned Village</span>
                                        <select 
                                            value={selectedVillage} 
                                            onChange={(e) => setSelectedVillage(e.target.value)}
                                            className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100 text-xs"
                                        >
                                            {villages.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                )}

                                {currentApp === "warehouse" && (
                                    <div className="space-y-1 text-[11.5px]">
                                        <span className="text-zinc-500 font-medium px-1">Storage Warehouse</span>
                                        <select 
                                            value={selectedWarehouse} 
                                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                                            className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100 text-xs"
                                        >
                                            {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                )}

                                {currentApp === "lab" && (
                                    <div className="space-y-1 text-[11.5px]">
                                        <span className="text-zinc-500 font-medium px-1">Testing Lab Depot</span>
                                        <select 
                                            value={selectedLab} 
                                            onChange={(e) => setSelectedLab(e.target.value)}
                                            className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-205 dark:border-zinc-805 rounded-xl p-2 outline-none text-zinc-900 dark:text-zinc-100 text-xs"
                                        >
                                            {labs.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsOption7SelectorOpen(false)}
                                className="w-full py-2.5 mt-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                )}

                {/* 8. Option 8 Centered Location Selector Modal */}
                {isOption8LocationModalOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[100] flex flex-col justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-[28px] p-5 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-visible text-left">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                                    <MapPin className="h-4.5 w-4.5 text-[#559BE1]" />
                                    <span>Location Context</span>
                                </h4>
                                <button 
                                    onClick={() => setIsOption8LocationModalOpen(false)}
                                    className="p-1 bg-zinc-100 dark:bg-zinc-805 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-400 leading-tight">Configure your geographic operations scope below.</p>

                            <div className="space-y-3">
                                {/* Franchise Selector */}
                                <div className="space-y-1 text-[11px] relative">
                                    <span className="text-zinc-500 font-medium px-1">Franchise</span>
                                    <button
                                        onClick={() => {
                                            setIsFranchiseDropdownOpen(!isFranchiseDropdownOpen);
                                            setIsBaseDropdownOpen(false);
                                            setIsSubLocationDropdownOpen(false);
                                            setFranchiseSearch("");
                                        }}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 flex items-center justify-between text-zinc-900 dark:text-zinc-100 text-xs font-semibold text-left outline-none"
                                    >
                                        <span>{selectedFranchise}</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                                    </button>
                                    
                                    {isFranchiseDropdownOpen && (
                                        <div className="absolute top-[52px] left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={franchiseSearch}
                                                    onChange={(e) => setFranchiseSearch(e.target.value)}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-lg pl-7 pr-3 py-1.5 outline-none text-[10px] font-semibold text-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>
                                            <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                                                {["North India", "South India"]
                                                    .filter(opt => opt.toLowerCase().includes(franchiseSearch.toLowerCase()))
                                                    .map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => {
                                                                setSelectedFranchise(opt);
                                                                setIsFranchiseDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                                                                selectedFranchise === opt 
                                                                    ? "bg-[#559BE1]/10 text-[#559BE1]" 
                                                                    : "text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                            }`}
                                                        >
                                                            <span>{opt}</span>
                                                            {selectedFranchise === opt && <Check className="h-3.5 w-3.5 text-[#559BE1]" />}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Base Selector */}
                                <div className="space-y-1 text-[11px] relative">
                                    <span className="text-zinc-500 font-medium px-1">Base</span>
                                    <button
                                        onClick={() => {
                                            setIsBaseDropdownOpen(!isBaseDropdownOpen);
                                            setIsFranchiseDropdownOpen(false);
                                            setIsSubLocationDropdownOpen(false);
                                            setBaseSearch("");
                                        }}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 flex items-center justify-between text-zinc-900 dark:text-zinc-100 text-xs font-semibold text-left outline-none"
                                    >
                                        <span>{selectedBase}</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                                    </button>
                                    
                                    {isBaseDropdownOpen && (
                                        <div className="absolute top-[52px] left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={baseSearch}
                                                    onChange={(e) => setBaseSearch(e.target.value)}
                                                    className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-150 dark:border-zinc-850 rounded-lg pl-7 pr-3 py-1.5 outline-none text-[10px] font-semibold text-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>
                                            <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                                                {bases
                                                    .filter(opt => opt.toLowerCase().includes(baseSearch.toLowerCase()))
                                                    .map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => {
                                                                setSelectedBase(opt);
                                                                setIsBaseDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                                                                selectedBase === opt 
                                                                    ? "bg-[#559BE1]/10 text-[#559BE1]" 
                                                                    : "text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                            }`}
                                                        >
                                                            <span>{opt}</span>
                                                            {selectedBase === opt && <Check className="h-3.5 w-3.5 text-[#559BE1]" />}
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Sub-location Selector */}
                                {currentApp !== "hub" && (
                                    <div className="space-y-1 text-[11px] relative">
                                        <span className="text-zinc-500 font-medium px-1">
                                            {currentApp === "farm" ? "Village" : currentApp === "warehouse" ? "Source" : "Lab"}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setIsSubLocationDropdownOpen(!isSubLocationDropdownOpen);
                                                setIsFranchiseDropdownOpen(false);
                                                setIsBaseDropdownOpen(false);
                                                setSubLocationSearch("");
                                            }}
                                            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 flex items-center justify-between text-zinc-900 dark:text-zinc-100 text-xs font-semibold text-left outline-none"
                                        >
                                            <span>
                                                {currentApp === "farm" ? selectedVillage : currentApp === "warehouse" ? selectedWarehouse : selectedLab}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                                        </button>
                                        
                                        {isSubLocationDropdownOpen && (
                                            <div className="absolute top-[52px] left-0 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 space-y-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-zinc-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search..."
                                                        value={subLocationSearch}
                                                        onChange={(e) => setSubLocationSearch(e.target.value)}
                                                        className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-150 dark:border-zinc-855 rounded-lg pl-7 pr-3 py-1.5 outline-none text-[10px] font-semibold text-zinc-900 dark:text-zinc-100"
                                                    />
                                                </div>
                                                <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                                                    {(currentApp === "farm" ? villages : currentApp === "warehouse" ? warehouses : labs)
                                                        .filter(opt => opt.toLowerCase().includes(subLocationSearch.toLowerCase()))
                                                        .map(opt => {
                                                            const currentVal = currentApp === "farm" ? selectedVillage : currentApp === "warehouse" ? selectedWarehouse : selectedLab;
                                                            return (
                                                                <button
                                                                    key={opt}
                                                                    onClick={() => {
                                                                        if (currentApp === "farm") setSelectedVillage(opt);
                                                                        else if (currentApp === "warehouse") setSelectedWarehouse(opt);
                                                                        else if (currentApp === "lab") setSelectedLab(opt);
                                                                        setIsSubLocationDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                                                                        currentVal === opt 
                                                                            ? "bg-[#559BE1]/10 text-[#559BE1]" 
                                                                            : "text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                                    }`}
                                                                >
                                                                    <span>{opt}</span>
                                                                    {currentVal === opt && <Check className="h-3.5 w-3.5 text-[#559BE1]" />}
                                                                </button>
                                                            )
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsOption8LocationModalOpen(false)}
                                className="w-full py-3 bg-[#559BE1] hover:bg-blue-600 text-white rounded-full text-xs font-bold transition-all text-center cursor-pointer shadow-md mt-2"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                )}

                {/* 9. Option 9 Centered App Switcher Popup Modal */}
                {isOption9AppModalOpen && (
                    <div className="absolute inset-0 bg-black/60 z-[100] flex flex-col justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-[28px] p-5 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-left">
                            
                            <div className="flex justify-between items-center pb-1">
                                <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
                                    <Smartphone className="h-4.5 w-4.5 text-[#559BE1]" />
                                    <span>Switch App Module</span>
                                </h4>
                                <button 
                                    onClick={() => setIsOption9AppModalOpen(false)}
                                    className="p-1 bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-400 leading-tight">Choose which application workspace to view.</p>

                            <div className="grid grid-cols-3 gap-2 py-2">
                                {accessFarm && (
                                    <button 
                                        onClick={() => {
                                            handleAppSwitch("farm")
                                            setIsOption9AppModalOpen(false)
                                        }}
                                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                            currentApp === "farm" 
                                                ? "border-[#2D7F4B] bg-[#2D7F4B]/10 text-[#2D7F4B]" 
                                                : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                                        }`}
                                    >
                                        <Tractor className="h-4.5 w-4.5 text-[#2D7F4B]" />
                                        <span>Farm App</span>
                                    </button>
                                )}

                                {accessWarehouse && (
                                    <button 
                                        onClick={() => {
                                            handleAppSwitch("warehouse")
                                            setIsOption9AppModalOpen(false)
                                        }}
                                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                            currentApp === "warehouse" 
                                                ? "border-[#C08A0E] bg-[#C08A0E]/10 text-[#C08A0E]" 
                                                : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                                        }`}
                                    >
                                        <Warehouse className="h-4.5 w-4.5 text-[#C08A0E]" />
                                        <span>Warehouse</span>
                                    </button>
                                )}

                                {accessLab && (
                                    <button 
                                        onClick={() => {
                                            handleAppSwitch("lab")
                                            setIsOption9AppModalOpen(false)
                                        }}
                                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 text-[10px] font-bold transition-all ${
                                            currentApp === "lab" 
                                                ? "border-[#6B46C1] bg-[#6B46C1]/10 text-[#6B46C1]" 
                                                : "border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-855"
                                        }`}
                                    >
                                        <FlaskConical className="h-4.5 w-4.5 text-[#6B46C1]" />
                                        <span>Lab Testing</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    // ----------------------------------------------------
    // Bottom Bar rendering based on selected NavOption
    // ----------------------------------------------------
    function renderSimulatorBottomBar() {
        if (isProfileOpen || activeStaticPage) return null

        // Variant 1 & Variant 2: Standard bottom tabs
        if (navOption === 8 || navOption === 9) {
            return renderBottomBarTabs()
        }

        return null
    }

    // Standard sub-page tabs (Option 1, 3, 5)
    function renderBottomBarTabs() {
        const getTabs = () => {
            if (currentApp === "farm") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "farmers", label: "Farmers", icon: User },
                    { id: "equipment", label: "Equipment", icon: Settings },
                    { id: "villages", label: "Villages", icon: MapPin }
                ]
            }
            if (currentApp === "warehouse") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "requests", label: "Requests", icon: FileText }
                ]
            }
            if (currentApp === "lab") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "samples", label: "Samples", icon: FlaskConical },
                    { id: "crates", label: "Crates", icon: Box },
                    { id: "shipments", label: "Shipments", icon: Truck }
                ]
            }
            return []
        }

        const tabs = getTabs()
        if (tabs.length === 0) return null

        const theme = getAppThemeColor(currentApp)
        const isIOS = platform === "ios"

        return (
            <div className={`absolute w-full bg-white dark:bg-zinc-955 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-around z-40 ${
                isIOS ? "bottom-0 h-14 pb-3 pt-1 px-2" : "bottom-8 h-12 text-[10px]"
            }`}>
                {tabs.map((tab) => {
                    const isActive = currentPage === tab.id
                    const Icon = tab.icon
                    
                    let activeColor = "text-emerald-600"
                    if (theme === "amber") activeColor = "text-amber-600"
                    if (theme === "indigo") activeColor = "text-indigo-600"

                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setCurrentPage(tab.id)
                                setIsProfileOpen(false)
                                setActiveTaskDetail(null)
                            }}
                            className={`flex flex-col items-center justify-center flex-1 transition-all ${
                                isActive ? activeColor : "text-zinc-400 hover:text-zinc-650"
                            }`}
                        >
                            <Icon className={`${isIOS ? "h-4.5 w-4.5" : "h-4 w-4"}`} />
                            <span className="text-[9px] mt-0.5 font-medium">{tab.label}</span>
                        </button>
                    )
                })}
            </div>
        )
    }

    // Option 2 Bottom Bar: [Home] [Search] [APP SWITCHER] [Profile]
    function renderUnifiedBottomBarOption2() {
        const isIOS = platform === "ios"
        const themeColor = getAppThemeColor(currentApp)
        
        let activeText = "text-emerald-600"
        if (themeColor === "amber") activeText = "text-amber-600"
        if (themeColor === "indigo") activeText = "text-indigo-600"

        return (
            <div className={`absolute bottom-0 w-full bg-white dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-around z-40 ${
                isIOS ? "h-14 pb-3 pt-1 px-2" : "h-12"
            }`}>
                <button
                    onClick={() => {
                        setCurrentPage("home")
                        setIsProfileOpen(false)
                        setActiveTaskDetail(null)
                    }}
                    className={`flex flex-col items-center justify-center flex-1 transition-all ${
                        currentPage === "home" ? activeText : "text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                    <Home className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">Home</span>
                </button>

                <button
                    onClick={() => {
                        if (currentApp === "farm") setCurrentPage("farmers")
                        else if (currentApp === "warehouse") setCurrentPage("requests")
                        else if (currentApp === "lab") setCurrentPage("samples")
                        setIsProfileOpen(false)
                        setActiveTaskDetail(null)
                    }}
                    className={`flex flex-col items-center justify-center flex-1 transition-all ${
                        currentPage !== "home" ? activeText : "text-zinc-400 hover:text-zinc-605"
                    }`}
                >
                    {currentApp === "farm" ? <User className="h-4.5 w-4.5" /> : 
                     currentApp === "warehouse" ? <FileText className="h-4.5 w-4.5" /> : <FlaskConical className="h-4.5 w-4.5" />}
                    <span className="text-[9px] mt-0.5 font-medium">
                        {currentApp === "farm" ? "Farmers" : 
                         currentApp === "warehouse" ? "Requests" : "Samples"}
                    </span>
                </button>

                {/* Central Switch App Button */}
                <button
                    onClick={() => setIsSwitcherOpen(true)}
                    className="flex flex-col items-center justify-center flex-1 relative -top-3 shrink-0"
                >
                    <div className="h-10 w-10 rounded-full bg-mati-gold shadow-lg flex items-center justify-center text-white hover:bg-yellow-600 transition-colors border-2 border-white dark:border-zinc-950">
                        <RefreshCw className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[9px] font-bold text-mati-gold mt-1">Switch App</span>
                </button>

                {/* Scope trigger */}
                <button
                    onClick={() => setIsLocationSelectorOpen(true)}
                    className="flex flex-col items-center justify-center flex-1 text-zinc-400 hover:text-zinc-650"
                >
                    <MapPin className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">Location</span>
                </button>

                {/* Profile tab */}
                <button
                    onClick={() => setIsProfileOpen(true)}
                    className="flex flex-col items-center justify-center flex-1 text-zinc-400 hover:text-zinc-600"
                >
                    <User className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">Profile</span>
                </button>
            </div>
        )
    }

    // Option 4 Bottom Bar: [My Day] [Sync Hub] [Profile]
    function renderUnifiedBottomBarOption4() {
        const isIOS = platform === "ios"
        return (
            <div className={`absolute bottom-0 w-full bg-white dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-855 flex items-center justify-around z-40 ${
                isIOS ? "h-14 pb-3 pt-1 px-2" : "h-12"
            }`}>
                <button
                    onClick={() => {
                        setCurrentPage("feed")
                        setIsProfileOpen(false)
                        setActiveTaskDetail(null)
                    }}
                    className={`flex flex-col items-center justify-center flex-1 transition-all ${
                        currentPage === "feed" ? "text-mati-gold" : "text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                    <Calendar className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">My Day</span>
                </button>

                <button
                    onClick={() => {
                        setIsLocationSelectorOpen(true)
                    }}
                    className="flex flex-col items-center justify-center flex-1 text-zinc-400 hover:text-zinc-650"
                >
                    <MapPin className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">Scope</span>
                </button>

                <button
                    onClick={() => setIsProfileOpen(true)}
                    className="flex flex-col items-center justify-center flex-1 text-zinc-400 hover:text-zinc-600"
                >
                    <User className="h-4.5 w-4.5" />
                    <span className="text-[9px] mt-0.5 font-medium">Profile</span>
                </button>
            </div>
        )
    }

    // Option 6 Bottom Bar: Renders page sub-tabs + Arrow App Switcher tab in the right corner
    function renderOption6BottomBar() {
        const isIOS = platform === "ios"
        const appTheme = getAppThemeColor(currentApp)
        
        let activeColor = "text-emerald-600"
        if (appTheme === "amber") activeColor = "text-amber-600"
        if (appTheme === "indigo") activeColor = "text-indigo-600"

        const getOption6Tabs = () => {
            if (currentApp === "farm") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "farmers", label: "Farmers", icon: User },
                    { id: "equipment", label: "Equipment", icon: Settings },
                ]
            }
            if (currentApp === "warehouse") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "requests", label: "Requests", icon: FileText }
                ]
            }
            if (currentApp === "lab") {
                return [
                    { id: "home", label: "Home", icon: Home },
                    { id: "samples", label: "Samples", icon: FlaskConical },
                    { id: "crates", label: "Crates", icon: Box },
                ]
            }
            return []
        }

        const tabs = getOption6Tabs()

        return (
            <div className="absolute bottom-0 w-full bg-white dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-850 flex flex-col z-40 select-none">
                {/* Switch App pull-up handle strip in top center */}
                <button
                    onClick={() => setIsOption6AppMenuOpen(true)}
                    className="w-full h-4.5 flex items-center justify-center border-b border-zinc-100/30 dark:border-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 cursor-pointer"
                >
                    <ChevronUp className="h-3.5 w-3.5" />
                </button>

                {/* Regular App Subpages */}
                <div className={`w-full flex items-center justify-around ${
                    isIOS ? "h-13 pb-2.5 pt-1 px-2" : "h-11"
                }`}>
                    {tabs.map((tab) => {
                        const isActive = currentPage === tab.id
                        const Icon = tab.icon

                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setCurrentPage(tab.id)
                                    setIsProfileOpen(false)
                                    setActiveTaskDetail(null)
                                }}
                                className={`flex flex-col items-center justify-center flex-1 transition-all ${
                                    isActive ? activeColor : "text-zinc-400 hover:text-zinc-650"
                                }`}
                            >
                                <Icon className={`${isIOS ? "h-4.5 w-4.5" : "h-4 w-4"}`} />
                                <span className="text-[9px] mt-0.5 font-medium">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        )
    }

    // ----------------------------------------------------
    // Design Breakdown Panel Rendering
    // ----------------------------------------------------
    function renderDesignDetails() {
        switch (navOption) {
            case 8:
                return (
                    <div className="space-y-4 text-left text-sm">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-955 rounded-xl border border-zinc-155 dark:border-zinc-855">
                            <span className="font-semibold text-zinc-850 dark:text-zinc-205 block">Variant 1: Drawer & Header Dialog</span>
                            <p className="text-xs text-zinc-550 mt-1 leading-relaxed">
                                Hamburger menu drawer hosts App Links and information links. Header displays active app and location details with a refresh arrows icon to trigger a centered context change dialog. Profile dropdown menu handles user details and quick app swapper switches.
                            </p>
                        </div>

                        <div className="space-y-1.5 text-xs text-zinc-500">
                            <div className="flex justify-between"><span>iOS Suitability:</span> <span className="font-semibold text-emerald-600">Very Good</span></div>
                            <div className="flex justify-between"><span>Android Suitability:</span> <span className="font-semibold text-emerald-600">Excellent</span></div>
                            <div className="flex justify-between"><span>Information Division:</span> <span className="font-semibold text-emerald-600">Balanced</span></div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                            <p className="text-emerald-600 flex items-start gap-1"><span className="font-bold">+</span> <span>Clear division: locations in center popup, app links in hamburger drawer, swapper in profile dropdown.</span></p>
                            <p className="text-red-500 flex items-start gap-1"><span className="font-bold">-</span> <span>Distributes configuration controls across multiple distinct icons.</span></p>
                        </div>
                    </div>
                )
            case 9:
                return (
                    <div className="space-y-4 text-left text-sm">
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-955 rounded-xl border border-zinc-155 dark:border-zinc-855">
                            <span className="font-semibold text-zinc-850 dark:text-zinc-205 block">Variant 2: Hamburger + Profile Swapper Page</span>
                            <p className="text-xs text-zinc-550 mt-1 leading-relaxed">
                                Drawer hosts App Links (routing to dedicated details page) and static pages. Profile initials button navigates to settings screen containing an active app switcher card. Card triggers a centered swapper popup.
                            </p>
                        </div>

                        <div className="space-y-1.5 text-xs text-zinc-500">
                            <div className="flex justify-between"><span>iOS Suitability:</span> <span className="font-semibold text-emerald-600">Very Good (Dedicated settings screen)</span></div>
                            <div className="flex justify-between"><span>Android Suitability:</span> <span className="font-semibold text-emerald-600">Excellent</span></div>
                            <div className="flex justify-between"><span>App Swapping:</span> <span className="font-semibold text-emerald-600">Clean & Focused</span></div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                            <p className="text-emerald-600 flex items-start gap-1"><span className="font-bold">+</span> <span>Moving app switcher into the settings screen reduces main screen UI clutter.</span></p>
                            <p className="text-red-500 flex items-start gap-1"><span className="font-bold">-</span> <span>Requires navigating to profile settings page to perform app switches.</span></p>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }
}
