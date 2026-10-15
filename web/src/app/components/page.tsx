import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, ArrowRight, Map, Filter, LayoutDashboard } from "lucide-react";

export default function ComponentsPage() {
    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center space-x-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-200 dark:hover:bg-zinc-800">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Components Library</h1>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="hover:shadow-md transition-shadow dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                                <FileText className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                            </div>
                            <CardTitle className="text-xl">Survey Card</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 flex flex-col">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 min-h-[60px]">
                                A versatile card component for displaying survey questions and responses in various formats (text, rating, image, etc.).
                            </p>
                            <div className="mt-auto pt-2">
                                <Link href="/components/survey" className="block">
                                    <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                                        View Variants <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Map View Card */}
                    <Card className="hover:shadow-md transition-shadow dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                                <Map className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                            </div>
                            <CardTitle className="text-xl">Map View</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 flex flex-col">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed min-h-[60px]">
                                Farmer plot boundary editor with manual drawing tools and ML-assisted generation capabilities.
                            </p>
                            <div className="mt-auto pt-2">
                                <Link href="/map-view" className="block">
                                    <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                                        Open Map Editor <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Filter Card */}
                    <Card className="hover:shadow-md transition-shadow dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                                <Filter className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                            </div>
                            <CardTitle className="text-xl">Filter</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 flex flex-col">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed min-h-[60px]">
                                Advanced multi-criteria filtering sidebar with support for date ranges, text operators, and match logic.
                            </p>
                            <div className="mt-auto pt-2">
                                <Link href="/components/filter" className="block">
                                    <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                                        Open Filter Preview <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Deployment Card */}
                    <Card className="hover:shadow-md transition-shadow dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg">
                                <LayoutDashboard className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                            </div>
                            <CardTitle className="text-xl">Deployment Component</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 flex flex-col">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed min-h-[60px]">
                                Hierarchical sidebar for verifying farmer deployments – tractors, loads, plots with approvals.
                            </p>
                            <div className="mt-auto pt-2">
                                <Link href="/components/deployment" className="block">
                                    <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                                        Open Deployment Preview <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
