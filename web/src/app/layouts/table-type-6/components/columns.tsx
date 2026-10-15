"use client"

import { ColumnDef } from "@tanstack/react-table"
import { GeoLocation } from "@/data/mrv-rich-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, ExternalLink } from "lucide-react"

export const columns: ColumnDef<GeoLocation>[] = [
    {
        accessorKey: "locationName",
        header: "Location Name",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-zinc-500" />
                <span className="font-medium">{row.getValue("locationName")}</span>
            </div>
        )
    },
    {
        accessorKey: "lat",
        header: "Latitude",
        cell: ({ row }) => <span className="font-mono text-zinc-600 dark:text-zinc-400">{row.getValue("lat")}</span>
    },
    {
        accessorKey: "lng",
        header: "Longitude",
        cell: ({ row }) => <span className="font-mono text-zinc-600 dark:text-zinc-400">{row.getValue("lng")}</span>

    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <Badge variant="outline">{row.getValue("type")}</Badge>
    },
    {
        accessorKey: "status",
        header: "Verification",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "Verified" ? "default" : "secondary"}>
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const lat = row.getValue("lat");
            const lng = row.getValue("lng");
            const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

            return (
                <Button variant="link" size="sm" asChild>
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                        Open Map <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                </Button>
            )
        },
    },
]
