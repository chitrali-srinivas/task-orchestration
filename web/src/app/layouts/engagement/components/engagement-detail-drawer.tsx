import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import { EngagementRecord } from "../data/schema"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, CheckCircle2, MapPin, User, XCircle } from "lucide-react"
import { format } from "date-fns"

interface EngagementDetailDrawerProps {
    record: EngagementRecord | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EngagementDetailDrawer({ record, open, onOpenChange }: EngagementDetailDrawerProps) {
    if (!record) return null

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-2xl">
                    <DrawerHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                    <AvatarImage src={record.farmer.avatar} />
                                    <AvatarFallback>{record.farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <DrawerTitle className="text-xl">{record.farmer.name}</DrawerTitle>
                                    <DrawerDescription asChild>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="font-normal text-xs px-1.5 py-0">
                                                {record.farmer.id}
                                            </Badge>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {record.village}
                                            </span>
                                        </div>
                                    </DrawerDescription>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge
                                    variant={
                                        record.status === "Verified" ? "default" :
                                            record.status === "Invalid" ? "destructive" : "secondary"
                                    }
                                    className={
                                        record.status === "Verified" ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" :
                                            record.status === "Invalid" ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400" :
                                                "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    }
                                >
                                    {record.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(record.submittedOn, "PPP")}
                                </span>
                            </div>
                        </div>
                    </DrawerHeader>

                    <div className="p-4 space-y-6">
                        {/* Highlights Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</span>
                                <p className="text-lg font-semibold mt-1">{record.engagementType}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Satisfaction Score</span>
                                <div className="flex items-center gap-1 mt-1">
                                    <span className="text-lg font-semibold">{record.score}</span>
                                    <span className="text-sm text-zinc-400">/ 5</span>
                                    <div className="ml-2 flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span key={star} className={star <= record.score ? "text-amber-400 text-sm" : "text-zinc-200 dark:text-zinc-700 text-sm"}>★</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Comments */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 text-zinc-900 dark:text-zinc-100">Feedback / Comments</h4>
                            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 leading-relaxed text-zinc-700 dark:text-zinc-300">
                                "{record.comments}"
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Surveyor</span>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-zinc-400" />
                                    <span className="font-medium">{record.surveyor.name}</span>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Record ID</span>
                                <span className="font-mono text-zinc-500">#{record.id}</span>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter>
                        <div className="flex gap-2 w-full">
                            <Button className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </Button>
                            <Button variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                        </div>
                        <DrawerClose asChild>
                            <Button variant="ghost">Close Details</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
