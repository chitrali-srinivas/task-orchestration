# Table & Data-Interaction Migration Audit: mati-demo → matic-dash

- **Date:** 2026-09-23
- **Scope:** Read-only audit. Nothing was modified in either project.
- **Method:** Everything here comes from reading the source of both apps. Neither app was run.
- **Path shorthand:** `D:` = `mati-demo/src/`, `P:` = `matic-dash/src/`.
- **Demo layouts covered:** `/layouts/season-management`, `/layouts/engagement`, `/layouts/deployment`.
- **Unconfirmed items** are marked "Not established from source" or "inferred".

---

# 1. Executive Summary

1. **Production already has a partial port of the demo system.**
   - It is `GenericDataTable` (P:components/generic-table/), used by **/engagement** and **/hse/reports**.
   - It matches the demo's toolbar: tabs with counts, a filter-count pill, and an "eye" button for showing and hiding columns.
   - It also matches the demo's right-hand 380px filter sheet, hover-card cells, badges, and per-tab column dropping.
   - It goes further than the demo in two ways: filters are applied server-side through adapter functions, and filter options are fetched from the server, searchable and paged.
   - **The migration should build on this system, not on `dyanmic-table-1.tsx`.**

2. **The demo's "server" is a mock.**
   - `D:lib/server-table/mock-server-service.ts` searches, filters, sorts and pages the full dataset in memory, with 400–700 ms of fake latency.
   - Worth copying is the behaviour it simulates:
     - one query shape: {page, pageSize, search, columnSearches, filters, sort}
     - debounced search
     - reset to page 1 when the query changes
     - cancelling superseded requests, and ignoring stale responses
     - loading, error and empty states
   - The mock code itself should not be copied.

3. **Almost no production list API supports free-text search.**
   - The only list endpoint with a `search` param is `GET /adminLabApp/getSampleList` (`&search=`, P:services/api.ts:3569).
   - HSE's `POST /hseSystem/v1/incidentReport` has `verified_by.text_search` plus `sort_by`/`sort_type`.
   - Engagement v4 has no search or sort fields (P:components/engagement/api/types.ts:3-17).
   - **Correct server-side search needs backend work on nearly every table.**

4. **Production `DataTable` pages already have broken server pagination.**
   - **Page number missing from the cache key**, so changing page never refetches: `useDeploymentData`, `useAWDData`, `useMatiBoostData`, `useControlFieldDataByFarmerId`, `useDeploymentSamplesData`.
   - **Page-size mismatch:** most APIs request 500 rows while the UI calculates pages as 100 rows.
   - **Page 1 never loads on its own:** LabCarts and LabShipment only query when `!!page_index`, which is false on page 1 (index 0).
   - **Shared cache keys:** Qualified/Disqualified share one, and so do FarmerVerification/EnrolledVerification.

5. **The demo has bugs that must not be ported.**
   - **Status tab lost (Engagement and Deployment):** the tab filter is silently dropped whenever a column filter changes. `use-server-table.ts:230-234` only protects keys named `tabStatus`/`statusTab`, but Engagement stores the tab under `status`.
   - **No pagination UI:** only the first 20 rows are reachable.
   - **Hardcoded sidebar options** that mostly don't match the data.
   - **Sort does nothing** on the object and computed columns.
   - **Spinner on every fetch:** each fetch replaces the table body with a 400px spinner.
   - **Season Management:** the global search is wired up but never rendered, and clear-all leaves the date filters applied.

6. **Production shows a full-screen loading overlay on every request through the `api` axios instance** (P:services/api.ts:91,109).
   - That instance has no pending-request counter.
   - The request layer needs a per-request way to skip this overlay. Otherwise it would cover the table on every search keystroke.

7. **Production's UI primitives are sized differently from the demo's.**
   - For example, `TableHead` is h-10 px-2 vs h-12 px-4, the icon Button is h-9 vs h-10, and Tabs are h-9 vs h-10.
   - The demo look must be applied inside the table-system components.
   - Changing `P:components/ui/*` would restyle the whole app.

8. **Recommended pilot: /engagement** (`EngagementPage` + `GenericDataTable`).
   - It is the direct production counterpart of the demo's Engagement layout: the same columns, tabs and architecture.
   - It has no row selection, no URL-driven state, and only one table on the page.
   - Limit: server search and sort can't be tested there until the backend adds the params.

---

# 2. Demo Architecture Map

```
/layouts/engagement/page.tsx  (identical structure: /layouts/deployment/page.tsx)
 ├─ NavBarType4 (layout shell; page root h-[calc(100vh-64px)] p-6)
 ├─ createEngagementTableConfig(engagementData)      data/table-config.ts   [demo/mock]
 ├─ useServerTable({config, initialFilters:{status}, initialPageSize:20, debounceMs:350})
 │    └─ MockTableService.fetch(query, signal)       lib/server-table/mock-server-service.ts [mock]
 ├─ EngagementTable                                   components/data-table.tsx  (owns useReactTable, manual*)
 │    ├─ DataTableToolbar                             components/data-table-toolbar.tsx
 │    │    ├─ Tabs (status + counts)  ├─ filter pill / button  ├─ Eye → column visibility
 │    │    └─ FilterSidebar (Sheet)                   app/components/filter/components/FilterSidebar.tsx
 │    ├─ header: columns[].header → DataTableColumnHeader   components/data-table-column-header.tsx
 │    │    (menu: Clear filter / Search → inline input / Filter → meta.openFilterForColumn / Asc / Desc / Hide)
 │    ├─ body states: loading (Loader2) | error (+Retry) | rows | empty (filtered vs not, +Clear)
 │    └─ (DataTablePagination exists — NOT rendered)
 ├─ columns.tsx (columns / allColumns; HoverCards; status badge)
 └─ EngagementDetailSheet (next/prev over current page)

/layouts/season-management/page.tsx
 ├─ TableConfig inline (searchableFields, customFilterHandlers, summary counts)    [mock]
 ├─ useServerTable({initialFilters:{statusTab:"All",...}, initialPageSize:1000, debounceMs:350})
 ├─ useReactTable owned BY THE PAGE (manual*; meta.openFilterForColumn)
 ├─ SeasonToolbar (tabs, filter pill, eye, Table/Timeline switch, + New Season)
 ├─ SeasonTable (presentational; same markup as EngagementTable body)
 ├─ columns.tsx → imports deployment's DataTableColumnHeader (onOpenFilter prop)
 ├─ SeasonFilterSidebar (data-derived options, draft resync on open)
 ├─ SeasonTimeline (alternate view over serverTable.data)
 └─ SeasonDetailSheet (create/edit CRUD → dataset → new service → refetch)
```

### Classification

**Categories:** A = shared component · B = shared hook/util · C = shared styling · D = layout-specific · E = page-specific · F = demo/mock infrastructure, do not copy.

| Piece | Category | Generic? | Has business logic? | Safe for production? |
|---|---|---|---|---|
| D:app/layouts/deployment/components/data-table-column-header.tsx (engagement copy is identical) | A | Yes | No | **Yes, after changes:** keep search values separate from column filters, add ARIA, drop `shadow-2xs` |
| engagement/components/data-table.tsx, season-table.tsx (body markup and states) | A/C | Mostly (`colSpan={columns.length}` ignores hidden columns) | No | **Use as a visual spec only.** Rebuild inside `GenericDataTable` |
| data-table-toolbar.tsx, season-toolbar.tsx | D | No (tabs and filter-id mapping are hardcoded) | Yes | Visual pattern only. Production `GenericToolbar` already matches it |
| FilterSidebar.tsx | D + F | No (engagement fields and mock options are hardcoded) | Yes | **No.** Keep `GenericFilterSidebar`; port only the "open at this field" behaviour |
| season-filter-sidebar.tsx | E | No | Yes | Ideas only: options derived from the data, and the draft re-syncing on open |
| lib/server-table/types.ts (`TableQuery`, `TableResponse`) | B | Yes | No | **Yes, as a contract** |
| lib/server-table/use-server-table.ts | B | Mostly | Yes (the filter-sync logic is buggy) | **Copy the behaviour only.** Reimplement it on React Query |
| lib/server-table/mock-server-service.ts | F | Yes | Simulates the server | **Never copy** |
| data/table-config.ts (searchableFields, customFilterHandlers) | F | No | Server-side logic | No. This logic belongs in the backend |
| data-table-pagination.tsx (three copies) | A (unused) | Yes | No | Optional. Nothing renders it |
| data-table-faceted-filter.tsx | A (unused) | Yes | No | Not needed |
| columns.tsx cells (HoverCard, phone masking, status badge) | E | No | Some | Production already has equivalents (P:components/engagement/components/columns.tsx) |
| globals.css `.scrollbar-minimal` (:100-123) | C | Yes | No | Yes. Production has no equivalent; `GenericDataTable` uses an inline `<style>` instead |

