"use client"

import * as React from "react"
import Link from "next/link"
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { data, type NavItem } from "./nav-data"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Bell, Bug, HelpCircle, ChevronsUpDown, Check, User, ClipboardList, Info, LogOut } from "lucide-react"
import { Input } from "@/components/ui/input"

import { useSearchParams } from "next/navigation"

export function NavBarType2({ children }: { children?: React.ReactNode }) {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <NavBarType2Content>{children}</NavBarType2Content>
        </React.Suspense>
    )
}

function NavBarType2Content({ children }: { children?: React.ReactNode }) {
    const searchParams = useSearchParams()
    const rolesParam = searchParams.get('roles')
    const selectedRoles = rolesParam ? rolesParam.split(',') : null

    const [activeFranchise, setActiveFranchise] = React.useState(data.franchises[0])
    const [activeBase, setActiveBase] = React.useState(data.bases[0])

    const filterItems = (items: NavItem[]): NavItem[] => {
        if (!selectedRoles) return items
        return items.filter(item => {
            if (!item.roles) return true
            return item.roles.some(r => selectedRoles.some(sr => sr === r))
        })
    }

    const filteredNavMain = [
        ...filterItems(data.navMain as NavItem[]).map(item => ({
            ...item,
            title: item.title === "Dashboard" ? "Verifier Dashboard" : item.title
        })),
        ...filterItems(data.admin as NavItem[]).map(item => ({
            ...item,
            title: item.title === "Dashboard" ? "Admin Dashboard" : item.title
        }))
    ]

    return (
        <div className="border-b bg-background">
            <div className="flex h-16 items-center px-4 gap-4">
                {/* Brand / Logo */}
                <Link href="/" className="font-bold text-xl mr-4 flex items-center gap-2">
                    <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white text-xs">M</div>
                    <span className="hidden md:inline-block">Mati</span>
                </Link>

                {/* Context Switchers (Horizontal) */}
                <div className="hidden md:flex items-center gap-2 border-r pr-4 mr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[140px] justify-between">
                                <span className="truncate">{activeFranchise.name}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Switch Franchise</DropdownMenuLabel>
                            {data.franchises.map((f) => (
                                <DropdownMenuItem key={f.name} onClick={() => setActiveFranchise(f)}>
                                    {f.name}
                                    {activeFranchise.name === f.name && <Check className="ml-auto h-4 w-4" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-[120px] justify-between">
                                <span className="truncate">{activeBase.name}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Switch Base</DropdownMenuLabel>
                            {data.bases.map((b) => (
                                <DropdownMenuItem key={b.name} onClick={() => setActiveBase(b)}>
                                    {b.name}
                                    {activeBase.name === b.name && <Check className="ml-auto h-4 w-4" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Main Navigation */}
                <NavigationMenu className="hidden lg:flex">
                    <NavigationMenuList>
                        {filteredNavMain.map((item, index) => (
                            <NavigationMenuItem key={`${item.title}-${index}`}>
                                {item.items && item.items.length > 0 ? (
                                    <>
                                        <NavigationMenuTrigger className={cn(item.isActive && "bg-accent/50 text-accent-foreground font-semibold")}>{item.title}</NavigationMenuTrigger>
                                        <NavigationMenuContent>
                                            <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
                                                <li className="row-span-3">
                                                    <NavigationMenuLink asChild>
                                                        <a
                                                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                                                            href={item.url}
                                                        >
                                                            {item.icon && <item.icon className="h-6 w-6" />}
                                                            <div className="mb-2 mt-4 text-lg font-medium">
                                                                {item.title}
                                                            </div>
                                                            <p className="text-sm leading-tight text-muted-foreground">
                                                                Manage your {item.title.toLowerCase()} operations efficiently.
                                                            </p>
                                                        </a>
                                                    </NavigationMenuLink>
                                                </li>
                                                {item.items.map((subItem) => (
                                                    <ListItem key={subItem.title} title={subItem.title} href={subItem.url}>
                                                        Access {subItem.title} dashboard.
                                                    </ListItem>
                                                ))}
                                            </ul>
                                        </NavigationMenuContent>
                                    </>
                                ) : (
                                    <NavigationMenuLink asChild>
                                        <Link href={item.url} className={cn(navigationMenuTriggerStyle(), item.isActive && "bg-accent/50 text-accent-foreground font-semibold")}>
                                            {item.title}
                                        </Link>
                                    </NavigationMenuLink>
                                )}
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                <div className="ml-auto flex items-center gap-4">
                    <div className="relative w-full max-w-sm hidden xl:block">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search..." className="pl-8 w-64 md:w-80" />
                    </div>

                    <Button variant="ghost" size="icon" title="Report Bug">
                        <Bug className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Help">
                        <HelpCircle className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />
                    <Button variant="ghost" size="icon">
                        <Bell className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={data.user.avatar} alt={data.user.name} />
                                    <AvatarFallback>CN</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                            {/* Header matching image */}
                            <div className="flex items-center gap-3 p-2 mb-2 border-b pb-4">
                                <Avatar className="h-10 w-10 border">
                                    <AvatarImage src={data.user.avatar} />
                                    <AvatarFallback>CN</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{data.user.name}</span>
                                    <span className="text-xs text-muted-foreground">{data.user.email}</span>
                                </div>
                            </div>

                            {/* Items matching image */}
                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer">
                                <div className="h-4 w-4 flex items-center justify-center"><User className="h-4 w-4" /></div>
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer">
                                <div className="h-4 w-4 flex items-center justify-center"><ClipboardList className="h-4 w-4" /></div>
                                Manage
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer">
                                <div className="h-4 w-4 flex items-center justify-center"><HelpCircle className="h-4 w-4" /></div>
                                Help
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer">
                                <div className="h-4 w-4 flex items-center justify-center"><Bug className="h-4 w-4" /></div>
                                Report a bug
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer">
                                <div className="h-4 w-4 flex items-center justify-center"><Info className="h-4 w-4" /></div>
                                About us
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-2" />

                            <DropdownMenuItem className="gap-3 p-2 cursor-pointer text-red-600 focus:text-red-700">
                                <div className="h-4 w-4 flex items-center justify-center"><LogOut className="h-4 w-4" /></div>
                                Log out
                            </DropdownMenuItem>

                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
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
                    <div className="text-sm font-medium leading-none">{title}</div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {children}
                    </p>
                </a>
            </NavigationMenuLink>
        </li>
    )
})
ListItem.displayName = "ListItem"
