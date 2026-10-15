// PROTOTYPE-ONLY — where a LIVE call's bearer token comes from, in order (production matic-dash: the signed-in
// Firebase user's ID token, refreshed on 401 / invalid_token — services/api.ts getAuthenticatedToken):
//   firebase-session  the app's own Firebase session (src/lib/firebase.ts; the sign-in page). Accepted by the Matic API
//                     only when mati-demo's NEXT_PUBLIC_FIREBASE_* point at the same Firebase project as matic-dash's
//                     VITE_FIREBASE_* — the API verifies ID tokens of that project.
//   dev-token         the prototype's manual fallback: a matic-dash dev session's token placed in this browser's
//                     localStorage under `mati_dev_auth_token` (never stored in the repo, never read by tooling).
//   none              live mode refuses the call before any request (an honest 401 in the UI and the Inspector).
// Nothing here logs, traces or returns a token to the UI: callers get the token for the request and the SOURCE name.
"use client"

import * as React from "react"
import { isLiveMode } from "./data-mode"

export const DEV_AUTH_TOKEN_STORAGE_KEY = "mati_dev_auth_token"

export type AuthSource = "firebase-session" | "dev-token" | "none"

export interface AuthSourceState {
    /** A Firebase user is signed in to this app. */
    firebaseUser: boolean
    /** A dev token is present in localStorage (presence only). */
    devToken: boolean
    /** The source a live call would use now. */
    source: AuthSource
    /** Firebase's initial auth state has been read (false: still unknown). */
    ready: boolean
}

export const AUTH_SOURCE_LABEL: Record<AuthSource, string> = {
    "firebase-session": "the app's Firebase session",
    "dev-token": "the dev token in localStorage",
    none: "no session",
}

/**
 * The origin whose localStorage the dev token is read from ("http://localhost:3108"). localStorage is per origin: a
 * token set on another port / host (or at 127.0.0.1 instead of localhost) is invisible here — the messages name the
 * origin so a token stored elsewhere is recognised at once. Empty outside a browser.
 */
export const pageOrigin = (): string => (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "")

/** Firebase is used only in LIVE mode and only in a real browser (never in node checks, where `document` is absent). */
const canUseFirebase = () => isLiveMode && typeof window !== "undefined" && typeof document !== "undefined"

export function readDevToken(): string | null {
    try {
        return window.localStorage.getItem(DEV_AUTH_TOKEN_STORAGE_KEY)?.trim() || null
    } catch {
        return null
    }
}

async function firebaseAuth() {
    const [{ auth }, { getIdToken }] = await Promise.all([import("@/lib/firebase"), import("firebase/auth")])
    await auth.authStateReady()
    return { auth, getIdToken }
}

/** The bearer token for one live call and where it came from. `forceRefresh` re-mints a Firebase token (after a 401). */
export async function resolveAuthToken(forceRefresh = false): Promise<{ token: string | null; source: AuthSource }> {
    if (canUseFirebase()) {
        try {
            const { auth, getIdToken } = await firebaseAuth()
            const user = auth.currentUser
            if (user) return { token: await getIdToken(user, forceRefresh), source: "firebase-session" }
        } catch {
            // Firebase not configured / unavailable: the dev token (below) still applies.
        }
    }
    const dev = readDevToken()
    return dev ? { token: dev, source: "dev-token" } : { token: null, source: "none" }
}

const INITIAL: AuthSourceState = { firebaseUser: false, devToken: false, source: "none", ready: false }

/** The session state the Data / API Inspector and the mode badge show (presence only — never a token). */
export function useAuthSourceState(): AuthSourceState {
    const [state, setState] = React.useState<AuthSourceState>(INITIAL)
    React.useEffect(() => {
        let unsubscribe: (() => void) | undefined
        let active = true
        const compute = (firebaseUser: boolean, ready: boolean) => {
            const devToken = readDevToken() !== null
            setState({ firebaseUser, devToken, source: firebaseUser ? "firebase-session" : devToken ? "dev-token" : "none", ready })
        }
        compute(false, false)
        if (canUseFirebase()) {
            Promise.all([import("@/lib/firebase"), import("firebase/auth")]).then(([{ auth }, { onAuthStateChanged }]) => {
                if (!active) return
                unsubscribe = onAuthStateChanged(auth, (user) => compute(!!user, true), () => compute(false, true))
            }).catch(() => compute(false, true))
        } else {
            compute(false, true)
        }
        const recheckDevToken = () => setState((s) => ({ ...s, devToken: readDevToken() !== null, source: s.firebaseUser ? "firebase-session" : readDevToken() ? "dev-token" : "none" }))
        // `storage` fires only in OTHER tabs: a token set from this tab's own DevTools console is picked up when the tab
        // regains focus / becomes visible (and on reload) — every request reads the storage afresh anyway.
        const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === DEV_AUTH_TOKEN_STORAGE_KEY) recheckDevToken() }
        const onVisible = () => { if (document.visibilityState === "visible") recheckDevToken() }
        window.addEventListener("storage", onStorage)
        window.addEventListener("focus", recheckDevToken)
        document.addEventListener("visibilitychange", onVisible)
        return () => {
            active = false
            unsubscribe?.()
            window.removeEventListener("storage", onStorage)
            window.removeEventListener("focus", recheckDevToken)
            document.removeEventListener("visibilitychange", onVisible)
        }
    }, [])
    return state
}