---

# 3. Demo Table/Data Interaction System

### Query and response shape (D:lib/server-table/types.ts)

- **Query:** `{page (1-based), pageSize, search, columnSearches, filters, sort:{field,direction}|null}`
- **Response:** `{rows, totalCount, page, pageSize, pageCount, hasNextPage, hasPreviousPage, summaryCounts?}`

### Who owns which state

- **`useServerTable` owns:**
  - the global search draft and its debounced value
  - column-search drafts and their debounced values
  - filters, sorting and pagination
  - the response data and loading/error state
  - the request id used to detect stale responses
- **The table component or page owns:**
  - TanStack `columnFilters` (a UI mirror of the query state)
  - `columnVisibility` and `rowSelection`
  - whether the filter sidebar is open, and which field it should open at

### How requests are made (use-server-table.ts)

- **Debouncing:** 350 ms, applied only to global search (:67-77) and column search (:80-87). Both reset to page 0.
- **No debounce for the rest:** filters, sort and pagination refetch immediately through `fetchData`'s dependencies (:145-153).
- **Cancelling old requests:** each new fetch aborts the previous `AbortController` (:92-96).
- **Ignoring stale responses:** a `requestIdRef` check commits only the newest response (:98, :124, :139). `AbortError` is ignored (:135-138).
- **Resetting to page 1:** happens in `setFilter`/`setFilters` (:187, :196), on column-filter changes (:237), on sort changes (:260) and in `clearFilters` (:270). Changing page does not reset anything.

### How column filters feed the query (use-server-table.ts:203-242; Engagement and Deployment only)

1. String values become `columnSearches`; any other value becomes `filters[id]`.
2. Filter keys that are no longer present get deleted, **except `tabStatus` and `statusTab`**.
3. Engagement's tab key is `status`, so step 2 deletes it: the **tab-loss bug**.

Season doesn't use this function. It has its own mapper (season page.tsx:187-228) and names its tab key `statusTab`, so it isn't affected.

---

# 4. Demo Visual/UI Specification

These class strings are taken from the source.

| Element | Implementation |
|---|---|
| Page shell | `flex flex-col h-[calc(100vh-64px)] p-6 overflow-hidden min-w-0 w-full`; card: `bg-white flex-1 min-h-0 flex flex-col` |
| Toolbar row | `flex flex-row items-center justify-between gap-4 w-full mb-[16px]` (Season: `mb-3 gap-3 py-1`) |
| Tabs | TabsList: `h-10 w-max bg-muted p-1`. Trigger: `text-xs px-3 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm`. Counts: `ml-2 opacity-50 font-normal` |
| Filter control | Wrapper: `h-10 rounded-md border border-zinc-200 bg-white shadow-sm`. With no filters, a ghost icon button `h-10 w-10 rounded-none`. With filters: `pl-3 pr-1 gap-2 bg-zinc-100/50`, the text "N filters" (`text-sm font-medium`), a separator, and a ghost X button `h-8 w-8` |
| Column visibility | Outline icon button `h-10 w-10`. Menu: `w-[180px]`; label `text-xs font-semibold uppercase tracking-wider text-zinc-500`; `ScrollArea h-[300px]`; checkbox items |
| Table container | `rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden relative min-w-0 w-full bg-white`. Scroll wrapper: `flex-1 overflow-auto scrollbar-minimal` |
| Header row | thead: `sticky top-0 z-30 bg-background shadow-sm`. th: `whitespace-nowrap h-12 px-4 text-left align-middle bg-muted/50 border-b border-zinc-200 sticky top-0 z-30`, with style `minWidth: columnDef.size` |
| Header trigger | Ghost `-ml-3 h-8 px-3`; title `text-xs font-semibold text-zinc-900`. Active-filter dot: `h-1.5 w-1.5 rounded-full bg-zinc-900 animate-pulse ml-1.5`. Sorted: ArrowUp/ArrowDown `h-3.5 w-3.5`. Unsorted: ChevronDown `opacity-0 group-hover/header:opacity-100`, rotated 180° while the menu is open |
| Column menu | `DropdownMenuContent align="start" sideOffset={4} w-48 p-1 shadow-lg rounded-lg z-[300]`; items `text-xs py-1.5 px-2.5 rounded-md`. Order: Clear filter (red, only when filtered, then a separator) → Search → Filter → separator → Asc (check mark when active) → Desc → separator → Hide |
| Inline search | Replaces the header: `h-7 min-w-[100px] max-w-[170px] rounded-md border border-zinc-300 px-2 shadow-2xs focus-within:border-zinc-500 focus-within:ring-1`. Search icon `h-3.5` on the left, input `text-xs`, placeholder `Search {title}...`, clear X `h-4 w-4`. The sort arrow stays visible |
| Body row | `cursor-pointer transition-all hover:bg-muted/50 data-[state=selected]:bg-muted animate-in fade-in slide-in-from-bottom-1 duration-300` (Season: `transition-colors … fade-in duration-200`). Selected: `bg-muted/50` |
| Cell | `whitespace-nowrap p-4 align-middle`, `minWidth: size`. **Nothing truncates.** Wide tables scroll horizontally |
| Loading | **Replaces the body:** row → cell `p-0` → `h-[400px] animate-in fade-in duration-500` → sticky centred block `w-[calc(100vw-var(--sidebar-width)-3rem)]` → Loader2 `h-8 w-8 text-zinc-300 animate-spin` + "LOADING RECORDS..." (`text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400`). The existing rows are **not** kept visible |
| Error | Replaces the body. Engagement: "Couldn't load records", then `error.message`, then an outline Retry button `h-8 text-xs` with the RotateCcw icon. Season: a red AlertCircle, "Failed to load seasons", and a Retry button with RefreshCw. The header stays visible |
| Empty | Cell `h-48 text-center`. With active filters: "No matching records found", "Try adjusting your search or filters.", and a "Clear all filters" button. Without: "No records found" and "There are no records in this category." Search-empty and filter-empty look the same. No icon |
| Filter sheet | Opens from the right: `w-full sm:max-w-[380px] p-0 border-l shadow-xl z-[300]`. Overlay: `bg-black/80 z-[150]`. Footer buttons: "Reset all" (changes the draft only) and "Apply now" |
| Multi-select field | The trigger shows removable chips (`text-[10px]`, max 130px). Popover: `w-[348px] max-h-[320px] z-[2000] modal={false}`, containing a search input (h-8), a list (max-h-200) with h-3.5 checkboxes, "No results found" when empty, and Clear/Close buttons |

**Classes that do nothing:** `shadow-2xs` and `scrollbar-none` have no effect in either app, because both run Tailwind 3.4. The demo's active PostCSS config is `postcss.config.js`, which takes precedence over `.mjs`.

---

# 5. Demo Behavior Specification

### Column search

**Opening**
- Open the header menu, then choose "Search". The inline input replaces the column title.
- The input is focused and its text selected when it opens (column-header:79-84).

**Typing and the request**
- Each keystroke calls `column.setFilterValue(value || undefined)`. The header itself doesn't debounce.
- The hook waits 350 ms after the last keystroke before searching.
- In Season, every keystroke also triggers `setFilters`, which fires an immediate request that the debounced request then cancels.
- Starting a column search resets to page 1.

**Keyboard and closing**
- Enter blurs the input.
- Escape clears the search and closes the input.
- Blur closes the input only when it's empty; a non-empty search stays open.
- The X button clears and closes. It blocks mousedown so the input doesn't blur first.
- The menu's "Clear filter" item also clears it.

