import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Tractor, Sparkles, Layers, CheckCircle2, Wrench } from "lucide-react";

export default function DeploymentVersionsPage() {
    const versions = [
        {
            title: "Existing Deployment",
            version: "V1",
            badge: "V1 • Existing / Baseline",
            badgeColor: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
            description: "The current Deployment layout: status tabs, deployment table, filter sidebar, column header actions, and the deployment detail sheet with map preview.",
            icon: Tractor,
            href: "/layouts/deployment",
            features: [
                "Status tabs with counts",
                "Filter sidebar & column menus",
                "Detail sheet with map preview",
                "Unchanged baseline implementation",
            ],
            buttonText: "Open Existing Deployment",
        },
        {
            title: "Deployment V2 Oct 26",
            version: "V2 Oct 26",
            badge: "V2 Oct 26 • In Development",
            badgeColor: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
            description: "Independent Deployment layout for the upcoming redesign, kept in its own folder and route so it can evolve without affecting the existing Deployment layout.",
            icon: Sparkles,
            href: "/layouts/deployment-v2-oct-26",
            features: [
                "Separate route & folder",
                "No shared state with V1",
                "Placeholder — redesign pending",
                "Ready for the V2 redesign",
            ],
            buttonText: "Open V2 Oct 26",
        },
        {
            title: "Deployment V2.1",
            version: "V2.1",
            badge: "V2.1 • Working Version",
            badgeColor: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
            description: "The working version for upcoming Deployment improvements: cloned from V2 Oct 26 into its own folder and route, with the Data / API Inspector. V2 Oct 26 and the existing layout stay unchanged.",
            icon: Wrench,
            href: "/layouts/deployment-v2-1",
            features: [
                "Separate route & folder",
                "Data / API Inspector",
                "Audit improvements",
                "Multi-plot boundary editing",
            ],
            buttonText: "Open V2.1",
        },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center space-x-4">
                    <Link href="/layouts">
                        <Button variant="ghost" size="icon" className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Deployment Versions</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Select a version of the Deployment layout to open.
                        </p>
                    </div>
                </div>

                {/* Version Cards Grid */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <Layers className="h-6 w-6 text-zinc-900 dark:text-zinc-50" />
                        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Available Layout Versions</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {versions.map((ver, idx) => (
                            <Card key={idx} className="hover:shadow-lg transition-all group cursor-pointer border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col justify-between">
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl group-hover:bg-mati-gold/10 transition-colors">
                                                <ver.icon className="h-6 w-6 text-zinc-700 dark:text-zinc-300 group-hover:text-mati-gold" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl font-bold">{ver.title}</CardTitle>
                                                <span className="text-xs text-zinc-500 font-mono">Version {ver.version}</span>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${ver.badgeColor}`}>
                                            {ver.badge}
                                        </span>
                                    </div>
                                    <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed pt-2">
                                        {ver.description}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-6">
                                    <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-850">
                                        <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Key Highlights</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                            {ver.features.map((feat, fIdx) => (
                                                <div key={fIdx} className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                    <span className="truncate">{feat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Link href={ver.href} className="block">
                                        <Button className="w-full group-hover:bg-zinc-900 group-hover:text-zinc-50 dark:group-hover:bg-zinc-50 dark:group-hover:text-zinc-900 font-semibold" variant="outline">
                                            {ver.buttonText} <ArrowRight className="ml-2 h-4 w-4" />
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
