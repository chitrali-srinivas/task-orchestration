"use client";

import React, { useState } from "react";
import { Search, History, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Farmer } from "@/types/map";

import { MOCK_FARMERS } from "@/data/mockData";

interface FarmerListSidebarProps {
    onSelectFarmer: (farmer: Farmer) => void;
    selectedFarmerId?: string;
}

export default function FarmerListSidebar({ onSelectFarmer, selectedFarmerId }: FarmerListSidebarProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredFarmers = MOCK_FARMERS.filter(farmer =>
        farmer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        farmer.village.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 w-full max-w-[400px]">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Farmers</h2>
                <Button variant="ghost" size="icon">
                    <History className="h-5 w-5 text-zinc-500" />
                </Button>
            </div>

            <div className="p-4 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search here..."
                            className="pl-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="flex items-center gap-2 px-3">
                        <SlidersHorizontal className="h-4 w-4" />
                        All AZs
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 px-4 pb-4">
                <div className="space-y-3">
                    {filteredFarmers.map((farmer) => (
                        <Card
                            key={farmer.id}
                            className={`cursor-pointer transition-all hover:border-zinc-300 dark:hover:border-zinc-700 ${selectedFarmerId === farmer.id ? "border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:ring-zinc-100 dark:bg-zinc-900/50" : "border-zinc-200 dark:border-zinc-800"}`}
                            onClick={() => onSelectFarmer(farmer)}
                        >
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                        {farmer.name}
                                        <History className="h-3 w-3 text-zinc-400" />
                                    </h3>
                                    <span className="text-xs text-zinc-500">{farmer.date}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-500">Cal. Area</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-200">{farmer.calArea}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-zinc-500">Trailers deployed</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-200">{farmer.trailersDeployed}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-500">Village</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-200">{farmer.village}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-zinc-500">Deployed</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-200">{farmer.deployed}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filteredFarmers.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                            No farmers found matching "{searchTerm}"
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
