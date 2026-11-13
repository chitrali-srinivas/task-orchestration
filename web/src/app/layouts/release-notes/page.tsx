// Release notes, opened from the version in the page footer. The notes live in lib/release-notes.ts.
import { format, parseISO } from "date-fns";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { APP_VERSION, RELEASE_NOTES } from "@/lib/release-notes";

function List({ title, items }: { title: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{title}</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

export default function ReleaseNotesPage() {
    return (
        <NavBarType4 pageTitle="Release notes" activeItemUrl="/layouts/release-notes" pageDescription="What changed in each version of the product, newest first.">
            <div className="h-[calc(100vh-64px)] overflow-y-auto p-6">
                <div className="mx-auto max-w-2xl space-y-6">
                    {RELEASE_NOTES.map((release) => (
                        <section key={release.version} className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                    v{release.version}
                                    {release.version === APP_VERSION && (
                                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                            Current
                                        </span>
                                    )}
                                </h2>
                                <span className="text-xs text-zinc-500">{format(parseISO(release.date), "d MMM yyyy")}</span>
                            </div>
                            <List title="New" items={release.added} />
                            <List title="Changed" items={release.changed} />
                        </section>
                    ))}
                </div>
            </div>
        </NavBarType4>
    );
}
