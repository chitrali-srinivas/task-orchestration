"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { data } from "./nav-data"
import {
    ChevronRight,
    ChevronDown,
    ChevronUp,
    LogOut,
    User,
    ClipboardList,
    HelpCircle,
    Bug,
    Info,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
} from "@/components/ui/sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NavMain } from "./components/nav-main"
import { TeamSwitcher } from "@/components/team-switcher"
import { NavProjects } from "@/components/nav-projects"
import Image from "next/image"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"

export function NavBarType4({ children, pageTitle = "Page title", activeItemUrl: initialActiveItemUrl, pageDescription }: { children?: React.ReactNode, pageTitle?: string, activeItemUrl?: string, pageDescription?: string }) {
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
                <div className="w-[16rem] border-r bg-white dark:bg-zinc-900 hidden md:block shrink-0" />
                <div className="flex-1 flex flex-col min-w-0">
                    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 bg-white dark:bg-zinc-900" />
                    <div className="flex-1 overflow-hidden">{children}</div>
                </div>
            </div>
        )
    }

    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <NavBarType4Content pageTitle={pageTitle} initialActiveItemUrl={initialActiveItemUrl} pageDescription={pageDescription}>{children}</NavBarType4Content>
        </React.Suspense>
    )
}

function NavBarType4Content({ children, pageTitle, initialActiveItemUrl, pageDescription }: { children?: React.ReactNode, pageTitle: string, initialActiveItemUrl?: string, pageDescription?: string }) {
    const searchParams = useSearchParams()
    const rolesParam = searchParams.get('roles')
    const selectedRoles = rolesParam ? rolesParam.split(',') : null

    const [activeItemUrl, setActiveItemUrl] = React.useState(initialActiveItemUrl || "#dashboard")
    const [isProfileOpen, setIsProfileOpen] = React.useState(false)
    const [isFranchiseOpen, setIsFranchiseOpen] = React.useState(false)

    const filterItems = (items: any[]) => {
        if (!selectedRoles) return items
        return items.filter(item => {
            if (!item.roles) return true
            return item.roles.some((r: any) => selectedRoles.some(sr => sr === r))
        })
    }

    const updateActiveItem = (url: string) => {
        setActiveItemUrl(url)
    }

    const filteredNavMain = filterItems(data.navMain)
    const filteredAdmin = filterItems(data.admin)
    const filteredHqVerifier = filterItems(data.hqVerifier || [])
    const filteredHqAdmin = filterItems(data.hqAdmin || [])

    return (
        <SidebarProvider>
            <AppSidebar 
                navMain={filteredNavMain} 
                admin={filteredAdmin} 
                hqVerifier={filteredHqVerifier}
                hqAdmin={filteredHqAdmin}
                activeItemUrl={activeItemUrl}
                onItemClick={updateActiveItem}
                isFranchiseOpen={isFranchiseOpen}
                setIsFranchiseOpen={setIsFranchiseOpen}
            />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 min-w-0 w-full overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
                            <BreadcrumbList className="flex-nowrap overflow-hidden">
                                <BreadcrumbItem className="flex items-center gap-2 min-w-0 overflow-hidden">
                                    <BreadcrumbPage className="text-lg font-semibold text-zinc-900 truncate shrink-0">{pageTitle}</BreadcrumbPage>
                                    {pageDescription && (
                                        <TooltipProvider>
                                            <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                    <button className="inline-flex items-center justify-center rounded-full w-5 h-5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors translate-y-[1px] shrink-0">
                                                        <Info className="w-4 h-4" />
                                                        <span className="sr-only">About {pageTitle}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="max-w-[280px] p-3 text-xs leading-relaxed">
                                                    <p className="font-medium mb-1">{pageTitle} Management</p>
                                                    <p className="text-zinc-500 dark:text-zinc-400">
                                                        {pageDescription}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>

                <div className="flex items-center gap-4 shrink-0 ml-auto">
                        <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                            <DropdownMenuTrigger asChild>
                                <button className={cn(
                                    "flex items-center gap-3 text-left outline-none p-1.5 rounded-md transition-all group",
                                    isProfileOpen ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                                )}>
                                    <Avatar className="h-9 w-9 rounded-lg border transition-transform group-active:scale-95">
                                        <AvatarImage src="https://github.com/shadcn.png" alt={data.user.name} />
                                        <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-zinc-900 leading-tight">{data.user.name}</span>
                                        <span className="text-xs text-zinc-500 leading-tight">{data.user.email}</span>
                                    </div>
                                    <ChevronDown className={cn(
                                        "ml-1 h-4 w-4 text-zinc-400 transition-all group-hover:text-zinc-900",
                                        isProfileOpen && "rotate-180 text-zinc-900"
                                    )} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 p-2">
                                <DropdownMenuItem className="gap-2">
                                    <User className="h-4 w-4" /> Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                    <ClipboardList className="h-4 w-4" /> Manage
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                    <HelpCircle className="h-4 w-4" /> Help
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                    <Bug className="h-4 w-4" /> Report a bug
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                    <Info className="h-4 w-4" /> About us
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-700">
                                    <LogOut className="h-4 w-4" /> Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <div className="flex flex-1 flex-col overflow-hidden">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

function AppSidebar({ 
    navMain, 
    admin, 
    hqVerifier,
    hqAdmin,
    activeItemUrl,
    onItemClick,
    isFranchiseOpen,
    setIsFranchiseOpen,
    ...props 
}: React.ComponentProps<typeof Sidebar> & { 
    navMain: any[], 
    admin: any[],
    hqVerifier: any[],
    hqAdmin: any[],
    activeItemUrl?: string,
    onItemClick?: (url: string) => void,
    isFranchiseOpen: boolean,
    setIsFranchiseOpen: (open: boolean) => void
}) {
    const [search, setSearch] = React.useState("")
    const [selectedFranchises, setSelectedFranchises] = React.useState<string[]>(["Franchise B", "Franchise D"])

    const franchises = [
        "Franchise A",
        "Franchise B",
        "Franchise C",
        "Franchise D",
        "Franchise E",
    ]

    const filteredFranchises = franchises.filter(f => 
        f.toLowerCase().includes(search.toLowerCase())
    )

    const toggleFranchise = (name: string) => {
        setSelectedFranchises(prev => 
            prev.includes(name) 
                ? prev.filter(f => f !== name)
                : [...prev, name]
        )
    }

    // Convert nav-data structure to match sidebar-07 expectations
    const projects = data.bases.map(base => ({
        name: base.name,
        url: "#",
        icon: base.logo,
    }))

    const others = (data as any).others || []

    return (
        <Sidebar collapsible="icon" className="bg-white border-r group/nav" {...props}>
            {/* Collapse / expand: appears when hovering the sidebar (the rail on the edge toggles it too) */}
            <SidebarTrigger
                className="absolute right-1 top-2 z-10 h-6 w-6 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-900 group-hover/nav:opacity-100 group-data-[collapsible=icon]:static group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:mt-2"
            />
            <SidebarHeader className="bg-white">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Dialog open={isFranchiseOpen} onOpenChange={setIsFranchiseOpen}>
                            <DialogTrigger asChild>
                                <SidebarMenuButton 
                                    size="lg" 
                                    className={cn(
                                        "text-left outline-none p-1.5 rounded-md transition-all group h-auto",
                                        isFranchiseOpen ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                                    )}
                                >
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg transition-transform group-active:scale-95">
                                        <Image
                                            src="/MATI LOGO G.png"
                                            alt="Mati Logo"
                                            width={24}
                                            height={24}
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold text-zinc-900 leading-tight">Mati Carbon</span>
                                        <span className="truncate text-xs text-zinc-500 font-normal leading-tight">Franchise name</span>
                                    </div>
                                </SidebarMenuButton>
                            </DialogTrigger>
                            <DialogContent 
                                className="sm:max-w-[480px] p-0 overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl gap-0 z-[500]"
                                onPointerDownOutside={(e) => e.preventDefault()}
                                onEscapeKeyDown={(e) => e.preventDefault()}
                            >
                                <DialogHeader className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
                                            <Image
                                                src="/MATI LOGO G.png"
                                                alt="Mati Logo"
                                                width={28}
                                                height={28}
                                                className="object-contain"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-50 leading-none">Select Franchise</DialogTitle>
                                            <DialogDescription className="text-xs text-zinc-500 font-medium leading-none">
                                                Choose franchises to filter your dashboard.
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <div className="px-6 pb-6 space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                        <input
                                            placeholder="Search franchises..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="flex h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 pl-10 pr-4 py-2 text-sm shadow-none transition-all placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 focus-visible:border-transparent"
                                        />
                                    </div>

                                    <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                                        <ScrollArea className="h-[280px]">
                                            <div className="p-1 space-y-0.5">
                                                {filteredFranchises.length === 0 ? (
                                                    <div className="py-12 text-center flex flex-col items-center gap-2">
                                                        <Search className="h-8 w-8 text-zinc-200 dark:text-zinc-800" />
                                                        <p className="text-sm text-zinc-500 font-medium">No franchises found</p>
                                                    </div>
                                                ) : (
                                                    filteredFranchises.map((franchise) => (
                                                        <div
                                                            key={franchise}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-md px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-all group border border-transparent",
                                                                selectedFranchises.includes(franchise) && "bg-zinc-50/80 dark:bg-zinc-900/80"
                                                            )}
                                                            onClick={() => toggleFranchise(franchise)}
                                                        >
                                                            <Checkbox 
                                                                checked={selectedFranchises.includes(franchise)}
                                                                onCheckedChange={() => toggleFranchise(franchise)}
                                                                className="h-4 w-4 rounded border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900"
                                                            />
                                                            <div className="flex-1">
                                                                <span className={cn(
                                                                    "text-sm font-medium transition-colors",
                                                                    selectedFranchises.includes(franchise) ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"
                                                                )}>
                                                                    {franchise}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>

                                <DialogFooter className="p-6 pt-0 flex flex-row items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        className="flex-1 h-10 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all rounded-lg"
                                        onClick={() => setSelectedFranchises([])}
                                    >
                                        Clear All
                                    </Button>
                                        <Button
                                        className="flex-1 h-10 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 transition-all rounded-lg shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                        onClick={() => setIsFranchiseOpen(false)}
                                        disabled={selectedFranchises.length === 0}
                                    >
                                        Apply
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent className="bg-white scrollbar-minimal">
                <NavMain items={navMain} label="Verifier" activeItemUrl={activeItemUrl} onItemClick={onItemClick} />
                
                {admin && admin.length > 0 && (
                    <NavMain items={admin} label="Admin" activeItemUrl={activeItemUrl} onItemClick={onItemClick} />
                )}

                {hqAdmin && hqAdmin.length > 0 && (
                    <NavMain items={hqAdmin} label="HQ Admin" activeItemUrl={activeItemUrl} onItemClick={onItemClick} />
                )}
            </SidebarContent>
            <SidebarFooter className="bg-white p-0">
                {others.length > 0 && (
                    <SidebarGroup className="p-2">
                        <SidebarGroupLabel>Others</SidebarGroupLabel>
                        <SidebarMenu>
                            {others.map((item: any) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title}>
                                        <a href={item.url}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
