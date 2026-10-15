"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { data, type NavItem } from "./nav-data"
import {
    Bell,
    ChevronsUpDown,
    Search,
    User,
    ClipboardList,
    HelpCircle,
    Bug,
    Info,
    LogOut,
} from "lucide-react"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
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
} from "@/components/ui/sidebar"
import { NavMain } from "./components/nav-main"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function NavBarType1({ children }: { children?: React.ReactNode }) {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <NavBarType1Content>{children}</NavBarType1Content>
        </React.Suspense>
    )
}

function NavBarType1Content({ children }: { children?: React.ReactNode }) {
    const searchParams = useSearchParams()
    const rolesParam = searchParams.get('roles')
    const selectedRoles = rolesParam ? rolesParam.split(',') : null

    const filterItems = (items: NavItem[]): NavItem[] => {
        if (!selectedRoles) return items
        return items.filter(item => {
            if (!item.roles) return true
            return item.roles.some(r => selectedRoles.some(sr => sr === r))
        })
    }

    const filteredNavMain = filterItems(data.navMain as NavItem[])
    const filteredAdmin = filterItems(data.admin as NavItem[])

    const sidebarLabel = selectedRoles?.length ? selectedRoles.join(" & ") : "Mati Center"

    return (
        <SidebarProvider>
            <AppSidebar navMain={filteredNavMain} admin={filteredAdmin} label={sidebarLabel} />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="#">
                                    Platform
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Dashboard</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="ml-auto flex items-center gap-4">
                        <div className="relative w-full max-w-sm hidden md:block">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="search" placeholder="Search..." className="pl-8 w-64 lg:w-80" />
                        </div>
                        <Button variant="ghost" size="icon">
                            <Bell className="h-4 w-4" />
                        </Button>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

function AppSidebar({ navMain, admin, label, ...props }: React.ComponentProps<typeof Sidebar> & { navMain: NavItem[], admin: NavItem[], label: string }) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader className="h-16 border-b flex items-center justify-center">
                <div className="flex items-center gap-2 font-bold text-xl px-2 w-full">
                    <div className="h-8 w-8 rounded-lg bg-black text-white flex items-center justify-center">M</div>
                    <span className="group-data-[collapsible=icon]:hidden truncate">{label}</span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navMain} label="Platform" />
                {admin.length > 0 && (
                    <>
                        <NavMain items={admin} label="Admin" />
                    </>
                )}
            </SidebarContent>
            <SidebarFooter>
                <div className="p-4 border-t group-data-[collapsible=icon]:p-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-12">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={data.user.avatar} alt={data.user.name} />
                                    <AvatarFallback>CN</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start truncate group-data-[collapsible=icon]:hidden">
                                    <span className="font-semibold text-sm">{data.user.name}</span>
                                    <span className="text-xs text-muted-foreground">{data.user.email}</span>
                                </div>
                                <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50 group-data-[collapsible=icon]:hidden" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" side="right">
                            <DropdownMenuLabel>Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2"><User className="h-4 w-4" /> Profile</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2"><ClipboardList className="h-4 w-4" /> Manage</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-red-600"><LogOut className="h-4 w-4" /> Log out</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
