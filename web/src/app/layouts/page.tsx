import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Table as TableIcon, MessageSquare, Tractor, Smartphone, ClipboardList, CalendarDays, FlaskConical } from "lucide-react";

export default function LayoutsPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center space-x-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Layouts Library</h1>
                </div>

                <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <TableIcon className="h-6 w-6 text-zinc-900 dark:text-zinc-50" />
                        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Table Layouts</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <TableIcon className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Table Layout</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Explore a variety of table layout patterns, headers, and cell components for different data types.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/table-layouts" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View All Variants <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Engagement Layout Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <MessageSquare className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Engagement Layout</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Interactive table and list views for managing farmer engagement feedback and interactions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/engagement" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Engagement <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Deployment Layout Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <Tractor className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Deployment Layout</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Interactive table and list views for managing farmer deployment processes and configurations.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/deployment-versions" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View All Versions <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Samples Layout Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <FlaskConical className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Samples Layout</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Deployment and control sample verification: one row per sample, a farmer detail across AZs, map with clustering, control plot boundaries, approve and report.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/samples" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Samples <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* App Navigation Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <Smartphone className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">App Navigation</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Explore iOS & Android layout patterns, dynamic app switchers, and context selectors for merged mobile apps.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/app-navigation" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Navigation Types <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Science Analysis Dashboard Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-emerald-500/10 transition-colors">
                                        <TableIcon className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-600" />
                                    </div>
                                    <CardTitle className="text-lg">Science Analysis Dashboard</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Satellite-driven plot boundary selection, Plotly indices & climate charts, farmer & village level analysis, and comparative workspace.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/science-analysis" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Science Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Survey Builder Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <ClipboardList className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Survey Builder</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Create, configure, test, version, and publish operational surveys. Explore available layout versions (V1.0, V1.1).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/survey-builder" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View All Versions <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                        {/* Season Management Card */}
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md group-hover:bg-amber-500/10 transition-colors">
                                        <CalendarDays className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-amber-600" />
                                    </div>
                                    <CardTitle className="text-lg">Season Management</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Manage agricultural seasons, 21-activity chronological Gantt timelines, status tracking, and base configurations.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/season-management" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Season Management <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    );
}

