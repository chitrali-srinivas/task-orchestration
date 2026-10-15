
import Link from "next/link"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Layout, Sidebar, Menu, Grip, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RoleSelectorDialog } from "./components/role-selector-dialog"

export default function NavBarsPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Navigation Bars</h1>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RoleSelectorDialog route="/nav-bar-type-1">
                        <div className="block group h-full">
                            <Card className="h-full hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:underline">Type 1</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-500">Standard SaaS Header with brand, links, and action buttons.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </RoleSelectorDialog>

                    <RoleSelectorDialog route="/nav-bar-type-2">
                        <div className="block group h-full">
                            <Card className="h-full hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:underline">Type 2</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-500">Search Focused navigation for content-heavy sites.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </RoleSelectorDialog>

                    <RoleSelectorDialog route="/nav-bar-type-3">
                        <div className="block group h-full">
                            <Card className="h-full hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:underline">Type 3</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-500">Dark / Creative theme for portfolios and agencies.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </RoleSelectorDialog>

                    <RoleSelectorDialog route="/nav-bar-type-4">
                        <div className="block group h-full">
                            {/* Wrapping in div because DialogTrigger passes props to children, and generic components can be tricky. 
                               But DialogTrigger expects a single child. Card is fine. 
                               However, previously it was a Link. We remove the Link and make the Card the trigger. 
                           */}
                            <Card className="h-full hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:underline">Type 4</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-500">Pixel-perfect implementation with header-based context switching and high-density sidebar.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </RoleSelectorDialog>

                    <RoleSelectorDialog route="/nav-bar-type-5">
                        <div className="block group h-full">
                            <Card className="h-full hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:underline">Type 5</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-zinc-500">Vercel-style dark top bar with gradient icons and streamlined context switching.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </RoleSelectorDialog>
                </div>
            </div>
        </div>
    )
}
