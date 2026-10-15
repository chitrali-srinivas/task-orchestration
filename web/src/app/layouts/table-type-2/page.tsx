import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus, Filter } from "lucide-react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { mockFarmers } from "@/data/mrv-rich-data";

export default function TableLayoutType2Page() {
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
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Farmer Directory</h1>
                            <p className="text-zinc-500 text-sm">Manage enrolled farmers and their statuses.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline">
                            <Filter className="mr-2 h-4 w-4" /> Filter
                        </Button>
                        <Button className="bg-mati-gold hover:bg-yellow-600 text-white">
                            <UserPlus className="mr-2 h-4 w-4" /> Add Farmer
                        </Button>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <DataTable columns={columns} data={mockFarmers} />
                </div>
            </div>
        </div>
    );
}
