
"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function BaseSwitcher({
    bases,
}: {
    bases: {
        name: string
        logo: React.ElementType
        plan: string
    }[]
}) {
    const { isMobile } = useSidebar()
    const [activeBase, setActiveBase] = React.useState(bases[0])
    const [search, setSearch] = React.useState("")

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <activeBase.logo className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">Base</span>
                                <span className="truncate text-xs">{activeBase.name}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        align="start"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <div className="p-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                <Input
                                    placeholder="Search base..."
                                    className="h-8 pl-7 text-xs"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <DropdownMenuLabel className="text-xs text-muted-foreground px-2">
                            Bases
                        </DropdownMenuLabel>
                        {bases.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).map((base) => (
                            <DropdownMenuItem
                                key={base.name}
                                onClick={() => setActiveBase(base)}
                                className="gap-2 p-2"
                            >
                                {base.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
