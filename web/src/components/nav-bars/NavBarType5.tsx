"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { data } from "./nav-data"
import {
    Bell,
    BookOpen,
    ChevronsUpDown,
    Search,
    Slash,
    User,
    ClipboardList,
    HelpCircle,
    Bug,
    Info,
    LogOut,
    Factory,
    Map,
} from "lucide-react"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Separator } from "@/components/ui/separator"
import { NavMain } from "./components/nav-main"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function NavBarType5({ children }: { children?: React.ReactNode }) {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
            <NavBarType5Content>{children}</NavBarType5Content>
        </React.Suspense>
    )
}

function NavBarType5Content({ children }: { children?: React.ReactNode }) {
    const searchParams = useSearchParams()
    const rolesParam = searchParams.get('roles')
    const selectedRoles = rolesParam ? rolesParam.split(',') : null
    const [activeTopItem, setActiveTopItem] = React.useState<string | null>(null)

    // State for context switchers
    const [activeFranchise, setActiveFranchise] = React.useState(data.franchises[0])
    const [activeBase, setActiveBase] = React.useState(data.bases[0])
    const [selectedVillages, setSelectedVillages] = React.useState<string[]>(["All Villages"])
    const [villageSearch, setVillageSearch] = React.useState("")

    const filterItems = (items: typeof data.navMain) => {
        if (!selectedRoles) return items
        return items.filter(item => {
            if (!item.roles) return true
            return item.roles.some(r => selectedRoles.some(sr => sr === r))
        })
    }

    const filteredNavMain = filterItems(data.navMain)
    const filteredAdmin = filterItems(data.admin)

    const toggleVillage = (villageName: string) => {
        if (villageName === "All Villages") {
            setSelectedVillages(["All Villages"])
            return
        }

        let newSelection = selectedVillages.filter(v => v !== "All Villages")
        if (newSelection.includes(villageName)) {
            newSelection = newSelection.filter(v => v !== villageName)
        } else {
            newSelection = [...newSelection, villageName]
        }

        if (newSelection.length === 0) {
            newSelection = ["All Villages"]
        }

        setSelectedVillages(newSelection)
    }

    const filteredVillages = data.villages.filter(v =>
        v.name.toLowerCase().includes(villageSearch.toLowerCase())
    )

    const customTabs = [
        {
            title: "Qualification",
            description: "Manage farm qualifications and compliance status.",
            icon: Factory,
            items: [
                { title: "Registration", statuses: ["Approved", "Pending"] },
                { title: "Enrolled", statuses: ["Approved", "Pending"] },
                { title: "Qualified", statuses: [] },
                { title: "Disqualified", statuses: [] },
            ]
        },
        {
            title: "Deployment",
            description: "Track and manage resource deployments across farms.",
            icon: Map,
            items: [
                { title: "Deployment", statuses: ["Approved", "Pending"] },
                { title: "Pre-sample", statuses: ["Approved", "Pending"] },
                { title: "Start sample", statuses: ["Approved", "Pending"] },
                { title: "Harvest sample", statuses: ["Approved", "Pending"] },
            ]
        },
        {
            title: "Engagement",
            description: "Monitor farmer engagement and communication logs.",
            icon: ClipboardList,
            items: [
                { title: "Engagement 1", statuses: ["Approved", "Pending"] },
                { title: "Engagement 2", statuses: ["Approved", "Pending"] },
                { title: "Engagement 3", statuses: ["Approved", "Pending"] },
                { title: "Engagement 4", statuses: ["Approved", "Pending"] },
            ]
        },
        {
            title: "Conversation",
            description: "View and manage direct conversations with stakeholders.",
            icon: BookOpen,
            items: [] // No items for Conversation
        }
    ]

    return (
        <SidebarProvider>
            <AppSidebar
                navMain={filteredNavMain}
                admin={filteredAdmin}
                activeFranchise={activeFranchise}
                setActiveFranchise={setActiveFranchise}
            />
            <SidebarInset>
                {/* Top Header - Vercel Style with Sidebar Integration */}
                <header className="sticky top-0 z-30 flex flex-col border-b bg-background">
                    <div className="flex h-16 shrink-0 items-center gap-2 px-4">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />

                            <Breadcrumb className="hidden md:flex">
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="flex items-center gap-2 h-10 px-2 hover:bg-gray-100 data-[state=open]:bg-gray-100">
                                                    <div className="flex flex-col items-start leading-none gap-0.5 text-left">
                                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Base</span>
                                                        <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">{activeBase.name}</span>
                                                    </div>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 text-gray-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-[200px]">
                                                <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Select Base</DropdownMenuLabel>
                                                <div className="p-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Search base..."
                                                            className="h-8 pl-7 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                {data.bases.map((base) => (
                                                    <DropdownMenuItem
                                                        key={base.name}
                                                        onClick={() => setActiveBase(base)}
                                                        className="cursor-pointer"
                                                    >
                                                        {base.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="-rotate-12">
                                        <Slash className="h-4 w-4" />
                                    </BreadcrumbSeparator>
                                    <BreadcrumbItem>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="flex items-center gap-2 h-10 px-2 hover:bg-gray-100 data-[state=open]:bg-gray-100">
                                                    <div className="flex flex-col items-start leading-none gap-0.5 text-left">
                                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Village</span>
                                                        <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">
                                                            {selectedVillages.length === 1 ? selectedVillages[0] : `${selectedVillages.length} Selected`}
                                                        </span>
                                                    </div>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 text-gray-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-[200px]">
                                                <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Select Villages</DropdownMenuLabel>
                                                <div className="p-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Search village..."
                                                            className="h-8 pl-7 text-xs"
                                                            value={villageSearch}
                                                            onChange={(e) => setVillageSearch(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto">
                                                    {filteredVillages.map((village) => {
                                                        const isSelected = selectedVillages.includes(village.name);
                                                        return (
                                                            <DropdownMenuItem
                                                                key={village.name}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    toggleVillage(village.name);
                                                                }}
                                                                className="cursor-pointer flex items-center gap-2"
                                                            >
                                                                <div className={cn(
                                                                    "h-4 w-4 border rounded-sm flex items-center justify-center",
                                                                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                                                                )}>
                                                                    {isSelected && <div className="h-2 w-2 bg-current rounded-full" />}
                                                                </div>
                                                                {village.name}
                                                            </DropdownMenuItem>
                                                        )
                                                    })}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                        </div>

                        {/* Right: Search & Actions */}
                        <div className="ml-auto flex items-center gap-3 md:gap-4">
                            <div className="relative hidden md:block">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    type="search"
                                    placeholder="Search"
                                    className="w-[200px] pl-9 h-8 bg-gray-50 border-gray-200 text-sm placeholder:text-gray-400 focus-visible:ring-gray-200 focus-visible:bg-white transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-black hover:bg-gray-100">
                                    <Bug className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-black hover:bg-gray-100">
                                    <Bell className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-10 flex items-center gap-3 pl-1 pr-2 rounded-full hover:bg-gray-100">
                                            <Avatar className="h-8 w-8 rounded-full border">
                                                <AvatarImage src={data.user.avatar} alt={data.user.name} />
                                                <AvatarFallback>CN</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col items-start text-xs leading-tight">
                                                <span className="font-semibold text-sm">{data.user.name}</span>
                                                <span className="text-gray-500">{data.user.email}</span>
                                            </div>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 text-gray-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <div className="flex items-center gap-3 p-2 mb-2 border-b pb-4">
                                            <Avatar className="h-10 w-10 border">
                                                <AvatarImage src={data.user.avatar} alt={data.user.name} />
                                                <AvatarFallback>CN</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{data.user.name}</span>
                                                <span className="text-xs text-muted-foreground">{data.user.email}</span>
                                            </div>
                                        </div>
                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                            <User className="h-4 w-4" /> Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                            <ClipboardList className="h-4 w-4" /> Manage
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                            <HelpCircle className="h-4 w-4" /> Help
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                            <Bug className="h-4 w-4" /> Report a bug
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                            <Info className="h-4 w-4" /> About us
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="cursor-pointer gap-2 text-red-600 focus:text-red-700">
                                            <LogOut className="h-4 w-4" /> Log out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>

                    {/* Secondary horizontal nav using NavigationMenu */}
                    <div className="flex h-10 items-center px-4 border-t">
                        <NavigationMenu className="justify-start" viewportClassName="justify-start">
                            <NavigationMenuList>
                                {customTabs.map((tab) => (
                                    <NavigationMenuItem key={tab.title}>
                                        <NavigationMenuTrigger
                                            className={cn(
                                                "h-10 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent data-[active]:bg-transparent px-2 text-sm font-medium transition-colors",
                                                activeTopItem === tab.title ? "text-black" : "text-gray-600 hover:text-black",
                                                // Hide chevron for "Conversation"
                                                tab.title === "Conversation" && "[&>svg]:hidden"
                                            )}
                                            onClick={() => setActiveTopItem(tab.title)}
                                        >
                                            <span className={cn(
                                                "relative flex items-center h-full pt-2 pb-2",
                                                activeTopItem === tab.title && "border-b-2 border-black"
                                            )}>
                                                {tab.title}
                                            </span>
                                        </NavigationMenuTrigger>
                                        <NavigationMenuContent className="left-0 top-0 min-w-[320px] w-[360px] md:w-[420px]">
                                            <ul className={cn(
                                                "grid gap-3 p-4",
                                                tab.items && tab.items.length > 0 ? "md:grid-cols-2" : ""
                                            )}>
                                                <li className={cn(tab.items && tab.items.length > 0 ? "row-span-2" : "")}>
                                                    <NavigationMenuLink asChild>
                                                        <a
                                                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-gray-50 to-gray-100 p-4 no-underline outline-none focus:shadow-md border border-gray-100"
                                                            href="#"
                                                        >
                                                            {tab.icon && <tab.icon className="h-6 w-6 text-gray-700 mb-2" />}
                                                            <div className="mb-2 mt-2 text-lg font-medium text-black">
                                                                {tab.title}
                                                            </div>
                                                            <p className="text-sm leading-tight text-gray-600">
                                                                {tab.description}
                                                            </p>
                                                        </a>
                                                    </NavigationMenuLink>
                                                </li>
                                                {tab.items && tab.items.map((item) => (
                                                    <ListItem key={item.title} title={item.title} href="#">
                                                        {item.statuses.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                {item.statuses.map(s => (
                                                                    <Button
                                                                        key={s}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-5 text-[10px] px-2 bg-white hover:bg-gray-50 border-gray-200 text-gray-600"
                                                                    >
                                                                        {s}
                                                                    </Button>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">View details</span>
                                                        )}
                                                    </ListItem>
                                                ))}
                                            </ul>
                                        </NavigationMenuContent>
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 max-w-[1400px] mx-auto w-full">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

function AppSidebar({
    navMain,
    admin,
    activeFranchise,
    setActiveFranchise,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    navMain: any[],
    admin: any[],
    activeFranchise: any,
    setActiveFranchise: (f: any) => void
}) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader className="h-16 border-b p-0 bg-background">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full h-full flex items-center gap-3 px-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                        >
                            <div className="h-8 w-8 flex-shrink-0 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                <img src="/MATI%20LOGO%20G.png" alt="Mati" className="h-5 w-5 object-contain invert dark:invert-0" />
                            </div>
                            <div className="flex flex-col items-start text-left gap-0.5 mr-auto group-data-[collapsible=icon]:hidden">
                                <span className="text-base font-bold leading-none text-zinc-900 dark:text-zinc-100">Mati Carbon</span>
                                <span className="text-xs text-zinc-500 font-normal">{activeFranchise.name}</span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-zinc-400 group-data-[collapsible=icon]:hidden" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[240px] ml-2">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Select Franchise</DropdownMenuLabel>
                        {data.franchises.map((franchise) => (
                            <DropdownMenuItem
                                key={franchise.name}
                                onClick={() => setActiveFranchise(franchise)}
                                className="cursor-pointer gap-2"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{franchise.name}</span>
                                    <span className="text-xs text-muted-foreground">{franchise.plan}</span>
                                </div>
                                {activeFranchise.name === franchise.name && (
                                    <div className="ml-auto h-2 w-2 rounded-full bg-green-500" />
                                )}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navMain} label="Verifier" />
                {admin && admin.length > 0 && <NavMain items={admin} label="Admin" />}
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}

const ListItem = React.forwardRef<
    React.ElementRef<"a">,
    React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
    return (
        <li>
            <NavigationMenuLink asChild>
                <a
                    ref={ref}
                    className={cn(
                        "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        className
                    )}
                    {...props}
                >
                    <div className="text-sm font-medium leading-none text-black">{title}</div>
                    <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {children}
                    </div>
                </a>
            </NavigationMenuLink>
        </li>
    )
})
ListItem.displayName = "ListItem"
