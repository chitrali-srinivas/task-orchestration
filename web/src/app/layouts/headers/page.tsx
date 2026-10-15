import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpDown, Users, Info, Settings, MoreHorizontal } from "lucide-react";
import { Table, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HeadersPage() {
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
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Headers Library</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                            A collection of individual table header components with labels.
                        </p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Headers Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                        {/* Simple Text Header */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Default Text
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none text-zinc-900 dark:text-zinc-100 font-semibold">
                                                Column Name
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* Checkbox Header */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Selection
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none w-[50px]">
                                                <Checkbox aria-label="Select all" />
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* Sortable Header */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Sortable
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-2 transition-colors">
                                                Status
                                                <ArrowUpDown className="h-4 w-4" />
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* Icon Header */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                With Icon
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
                                                <Users className="h-4 w-4 text-zinc-500" />
                                                Users
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* Right Aligned (Numeric) */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Numeric (Right)
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center justify-end">
                                <Table className="w-auto">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none text-right text-zinc-900 dark:text-zinc-100 font-semibold">
                                                $ Amount
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* Center Aligned */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Centered
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center justify-center">
                                <Table className="w-auto">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none text-center text-zinc-900 dark:text-zinc-100 font-semibold">
                                                Status
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                        {/* With Tooltip */}
                        <TooltipProvider>
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    With Tooltip
                                </div>
                                <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableHead className="h-auto p-0 border-none flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
                                                    Complexity
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Info className="h-4 w-4 text-zinc-400 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Calculated based on alg</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                    </Table>
                                </div>
                            </div>
                        </TooltipProvider>

                        {/* Action Header */}
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Actions
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-zinc-950 p-4 shadow-sm h-16 flex items-center">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-auto p-0 border-none flex items-center justify-between w-full">
                                                <span>Settings</span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem>Filter</DropdownMenuItem>
                                                        <DropdownMenuItem>Hide Column</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                </Table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