**How it interacts with other state**
- A search survives sorting.
- A search **replaces** a sidebar filter on the same column, because both share one `columnFilters` entry.
- In Engagement, typing a search **drops the status tab** (the tab-loss bug).
- No state is stored in the URL, in any of the three layouts.

**Loading and empty:** loading uses the full-body spinner; no results shows the "No matching records" state.

### Column menu

- Opened from the ghost button in each header. It is a Radix DropdownMenu, `align=start`, `sideOffset=4`, 192px wide.
- Keyboard use, typeahead, Escape and outside-click all come from Radix.
- It animates in and out with the primitive's `data-[state=open]:animate-in fade-in-0 zoom-in-95 slide-in-from-top-2` classes and their closing mirror.
- Items are never disabled. An item is hidden when `getCanFilter()`, `getCanSort()` or `getCanHide()` is false.
- There is no "clear sort" item: once sorted, a column can only switch between Asc and Desc.

### Filtering

**Opening the sidebar**
- From the toolbar filter button, or from a column header's "Filter" item.
- The header item sets `initialOpenField`. After 250 ms the sidebar opens that field's picker and scrolls to it smoothly; 100 ms later it focuses the picker's search box.

**Filter types and matching**
- Multi-select: values within one field are OR-ed; different fields are AND-ed.
- Date range: two single-date calendars.
- Number range: min/max inputs (Deployment only).

**Applying and clearing**
- "Apply now" applies the draft and closes the sidebar.
- Per-field "Reset" and the popover's "Clear" change the draft only.
- The toolbar X clears everything. In Engagement that also clears the tab (bug); in Season it leaves date ranges applied (bug).

**Counts and draft behaviour**
- The filter pill counts only non-string filters. Column searches are not counted, but they do show the header dot.
- The Engagement sidebar never re-syncs its draft with the applied filters, so stale selections reappear. Season re-syncs every time the sidebar opens.
- Filter changes refetch immediately and reset to page 1.

### Sorting

- Asc/Desc in the menu call `column.toggleSorting(desc)`; the table uses `manualSorting`.
- The hook sends `{field: column.id, direction}` and resets to page 1.
- Unsorted columns show a chevron on hover.
- Sorting keeps the current search and filters.
- In the mock, sorting does nothing on object or computed column ids (farmer, surveyor, verifiedBy, verifiedOn), and `engagementType` strings get parsed as dates.

### Pagination

- The page index is 0-based in TanStack and 1-based in the query.
- Page size is 20 in Engagement/Deployment and 1000 in Season.
- `pageCount` and `rowCount` come from the response.
- **No pagination UI is rendered in any layout.** Engagement's Verified tab has 30 rows, so rows 21-30 can't be reached.
- The detail sheet's Next/Previous stops at the end of the current page.

---

# 6. Demo Animation & State Specification

| What animates | How | When |
|---|---|---|
| Rows | `animate-in fade-in slide-in-from-bottom-1 duration-300` (Season: `fade-in duration-200`), using tailwindcss-animate's `@keyframes enter` | On mount. Because loading replaces the body, the rows re-animate after every fetch |
| Loader block | `animate-in fade-in duration-500` + `animate-spin` | Every fetch |
| Filter dot | `animate-pulse`, always running | While a filter is active |
| Header chevron | `transition-transform duration-200`; `group-data-[state=open]/header:rotate-180`; opacity changes on hover | Hover, or when the menu opens |
| Menus, popovers, hover cards, selects | Radix `data-[state]` classes: fade-0, zoom-95, slide-2 | Open and close |
| Sheets | Overlay fades. Content uses `slide-in-from-right` (500 ms) and `slide-out-to-right` (300 ms), `ease-in-out` | Open and close |

- framer-motion is installed in the demo but none of these three layouts use it.
- The body shows exactly one state, in this priority order: `isLoading`, then `error`, then rows, then empty.
- `isInitialLoading` is declared in the props but never used, so the first load and later refetches look identical.

---

# 7. Demo Accessibility Specification

**Implemented**
- Radix keyboard support for DropdownMenu, Popover, Tabs, Checkbox and Sheet. The Sheet traps focus and has an sr-only "Close" label.
- Escape and Enter work in the header search.
- `title` attributes on the toolbar buttons and the clear-search button.
- The sidebar's multi-select trigger and chip-remove buttons have `role="button"`, `tabIndex=0`, and Enter/Space handling.
- The pagination component, though never rendered, has sr-only labels.

**Partial**
- Focus moves into the header search when it opens, but doesn't return to the header trigger when it closes.
- Sidebar labels have no `htmlFor`.
- The header trigger has a `title` only while its column is filtered.

**Missing**
- No `aria-sort` on `th`, and no text alternative for the sort arrows or the filter dot.
- The search input has no `aria-label`; it relies on its placeholder.
- No `aria-live` or `aria-busy` for loading and error states.
- Rows only respond to clicks, so the detail sheet can't be opened from the keyboard.
- Hover-card triggers can't take focus.
- Checkboxes in the option lists have no labels.
- No `SheetDescription`, so Radix logs a warning.
- The eye button that reveals phone numbers has no `aria-label`.

---

# 8. Season Management Analysis

**How it's built**
- The page owns the `useReactTable` instance; `SeasonTable` is presentational only.
- Its columns import Deployment's header component and pass `onOpenFilter`.
- The tab key is `statusTab`, which the hook protects, so this layout doesn't have the tab-loss bug.
- Filter options come from the data (selected values first, then in data order), and the sidebar draft re-syncs whenever it opens.
- `initialPageSize` is 1000 for 56 rows, so there is always exactly one page.
- **Extras:**
  - a Table/Timeline switch; when results are empty, the timeline falls back to showing the full dataset
  - "+ New Season" create/edit through the detail sheet
  - the mock service is rebuilt on every data change

**Bugs**
- The global search is passed to the toolbar but never rendered.
- Partial column search is broken for `createdBy` and `updatedBy`: their custom handlers use `val.includes(row.createdBy)`.
- The toolbar X leaves `startDate`/`endDate` applied.
- "Filter" on the Created-at column opens the Season Start field.
- `renderDateRange` calls hooks inside a nested function.
- Tab counts are totals, not filtered counts.

# 9. Engagement Analysis

**How it's built**
- `EngagementTable` owns the table instance and the toolbar.
- The initial filter is `{status:"Verified"}` with a page size of 20.
- **Columns change per tab:** `allColumns` adds Status on All; Pending and Invalid drop verifiedBy/verifiedOn.
- Which `FilterSidebar` fields appear depends on `activeColumns`, but their options are hardcoded mocks ("Rajesh Kumar…" while the data has "Farmer A–H").
- `searchableFields` is defined, but there's no global search input.

**Bugs**
- The tab filter is lost on any column-filter or search change, and on the toolbar clear.
- A stale sidebar filter survives when a search is typed on the same column.
- The sidebar never re-syncs with the applied filters.
- Only the first page is reachable.
- Next/Previous only works within the current page.
- `hasActiveFilters` counts the tab's status as an active filter.

# 10. Deployment Analysis

**What's shared with Engagement:** the table, column header, pagination, toolbar and config (`createDeploymentTableConfig` returns the engagement config).

**What differs:**
- **Columns:** Engagement type and Base are replaced with village, plots and area; `calArea` and `deployed` are added; in `allColumns`, surveyor moves to after status.
- **Filters:** the toolbar pushes both `deployed` and `matiDeployed` for a single range, so the pill shows "2 filters". The number-range filter only appears in this layout.
- **Data:** 34 hand-written, realistic records.
- **Detail sheet:** a completely different 4016-line component with dispatch cards and a `defaultTab`.

It has the same bugs as Engagement.

---

# 11. Production Table Inventory

### System 1: `DataTable` (P:components/dyanmic-table-1.tsx)

- Used in 20 files, 22 instances, all with `manualPagination`.
- Filtering and sorting run client-side over only the rows already loaded, and there's no sort UI.
- Select filters use `FilterDropdown`; `arrIncludesSome` is overridden to an exact `includes` check.
- Row ids are row indexes.
- Every cell is wrapped in a click handler that calls `stopPropagation`.

### System 2: `GenericDataTable` (P:components/generic-table/**, P:components/table-configs/**)

