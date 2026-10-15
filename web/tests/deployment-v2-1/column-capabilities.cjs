// Deployment V2.1 — the dispatch table's column capability matrix, verified 2026-10-11 against the API contract
// (src/app/layouts/deployment-v2-1/data/api-contract.ts: sort ids, filter keys), the query mapper (data/query-mapper.ts:
// SORT_BY_COLUMN, MAPPED_FILTERS) and the filter sidebar (components/filter-sidebar.tsx: its sections). Shared by the
// browser suites (the rendered header menus must match it) and check-live-api.mjs (it must match the contract).
//   hide       Hide column — a frontend action, every column
//   sortBy     the v4 `sort_by` the header's Asc / Desc sends; null = no API sort → no Asc / Desc
//   filterKey  the contract filter the header's Filter opens; null = no API filter or no filter UI → no Filter
//   filterUi   the filter sidebar section it opens
// Notes: AZ name has no filter key of its own — its Filter opens the AZ section (az_ids), the same filter as AZ code.
// Status is filtered by the status tabs (the contract's `status`), which have no column filter UI → sort only.
// Boundaries is derived in the browser (saved outlines / plots from the dispatch read) → nothing to sort or filter.
const COLUMNS = [
    { title: "Submitted on", id: "submittedOn", hide: true, sortBy: "created_at", filterKey: "submittedOn", filterUi: "Submitted on" },
    { title: "Dispatch ID", id: "dispatch", hide: true, sortBy: null, filterKey: null, filterUi: null },
    { title: "Farmer", id: "farmer", hide: true, sortBy: "farmer_name", filterKey: "farmer", filterUi: "Farmers" },
    { title: "Village", id: "village", hide: true, sortBy: "village_name", filterKey: "village", filterUi: "Villages" },
    { title: "Plots", id: "plots", hide: true, sortBy: "plots", filterKey: null, filterUi: null },
    { title: "Boundaries", id: "dispatchBoundaries", hide: true, sortBy: null, filterKey: null, filterUi: null },
    { title: "Area", id: "area", hide: true, sortBy: "actual_area", filterKey: null, filterUi: null },
    { title: "Cal. Area", id: "calArea", hide: true, sortBy: "calculated_area", filterKey: null, filterUi: null },
    { title: "AZ code", id: "azs", hide: true, sortBy: "az_code", filterKey: "azs", filterUi: "AZ" },
    { title: "AZ name", id: "azName", hide: true, sortBy: "az_name", filterKey: "azs", filterUi: "AZ" },
    { title: "Deployed", id: "deployed", hide: true, sortBy: "deployed_amount", filterKey: null, filterUi: null },
    { title: "Status", id: "status", hide: true, sortBy: "status", filterKey: null, filterUi: null },
    { title: "Surveyor", id: "surveyor", hide: true, sortBy: "surveyor_name", filterKey: "surveyor", filterUi: "Surveyors" },
    { title: "Verified By", id: "verifiedBy", hide: true, sortBy: "verified_by", filterKey: "verifiedBy", filterUi: "Verified By" },
    { title: "Verified On", id: "verifiedOn", hide: true, sortBy: null, filterKey: "verifiedOn", filterUi: "Verified On" },
]
/** Shown on the All / Verified tabs only (V2's tabs). */
const VERIFIED_TAB_ONLY = ["verifiedBy", "verifiedOn"]
/** The header menu a column must render, in order (nothing disabled or decorative). */
const menuOf = (c) => [...(c.filterKey ? ["Filter"] : []), ...(c.sortBy ? ["Asc", "Desc"] : []), ...(c.hide ? ["Hide column"] : [])]

module.exports = { COLUMNS, VERIFIED_TAB_ONLY, menuOf }
