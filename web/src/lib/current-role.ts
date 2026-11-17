"use client"

// Who is using the app, until sign-in exists: a role picked in the user menu ("Signed in as") and kept in this browser
// (`mati.role`). It decides what each role may do (edit the registration survey, move farmer statuses); it is not
// security, since anyone can switch. Roles are those of Masters - Users.
import * as React from "react"
import { USER_ROLES, type UserRoleName } from "@/app/layouts/survey-builder/lib/master-data-registry"

export const ROLES = USER_ROLES
export type Role = UserRoleName

const KEY = "mati.role"
const EVENT = "mati-role-change"
/** Full access by default, as before roles existed. */
export const DEFAULT_ROLE: Role = "Super Admin"

const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v)

export function loadRole(): Role {
    if (typeof window === "undefined") return DEFAULT_ROLE
    try {
        const v = window.localStorage.getItem(KEY)
        return isRole(v) ? v : DEFAULT_ROLE
    } catch {
        return DEFAULT_ROLE
    }
}

export function saveRole(role: Role) {
    try {
        window.localStorage.setItem(KEY, role)
    } catch {
        /* ignore */
    }
    window.dispatchEvent(new Event(EVENT))
}

const subscribe = (onChange: () => void) => {
    window.addEventListener(EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
        window.removeEventListener(EVENT, onChange)
        window.removeEventListener("storage", onChange)
    }
}

/** The current role; re-renders when it's switched (here or in another tab). */
export function useCurrentRole(): Role {
    return React.useSyncExternalStore(subscribe, loadRole, () => DEFAULT_ROLE)
}

/** Only a Super Admin edits built-in surveys. */
export const canEditSystemSurveys = (role: Role) => role === "Super Admin"
