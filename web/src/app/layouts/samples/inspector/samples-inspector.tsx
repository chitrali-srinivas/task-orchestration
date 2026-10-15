"use client"

// DESIGN-TIME — the Samples Data / API Inspector: the generic Inspector (src/components/data-inspector) fed with the
// Samples content (samples-inspector-spec.ts) and the live mock DB. Opened from the toolbar (left of Filter). Not part
// of the production feature.
import { DataInspector, InspectorSubheading } from "@/components/data-inspector/data-inspector"
import type { InspectorSpec } from "@/components/data-inspector/inspector-spec"
import type { MockDb } from "../data/mock/mock-db"
import { buildSamplesInspectorSpec } from "./samples-inspector-spec"

/** The farmer opened in the page, as a short chain of record counts (no raw rows). */
function SelectedFarmer({ db, farmerId, sampleId }: { db: Readonly<MockDb>; farmerId: string; sampleId: string | null }) {
    const responses = new Set(db.survey_responses.filter((r) => r.farmer_id === farmerId).map((r) => r.id))
    const samples = db.samples.filter((s) => responses.has(s.survey_response_id))
    const ids = new Set(samples.map((s) => s.id))
    const azs = new Set(db.survey_responses.filter((r) => responses.has(r.id)).map((r) => r.az_id))
    const plots = new Set(samples.flatMap((s) => [s.plot_id, s.generated_plot_id]).filter(Boolean))
    const chain: [string, string | number][] = [
        ["Farmer", farmerId],
        ["AZs", [...azs].sort((a, b) => a - b).map((a) => `AZ${a}`).join(", ")],
        ["Samples", samples.length],
        ["Plots", plots.size],
        ["Reports", db.reports.filter((r) => ids.has(r.sample_id)).length],
        ["Events", db.events.filter((e) => ids.has(e.sample_id)).length],
    ]
    const selected = sampleId ? samples.find((s) => s.id === sampleId) : null
    return (
        <div className="space-y-2">
            <InspectorSubheading>Open in the page</InspectorSubheading>
            <div data-inspector-chain className="flex flex-wrap items-center gap-1.5 text-xs">
                {selected && <span className="rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1"><span className="text-zinc-500">Selected sample</span> <span className="font-semibold font-mono">{selected.sample_code ?? selected.id.slice(0, 8)}</span></span>}
                {chain.map(([label, value]) => (
                    <span key={label} className="rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1"><span className="text-zinc-500">{label}</span> <span className="font-semibold font-mono">{value}</span></span>
                ))}
            </div>
        </div>
    )
}

export function SamplesInspector({ open, onOpenChange, db, selectedFarmerId, selectedSampleId }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    db: Readonly<MockDb>
    selectedFarmerId: string | null
    selectedSampleId: string | null
}) {
    // rebuilt on every render: `db` is the same (mutable) object after a mutation, the page re-renders on its data version
    const base = buildSamplesInspectorSpec(db, selectedSampleId)
    const spec: InspectorSpec = { ...base, mockData: { ...base.mockData, extra: selectedFarmerId ? <SelectedFarmer db={db} farmerId={selectedFarmerId} sampleId={selectedSampleId} /> : undefined } }
    return <DataInspector open={open} onOpenChange={onOpenChange} spec={spec} />
}
