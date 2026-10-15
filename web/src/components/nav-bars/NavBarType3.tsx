
"use client"

import * as React from "react"
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
    SidebarTrigger,
    useSidebar
} from "@/components/ui/sidebar"
import { NavMain } from "./components/nav-main"
import { NavUser } from "./components/nav-user"
import { FranchiseSwitcher } from "./components/franchise-switcher"
import { BaseSwitcher } from "./components/base-switcher"
import { data, type NavItem } from "./nav-data"
import { Search, Bell, HelpCircle, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"

function AppSidebarMinimal({ navMain, admin, label, ...props }: React.ComponentProps<typeof Sidebar> & { navMain: NavItem[], admin: NavItem[], label?: string }) {
    const sidebarLabel = label || "Apps"
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <FranchiseSwitcher franchises={data.franchises} />
                <BaseSwitcher bases={data.bases} />
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navMain} label={sidebarLabel} />
                {admin && admin.length > 0 && <NavMain items={admin} label="Admin" />}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}

import { useSearchParams } from "next/navigation"

export function NavBarType3({ children }: { children?: React.ReactNode }) {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <NavBarType3Content>{children}</NavBarType3Content>
        </React.Suspense>
    )
}

function NavBarType3Content({ children }: { children?: React.ReactNode }) {
    const searchParams = useSearchParams()
    const rolesParam = searchParams.get('roles')
    const selectedRoles = rolesParam ? rolesParam.split(',') : null

    const filterItems = (items: typeof data.navMain): NavItem[] => {
        if (!selectedRoles) return items as unknown as NavItem[]
        return items.filter(item => {
            if (!item.roles) return true
            return item.roles.some(r => selectedRoles.some(sr => sr === r))
        }) as unknown as NavItem[]
    }

    const filteredNavMain = filterItems(data.navMain)
    const filteredAdmin = filterItems(data.admin)

    const mainLabel = selectedRoles && selectedRoles.length > 0 ? selectedRoles[0] : "Apps"

    return (
        <SidebarProvider defaultOpen={false}>
            <AppSidebarMinimal navMain={filteredNavMain} admin={filteredAdmin} label={mainLabel} />
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-muted/20 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex-1 flex items-center justify-between">
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Page Title</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>

                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Search className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Bell className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    {children || (
                        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                            <div className="aspect-video rounded-xl bg-muted/50" />
                            <div className="aspect-video rounded-xl bg-muted/50" />
                            <div className="aspect-video rounded-xl bg-muted/50" />
                        </div>
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