- Routes: /engagement and /hse/reports.
- Filters are applied server-side through adapter functions, and pages load by infinite scroll that the page accumulates manually.
- Sorting is client-side, with Asc/Desc/Hide in the menu.
- It has no loading or error state; empty shows "No results.".
- The AWD and MatiBoost configs and adapters are stubs, and nothing uses them.

### System 3: `TableView` and plain shadcn/HTML tables

- Used for summaries, dialogs and print output: Home, DeploymentSummary, WarehouseSummary, HSESummary, QualitySystemSummary, LabSummary, SupplyDemand, soil-ph-map, and the plot, qualification and print dialogs.
- **Candidates for the demo experience:**
  - SupplyDemand's request and allocation lists (client-side sort and filter, checkbox selection, mutations)
  - possibly the soil-ph-map list
- Everything else is a summary, form or workflow dialog and shouldn't be migrated.

### Dead code

- P:components/engagement/components/data-table*.tsx (legacy)
- P:components/filter/**
- P:components/village-filter.tsx
- P:pages/HSEReport.tsx. It isn't routed (`/hse/reports` renders `HseIncidentReportPage`), and its `handleDetailView` calls itself forever (line 186).

---

# 12. Production Table-by-Table Matrix

**Applies to every `DataTable` row below:**
- There's no search, no sort UI, no column visibility, and no loading, error or retry UI.
- The only loading indicator is the global full-screen overlay. The API functions catch errors themselves, show a toast and return empty data.
- An empty result shows "No results.".
- Cell clicks call `stopPropagation`.

**Column key:**
- **Size:** API rows requested / UI page size; bold means they don't match.
- **Sel:** whether checkbox selection is shown.
- **URL:** state read from the URL.
- **Compat:** how well the table fits the demo experience once it has an adapter.
- **Risk:** every `DataTable` page is high risk until its pagination bugs are fixed.

| # | Page (route) | API (method, endpoint) | Pagination / size | Server filters | Client filters | Sel | URL | Special / defects | Compat | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | AWDOverview (/awd) | POST /adminFarmApp/v3/getDeploymentData az_ids[4] | **key lacks page**; **500/100** | dates, village_id | farmer/village/area selects | no | :farmerId ignored | NOC result thrown away | med | H |
| 2 | ControlFieldOverview (/control-field/overview/:type[/:farmerId]) | POST /adminDeploymentSec/v3/getControlFieldData | **key lacks page**; **500/100** | dates, village, farmer_id, sample_type | farmer only | no | type, farmerId | "village" filterable id is invalid; surveyor filterFn has the wrong signature | med | H |
| 3 | DeploymentOverview (/deployment/overview) | POST /adminFarmApp/v3/getDeploymentData az_ids[1,2,3] | **key lacks page**; **500/100** | dates, village | farmer | no | ignored | 2 sequential requests on click; invalid filterable ids | med | H |
| 4 | DisqualifiedFarmer (/farmers/disqualified) | POST /adminFarmApp/v3/getFarmerList (camelCase dates) | **500/100**; **key shared with Qualified** | dates, village, qualification_status=-1 | name, surveyor (broken fn) | no (checkbox off) | — | mutates state directly | med | H |
| 5 | EngagementOverview (/engagement/overview/:type) | POST /adminEngagementSec/v3/getEngagementData | 100/100 ✓ | dates, village, engagement_type | farmer/village/azs/surveyors (custom fns work) | no | type | no `enabled`; refetches twice | med-high | M |
| 6 | Enrolled (/farmers/enrolled[/:farmerId]) | POST /adminFarmApp/v3/getPlotEnrolledData | 100/100 ✓ | dates, village, farmer_id | 3 selects | no | farmerId | count fields swapped | high | M |
| 7 | EnrolledVerification (/farmers/enrolled/verification) | POST …/getPlotEnrolledVerificationData | 100/100 ✓; **key shared with FarmerVerification** | dates, village, farmer_id | client-side tabs; rows grouped per farmer | yes (except ActionRequired) | farmerId | select-all adds `null`; tab counts from current page only; History dead; bulk pH/qualify | low | H |
| 8 | FarmerVerification (/farmers/verification) | POST …/getRegistrationVerificationData | **500/100**; shared key | dates, village, farmer_id | client-side tabs | yes | farmerId → auto tab | deselect-all keeps everyone selected; bulk approve/report | low | H |
| 9 | MatiBoostOverview (/mati-boost) | POST getDeploymentData az_ids[5] | **key lacks page**; **500/100** | dates, village | 3 selects | no | ignored | — | med | H |
| 10 | QualifiedFarmer (/farmers/qualified) | POST getFarmerList status=1 | **500/100**; shared key | as #4 | name, surveyor (broken) | no | — | clicking the actions cell probably triggers move-to-enrolled; viewing cells is blocked without edit access | low | H |
| 11 | Registration (/farmers/registered) | POST …/getRegistrationData | 1000/1000 ✓ | dates, village, farmer_id | name, surveyor | no | farmerId | clicks only log | high | L |
| 12 | HSEQualityDefect (/quality-system/quality-defect) | GET …/defectsNoDefectsListing (newline inside the URL) | no paging; total undefined, so pageCount is 0 | dates, listing_type | 7 selects (surveyor fn broken) | no | `defectStatus`/`defectType` → `initialColumnFilters` | loads the whole list client-side | med (client) | M |
| 13 | HSEReport (not routed) | GET /hseSystem/reportedListing | no paging | dates | 6 selects | no | incidentStatus/Type | infinite recursion; dead code | n/a | — |
| 14 | LabCarts (/lab/carts) | GET /adminLabApp/getCartList | **disabled on page 1**; **500/100**; total read from the wrong level | dates | id, surveyor (object never matches) | no | — | village filter not wired | med | H |
| 15-17 | LabSamples ×3 (/lab/samples) | GET /adminLabApp/getSampleList **&search=** | 500/500 ✓; resets pageIndex | dates, status (dropped while searching), test_type, **search** | type/village/surveyor | no | status, test | the three tables share pagination and selection state; Pending and Received both render with `?status=pending&test=`; global search context; `sampleId` passed from the soil map; village not wired; CSV covers current page only | **only page where server search can be piloted** | H |
| 18 | LabShipment (/lab/shipments) | GET /adminLabApp/getShipmentList | **disabled on page 1**; **500/100** | dates, shipment_status | 4 selects (surveyor broken) | no | status (raw value, case mismatch) | "details" handler fires twice | med | H |
| 19 | QualityCheckOverview (/warehouse/quality-check) | POST /adminWarehouse/v3/warehouseQcData | **500/100**; **key lacks dispatchId** | dates, qc_type, qc_response_id | 4 selects (surveyor broken) | no | qcType, dispatchId, qcId | village not wired | med | H |
| 20 | QualityCheckVerification (…/verification) | POST …/warehouseQcVerificationData | **500/100** | dates, qc_type, qc_response_id | client-side tabs via `filteredFarmers` (stale when data is empty) | ActionRequired tab only | qcType, dispatchId, qcId | selection keyed by row index but matched by id, so the wrong rows get reported; report flags in localStorage; per-row approve/reject | low | H |
| 21 | SampleOverviewPage (/samples/:type) | POST /adminDeploymentSec/v3/getDeploymentSamplesData | **key lacks page**; **500/100** | dates, sample_type, village, farmer | farmer, surveyor (broken) | no | type, farmerId | `:farmerId` route unprotected | med | H |
| 22 | WarehouseDispatches (/warehouse/dispatches[/:sourceId]) | POST /adminWarehouse/v3/getClusterData | **no paging params** (pager is cosmetic) | dates, village, source_id, dispatch_id | village, cluster | no | sourceId, dispatchId | meaning of total_count not established | low-med | M |
| G1 | EngagementPage (/engagement) | POST /adminEngagementSec/v4/getEngagementMetadata + getEngagementStatusCounts | page/rows=100, infinite scroll, total_pages from server | 9 fields via adapter | client re-filter by tab status; client sort | no | none | counts key includes the page, so counts refetch on every load-more; `verified.date '-'` may crash `format` | **very high** | M |
| G2 | HseIncidentReportPage (/hse/reports) | POST /hseSystem/v1/incidentReport (**supports sort_by/sort_type and verified_by.text_search**) | page/rows=100, infinite scroll | 8 fields via adapter; sort hardcoded to updated_at desc | client sort | no | none | optimistic patching, auto-advance, refreshKey | **very high** | M |

---

# 13. Production API/Data Architecture

### Axios clients (P:services/api.ts)

- **`api` (:33):** used by Engagement and HSE. It shows the global loader **without a pending-request counter** (:91, :109).
- **`localApi` (:40):** used by the `DataTable` pages. It does count pending requests.
- **Auth:** both attach a fresh Firebase token and retry once on a 401 or `invalid_token`.
- **Cancellation:** no request uses an `AbortSignal` anywhere.

### React Query

- `QueryClient` is created with no `defaultOptions` (P:App.tsx:70). That means data is treated as stale immediately, failed queries retry 3 times, and queries refetch when the window regains focus.

### Error handling

- Most `DataTable` API functions catch their own errors, show a toast and return empty data.
- React Query therefore never sees `isError`, so error and retry UI can't work until those functions rethrow.

### Base switching

- Switching base calls `invalidateQueries()` on everything and renders `<Outlet key={currentBaseId}>` (P:pages/layout.tsx:1213).
- All table state resets on a base switch. That's acceptable, and it must be preserved.

### Parameter conventions

| Concern | What production uses |
|---|---|
| Page | `page` = pageIndex+1 everywhere. The frontend assumes the backend is 1-based; not established from source |
| Size | `rows` (most POSTs), `pageSize` (GET lab endpoints, getFarmerList), none (HSE lists, cluster data) |
| Total | `data.total_count`, `data.totalCount[0].total_count`, `result[0].total_count`, `data.total_rows_count`, per-row `total_count`, `pagination.total_pages` |
| Dates | Epoch ms `start_date`/`end_date`; camelCase `startDate`/`endDate` in getFarmerList; nested `date:{start_date,end_date}` in HSE; `yyyy-MM-dd` converted to ms in the engagement adapter |
| Search | Only `search` (getSampleList and every filter-option endpoint) and `verified_by.text_search` (HSE) |
| Sort | Only HSE's `sort_by`/`sort_type` |

### Can the frontend hide these differences behind one contract?

Yes, with one adapter per table. The adapter:

1. Maps the query `{page, rows, search?, columnSearch?, filters, sort?}` to the request body.
2. Passes `signal` through so requests can be cancelled.
3. Maps the response to `{rows, total, pageCount|hasMore, counts?}`.
4. Declares what the API supports (search, sortable fields, column search), so the UI only offers those features.

This adapter pattern already exists in P:components/table-configs/adapters/engagement.adapter.ts and hse-incident.adapter.ts.

---

# 14. Search/Filter/Sort/Pagination Analysis

### Where state should live

| State | Owner |
|---|---|
| Whether menus, inline search and the sidebar are open; which field the sidebar opens at; column visibility; row selection (**keyed with `getRowId`, never by index**) | Table system (UI) |
| Active tab, default filters, filters seeded from the URL (passed in as initial values) | Page |
| Search draft and debounced value, column searches, filters, sort, page | A query-state hook shared by the table system, with one instance per table, owned by the page |
| The request, cancellation, total, pageCount and counts | Data layer (React Query plus the adapter) |

### What each interaction should do

| Interaction | Reset to page 1? | Why |
|---|---|---|
| Search → pagination | Yes | The result set changed, so the old page index may not exist |
| Filter → pagination | Yes | Same reason |
| Sort → pagination | Yes | Page N of a different ordering is meaningless |
| Tab change | Yes, and keep search, filters and sort | The tab key must be protected (this is the demo bug) |
| Search → filter | Yes | Both apply (AND). A search must never overwrite a filter on the same column, so store them separately: `columnSearches[col]` vs `filters[col]` |
| Filter → search | Yes | Keep the filters |
| Search or filter → sort | Yes | Keep the sort |
| Sort → filter | Yes | Keep the sort |
| Search → filter → sort | Yes, once per settled change | They share one query key, so only one request fires once the changes settle |
| …then change page | No | Only the page changes; everything else is kept |
| Data refresh (mutation or invalidation) | No | Keep the current page, but move back to the last page if it no longer exists |

- **Selection:** clear it on every query change except a page-only change, unless a page explicitly opts in to selecting across pages. Today selection is keyed by row index, so after a refetch it ends up on different rows.
- **Infinite-scroll pages (G1/G2):** "reset to page 1" means clearing the accumulated rows, which already happens (engagement page.tsx:38-41).

---

# 15. Demo vs Production Compatibility Matrix

**Legend:** ✓ supported, ✗ not supported, ~ partial. Risk: L low, M medium, H high.

| Capability | Demo | DataTable | Generic | Gap / Risk | Approach |
|---|---|---|---|---|---|
| Visual styling (header h-12 px-4, xs semibold, bg-muted/50) | ✓ | ✗ | ~ (sticky, bg-muted) | L | Apply the classes inside the table system, not in primitives |
| Container and sticky header | ✓ | ~ (sticky, fixed height) | ✓ | L | Keep Generic; add the demo classes and `scrollbar-minimal` |
| Row hover and selected state | ✓ | ✓ | ✓ | L | Unify on `data-state` |
| Row entry animation | ✓ | ✗ | ✗ | M: replays on every fetch | Animate only on first load or when the result set changes |
| Column menu | ✓ | ✗ | ~ (Asc/Desc/Hide) | M | Extend `GenericColumnHeader` into the demo menu |
| Column search | ✓ (mock) | ✗ | ✗ | **H: needs API support** | Show only on columns the adapter declares searchable |
| Global search | hook only, no UI | ✗ | ✗ | H: needs API support | Optional toolbar slot, shown only if the API supports it |
| Filters and filter types | multi, date, number | select only | multi (remote), date, number, tag | L | **Keep production's Generic filters.** They're better than the demo's |
| Active-filter indicator (header dot) | ✓ | ✗ | pill only | L | Add the header dot |
| Clear one / clear all | ✓ (buggy) | ~ | ✓ | M | Clear-all must keep the tab and default filters |
| Sort | server-side (mock) | client-side, no UI | client-side | **H: client sort over accumulated rows is wrong** | Server sort where the adapter declares it; hide sort where it's unsupported |
| Column visibility | ✓ | ✗ | ✓ | L | Keep |
| Pagination | none visible | numbered footer | infinite scroll | M: UX decision | Keep infinite scroll on Generic (open question) |
| Page-size selector | unused | ✗ | ✗ | L | Not needed |
| Loading | replaces the whole body | global overlay | none | M: clashes with the overlay | Inline, keeping rows visible; skip the global overlay |
| Skeleton | ✗ | ✗ | ✗ | — | Not required |
| Empty / no results | ✓ (one message) | "No results." | "No results." | L | Adopt the demo's filtered vs unfiltered wording |
| Error and retry | ✓ | ✗ (errors swallowed) | ✗ | M | API layer must rethrow errors |
| Debounce | 350 ms | — | 300 ms (filter options) | L | Use 350 ms for list search |
| Cancellation and race handling | ✓ | ✗ | ✗ | M | React Query keys plus `signal` passed to axios |
| URL state | ✗ | read-only seeds | ✗ | M | Keep existing seeds; no new URL state unless requested |
| Keyboard and a11y | partial | minimal | minimal | M | Add the missing items from section 7 |
| Responsive | overflow-auto, nowrap | fixed-height box | min-w-max, overflow-auto | L | Keep horizontal scrolling |
| Multiple tables on one page | n/a | shared state (LabSamples) | n/a | H | One query-state instance per table |
| Custom cells | ✓ | ✓ | ✓ | L | Keep column-owned renderers |
| Custom filterFn | dead code (filtering is manual) | many; several broken | none (server-side) | H | Server filters replace them in migrated tables |
| Controlled state | controlled by the page | half-controlled | mixed | M | Page owns the query state |
| Row actions and bulk actions | ✗ | ✓ (verification pages) | per row, in the sheet | H | Page-level extension slots |
| Custom toolbar and footer | layout-specific | page header above the table | tabs + counts config | L | Toolbar config plus slots |

---

# 16. Production Cases the Demo Does Not Cover

| Case | Demo supports it? | Clean support possible? | Adapter? | Page config? | Change to the shared system? | Regression risk |
|---|---|---|---|---|---|---|
| Checkbox selection and bulk actions (FarmerVerification, EnrolledVerification, QualityCheckVerification) | No (no checkbox column) | Yes | No | Yes (`selection` + `getRowId`) | Yes: add a selection column, keyed by id | **High**: existing select-all/deselect bugs and index-based keys |
| `onRowSelectionChange(selection, row, flag)` called through `setTimeout` | No | Only with a compatibility shim | No | Yes | Keep a compatibility callback | High |
| Cell-level clicks (`onColumnClick`) and action cells (QualifiedFarmer) | No | Yes: each cell handles its own clicks | No | Yes | Remove the wrapper that intercepts every cell click | **High**: the Qualified actions cell probably triggers enrolment today |
| Filters seeded from the URL (HSE defects, LabSamples status/test, QC qcType/dispatchId, `:farmerId` paths) | No | Yes | Maps them to the API | `initialFilters` read from the URL | Support for initial state | Med: don't overwrite them on tab change or reset |
| Client-side tabs over server data (EnrolledVerification, FarmerVerification, QC Verification) | Server-side tabs only | Only if the API can filter by status; otherwise tab counts stay wrong | Yes | Yes | No | High |
| Mixed page sizes (100 / 500 / 1000) | Fixed per page | Yes | The adapter owns the page size | Yes | No | Med |
| Endpoints with no paging (HSE defects, cluster data) | No | Yes, as a client-mode table | Mark as `paging: none` | Yes | Client mode must stay supported | Med |
| Global search context shared across pages (LabSamples ↔ LabSampleReceived; `sampleId` survives navigation) | No | Yes | — | Yes | Scope search state to the page | High |
| Remount on base switch | n/a | Yes | — | — | None | L |
| Global loading overlay | n/a | Needs a per-request opt-out flag | — | — | Request config in api.ts | Med: the interceptor is shared app-wide |
| Permission-gated actions and columns (`usePermissionAccess`, verifier.*) | No | Yes | — | The page builds the columns | No | Med |
| Row flags stored in localStorage (QC "reportedQualityChecks", deployment report keys) | No | Yes, inside the cell | — | Yes | No | Med |
| Dates that need time-of-day or epoch conversion | Parsed by the mock | Yes | In the adapter | — | — | Med |
| Infinite accumulation plus detail-sheet auto-load (Engagement, HSE) | No | Yes | — | — | Don't use `keepPreviousData` with manual accumulation (see section 17) | Med |

---

# 17. Potential Regression/Bug Scenarios

### Search, filter and sort logic

1. **Storing search as a string in `columnFilters`, as the demo does, empties `DataTable` pages.**
   - The overridden `arrIncludesSome` returns false for anything that isn't an array (dyanmic-table-1.tsx:242-246).
   - The `filterFn`s with the wrong signature would evaluate `"text".includes(phone)`.
2. **Client-side search or sort over loaded rows looks like it works, but misses records.**
   - On 500-row pages it never sees rows beyond 500.
   - On infinite-scroll pages it only sees the rows loaded so far.
   - `GenericDataTable` already sorts client-side over accumulated rows today, so load-more after sorting gives an interleaved order.
3. **Tab protection:** copying `use-server-table` reproduces the demo's tab-loss bug, because Engagement's tab key is `status`.
   - Production's `EngagementPage` also re-filters rows client-side by tab (page.tsx:75-78).
   - If the server-side tab and the client-side tab ever disagree, rows disappear.
4. **URL filters being overwritten:** `initialColumnFilters` is applied only once (guarded by a ref).
   - A migrated "clear all" or tab change must either restore the URL seed or deliberately drop it. Decide which.
5. **Hidden columns:** the demo sets `colSpan={columns.length}`, which ignores hidden columns.
   - A hidden column's search and filter keep applying. Decide whether hiding a column clears them (recommended: keep them, but show them in the filter pill).
6. **Columns without string headers or ids:**
   - Columns defined with only an `accessorFn` and an `id` (e.g. `id: calculatedArea`) and nested values (`farmer.name`, `surveyor`, `verified.date`) need an explicit `meta.title` and a server-field mapping.
   - The demo mock sorted by the raw column id and failed on exactly these.
7. **The displayed value is not the API value.**
   - Surveyor filters use phone numbers; the phones on screen are masked.
   - The status label "Need Correction" maps to `rejected`.
   - Dates show as `dd MMM yy` but are sent as epoch ms.
   - Column search therefore needs a server field per column, not the displayed text.
8. **`hasActiveFilters`:** the demo counts the tab as a filter. Production must exclude the tab and default filters, or "Clear all filters" appears on every empty tab.

### Pagination and caching

9. **Fixing only part of the pagination doesn't help.**
   - Adding a reset-to-page-1 without first adding the page number to the query key (Deployment, AWD, MatiBoost, ControlField, SampleOverview) still leaves paging broken.
   - Adding the page number to the key without fixing the 500/100 mismatch makes page 2 skip rows 101-500.
10. **LabCarts and LabShipment are disabled on page 1** (`!!page_index`). Any reset to page 1 would disable the query and blank the table.
11. **Shared query keys:** Qualified/Disqualified and FarmerVerification/EnrolledVerification can show each other's cached rows. `keepPreviousData` would make this worse.
12. **`keepPreviousData` combined with manual accumulation** (the Engagement and HSE `allRecords` effects):
    - The reset effect clears the list.
    - Then the placeholder data, which belongs to the old query, gets appended to the new list.
    - Use `useInfiniteQuery`, or never combine the two.
13. **The Engagement counts query refetches on every load-more**, because its key includes the page. Adding search makes this worse.

### Loading, errors and requests

14. **The `api` instance's global loader has no counter.**
    - With overlapping requests (list, counts, filter options), the first one to finish hides the overlay while the others are still running.
    - Debounced search requests flash a full-screen overlay while the user is typing.
15. **The demo's full-body loading state** shrinks the table to a 400px block and replays the row animation after every keystroke.
16. **Swallowed errors:** error and retry states never appear on `DataTable` pages until the API functions rethrow.
    - Once they rethrow, React Query's default 3 retries kick in, and each retry shows the overlay.
17. **Stale-response edge case:** the demo guards against stale responses once per hook instance.
    - If two tables shared one hook (as LabSamples' three tables share state), a response for one table could be committed into the other.
18. **Base-switch refetches:** many pages call `setTimeout(refetch, 1000)` on base switch, which runs `refetch()` even when the query is disabled.
    - After migration this can fire a request with stale query state. Remove it when a page moves to the new hook.

### Selection and clicks

19. **Selection lost or applied to the wrong rows:** selection is keyed by row index, so after a refetch or page change it points at different rows.
    - QualityCheckVerification's "Report Selected" already reports the wrong rows.
    - Switch to `getRowId` before touching any selection UI.
20. **Removing the cell click wrapper** changes click behaviour on every `DataTable` page. For example, the Qualified actions cell currently fires twice.

### Visuals and layout

21. **Z-index layering:**
    - Production primitives use z-50 or z-[60]; the demo uses z-[300], z-[2000] and z-[2500].
    - Production's Popover isn't portalled by default (P:components/ui/popover.tsx:20), so header popovers inside `overflow-hidden` or sticky containers may be clipped.
    - The GlobalLoader is also z-50.
22. **Restyling primitives** (TableHead h-10→h-12, cell p-2→p-4, Button icon h-9→h-10) would change every table, dialog and summary in the app.
23. **The demo sidebar never re-syncs with the applied filters.** Production's `GenericFilterSidebar` already re-syncs when opened (:244-246). Keep that behaviour.
24. **Mobile layout:** the demo's sticky loader width uses `var(--sidebar-width)`. Whether production defines that variable is not established from source.

### Specific pages and routes

25. **Engagement's `verified.date` can be the string `'-'`**, and passing it to `format()` may throw in date-fns v4 (inferred, not run). A new loading or empty state that re-renders more often could expose this.
26. **Back/forward and refresh:** nothing is stored in the URL, so every table resets on reload. Adding URL state later would conflict with the URL seeds, which are read only once.
27. **Duplicate route:** `lab/samples` is declared twice in App.tsx (lines 293-302). Any route-level wrapper change must be made in both places.

---

# 18. Recommended Target Architecture

Build on `GenericDataTable`, and move `DataTable` pages over one at a time.

| Layer | Piece | Responsibility | Must not know about |
|---|---|---|---|
| 1. Primitives | P:components/ui/* (unchanged) | Radix and shadcn components | Tables |
| 2. Visual system | `GenericDataTable` body plus a new states component | Demo classes for container, header, rows and cells; loading shown inline while rows stay visible, distinguishing first load from refetch; error with retry; empty (unfiltered vs filtered, with a clear button); `size` → minWidth; `meta.openFilterForColumn` | APIs and business fields |
| 3. Column interaction | `GenericColumnHeader`, extended into the demo menu | Title, filter dot, sort arrows; menu with Clear/Search/Filter/Asc/Desc/Hide, each shown only if the column supports it; inline search with Escape/Enter; ARIA | Where the data comes from |
| 4. Filter system | Existing `GenericToolbar`, `GenericFilterSidebar` and filter types | Keep as they are. Add `initialOpenField` (auto-open and scroll to a field); make clear-all keep protected keys | Endpoints (options come from `optionsFetcher`) |
| 5. Table state | New `useTableQuery`, one instance per table | Search, column searches, filters, sort and page; 350 ms debounce; the page-reset rules from section 14; protected keys such as the tab; `hasActiveFilters` that ignores defaults | HTTP |
| 6. Data contract | Types added to `generic-table/types.ts` | `TableQuery` and `TableResult` (shape borrowed from the demo's types.ts) | — |
| 7. API adapter | One per table, under `table-configs/adapters/*` (the pattern exists) | Map query → request body and response → result; declare what the API supports (search, sortable fields, paging mode); pass `signal` through | UI |
| 8. Pagination | Infinite (existing) or numbered, chosen per table | Keep infinite scroll for Generic; move to `useInfiniteQuery` once things are stable | — |
| 9. Loading, error and empty states | Driven by React Query state | Distinguish `isLoading`, `isFetching` and `isError` | — |
| 10. Page config | The page file | Tabs, columns, filter fields, defaults, URL seeds, adapter | Table internals |
| 11. Page extensions | Slots: right side of the toolbar, a selection bar, row actions via cells | Bulk actions, CRUD buttons, detail sheets | — |

### Data layer

- **Query key:** `[tableId, baseId, ...queryState]`, using the **debounced** search.
- **Cancellation:** the queryFn passes `signal` to axios, so React Query cancels superseded requests when the key changes.
- **Stale results:** results are always displayed for the current key only. This solves stale responses without a hand-written request id.
- **Overlay opt-out:** the request sets a config flag to skip the global overlay. This is the one change api.ts needs.

---

# 19. Recommended Configuration Model

This is a conceptual sketch built on the existing types.

```ts
// per column (TanStack ColumnDef + meta)
meta: { title: string; filterField?: string /* key in filterFields */;
        search?: { field: string } ; sort?: { field: string } }   // absent = not offered

