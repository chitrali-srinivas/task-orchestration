import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreHorizontal, Copy, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { MapPin } from "lucide-react";

export default function CellsPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex items-center space-x-4">
                    <Link href="/layouts/table-layouts">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Cells Library</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                            A collection of individual table cell components for various data types.
                        </p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Primary Text Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Primary Text
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none text-zinc-900 dark:text-zinc-100 font-medium">
                                                Organic Corn Seeds
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Secondary Text Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Secondary Text
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none text-zinc-500 dark:text-zinc-400">
                                                ORD-2024-001
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* User/Avatar Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Avatar & Text
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src="/avatars/01.png" alt="Avatar" />
                                                        <AvatarFallback>OM</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Olivia Martin</span>
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">olivia@example.com</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Status Badge - Success */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Status Badge
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                                                    Completed
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Status Dot */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Status Dot
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                                                    <span className="text-zinc-700 dark:text-zinc-300">Processing</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Amount/Currency */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Currency
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none font-mono">
                                                $2,450.00
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Trend Positive */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Trend (Positive)
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                    <TrendingUp className="h-4 w-4" />
                                                    <span>+12.5%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Tags List */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Tags
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex gap-1 flex-wrap">
                                                    <Badge variant="outline" className="text-xs font-normal">React</Badge>
                                                    <Badge variant="outline" className="text-xs font-normal">Next.js</Badge>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Copyable ID */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Copyable ID
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex items-center gap-2 group">
                                                    <span className="font-mono text-xs text-zinc-500">ab45...89x</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Date Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Date & Time
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-zinc-900 dark:text-zinc-100">Jan 22, 2024</span>
                                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">10:45 AM</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Actions Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Row Actions
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600">Delete Record</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Image Preview Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Image Preview
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <div className="relative h-10 w-16 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 cursor-zoom-in hover:opacity-80 transition-opacity">
                                                            <img
                                                                src="/Farm Satellite View.png"
                                                                alt="Farm Satellite View"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-3xl border-zinc-200 dark:border-zinc-800 p-0 overflow-hidden bg-transparent border-none shadow-none">
                                                        <img
                                                            src="/Farm Satellite View.png"
                                                            alt="Farm Satellite View Full"
                                                            className="w-full h-auto rounded-lg shadow-2xl"
                                                        />
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Progress Bar Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Progress Bar
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none w-full">
                                                <div className="flex items-center gap-3">
                                                    <Progress value={65} className="h-2 w-[60%]" />
                                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">65%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Map / Location Cell */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Location Data
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                <Table>
                                    <TableBody>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableCell className="p-0 border-none">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 gap-2 text-zinc-600 dark:text-zinc-300">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            <span>12.9716° N, 77.5946° E</span>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-0">
                                                        <div className="h-40 w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden rounded-md">
                                                            <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/77.5946,12.9716,12,0,0/300x200?access_token=placeholder')] bg-cover bg-center opacity-50" />
                                                            <span className="text-xs text-zinc-500 font-medium relative z-10 bg-white/80 dark:bg-black/80 px-2 py-1 rounded">Map Preview</span>
                                                        </div>
                                                        <div className="p-2 bg-white dark:bg-zinc-950">
                                                            <p className="text-xs font-medium">Farm Location A</p>
                                                            <p className="text-[10px] text-zinc-500">Karnataka, India</p>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Paragraph / Truncated Text Cell */}
                        <TooltipProvider>
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    Description (Paragraph)
                                </div>
                                <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm flex items-center h-20">
                                    <Table>
                                        <TableBody>
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableCell className="p-0 border-none max-w-[200px]">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 cursor-help">
                                                                This field contains detailed notes about the harvest quality, including moisture content observations and suggestions for the next planting cycle based on soil analysis.
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <p>This field contains detailed notes about the harvest quality, including moisture content observations and suggestions for the next planting cycle based on soil analysis.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TooltipProvider>

                    </div>
                </div>
            </div>
        </div>
    );
}
