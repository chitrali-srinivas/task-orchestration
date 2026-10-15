
"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarMenuBadge,
    useSidebar,
} from "@/components/ui/sidebar"

import { type NavItem } from "../nav-data"

export function NavMain({
    items,
    label,
    activeItemUrl,
    onItemClick
}: {
    label: string
    items: NavItem[]
    activeItemUrl?: string
    onItemClick?: (url: string) => void
}) {
    const { state } = useSidebar()

    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item, index) => {
                    const isParentActive = item.url === activeItemUrl;
                    const hasActiveChild = item.items?.some(subItem => subItem.url === activeItemUrl);
                    
                    return item.items && item.items.length > 0 ? (
                        <Collapsible
                            key={`${item.title}-${index}`}
                            asChild
                            defaultOpen={item.isActive || hasActiveChild}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton 
                                        tooltip={item.title} 
                                        isActive={hasActiveChild}
                                        onClick={() => {
                                            if (state === "collapsed" && item.items && item.items.length > 0) {
                                                onItemClick?.(item.items[0].url)
                                            }
                                        }}
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items?.map((subItem) => {
                                            const isSubActive = subItem.url === activeItemUrl;
                                            
                                            return (
                                                <SidebarMenuSubItem key={subItem.title}>
                                                    <SidebarMenuSubButton 
                                                        asChild 
                                                        isActive={isSubActive}
                                                        onClick={() => onItemClick?.(subItem.url)}
                                                    >
                                                        <a href={subItem.url}>
                                                            <span className={cn(isSubActive && "font-semibold text-zinc-900")}>{subItem.title}</span>
                                                        </a>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )
                                        })}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        <SidebarMenuItem key={`${item.title}-${index}`}>
                            <SidebarMenuButton 
                                tooltip={item.title} 
                                asChild 
                                isActive={isParentActive}
                                onClick={() => onItemClick?.(item.url)}
                            >
                                <a href={item.url}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                    {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
