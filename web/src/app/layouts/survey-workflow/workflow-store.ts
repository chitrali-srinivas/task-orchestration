/**
 * Survey Workflow: the order in which surveys run for a season, and the condition on the
 * previous survey's status that makes the next one visible.
 *
 * Kept in localStorage (`mati.workflows`) like surveys and masters. An active workflow starts for a farmer once they
 * reach its start status (verified by default): its first steps become that farmer's tasks. Registration is not a
 * step: the built-in Farmer Registration survey registers farmers outside any workflow.
 */
import type { FarmerStatus } from "@/lib/orchestration/engine";

/**
 * When the next task is created once the condition is met:
 *  immediately – the same day; days – n days later; date – a fixed date;
 *  field – n days after a date the surveyor entered in the previous survey.
 */
export type TriggerType = "immediately" | "days" | "date" | "field";

export interface WorkflowStep {
    id: string;
    /** Survey template id from the survey builder, or "__end__" for an End node. */
    surveyId: string;
    /** Step this one follows; null = follows Start. */
    parentId: string | null;
    /** Status of the parent survey that enables this step (empty for steps after Start). */
    onStatus: string;
    trigger: TriggerType;
    /** For trigger "days": how many days after the parent reaches onStatus. */
    days?: number;
    /** For trigger "date": the date the task is created (YYYY-MM-DD). */
    date?: string;
    /** For trigger "field": id of the Date question in the parent survey whose answer is the base date (+ days). */
    fieldQuestionId?: string;
    /** Label of that question, kept for display. */
    fieldLabel?: string;
    /** Validity window for the task (YYYY-MM-DD). Both empty = indefinite. */
    validFrom?: string;
    validTo?: string;
}

export const END_SURVEY_ID = "__end__";

export type WorkflowStatus = "draft" | "active" | "completed";

export interface Workflow {
    id: string;
    name: string;
    country: string;
    status: WorkflowStatus;
    /** Farmer status that starts this workflow for a farmer. Missing = verified. */
    startOn?: FarmerStatus;
    steps: WorkflowStep[];
    createdAt: string;
    updatedAt: string;
}

const STORAGE_KEY = "mati.workflows";
const SURVEYS_KEY = "mati.surveys";

/**
 * Workflows saved when registration was their first step: that step goes and the steps after it move up to Start
 * (they now start when the farmer reaches the workflow's start status). Same array back when nothing changed.
 */
export function dropRegistrationSteps(steps: WorkflowStep[], isRegistration: (surveyId: string) => boolean): WorkflowStep[] {
    const dropped = new Set(steps.filter((s) => s.parentId === null && isRegistration(s.surveyId)).map((s) => s.id));
    if (dropped.size === 0) return steps;
    return steps
        .filter((s) => !dropped.has(s.id))
        .map((s) => (s.parentId && dropped.has(s.parentId) ? { ...s, parentId: null, onStatus: "" } : s));
}

/** Surveys that registered farmers before the built-in one: the Farmer Enrollment category, or the built-in survey. */
function registrationSurveyIds(): Set<string> {
    try {
        const surveys = JSON.parse(window.localStorage.getItem(SURVEYS_KEY) || "[]") as { id: string; category?: string; systemSurvey?: string }[];
        return new Set(surveys.filter((s) => s.systemSurvey || /^farmer[ _]enrollment$/i.test((s.category || "").trim())).map((s) => s.id));
    } catch {
        return new Set();
    }
}

export function loadWorkflows(): Workflow[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as Workflow[]) : [];
        const registration = registrationSurveyIds();
        let changed = false;
        const migrated = list.map((w) => {
            const steps = dropRegistrationSteps(w.steps, (id) => registration.has(id));
            if (steps === w.steps) return w;
            changed = true;
            return { ...w, steps };
        });
        if (changed) saveWorkflows(migrated);
        return migrated;
    } catch {
        return [];
    }
}

export function saveWorkflows(list: Workflow[]) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* ignore */
    }
}

export function newWorkflow(name: string, country: string): Workflow {
    const now = new Date().toISOString();
    return { id: `wf_${Date.now()}`, name, country, status: "draft", steps: [], createdAt: now, updatedAt: now };
}

/** Ids of a step and everything below it. */
export function subtreeIds(steps: WorkflowStep[], stepId: string): Set<string> {
    const out = new Set<string>([stepId]);
    let grew = true;
    while (grew) {
        grew = false;
        steps.forEach((s) => {
            if (s.parentId && out.has(s.parentId) && !out.has(s.id)) {
                out.add(s.id);
                grew = true;
            }
        });
    }
    return out;
}

/** Human-readable label for the arrow into a step. */
export function describeStep(step: WorkflowStep): string {
    const parts: string[] = [];
    if (step.onStatus) parts.push(`status: ${step.onStatus}`);
    if (step.surveyId === END_SURVEY_ID) return parts.join(" · ");
    if (step.trigger === "immediately") parts.push("trigger: immediately");
    if (step.trigger === "days") parts.push(`trigger: after ${step.days ?? 0} day${step.days === 1 ? "" : "s"}`);
    if (step.trigger === "date") parts.push(`trigger: ${step.date || "date"}`);
    if (step.trigger === "field") parts.push(`trigger: ${step.fieldLabel || "survey date"} + ${step.days ?? 0} day${step.days === 1 ? "" : "s"}`);
    parts.push(step.validFrom || step.validTo ? `validity: ${step.validFrom || "…"} – ${step.validTo || "…"}` : "validity: indefinite");
    return parts.join(" · ");
}
