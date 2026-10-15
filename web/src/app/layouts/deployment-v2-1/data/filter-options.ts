// PROTOTYPE-ONLY — filter-sidebar options for Deployment V2.
// mock: none (the sidebar's built-in name lists, which the mock data uses).
// live: the v4 lookup APIs, as { label: name, value: id } — farmer_id, village_id, AZ id, surveyor / verifier phone.
"use client";

import * as React from "react";
import { isLiveMode } from "./data-mode";
import { lookupApi, type FilterOption } from "./live-api";

type OptionField = "farmers" | "villages" | "azs" | "surveyors" | "verifiedBy";

export interface DeploymentFilterOptions {
    optionsByField?: Partial<Record<OptionField, FilterOption[]>>;
    optionErrors?: Partial<Record<OptionField, string>>;
}

const LOOKUPS: Record<OptionField, () => Promise<{ options: FilterOption[]; pagesLoaded: number; totalPages: number }>> = {
    farmers: lookupApi.farmers,
    villages: lookupApi.villages,
    azs: lookupApi.azs,
    surveyors: lookupApi.surveyors,
    verifiedBy: lookupApi.verifiers,
};

let cached: Promise<DeploymentFilterOptions> | null = null;

function loadLiveOptions(): Promise<DeploymentFilterOptions> {
    if (!cached) {
        cached = Promise.all(
            (Object.keys(LOOKUPS) as OptionField[]).map(async (field) => {
                try {
                    const { options } = await LOOKUPS[field]();
                    return { field, options };
                } catch (error) {
                    return { field, error: (error as Error)?.message ?? "Failed to load options" };
                }
            })
        ).then((results) => {
            const result: DeploymentFilterOptions = { optionsByField: {}, optionErrors: {} };
            for (const r of results) {
                // A failed field gets no options (never the built-in mock names) plus its error.
                result.optionsByField![r.field] = "options" in r ? r.options : [];
                if ("error" in r) result.optionErrors![r.field] = `Couldn't load options: ${r.error}`;
            }
            // A failed lookup is retried the next time the sidebar mounts.
            if (Object.keys(result.optionErrors!).length > 0) cached = null;
            return result;
        });
    }
    return cached;
}

function useMockFilterOptions(): DeploymentFilterOptions {
    return {};
}

function useLiveFilterOptions(): DeploymentFilterOptions {
    // Until the lookups answer, every field shows an empty list (never the mock names).
    const [state, setState] = React.useState<DeploymentFilterOptions>({
        optionsByField: { farmers: [], villages: [], azs: [], surveyors: [], verifiedBy: [] },
    });
    React.useEffect(() => {
        let active = true;
        loadLiveOptions().then((result) => {
            if (active) setState(result);
        });
        return () => {
            active = false;
        };
    }, []);
    return state;
}

export const useDeploymentFilterOptions = isLiveMode ? useLiveFilterOptions : useMockFilterOptions;
