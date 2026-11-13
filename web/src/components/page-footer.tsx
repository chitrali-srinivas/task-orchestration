"use client"

// Footer under the list pages: the version (opens the release notes), the rights line (opens the terms), the session
// id and when the page's data was last loaded. Items never wrap inside; on a narrow page the right group moves down.
import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { RefreshCw } from "lucide-react"
import { APP_VERSION } from "@/lib/release-notes"

/** Where "All rights reserved" goes. Placeholder until the terms page exists. */
export const TERMS_URL = "#terms"

const TEXT = "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
const LINK = `${TEXT} underline decoration-zinc-300 dark:decoration-zinc-600 hover:decoration-zinc-500 underline-offset-2`

export function PageFooter({ sessionId, onRefresh }: { sessionId: string; /** Reloads the page's data; without it the time is shown with no button. */ onRefresh?: () => void }) {
    const [refreshedAt, setRefreshedAt] = React.useState(() => new Date())
    const time = (
        <span suppressHydrationWarning>{format(refreshedAt, "dd MMM yyyy, hh:mm aa")}</span>
    )

    return (
        <div className="shrink-0 py-3 px-1 border-t border-zinc-100 dark:border-zinc-800 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                <div className="flex items-center gap-4">
                    <Link href="/layouts/release-notes" className={`${LINK} normal-case`} title="Release notes">
                        v{APP_VERSION}
                    </Link>
                    <span className="opacity-30">|</span>
                    <a href={TERMS_URL} className={LINK} title="Terms and conditions">
                        All rights reserved by Mati Carbon Pvt
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="opacity-50">Session ID:</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">{sessionId}</span>
                    </div>
                    <span className="opacity-30">|</span>
                    {onRefresh ? (
                        <button
                            type="button"
                            onClick={() => {
                                onRefresh()
                                setRefreshedAt(new Date())
                            }}
                            className={`flex items-center gap-1.5 uppercase tracking-wider ${TEXT}`}
                            title="Refresh"
                            aria-label="Refresh"
                        >
                            <RefreshCw className="h-3 w-3" />
                            {time}
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400" title="Loaded">
                            <RefreshCw className="h-3 w-3" />
                            {time}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
