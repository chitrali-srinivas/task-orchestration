import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { mockFarmers } from "@/data/mrv-rich-data";

export default function TableLayoutType1Page() {
    // Flattening data for "Summary View" - extracting samples from farmers
    const allSamples = mockFarmers.flatMap(f => f.samples);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center space-x-4">
                    <Link href="/layouts/table-layouts">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Summary Stats (Project View)</h1>
                        <p className="text-zinc-500 text-sm">Aggregated progress of ongoing survey phases.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500">Overall Completion</h3>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">84%</span>
                            <span className="text-sm text-green-600">+4% today</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500">Active Surveyors</h3>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">12</span>
                            <span className="text-sm text-zinc-400">In Field</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500">Samples Collected</h3>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{allSamples.length}</span>
                            <span className="text-sm text-zinc-400">Total</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">Recent Activity Log</h2>
                    <DataTable columns={columns} data={allSamples.slice(0, 10)} />
                </div>
            </div>
        </div>
    );
}
