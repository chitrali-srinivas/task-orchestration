import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Table as TableIcon, Users, Search, Activity, AlertTriangle, MapPin, ListTree, BarChart3, LayoutGrid } from "lucide-react";

export default function TableLayoutsListPage() {
    const layouts = [
        {
            title: "Table Layout Type 1",
            description: "Summary Stats Table with Visual Indicators. Best for aggregated metrics and progress tracking.",
            icon: BarChart3,
            href: "/layouts/table-type-1",
        },
        {
            title: "Table Layout Type 2",
            description: "Profile List Table with Avatars. Optimized for checking farmer or surveyor directories.",
            icon: Users,
            href: "/layouts/table-type-2",
        },
        {
            title: "Table Layout Type 3",
            description: "Paginated Details Table. Standard transactional log view with sorting and searching.",
            icon: Search,
            href: "/layouts/table-type-3",
        },
        {
            title: "Table Layout Type 4",
            description: "Metrics-Focused Table. Numeric-heavy views for scientific data and summation.",
            icon: Activity,
            href: "/layouts/table-type-4",
        },
        {
            title: "Table Layout Type 5",
            description: "Status-Enhanced Table. Highlights data quality issues and flagged records.",
            icon: AlertTriangle,
            href: "/layouts/table-type-5",
        },
        {
            title: "Table Layout Type 6",
            description: "Geo-Integrated Table. Location-aware data with Lat/Long and Map actions.",
            icon: MapPin,
            href: "/layouts/table-type-6",
        },
        {
            title: "Table Layout Type 7",
            description: "Hybrid Expandable Table. Hierarchical view for nested details like Farmer -> Samples.",
            icon: ListTree,
            href: "/layouts/table-type-7",
        },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex items-center space-x-4">
                    <Link href="/layouts">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Table Library Gallery</h1>
                </div>

                <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <TableIcon className="h-6 w-6 text-zinc-900 dark:text-zinc-50" />
                        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Table Components</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <TableIcon className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Headers Library</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    A collection of individual table header components with their labels.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/headers" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Headers <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                        <LayoutGrid className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                    </div>
                                    <CardTitle className="text-lg">Cells Library</CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                    Review different types of table cells (Status, Avatar, Actions, etc).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/layouts/cells" className="block">
                                    <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                        View Cells <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <TableIcon className="h-6 w-6 text-zinc-900 dark:text-zinc-50" />
                        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Table Variants</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {layouts.map((layout, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow group cursor-pointer border-zinc-200 dark:border-zinc-800">
                                <CardHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md group-hover:bg-mati-gold/10 transition-colors">
                                            <layout.icon className="h-5 w-5 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                        </div>
                                        <CardTitle className="text-lg">{layout.title}</CardTitle>
                                    </div>
                                    <CardDescription className="line-clamp-2">
                                        {layout.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Link href={layout.href} className="block">
                                        <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900" variant="outline">
                                            View Variant <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
