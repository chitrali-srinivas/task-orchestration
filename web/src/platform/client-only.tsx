"use client"

// PLATFORM ADAPTER — lazily loaded, browser-only components (maps, charts, anything touching `window`).
//
// mati-demo (Next.js): next/dynamic with `ssr: false`.
// Production (matic-dash, Vite SPA — no server rendering): `React.lazy(loader)` rendered inside
//   `<Suspense fallback={loading()}>`.

import type { ComponentType, ReactNode } from "react"
import dynamic from "next/dynamic"

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>

export function clientOnly<P extends object>(loader: Loader<P>, options: { loading?: () => ReactNode } = {}) {
    return dynamic<P>(loader, { ssr: false, loading: options.loading })
}
