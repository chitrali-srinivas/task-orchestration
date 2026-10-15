import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Map } from "lucide-react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { mockFarmers } from "@/data/mrv-rich-data";

export default function TableLayoutType6Page() {
    const allLocations = mockFarmers.map(f => f.location);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/layouts/table-layouts">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Site Registry</h1>
                            <p className="text-zinc-500 text-sm">Geospatial verification of registered farm plots.</p>
                        </div>
                    </div>
                    <Button variant="outline">
                        <Map className="mr-2 h-4 w-4" /> View All on Map
                    </Button>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <DataTable columns={columns} data={allLocations} />
                </div>
            </div>
        </div>
    );
}
