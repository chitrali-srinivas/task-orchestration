/**
 * Survey Workflow: the order in which surveys run for a season, and the condition on the
 * previous survey's status that makes the next one visible.
 *
 * Kept in localStorage (`mati.workflows`) like surveys and masters. Later each step becomes
 * a task per farmer when the workflow's condition is met.
 */

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
    steps: WorkflowStep[];
    createdAt: string;
    updatedAt: string;
}

const STORAGE_KEY = "mati.workflows";

export function loadWorkflows(): Workflow[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Workflow[]) : [];
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
