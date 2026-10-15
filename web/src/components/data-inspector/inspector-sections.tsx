"use client"

// Data / API Inspector — the standard sections rendered from an InspectorSpec, in reading order:
//   1 Overview · 2 Data flow · 3 Domain model · 4 API contract · 5 UI → API · 6 Database · 7 Mock data ·
//   8 Workflows · 9 Rules · 10 Open questions
// Levels: the overview and the diagrams are always visible; field lists, payloads, schemas, sample records and
// technical notes sit behind "View …" toggles.
import * as React from "react"
import { ArrowRight, Check, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    Chip,
    Disclosure,
    FlowDiagram,
    InspectorCode,
    InspectorSubheading,
    InspectorTable,
    PROVENANCE,
    ProvenanceBadge,
    TreeDiagram,
    WorkflowDiagram,
    type Provenance,
} from "./inspector-primitives"
import type { ApiSpec, InspectorSpec, TableSpec } from "./inspector-spec"

export interface InspectorSectionDef {
    id: string
    title: string
    /** One line under the title. */
    description?: string
    content: React.ReactNode
}

const METHOD_CLASS: Record<ApiSpec["method"], string> = {
    GET: "border-sky-200 text-sky-700 dark:border-sky-900/60 dark:text-sky-300",
    POST: "border-emerald-200 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300",
    PUT: "border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-300",
    PATCH: "border-violet-200 text-violet-700 dark:border-violet-900/60 dark:text-violet-300",
    DELETE: "border-red-200 text-red-700 dark:border-red-900/60 dark:text-red-300",
}

function Method({ method }: { method: ApiSpec["method"] }) {
    return <Badge variant="outline" className={cn("font-mono text-[10px] font-bold px-1.5 py-0 rounded shadow-none", METHOD_CLASS[method])}>{method}</Badge>
}

