
import { NavBarType4 } from "@/components/nav-bars/NavBarType4"

export default function NavBarType4Page() {
    return (
        <div className="min-h-screen">
            <NavBarType4>
                <div className="container mx-auto p-4 md:p-8">
                    <h1 className="text-2xl font-bold mb-4">Nav Bar Type 4 (Reference Match)</h1>
                    <p className="text-muted-foreground mb-8">
                        This layout matches your reference screenshots, featuring:
                    </p>
                    <ul className="list-disc pl-5 mb-8 text-muted-foreground space-y-1">
                        <li><strong>Top Header Context Switching</strong>: Franchise and Base selectors integrated into the breadcrumb area.</li>
                        <li><strong>High Density Sidebar</strong>: Grouped application navigation.</li>
                        <li><strong>Right Actions</strong>: Search, Favorites, and Profile actions.</li>
                    </ul>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="h-48 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm w-full flex items-center justify-center text-zinc-400">
                            Dashboard Widget
                        </div>
                        <div className="h-48 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm w-full flex items-center justify-center text-zinc-400">
                            Analytics Chart
                        </div>
                        <div className="h-48 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm w-full flex items-center justify-center text-zinc-400">
                            Recent Activity
                        </div>
                    </div>
                </div>
            </NavBarType4>
        </div>
    )
}
