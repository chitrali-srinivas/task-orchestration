# src/platform — framework adapters

The only place where port-bound code touches the host framework. Everything else in a port-bound
feature is plain React + TypeScript and moves to production unchanged.

| Adapter | mati-demo (Next.js 16) | matic-dash (Vite 6 + React Router 7) equivalent |
|---|---|---|
| `link.tsx` → `<AppLink href>` | `next/link` | `<Link to={href}>` from `react-router-dom` |
| `navigation.ts` → `useAppNavigate()`, `useAppSearchParams()` | `next/navigation` | `useNavigate()`, `useSearchParams()[0]` |
| `client-only.tsx` → `clientOnly(loader, { loading })` | `next/dynamic` with `ssr: false` | `React.lazy(loader)` + `<Suspense fallback>` |
| `env.ts` → `env.googleMapsApiKey` | `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` |

ESLint enforces the boundary (`eslint.config.mjs`): port-bound files may not import `next/*`,
`@/mocks/*`, or read `process.env`. See `docs/PORTABILITY.md`.
