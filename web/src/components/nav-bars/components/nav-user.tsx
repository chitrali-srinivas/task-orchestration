"use client"

import {
    BadgeCheck,
    Bell,
    ChevronsUpDown,
    CreditCard,
    LogOut,
    Sparkles,
    User,
    ClipboardList,
    HelpCircle,
    Bug,
    Info,
} from "lucide-react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
    user,
}: {
    user: {
        name: string
        email: string
        avatar: string
    }
}) {
    const { isMobile } = useSidebar()

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={user.avatar} alt={user.name} />
                                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{user.name}</span>
                                <span className="truncate text-xs">{user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-64 p-2"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <div className="flex items-center gap-3 p-2 mb-2 border-b pb-4">
                            <Avatar className="h-10 w-10 border">
                                <AvatarImage src={user.avatar} alt={user.name} />
                                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-semibold text-sm">{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                        </div>

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
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

