// Data / API Inspector — the structured content a layout hands the generic Inspector. Plain data (plus an optional
// node for live mock details); the Inspector decides the layout, the hierarchy and what is collapsed.
import type * as React from "react"
import type { FlowNode, Provenance, TreeNode, WorkflowStep } from "./inspector-primitives"

export interface InspectorFact { label: string; provenance: Provenance }

export interface EntitySpec {
    name: string
    provenance: Provenance
    description: string
    primaryKey: string
    relationships: string[]
    fields: { name: string; type: string; note?: string }[]
}

export interface ApiSpec {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    path: string
    provenance: Provenance
    purpose: string
    usedBy: string
    inputs: string[]
    returns: string
    request?: string
    response?: string
    notes?: string[]
}

export interface UiMapping { action: string; data: string; api: string; result: string }

export interface TableSpec {
    name: string
    provenance: Provenance
    purpose: string
    columns: string[]
    note?: string
}

export interface CoverageItem { label: string; count: number; example?: string }

export interface MockDataSpec {
    sources: { label: string; detail: string; provenance: Provenance }[]
    records: { label: string; value: string | number }[]
    coverage: CoverageItem[]
    example?: { title: string; json: string }
    /** Live details for the record selected in the page (kept small). */
    extra?: React.ReactNode
}

export interface WorkflowSpec { id: string; title: string; summary: string; steps: WorkflowStep[]; technical?: string[] }

export interface RuleGroup { title: string; rules: { text: string; provenance: Provenance }[] }

export interface OpenQuestion { area: string; question: string; context?: string }

export interface InspectorSpec {
    feature: string
    /** One sentence: what the screen lets a user do. */
    summary: string
    dataSource: InspectorFact
    primaryEntity: string
    relatedEntities: string[]
    apiStatus: InspectorFact
    dataFlow: {
        read: { caption: string; nodes: FlowNode[] }
        write: { caption: string; nodes: FlowNode[] }
        technical?: string[]
    }
    domain: { tree: TreeNode; caption?: string; entities: EntitySpec[] }
    apis: ApiSpec[]
    uiMappings: UiMapping[]
    database: { caption: string; relations: string[]; tables: TableSpec[] }
    mockData: MockDataSpec
    workflows: WorkflowSpec[]
    rules: RuleGroup[]
    openQuestions: OpenQuestion[]
}
