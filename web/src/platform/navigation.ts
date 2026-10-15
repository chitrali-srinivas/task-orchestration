"use client"

// PLATFORM ADAPTER — programmatic navigation and URL query parameters.
//
// mati-demo (Next.js): next/navigation.
// Production (matic-dash, React Router 7):
//   useAppNavigate     → `const navigate = useNavigate(); return (href) => navigate(href)`
//   useAppSearchParams → `const [params] = useSearchParams(); return params`

import { useRouter, useSearchParams } from "next/navigation"

export function useAppNavigate(): (href: string) => void {
    const router = useRouter()
    return (href: string) => router.push(href)
}

/** Read-only URL query parameters (`.get()`, `.has()`, …). */
export function useAppSearchParams(): Pick<URLSearchParams, "get" | "getAll" | "has" | "toString"> {
    return useSearchParams()
}