// per table (extends GenericToolbarConfig)
{ id: "engagement",
  tabs, tabKey: "status", counts,           // tabKey is protected
  filterFields,                             // existing GenericFilterField[]
  defaults: { filters, sort },              // + URL seeds merged by page
  adapter: { toRequest(query) , fetch(body, signal), fromResponse(res),
             paging: "infinite" | "numbered" | "none", rows: 100 },
  selection?: { getRowId, mode: "page" }, emptyText? }
```

- **The page supplies:** columns (with cells and permissions) and any extension slots.
- **The config supplies:** everything else.

---

# 20. Recommended Migration Strategy

**Applies to every stage:**
- **Testing:** build (`tsc -b`) + lint + the manual matrix in section 22 on the affected routes.
- **Delivery:** one PR per stage, so each stage can be undone with a single revert.

### Stage 0: Analysis and architecture

- This report.
- Answer the open questions in section 24.
- Get the backend to confirm search and sort parameters for each endpoint.

### Stage 1: Shared visual system

- **Files:** generic-data-table.tsx, a new generic-table states component, index.css (`scrollbar-minimal`).
- **Affects:** /engagement and /hse/reports only.
- **Risk:** low to medium. **Rollback:** revert.
- **Behaviour change:** visual only, plus inline loading and error states.
- **Testing:** check both pages visually for regressions.

### Stage 2: Column interaction system

- **Files:** generic-column-header.tsx, the two columns.tsx files (`meta`), types.ts.
- **Behaviour:** Search and Sort stay hidden until an adapter declares support for them.
- **Risk:** low. **Rollback:** revert.

### Stage 3: Filter system

- **Files:** generic-toolbar.tsx, generic-filter-sidebar.tsx.
- **Behaviour:** add `initialOpenField`; the header's "Filter" item opens the sidebar at that field; clear-all keeps protected keys.
- **Risk:** medium, because of HSE's reset key and `onFiltersChange` flow.

### Stage 4: Server-side search

- **Files:**
  - the new `useTableQuery`
  - both adapters and both hooks
  - the engagement and HSE api files (pass `signal`)
  - api.ts (the overlay opt-out)
- **Blocked on the backend for Engagement.** HSE can only search `verified_by`.
- **Risk:** high, because the interceptor is shared app-wide. **Rollback:** turn the capability flag off.

### Stage 5: Sorting and pagination

- **Changes:** HSE adapter sends `sort_by`/`sort_type`; remove client-side sorting over accumulated rows; optionally move Generic's accumulation to `useInfiniteQuery`.
- **Risk:** medium.

### Stage 6: Loading, error and empty states

- **Changes:** make the migrated tables' API functions rethrow errors, and set a per-query `retry`.
- **Risk:** medium: toast behaviour changes.

### Stage 7: Special cases

1. **Fix the `DataTable` prerequisites in the hooks first:**
   - add the page number to query keys that miss it
   - align the API and UI page sizes
   - fix `enabled` so page 1 loads (LabCarts, LabShipment)
   - separate the shared keys
2. **Pilot one `DataTable` page** on the Generic system through an adapter, e.g. Enrolled, where the sizes already match.
3. **Then the selection pages**, using `getRowId`.
4. **Then LabSamples**, with page-scoped search instead of the global context.

### Stage 8: Migrate the remaining tables

- One page per change.
- **Order:**
  1. low-risk list pages
  2. pages seeded from the URL
  3. pages with selection and bulk actions
  4. LabSamples

### Stage 9: Remove legacy systems

- **Delete:**
  - the dead engagement data-table files
  - P:components/filter
  - HSEReport.tsx (after confirming it's unused)
  - the unused AWD/MatiBoost configs
- **Retire** dyanmic-table-1.tsx once no page imports it.

---

# 21. Recommended Pilot Table

| Candidate | Complexity | Special cases | API | How well it represents the demo | Risk |
|---|---|---|---|---|---|
| **/engagement (G1)** | Medium | None: no selection, no URL state, one table | Adapter exists; **no search or sort params** | **Direct counterpart of the demo's Engagement layout** | Medium |
| /hse/reports (G2) | Medium-high | Optimistic patching, auto-advance | **Supports sort**; text search on one field only | High | Medium |
| ControlFieldOverview | Medium | Key lacks page, wrong filterFn, invalid ids | No search or sort | Medium | High |
| LabSamples | High | Three tables, global search, URL state, status dropped while searching | **The only list API with search** | Low | High |
| Enrolled | Low | farmerId path | No search or sort | Medium | Low-medium |

**Pick: /engagement.**
- It is production's direct twin of the demo's Engagement layout, and it already uses the target architecture.
- It has none of the high-risk special cases.
- Stages 1–3 and 6 can be finished and checked there side by side with the demo.
- **Limit:** Stage 4 (server search) can't be proven there until the backend adds a search parameter.

**Next:**
- Prove sorting on HSE.
- Prove server search on LabSamples, or on Engagement once the backend supports it.

---

# 22. Testing Strategy

There is no test runner in the project; package.json only has `lint`. Testing means `npm run build` + `npm run lint` + manual QA.

| Area | Cases |
|---|---|
| Visual | Header h-12/px-4/xs semibold/bg-muted/50; sticky header while scrolling in both directions; row hover and selected; cells don't wrap and scroll horizontally; borders and radius; compare side by side with the demo; primitives unchanged elsewhere (summary pages, dialogs) |
| Interaction | Menu opens and closes (click, Escape, outside click); search: open → type → Enter → Escape → X; "Filter" opens the right sidebar field; Asc/Desc check marks; Hide and the eye menu brings the column back; filter-pill count; clear one; clear all keeps the tab; switching tabs keeps filters |
| State | First load; refetch keeps rows and shows a busy indicator; search pending during the debounce; filtered-empty vs unfiltered-empty; error → Retry succeeds; base switch resets |
| Server (DevTools throttling and blocking) | Slow API; failed API (500, network); type "A…ABCD" under throttling and confirm only the final key's rows render and superseded requests are cancelled in the Network tab; rapid filter toggles; page resets after search, filter and sort; totals and counts update; the global overlay doesn't flash while typing; the token-expiry retry still works |
| Edge cases | 0, 1 and very many results; long text and long headers; no filters and all filters; a hidden column with an active filter; array, number, date and nested columns; dynamic columns per tab; rows with `verified.date '-'` |
| Multiple tables and pages | LabSamples tab switching and URL combinations; navigating Qualified ↔ Disqualified; FarmerVerification ↔ EnrolledVerification |
| Selection pages (Stage 7) | Select a row, select all, deselect all, change page, refetch, check the ids in bulk-action payloads |
| Responsive | Desktop ≥1280, tablet 768–1024, mobile 375: toolbar wrapping, full-width sheet, horizontal scroll |
| Accessibility | Tab order through the toolbar, menus and sidebar; focus returns to the trigger; Escape everywhere; `aria-sort`; `aria-label` on search; `aria-live` for loading; opening rows from the keyboard (if added) |

---

# 23. File-Level Impact

### Demo files to study (for behaviour and visuals; don't copy them wholesale)

- D:app/layouts/deployment/components/data-table-column-header.tsx (the header and menu reference)
- D:app/layouts/engagement/components/data-table.tsx and D:app/layouts/season-management/components/season-table.tsx (body markup and states)
- D:app/layouts/engagement/components/data-table-toolbar.tsx (toolbar visuals)
- D:lib/server-table/types.ts (the contract)
- D:lib/server-table/use-server-table.ts (debounce, reset and abort behaviour, **but not its filter-sync code**)
- D:app/components/filter/components/FilterSidebar.tsx (only the logic that auto-opens and scrolls to a field)
- D:app/layouts/season-management/components/season-filter-sidebar.tsx (the draft re-sync idea)
- D:app/globals.css:100-123 (`scrollbar-minimal`)

### Production files likely to change

| File | Why |
|---|---|
| P:components/generic-table/components/generic-data-table.tsx | Demo visuals, states, `meta.openFilterForColumn`, column sizes, manual sort where the adapter supports it |
| P:components/generic-table/components/generic-column-header.tsx | The demo's column menu |
| P:components/generic-table/components/generic-toolbar.tsx | `initialOpenField`, clear-all that keeps protected keys, optional search slot |
| P:components/generic-table/components/generic-filter-sidebar.tsx | Opening at a specific field |
| P:components/generic-table/types.ts | Query, result and capability types |
| P:components/table-configs/adapters/engagement.adapter.ts, hse-incident.adapter.ts | Map search and sort |
| P:components/table-configs/engagement.table.config.ts, hse-incident.table.config.ts | Tab key and capabilities |
| P:components/engagement/components/columns.tsx, P:components/hse-incident/components/columns.tsx | `meta.title` and field mapping |
| P:components/engagement/hooks/use-engagement-table.ts, P:components/hse-incident/hooks/use-incident-report-table.ts | Query key built from query state, `signal`, counts key without the page |
| P:components/engagement/api/engagement.api.ts, P:components/hse-incident/api/incident-report.api.ts | Pass `signal` and the overlay opt-out |
| P:components/engagement/page.tsx, P:components/hse-incident/page.tsx | Wire up `useTableQuery` |
| P:services/api.ts | **Only** a per-request "skip global loader" flag in the `api` interceptors, plus rethrowing errors for migrated tables (Stage 6). It's shared by the whole app, so change it with great care |
| P:index.css | `scrollbar-minimal` utility |
| Stage 7+: P:hooks/DeploymentHook.ts, SamplingHook.ts, LabHook.ts, FarmAppHook.ts, RegistrationHook.ts, WarehouseHook.ts and the matching pages | Key, page-size and `enabled` fixes, then migrating each page |

### New files that may be needed

- P:components/generic-table/hooks/use-table-query.ts
- P:components/generic-table/components/generic-table-states.tsx
- One adapter per `DataTable` page as it migrates

### Files not to touch

- **P:components/ui/*:** app-wide primitives (table, button, tabs, dropdown-menu, popover, sheet, select).
- **dyanmic-table-1.tsx:** until its pages have migrated; 22 instances depend on it.
- **search-context.tsx, base-context.tsx, pages/layout.tsx:** the base-switch remount behaviour depends on them.
- **The auth and token-refresh logic in the api.ts interceptors.**
- **App.tsx routes:** except removing dead routes in Stage 9.
- **The summary, print and workflow tables.**

---

# 24. Open Questions / Information Needed

1. **Backend search:** which list endpoints can add a search parameter, and with what name and scope (one global search, per-field, or both)?
   - Engagement v4
   - `getControlFieldData`
   - the `getDeploymentData` family
   - `getFarmerList`
   - the others in section 12
2. **Backend sort:** does Engagement v4, or any `DataTable` endpoint, support sorting? Can HSE's `sort_by` accept any column?
3. **Paging semantics:** is `page` 1-based on every backend (the frontend assumes so)? What does `total_count` mean for `getClusterData`?
4. **Pagination UX:** infinite scroll (current Generic), numbered pages (current DataTable), or the demo's approach (which shows no pagination at all)?
5. **Global search:** is a global search box wanted? The demo doesn't actually show one.
6. **URL state:** should search, filters and tab be kept in the URL (back/forward, refresh, sharing)? Today the URL only seeds state once.
7. **Existing bugs:** should the production bugs in section 12 be fixed as part of this work, or tracked separately? Several of them block correct pagination.
8. **Global overlay:** should the full-screen loading overlay stay for table fetches, or be replaced with inline states?
9. **Targets:** what accessibility standard and minimum viewport are required? Is mobile needed?
10. **HSEReport.tsx:** should it be deleted or routed again?
11. **Hidden columns:** should hiding a column clear its filter and search?
12. **Selection across pages:** should selection persist across pages on the verification pages?

---

# 25. Final Implementation Checklist

- [ ] Get answers to the open questions in section 24, especially 1, 2, 4 and 7.
- [ ] Get backend confirmation of search and sort parameters per endpoint, and record them as adapter capabilities.
- [ ] Add the global-overlay opt-out flag to the `api` instance. Nothing changes unless the flag is set.
- [ ] **Stage 1:** demo visuals and states in `GenericDataTable` only. Leave primitives untouched.
- [ ] **Stage 2:** demo column menu, shown per capability; `meta.title` on the Engagement and HSE columns.
- [ ] **Stage 3:** sidebar opens at a field; clear-all keeps the tab and default filters; `hasActiveFilters` ignores defaults.
- [ ] **Stage 4:** `useTableQuery` (350 ms debounce, reset rules, protected tab key) + React Query keys + `signal`. Hide search wherever the API lacks it. **Never fall back to client-side search.**
- [ ] **Stage 5:** HSE server sort; remove client sort over accumulated rows; drop the page from the counts key.
- [ ] **Stage 6:** rethrow errors for migrated tables; wire up Retry; set a per-query retry policy.
- [ ] **Before any `DataTable` page migrates**, fix:
  - [ ] query keys missing the page number
  - [ ] the 500/100 page-size mismatch
  - [ ] `enabled` on page 1 (LabCarts, LabShipment)
  - [ ] the shared cache keys
  - [ ] row ids via `getRowId`
  - [ ] the `filterFn`s with the wrong signature
- [ ] Migrate one page per PR, run the section 22 matrix each time, and keep each rollback to a single revert.
- [ ] **Stage 9:** delete dead code only after grep confirms nothing imports it.
