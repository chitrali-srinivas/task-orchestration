"use client";

import "./tree.css";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Flag, Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SurveyService } from "../survey-builder/services/survey-service";
import { DEFAULT_SURVEY_STATUSES, SurveyModel } from "../survey-builder/types/survey-schema";
import {
    END_SURVEY_ID,
    TriggerType,
    Workflow,
    WorkflowStatus,
    WorkflowStep,
    describeStep,
    loadWorkflows,
    newWorkflow,
    saveWorkflows,
    subtreeIds,
} from "./workflow-store";

/**
 * Survey Workflow: connect surveys in sequence. Each arrow says which status of the previous
 * survey enables the next one, when its task is created, and how long it stays valid.
 */
export default function SurveyWorkflowPage() {
    return (
        <NavBarType4
            pageTitle="Survey Workflow"
            activeItemUrl="/layouts/survey-workflow"
            pageDescription="Sequence of surveys for a season and the conditions that enable each next survey."
        >
            <div className="h-full overflow-auto bg-zinc-50/40 p-5 dark:bg-zinc-950/40">
                <Workflows />
            </div>
        </NavBarType4>
    );
}

const STATUS_STYLE: Record<WorkflowStatus, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function Workflows() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [surveys, setSurveys] = useState<SurveyModel[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setWorkflows(loadWorkflows());
        SurveyService.getAllSurveys().then(setSurveys);
    }, []);

    const persist = (next: Workflow[]) => {
        saveWorkflows(next);
        setWorkflows(next);
    };
    const update = (wf: Workflow) => persist(workflows.map((w) => (w.id === wf.id ? { ...wf, updatedAt: new Date().toISOString() } : w)));

    const open = workflows.find((w) => w.id === openId);
    if (open) {
        return <WorkflowEditor workflow={open} surveys={surveys} onChange={update} onBack={() => setOpenId(null)} />;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <WorkflowIcon className="h-4 w-4 text-zinc-500" /> Workflows
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">One workflow per season. Open one to connect its surveys.</p>
                </div>
                <Button type="button" size="sm" onClick={() => setCreating(true)} className="h-8 gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> New workflow
                </Button>
            </div>

            {workflows.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">No workflows yet. Click New workflow to create the first one.</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs">Season name</TableHead>
                            <TableHead className="text-xs">Country</TableHead>
                            <TableHead className="text-xs">Surveys</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((w) => (
                            <TableRow key={w.id} className="cursor-pointer" onClick={() => setOpenId(w.id)}>
                                <TableCell className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{w.name}</TableCell>
                                <TableCell className="text-xs">{w.country || <span className="text-zinc-300">—</span>}</TableCell>
                                <TableCell className="text-xs">{w.steps.filter((s) => s.surveyId !== END_SURVEY_ID).length}</TableCell>
                                <TableCell>
                                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize", STATUS_STYLE[w.status])}>{w.status}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-rose-600"
                                        title="Delete workflow"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            persist(workflows.filter((x) => x.id !== w.id));
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {creating && (
                <NewWorkflowDialog
                    onClose={() => setCreating(false)}
                    onCreate={(name, country) => {
                        const wf = newWorkflow(name, country);
                        persist([...workflows, wf]);
                        setCreating(false);
                        setOpenId(wf.id);
                    }}
                />
            )}
        </div>
    );
}

function NewWorkflowDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, country: string) => void }) {
    const [name, setName] = useState("");
    const [country, setCountry] = useState("");
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[420px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">New workflow</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">Name it after the season it runs for.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="wf-name" className="text-xs font-semibold">Season name <span className="text-rose-500">*</span></Label>
                        <Input id="wf-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kharif_ERW_GPM_012025_11_2030" className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="wf-country" className="text-xs font-semibold">Country</Label>
                        <Input id="wf-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" className="h-9 text-xs" />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancel</Button>
                    <Button type="button" size="sm" disabled={!name.trim()} onClick={() => onCreate(name.trim(), country.trim())} className="h-8 text-xs">Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ----------------------------- Editor ----------------------------- */

interface EditorProps {
    workflow: Workflow;
    surveys: SurveyModel[];
    onChange: (wf: Workflow) => void;
    onBack: () => void;
}

/** What the step dialog is doing: adding a child under `parentId`, or editing `step`. */
type StepDialogState = { mode: "add"; parentId: string | null } | { mode: "edit"; step: WorkflowStep };

function WorkflowEditor({ workflow, surveys, onChange, onBack }: EditorProps) {
    const [dialog, setDialog] = useState<StepDialogState | null>(null);
    const surveyById = useMemo(() => new Map(surveys.map((s) => [s.id, s])), [surveys]);
    const surveyName = (id: string) => (id === END_SURVEY_ID ? "End" : surveyById.get(id)?.name || "(missing survey)");
    const statusesOf = (surveyId: string | null) => {
        if (!surveyId || surveyId === END_SURVEY_ID) return [];
        const s = surveyById.get(surveyId);
        return s?.statuses?.length ? s.statuses : [...DEFAULT_SURVEY_STATUSES];
    };
    const parentSurveyId = (parentId: string | null) => (parentId ? workflow.steps.find((s) => s.id === parentId)?.surveyId || null : null);

    const saveStep = (step: WorkflowStep) => {
        const exists = workflow.steps.some((s) => s.id === step.id);
        onChange({ ...workflow, steps: exists ? workflow.steps.map((s) => (s.id === step.id ? step : s)) : [...workflow.steps, step] });
        setDialog(null);
    };
    const removeStep = (stepId: string) => {
        const gone = subtreeIds(workflow.steps, stepId);
        onChange({ ...workflow, steps: workflow.steps.filter((s) => !gone.has(s.id)) });
        setDialog(null);
    };

    const children = (parentId: string | null) => workflow.steps.filter((s) => s.parentId === parentId);

    const node = (step: WorkflowStep) => {
        const isEnd = step.surveyId === END_SURVEY_ID;
        return (
            <li key={step.id}>
                <div className="flex flex-col items-center gap-1.5">
                    <span className="max-w-[220px] text-center font-mono text-[10px] leading-snug text-zinc-500">{describeStep(step)}</span>
                    <button
                        type="button"
                        onClick={() => setDialog({ mode: "edit", step })}
                        className={cn(
                            "rounded-lg border px-4 py-2 text-xs font-semibold shadow-2xs transition-colors",
                            isEnd
                                ? "h-11 w-11 rounded-full border-rose-600 bg-rose-500 p-0 text-white hover:bg-rose-600"
                                : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-100"
                        )}
                        title="Edit this step"
                    >
                        {isEnd ? "End" : `Survey: ${surveyName(step.surveyId)}`}
                    </button>
                    {!isEnd && (
                        <button
                            type="button"
                            onClick={() => setDialog({ mode: "add", parentId: step.id })}
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                            title="Add next survey"
                        >
                            <Plus className="h-3 w-3" />
                        </button>
                    )}
                </div>
                {!isEnd && children(step.id).length > 0 && <ul>{children(step.id).map(node)}</ul>}
            </li>
        );
    };

    const roots = children(null);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} title="Back to workflows">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Season name: {workflow.name}</h2>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Country: {workflow.country || "—"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-zinc-500">Status</Label>
                    <Select value={workflow.status} onValueChange={(v) => onChange({ ...workflow, status: v as WorkflowStatus })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(["draft", "active", "completed"] as WorkflowStatus[]).map((s) => (
                                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
                {/* Survey template list */}
                <div className="rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                        <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            <ClipboardList className="h-3.5 w-3.5 text-zinc-500" /> Survey Template List
                        </h3>
                    </div>
                    <div className="space-y-2 p-3">
                        {surveys.length === 0 ? (
                            <p className="text-[11px] text-zinc-500">
                                No surveys yet. Create them in the{" "}
                                <a href="/layouts/survey-builder/v1-0" className="font-semibold underline underline-offset-2">Survey Builder</a>.
                            </p>
                        ) : (
                            surveys.map((s) => {
                                const used = workflow.steps.some((st) => st.surveyId === s.id);
                                return (
                                    <div key={s.id} className={cn("rounded-md border px-3 py-2 text-xs", used ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800" : "border-zinc-200 dark:border-zinc-800")}>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">Survey: {s.name}</div>
                                        <div className="font-mono text-[10px] text-zinc-500">v{s.version} · {s.status} · {(s.statuses || DEFAULT_SURVEY_STATUSES).join(" → ")}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Flow canvas */}
                <div className="min-h-[420px] overflow-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="wf-tree">
                        <ul>
                            <li>
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow-2xs">Start</div>
                                    <button
                                        type="button"
                                        onClick={() => setDialog({ mode: "add", parentId: null })}
                                        className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-400 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                                        title="Add first survey"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                                {roots.length > 0 && <ul>{roots.map(node)}</ul>}
                            </li>
                        </ul>
                    </div>
                    {roots.length === 0 && (
                        <p className="pt-6 text-center text-xs text-zinc-500">Click + under Start to add the first survey.</p>
                    )}
                </div>
            </div>

            {dialog && (
                <StepDialog
                    state={dialog}
                    surveys={surveys}
                    parentStatuses={statusesOf(dialog.mode === "add" ? parentSurveyId(dialog.parentId) : parentSurveyId(dialog.step.parentId))}
                    parentLabel={(() => {
                        const pid = dialog.mode === "add" ? dialog.parentId : dialog.step.parentId;
                        return pid ? surveyName(parentSurveyId(pid) || "") : "Start";
                    })()}
                    onSave={saveStep}
                    onDelete={dialog.mode === "edit" ? () => removeStep(dialog.step.id) : undefined}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}

/* --------------------------- Step dialog --------------------------- */

interface StepDialogProps {
    state: StepDialogState;
    surveys: SurveyModel[];
    parentStatuses: string[];
    parentLabel: string;
    onSave: (step: WorkflowStep) => void;
    onDelete?: () => void;
    onClose: () => void;
}

function StepDialog({ state, surveys, parentStatuses, parentLabel, onSave, onDelete, onClose }: StepDialogProps) {
    const initial: WorkflowStep =
        state.mode === "edit"
            ? state.step
            : { id: `st_${Date.now()}`, surveyId: "", parentId: state.parentId, onStatus: parentStatuses[0] || "", trigger: "immediately" };
    const [draft, setDraft] = useState<WorkflowStep>(initial);
    const set = (patch: Partial<WorkflowStep>) => setDraft((d) => ({ ...d, ...patch }));
    const isEnd = draft.surveyId === END_SURVEY_ID;
    const afterStart = draft.parentId === null;
    const canSave =
        Boolean(draft.surveyId) &&
        (afterStart || Boolean(draft.onStatus)) &&
        (draft.trigger !== "days" || (draft.days ?? -1) >= 0) &&
        (draft.trigger !== "date" || Boolean(draft.date));

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[460px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">{state.mode === "add" ? "Add next step" : "Edit step"}</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">After <span className="font-semibold">{parentLabel}</span></DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs font-semibold">Survey <span className="text-rose-500">*</span></Label>
                        <Select value={draft.surveyId} onValueChange={(v) => set({ surveyId: v })}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick a survey…" /></SelectTrigger>
                            <SelectContent>
                                {surveys.map((s) => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">Survey: {s.name}</SelectItem>
                                ))}
                                {!afterStart && (
                                    <SelectItem value={END_SURVEY_ID} className="text-xs">
                                        <span className="flex items-center gap-1.5"><Flag className="h-3 w-3 text-rose-500" /> End (no further survey)</span>
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {!afterStart && (
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">When {parentLabel} status is <span className="text-rose-500">*</span></Label>
                            <Select value={draft.onStatus} onValueChange={(v) => set({ onStatus: v })}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick a status…" /></SelectTrigger>
                                <SelectContent>
                                    {parentStatuses.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isEnd && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Create task</Label>
                                <div className="grid grid-cols-[1fr_1fr] gap-2">
                                    <Select value={draft.trigger} onValueChange={(v) => set({ trigger: v as TriggerType })}>
                                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="immediately" className="text-xs">Immediately</SelectItem>
                                            <SelectItem value="days" className="text-xs">After n days</SelectItem>
                                            <SelectItem value="date" className="text-xs">On a date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {draft.trigger === "days" && (
                                        <Input type="number" min={0} value={draft.days ?? ""} onChange={(e) => set({ days: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Days" className="h-9 text-xs" />
                                    )}
                                    {draft.trigger === "date" && (
                                        <Input type="date" value={draft.date || ""} onChange={(e) => set({ date: e.target.value })} className="h-9 text-xs" />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Validity <span className="font-normal text-zinc-400">(leave empty for indefinite)</span></Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input type="date" value={draft.validFrom || ""} onChange={(e) => set({ validFrom: e.target.value })} className="h-9 text-xs" title="Start date" />
                                    <Input type="date" value={draft.validTo || ""} onChange={(e) => set({ validTo: e.target.value })} className="h-9 text-xs" title="End date" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="flex items-center sm:justify-between">
                    {onDelete ? (
                        <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="h-8 gap-1 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                            <Trash2 className="h-3.5 w-3.5" /> Remove step and everything after it
                        </Button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancel</Button>
                        <Button type="button" size="sm" disabled={!canSave} onClick={() => onSave(draft)} className="h-8 text-xs">Save</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
