"use client"

// PLATFORM ADAPTER — in-app links.
// Portable code uses <AppLink href="…"> instead of importing a router's Link directly.
//
// mati-demo (Next.js): wraps next/link.
// Production (matic-dash, React Router 7): `import { Link } from "react-router-dom"` and pass `to={href}`.

import * as React from "react"
import NextLink from "next/link"

export type AppLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string
}

export const AppLink = React.forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink({ href, ...props }, ref) {
    return <NextLink ref={ref} href={href} {...props} />
})