/** A labelled value in the overview / cards. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 space-y-1">
            <dt className="text-[10px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500">{label}</dt>
            <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex flex-wrap items-center gap-1.5 min-w-0">{children}</dd>
        </div>
    )
}

function ApiCard({ api }: { api: ApiSpec }) {
    return (
        <div data-api-card={`${api.method} ${api.path}`} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Method method={api.method} />
                <code className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 break-all">{api.path}</code>
                <ProvenanceBadge kind={api.provenance} className="ml-auto" />
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">{api.purpose}</p>
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] text-xs">
                <dt className="text-zinc-400">Used by</dt><dd className="text-zinc-700 dark:text-zinc-300 min-w-0">{api.usedBy}</dd>
                <dt className="text-zinc-400">Inputs</dt>
                <dd className="flex flex-wrap gap-1 min-w-0">{api.inputs.length ? api.inputs.map((i) => <Chip key={i} mono>{i}</Chip>) : <span className="text-zinc-400">—</span>}</dd>
                <dt className="text-zinc-400">Returns</dt><dd className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-words min-w-0">{api.returns}</dd>
            </dl>
            {(api.request || api.response || api.notes?.length) && (
                <div className="flex flex-col gap-1.5 pt-0.5">
                    {api.request && <Disclosure label="View request"><InspectorCode>{api.request}</InspectorCode></Disclosure>}
                    {api.response && <Disclosure label="View response"><InspectorCode>{api.response}</InspectorCode></Disclosure>}
                    {api.notes?.length ? (
                        <Disclosure label="View notes">
                            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">{api.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                        </Disclosure>
                    ) : null}
                </div>
            )}
        </div>
    )
}

function TableRow({ table }: { table: TableSpec }) {
    return (
        <div data-db-table={table.name} className="py-2.5 first:pt-0 last:pb-0 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs font-bold text-zinc-900 dark:text-zinc-50">{table.name}</code>
                <ProvenanceBadge kind={table.provenance} />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">{table.purpose}</p>
            <Disclosure label="View schema">
                <div className="flex flex-wrap gap-1">{table.columns.map((c) => <Chip key={c} mono>{c}</Chip>)}</div>
                {table.note && <p className="mt-1.5 text-[11px] text-zinc-500">{table.note}</p>}
            </Disclosure>
        </div>
    )
}

function TechnicalNotes({ notes, label = "View technical details" }: { notes?: string[]; label?: string }) {
    if (!notes?.length) return null
    return (
        <Disclosure label={label}>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </Disclosure>
    )
}

const PROVENANCE_ORDER: Provenance[] = ["observed", "proposed", "mock", "open"]

/** The standard sections for a spec. `goTo` lets the overview link to a section. */
export function buildSpecSections(spec: InspectorSpec, goTo: (id: string) => void): InspectorSectionDef[] {
    const reads = spec.apis.filter((a) => a.method === "GET")
    const writes = spec.apis.filter((a) => a.method !== "GET")
    const glance: { id: string; label: string; value: number }[] = [
        { id: "api", label: "API operations", value: spec.apis.length },
        { id: "domain", label: "Entities", value: spec.domain.entities.length },
        { id: "database", label: "Tables", value: spec.database.tables.length },
        { id: "workflows", label: "Workflows", value: spec.workflows.length },
        { id: "open-questions", label: "Open questions", value: spec.openQuestions.length },
    ]
    return [
        {
            id: "overview",
            title: "Overview",
            description: spec.summary,
            content: (
                <div className="space-y-6">
                    <dl data-inspector-facts className="grid gap-4 grid-cols-2 lg:grid-cols-4 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                        <Fact label="Data source"><span>{spec.dataSource.label}</span><ProvenanceBadge kind={spec.dataSource.provenance} /></Fact>
                        <Fact label="Primary entity"><span data-primary-entity>{spec.primaryEntity}</span></Fact>
                        <Fact label="Related entities"><span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{spec.relatedEntities.join(" · ")}</span></Fact>
                        <Fact label="API status"><span>{spec.apiStatus.label}</span><ProvenanceBadge kind={spec.apiStatus.provenance} /></Fact>
                    </dl>
                    <div className="space-y-2">
                        <InspectorSubheading>How the screen gets its data</InspectorSubheading>
                        <FlowDiagram nodes={spec.dataFlow.read.nodes} data-overview-flow="" />
                    </div>
                    <div className="space-y-2">
                        <InspectorSubheading>At a glance</InspectorSubheading>
                        <div className="flex flex-wrap gap-2">
                            {glance.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    data-overview-link={g.id}
                                    onClick={() => goTo(g.id)}
                                    className="group inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                                >
                                    <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{g.value}</span>
                                    <span className="text-zinc-600 dark:text-zinc-300">{g.label}</span>
                                    <ArrowRight className="h-3 w-3 text-zinc-300 group-hover:text-zinc-600" aria-hidden />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <InspectorSubheading>Labels used in this inspector</InspectorSubheading>
                        <ul data-provenance-legend className="grid gap-1.5 sm:grid-cols-2 min-[2200px]:grid-cols-4">
                            {PROVENANCE_ORDER.map((k) => (
                                <li key={k} className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300"><ProvenanceBadge kind={k} /><span>{PROVENANCE[k].meaning}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            ),
        },
        {
            id: "data-flow",
            title: "Data flow",
            description: "Reads travel from the database to the UI; every user action goes back through the API.",
            content: (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <InspectorSubheading>Reading data</InspectorSubheading>
                        <FlowDiagram nodes={spec.dataFlow.read.nodes} data-flow="read" />
                        <p className="text-[11px] text-zinc-500">{spec.dataFlow.read.caption}</p>
                    </div>
                    <div className="space-y-2">
                        <InspectorSubheading>When the user acts</InspectorSubheading>
                        <FlowDiagram nodes={spec.dataFlow.write.nodes} data-flow="write" />
                        <p className="text-[11px] text-zinc-500">{spec.dataFlow.write.caption}</p>
                    </div>
                    <TechnicalNotes notes={spec.dataFlow.technical} />
                </div>
            ),
        },
        {
            id: "domain",
            title: "Domain model",
            description: spec.domain.caption ?? "The important entities and how they relate. Fields are one click away.",
            content: (
                <div className="grid gap-6 min-[2200px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[2200px]:items-start">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 overflow-x-auto">
                        <TreeDiagram root={spec.domain.tree} data-domain-tree="" />
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {spec.domain.entities.map((e) => (
                            <div key={e.name} data-entity-card={e.name} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-2 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{e.name}</h4>
                                    <ProvenanceBadge kind={e.provenance} className="ml-auto" />
                                </div>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300">{e.description}</p>
                                <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                                    <dt className="text-zinc-400">Primary key</dt><dd><code className="text-[11px]">{e.primaryKey}</code></dd>
                                    <dt className="text-zinc-400">Relates to</dt><dd className="flex flex-wrap gap-1">{e.relationships.map((r) => <Chip key={r}>{r}</Chip>)}</dd>
                                </dl>
                                <Disclosure label="View fields">
                                    <InspectorTable columns={["Field", "Type", "Note"]} rows={e.fields.map((f) => [<code key="f" className="text-[11px]">{f.name}</code>, <span key="t" className="font-mono text-[11px]">{f.type}</span>, f.note ?? ""])} />
                                </Disclosure>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: "api",
            title: "API contract",
            description: "What the backend needs to provide. Payloads are collapsed — open a card's request or response when you need it.",
            content: (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <InspectorSubheading>Reads</InspectorSubheading>
                        <div className="grid gap-3 lg:grid-cols-2 min-[2200px]:grid-cols-3">{reads.map((a) => <ApiCard key={a.method + a.path} api={a} />)}</div>
                    </div>
                    <div className="space-y-2">
                        <InspectorSubheading>Actions</InspectorSubheading>
                        <div className="grid gap-3 lg:grid-cols-2 min-[2200px]:grid-cols-3">{writes.map((a) => <ApiCard key={a.method + a.path} api={a} />)}</div>
                    </div>
                </div>
            ),
        },
        {
            id: "ui-api",
            title: "UI → API",
            description: "Each thing the user does, the data it needs, the call it makes and what changes on screen.",
            content: (
                <InspectorTable
                    data-ui-mapping=""
                    columns={["User action", "Data needed", "API", "Result"]}
                    rows={spec.uiMappings.map((m) => [<span key="a" className="font-semibold text-zinc-900 dark:text-zinc-50">{m.action}</span>, m.data, <code key="c" className="text-[11px] whitespace-nowrap">{m.api}</code>, m.result])}
                />
            ),
        },
        {
            id: "database",
            title: "Database",
            description: spec.database.caption,
            content: (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <InspectorSubheading>Relationships</InspectorSubheading>
                        <ul data-db-relations className="grid gap-1 sm:grid-cols-2">
                            {spec.database.relations.map((r) => <li key={r} className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-words">{r}</li>)}
                        </ul>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                    {PROVENANCE_ORDER.map((k) => {
                        const tables = spec.database.tables.filter((t) => t.provenance === k)
                        if (!tables.length) return null
                        return (
                            <div key={k} data-db-group={k} className="space-y-2">
                                <InspectorSubheading provenance={k}>{k === "observed" ? "Existing today" : k === "proposed" ? "Proposed" : k === "mock" ? "Mock only" : "Unresolved"}</InspectorSubheading>
                                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {tables.map((t) => <TableRow key={t.name} table={t} />)}
                                </div>
                            </div>
                        )
                    })}
                    </div>
                </div>
            ),
        },
        {
            id: "mock-data",
            title: "Mock data",
            description: "What the prototype runs on — summarised; one representative record is a click away.",
            content: (
                <div className="space-y-5">
                    <div className="grid gap-2 lg:grid-cols-3">
                        {spec.mockData.sources.map((s) => (
                            <div key={s.label} data-mock-source={s.label} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-1 min-w-0">
                                <div className="flex items-center gap-2"><code className="text-xs font-bold text-zinc-900 dark:text-zinc-50 break-all">{s.label}</code><ProvenanceBadge kind={s.provenance} className="ml-auto" /></div>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">{s.detail}</p>
                            </div>
                        ))}
                    </div>
                    <dl className="grid gap-3 grid-cols-3 sm:grid-cols-6">
                        {spec.mockData.records.map((r) => (
                            <div key={r.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2">
                                <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{r.label}</dt>
                                <dd className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{typeof r.value === "number" ? r.value.toLocaleString("en-IN") : r.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="space-y-2">
                        <InspectorSubheading>Coverage</InspectorSubheading>
                        <ul data-mock-coverage className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 min-[2200px]:grid-cols-4">
                            {spec.mockData.coverage.map((c) => (
                                <li key={c.label} data-covered={c.count > 0 ? "yes" : "no"} className="flex items-start gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 min-w-0">
                                    {c.count > 0 ? <Check className="h-3.5 w-3.5 mt-px shrink-0 text-emerald-600" aria-label="covered" /> : <Minus className="h-3.5 w-3.5 mt-px shrink-0 text-zinc-400" aria-label="not covered" />}
                                    <span className="min-w-0">{c.label} <span className="text-zinc-400 tabular-nums">{c.count.toLocaleString("en-IN")}</span>{c.example && <span className="text-zinc-400"> · {c.example}</span>}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {spec.mockData.extra}
                    {spec.mockData.example && (
                        <Disclosure label="View sample record">
                            <p className="mb-1.5 text-[11px] text-zinc-500">{spec.mockData.example.title}</p>
                            <InspectorCode>{spec.mockData.example.json}</InspectorCode>
                        </Disclosure>
                    )}
                </div>
            ),
        },
        {
            id: "workflows",
            title: "Workflows",
            description: "The important actions, step by step.",
            content: (
                <div className="grid gap-4 2xl:grid-cols-2">
                    {spec.workflows.map((w) => (
                        <div key={w.id} data-workflow={w.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 min-w-0">
                            <div className="space-y-0.5">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{w.title}</h4>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{w.summary}</p>
                            </div>
                            <WorkflowDiagram steps={w.steps} />
                            <TechnicalNotes notes={w.technical} />
                        </div>
                    ))}
                </div>
            ),
        },
        {
            id: "rules",
            title: "Rules",
            description: "The business rules the backend enforces. Anything not settled is marked as an open question.",
            content: (
                <div className="grid gap-4 lg:grid-cols-2 min-[2200px]:grid-cols-4">
                    {spec.rules.map((g) => (
                        <div key={g.title} data-rule-group={g.title} className="space-y-2 min-w-0">
                            <InspectorSubheading>{g.title}</InspectorSubheading>
                            <ul className="space-y-1.5">
                                {g.rules.map((r) => (
                                    <li key={r.text} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" aria-hidden />
                                        <span className="flex-1 min-w-0">{r.text}</span>
                                        <ProvenanceBadge kind={r.provenance} className="shrink-0" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            id: "open-questions",
            title: "Open questions",
            description: "Decisions the backend / product still need to make. None of these is implemented as a fact.",
            content: (
                <ol data-open-questions className="grid gap-2 xl:grid-cols-2">
                    {spec.openQuestions.map((q, i) => (
                        <li key={q.question} className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                            <span className="text-xs font-bold tabular-nums text-zinc-400 w-5 shrink-0">{i + 1}</span>
                            <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{q.question}</p>
                                {q.context && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{q.context}</p>}
                            </div>
                            <Chip className="shrink-0">{q.area}</Chip>
                        </li>
                    ))}
                </ol>
            ),
        },
    ]
}
