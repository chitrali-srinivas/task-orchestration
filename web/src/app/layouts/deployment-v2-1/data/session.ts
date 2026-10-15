// PROTOTYPE-ONLY (session source) / PORT-BOUND (permission rule) — the signed-in verifier for the detail workflow.
// mock: MOCK_ADMIN + ?mockPermission (mock-backend.ts).
// live: POST /api/v1/auth/bootstrap (no body), as matic-dash userService.getAuthenticatedUser does on every load.
//   Only user.phone_no (sent as franchise_verifier_id), user.display_name and permissions[] are read; nothing else
//   from the response (it may carry credentials) is kept, logged or stored.
//   Permission rule = matic-dash lib/permissions.ts normalisation + lib/rbac.ts exact-key match, per base access.
//   Production: replaced by matic-dash's usePermissionAccess / mati_admin_phone_no.
"use client";

import * as React from "react";
import { isLiveMode } from "./data-mode";
import { MOCK_ADMIN, getMockPermissions, type MockPermissions } from "./mock-backend";
import { matiApi } from "./api-client";

export interface DeploymentSession {
    status: "loading" | "ready" | "error";
    /** franchise_verifier_id for mutations (matic-dash: mati_admin_phone_no). */
    verifierPhone: string | null;
    displayName: string;
    permissions: MockPermissions;
    error?: string;
}

export const DEPLOYMENT_EDIT_PERMISSION = "verifier.farm.deployment_verification.create";
export const DEPLOYMENT_DELETE_PERMISSION = "verifier.farm.deployment_verification.delete";
/** V2.1 (M1): the AWD / Mati Boost workflow keys (matic-dash route-permissions.json). */
export const AWD_EDIT_PERMISSION = "verifier.farm.awd_deployment_verification.create";
export const MATI_BOOST_EDIT_PERMISSION = "verifier.farm.mati_boost_deployment_verification.create";

/** matic-dash lib/permissions.ts normalisePermissionKey (module-prefix rewrites; no farm aliases exist). */
export function normalisePermissionKey(key: string): string {
    return key
        .trim()
        .replace(/^verifierdash\./, "verifier.")
        .replace(/^verifier\.farm_app\./, "verifier.farm.")
        .replace(/^verifier\.warehouse_app\./, "verifier.warehouse.")
        .replace(/^verifier\.lab_app\./, "verifier.lab.")
        .replace(/^verifier\.supply_and_demand\./, "verifier.supply_demand.")
        .replace(".enagement_verification.", ".engagement_verification.");
}

interface BootstrapUser { phone_no?: unknown; display_name?: unknown }
interface BootstrapData {
    user?: BootstrapUser;
    permissions?: unknown;
    access?: { base?: unknown };
    current_access?: { base?: unknown };
}

const toPermissionKey = (p: unknown): string | null => {
    if (typeof p === "string") return p;
    if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        const k = o.permission_key ?? o.permission ?? o.accessLevel ?? o.access_level ?? o.key ?? o.name;
        return typeof k === "string" ? k : null;
    }
    return null;
};

/** Reads the fields V2 needs from a bootstrap response. Exported for tests. */
export function toSession(data: BootstrapData): DeploymentSession {
    const user = data.user ?? {};
    const phone = typeof user.phone_no === "string" && user.phone_no.trim() ? user.phone_no.trim() : null;
    const name = typeof user.display_name === "string" && user.display_name.trim() ? user.display_name.trim() : "You";
    const keys = new Set((Array.isArray(data.permissions) ? data.permissions : []).map(toPermissionKey).filter((k): k is string => !!k).map(normalisePermissionKey));
    // rbac.ts: permissions are checked against the selected base's access entry; without any base access → none.
    const bases = [data.access?.base, data.current_access?.base].flatMap((b) => (Array.isArray(b) ? b : b ? [b] : []));
    const hasBase = bases.length > 0;
    // V2 also requires a verifier phone for edit: every mutation carries it as franchise_verifier_id (matic-dash
    // would send null when mati_admin_phone_no is unset).
    return {
        status: "ready",
        verifierPhone: phone,
        displayName: name,
        permissions: {
            edit: hasBase && phone !== null && keys.has(DEPLOYMENT_EDIT_PERMISSION),
            delete: hasBase && keys.has(DEPLOYMENT_DELETE_PERMISSION),
            awdEdit: hasBase && phone !== null && keys.has(AWD_EDIT_PERMISSION),
            matiBoostEdit: hasBase && phone !== null && keys.has(MATI_BOOST_EDIT_PERMISSION),
        },
    };
}

const LOADING: DeploymentSession = { status: "loading", verifierPhone: null, displayName: "You", permissions: { edit: false, delete: false, awdEdit: false, matiBoostEdit: false } };

let cached: Promise<DeploymentSession> | null = null;
function loadLiveSession(): Promise<DeploymentSession> {
    if (!cached) {
        cached = matiApi
            .post<{ data?: BootstrapData & { data?: BootstrapData } }>("/api/v1/auth/bootstrap", undefined)
            .then(({ body }) => {
                const data = body?.data?.data ?? body?.data;
                if (!data?.user) throw new Error("Bootstrap response has no user");
                return toSession(data);
            })
            .catch((error: unknown) => {
                cached = null; // retried on the next mount
                return { ...LOADING, status: "error" as const, error: error instanceof Error ? error.message : String(error) };
            });
    }
    return cached;
}

/** V2.1: ?mockVerifier=nophone → a verifier without a phone (exercises the "no verifier id → view only" gate). */
const mockVerifierPhone = () =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mockVerifier") === "nophone" ? null : MOCK_ADMIN.phone;

function useMockSession(): DeploymentSession {
    return React.useMemo(() => ({ status: "ready", verifierPhone: mockVerifierPhone(), displayName: MOCK_ADMIN.name, permissions: getMockPermissions() }), []);
}

/** Live: actions stay disabled until the verifier is known (and stay disabled if bootstrap fails). */
function useLiveSession(): DeploymentSession {
    const [session, setSession] = React.useState<DeploymentSession>(LOADING);
    React.useEffect(() => {
        let active = true;
        loadLiveSession().then((s) => {
            if (active) setSession(s);
        });
        return () => {
            active = false;
        };
    }, []);
    return session;
}

export const useDeploymentSession = isLiveMode ? useLiveSession : useMockSession;
