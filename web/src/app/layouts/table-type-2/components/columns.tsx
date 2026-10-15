"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Profile } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MoreHorizontal } from "lucide-react"

export const columns: ColumnDef<Profile>[] = [
    {
        accessorKey: "name",
        header: "Profile",
        cell: ({ row }) => {
            const initials = row.original.name.split(' ').map(n => n[0]).join('').substring(0, 2);
            return (
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={row.original.avatarUrl} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">{row.original.name}</div>
                        <div className="text-xs text-zinc-500">{row.original.fatherName}</div>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "village",
        header: "Location",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "Active" ? "default" : "secondary"}>
                    {status}
                </Badge>
            )
        },
    },
    {
        accessorKey: "mobile",
        header: "Contact",
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Phone className="h-3 w-3" />
                    <span className="text-sm">{row.getValue("mobile")}</span>
                </div>
            )
        }
    },
    {
        id: "actions",
        cell: () => (
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Phone className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                </Button>
            </div>
        ),
    },
]
