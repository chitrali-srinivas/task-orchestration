"use client";

import * as React from "react";
import Link from "next/link";
import { 
    ArrowLeft, 
    Filter, 
    Table as TableIcon, 
    Search,
    LayoutGrid,
    Settings2,
    SlidersHorizontal,
    MoreVertical,
    Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterSidebar, FilterValue } from "./components/FilterSidebar";
import { cn } from "@/lib/utils";

export default function FilterPreviewPage() {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [appliedFilters, setFilters] = React.useState<FilterValue | undefined>(undefined);
    const [logic, setLogic] = React.useState<"and" | "or">("and");

    const handleApply = (filters: FilterValue) => {
        setFilters(filters);
        console.log("Applied Filters:", filters);
    };

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/components">
                            <Button variant="ghost" size="icon" className="hover:bg-zinc-200 dark:hover:bg-zinc-800">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Advanced Filter Component</h1>
                            <p className="text-sm text-zinc-500">Reusable sidebar for complex table filtering</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            className="h-10 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <SlidersHorizontal className="mr-2 h-4 w-4" />
                            Filters
                            {appliedFilters && Object.keys(appliedFilters).length > 0 && (
                                <Badge className="ml-2 bg-green-600 hover:bg-green-600 h-5 px-1.5 min-w-[20px] justify-center">
                                    !
                                </Badge>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="grid lg:grid-cols-1 gap-8">
                    {/* State Preview */}
                    <div className="space-y-6">
                        <Card className="dark:bg-zinc-950 dark:border-zinc-800 border-zinc-200 shadow-sm min-h-[400px] flex flex-col">
                            <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold">Filter State Output</CardTitle>
                                    <p className="text-xs text-zinc-500 mt-1 italic">This JSON represents what is sent to the table onApply</p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-6 bg-zinc-50/30 dark:bg-zinc-900/30">
                                {!appliedFilters ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 py-20">
                                        <div className="h-16 w-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <Search className="h-8 w-8 text-zinc-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-zinc-900 dark:text-zinc-50">No filters applied</p>
                                            <p className="text-xs text-zinc-500 max-w-[200px]">Click the Filters button above to start refining data.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <pre className="text-[11px] font-mono p-4 rounded-lg bg-zinc-900 text-zinc-300 overflow-auto max-h-[600px]">
                                        {JSON.stringify(appliedFilters, null, 2)}
                                    </pre>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Reusable Sidebar Component */}
            <FilterSidebar 
                open={sidebarOpen} 
                onOpenChange={setSidebarOpen} 
                onApply={handleApply}
                initialFilters={appliedFilters}
            />
        </main>
    );
}
