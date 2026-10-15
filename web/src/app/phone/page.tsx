"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ListTodo, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyService } from "@/app/layouts/survey-builder/services/survey-service";
import { SurveyModel } from "@/app/layouts/survey-builder/types/survey-schema";
import { PreviewAllQuestions } from "@/app/layouts/survey-builder/components/preview/preview-runtime";
import { Workflow } from "@/app/layouts/survey-workflow/workflow-store";
import { Farmer, STATUS, Task, isPendingOnApp } from "@/lib/orchestration/engine";
import { phoneWorkflows, loadFarmers, loadToday, refreshTasks, registerFarmer, saveToday, submitTask } from "@/lib/orchestration/store";

/**
 * Surveyor phone (simulation). Registering a farmer fills the workflow's first survey; the
 * engine then creates the next tasks immediately, and they show up under Pending.
 * "Today" can be moved to see day-based tasks appear and expire.
 */
export default function PhonePage() {
    const [today, setToday] = useState("");
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [workflowId, setWorkflowId] = useState("");
    const [surveys, setSurveys] = useState<SurveyModel[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);

    useEffect(() => {
        const t = loadToday();
        setToday(t);
        const wfs = phoneWorkflows();
        setWorkflows(wfs);
        setWorkflowId(wfs[0]?.id || "");
        setTasks(refreshTasks(t));
        setFarmers(loadFarmers());
        SurveyService.getAllSurveys().then(setSurveys);
    }, []);

    const changeToday = (t: string) => {
        if (!t) return;
        saveToday(t);
        setToday(t);
        setTasks(refreshTasks(t));
    };
    const workflow = workflows.find((w) => w.id === workflowId) || null;

    return (
        <div className="min-h-screen bg-zinc-100 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 md:flex-row">
                {/* Simulation controls */}
                <div className="w-full space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 md:w-64">
                    <h1 className="text-sm font-bold">Surveyor phone</h1>
                    <p className="text-[11px] text-zinc-500">Simulation of the app. Tasks come from the active workflow.</p>
                    <div className="space-y-1">
                        <Label htmlFor="ph-today" className="text-xs">Today</Label>
                        <Input id="ph-today" type="date" value={today} onChange={(e) => changeToday(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Workflow</Label>
                        {workflows.length === 0 ? (
                            <p className="text-[11px] text-rose-600">
                                No workflow yet. Create one in <a href="/layouts/survey-workflow" className="underline">Survey Workflow</a>.
                            </p>
                        ) : (
                            <Select value={workflowId} onValueChange={setWorkflowId}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {workflows.map((w) => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name} <span className="text-zinc-400">· {w.status}</span></SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <a href="/layouts/tasks" className="block text-[11px] text-zinc-500 underline underline-offset-2">Open task summary (HQ)</a>
                </div>

                {/* Phone */}
                <div className="mx-auto w-[320px] overflow-hidden rounded-[2rem] border-[6px] border-zinc-900 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950" style={{ height: 640 }}>
                    <PhoneApp
                        today={today}
                        workflow={workflow}
                        surveys={surveys}
                        tasks={tasks}
                        farmers={farmers}
                        onTasks={setTasks}
                        onFarmers={setFarmers}
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Phone app ------------------------------ */

interface PhoneAppProps {
    today: string;
    workflow: Workflow | null;
    surveys: SurveyModel[];
    tasks: Task[];
    farmers: Farmer[];
    onTasks: (t: Task[]) => void;
    onFarmers: (f: Farmer[]) => void;
}

type Screen = { name: "tasks" } | { name: "farmers" } | { name: "register" } | { name: "task"; task: Task };

function PhoneApp({ today, workflow, surveys, tasks, farmers, onTasks, onFarmers }: PhoneAppProps) {
    const [screen, setScreen] = useState<Screen>({ name: "tasks" });
    const [village, setVillage] = useState<string>("all");
    const [tab, setTab] = useState<"pending" | "completed">("pending");

    const surveyById = useMemo(() => new Map(surveys.map((s) => [s.id, s])), [surveys]);
    const farmerById = useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers]);
    const villages = Array.from(new Set(farmers.map((f) => f.village).filter(Boolean))).sort();
    const inVillage = (farmerId: string) => village === "all" || farmerById.get(farmerId)?.village === village;

    const pending = tasks.filter((t) => isPendingOnApp(t, today) && inVillage(t.farmerId)).sort((a, b) => a.taskNo - b.taskNo);
    const completed = tasks.filter((t) => t.status !== STATUS.planned && t.status !== STATUS.expired && inVillage(t.farmerId)).sort((a, b) => b.taskNo - a.taskNo);

    const header = (
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <button type="button" className="flex items-center gap-1 text-xs font-semibold" onClick={() => setVillage(village === "all" ? villages[0] || "all" : villages[(villages.indexOf(village) + 1) % villages.length] === village ? "all" : villages[(villages.indexOf(village) + 1) % villages.length])} title="Switch village">
                {village === "all" ? "All villages" : village} <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">SR</div>
        </div>
    );

    const nav = (
        <div className="grid grid-cols-2 border-t border-zinc-200 dark:border-zinc-800">
            {([["tasks", "Task", ListTodo], ["farmers", "Farmer", Users]] as const).map(([name, label, Icon]) => (
                <button
                    key={name}
                    type="button"
                    onClick={() => setScreen(name === "tasks" ? { name: "tasks" } : { name: "farmers" })}
                    className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", screen.name === name || (name === "farmers" && screen.name === "register") ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400")}
                >
                    <Icon className="h-4 w-4" /> {label}
                </button>
            ))}
        </div>
    );

    // The workflow's starting survey is always open: it is how a farmer enters the workflow.
    const rootStep = workflow?.steps.find((st) => st.parentId === null);
    const rootSurvey = rootStep ? surveyById.get(rootStep.surveyId) : undefined;
    const startCard = rootSurvey && (
        <button
            type="button"
            onClick={() => setScreen({ name: "register" })}
            className="w-full rounded-lg border border-dashed border-zinc-400 p-3 text-left hover:border-zinc-900 dark:hover:border-zinc-100"
        >
            <div className="font-mono text-[10px] text-zinc-500">Start · always open</div>
            <div className="mt-1 text-xs font-semibold">Survey: {rootSurvey.name}</div>
            <div className="text-[11px] text-zinc-600 dark:text-zinc-300">Register a new farmer</div>
        </button>
    );

    const taskCard = (t: Task) => {
        const f = farmerById.get(t.farmerId);
        const s = surveyById.get(t.surveyId);
        return (
            <button
                key={t.id}
                type="button"
                disabled={t.status !== STATUS.planned}
                onClick={() => setScreen({ name: "task", task: t })}
                className="w-full rounded-lg bg-zinc-100 p-3 text-left disabled:opacity-80 dark:bg-zinc-900"
            >
                <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                    <span>T{t.taskNo}</span>
                    <span>{t.plannedEnd ? `Ends: ${t.plannedEnd}` : "No end date"}</span>
                </div>
                <div className="mt-1 text-xs font-semibold">Farmer: {f?.name || "?"}</div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{s?.name || t.surveyId}</div>
                {t.status !== STATUS.planned && <div className="mt-1 text-[10px] font-semibold capitalize text-emerald-600">{t.status}</div>}
            </button>
        );
    };

    // ---- screens ----
    if (screen.name === "task") {
        const s = surveyById.get(screen.task.surveyId);
        return (
            <SurveyForm
                title={`T${screen.task.taskNo} · ${s?.name || "Survey"}`}
                subtitle={`Farmer: ${farmerById.get(screen.task.farmerId)?.name || ""}`}
                survey={s}
                onBack={() => setScreen({ name: "tasks" })}
                onSubmit={(answers) => {
                    onTasks(submitTask(screen.task.id, answers, today));
                    setScreen({ name: "tasks" });
                    setTab("completed");
                }}
            />
        );
    }

    if (screen.name === "register") {
        const rootStep = workflow?.steps.find((st) => st.parentId === null);
        const s = rootStep ? surveyById.get(rootStep.surveyId) : undefined;
        return (
            <SurveyForm
                title={s ? `Survey: ${s.name}` : "Register farmer"}
                subtitle="New farmer"
                survey={s}
                submitLabel="Register"
                emptyMessage={!workflow ? "No workflow." : !rootStep ? "The workflow has no first survey after Start." : "The first survey of the workflow no longer exists."}
                onBack={() => setScreen({ name: "farmers" })}
                onSubmit={(answers) => {
                    const res = registerFarmer({ workflow: workflow!, rootStepId: rootStep!.id, questions: s!.questions, response: answers, today });
                    onFarmers([...farmers, res.farmer]);
                    onTasks(res.tasks);
                    setVillage("all");
                    setScreen({ name: "tasks" });
                    setTab("pending");
                }}
            />
        );
    }

    if (screen.name === "farmers") {
        const list = farmers.filter((f) => village === "all" || f.village === village);
        return (
            <div className="flex h-full flex-col">
                {header}
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Farmers</h2>
                        <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={() => setScreen({ name: "register" })}>
                            <UserPlus className="h-3.5 w-3.5" /> Register
                        </Button>
                    </div>
                    {list.length === 0 ? (
                        <p className="py-8 text-center text-xs text-zinc-400">No farmers yet. Register one to start the workflow.</p>
                    ) : (
                        list.map((f) => (
                            <div key={f.id} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                                <div className="text-xs font-semibold">{f.name}</div>
                                <div className="text-[11px] text-zinc-500">{f.village || "No village"} · {tasks.filter((t) => t.farmerId === f.id).length} tasks</div>
                            </div>
                        ))
                    )}
                </div>
                {nav}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            {header}
            <div className="flex-1 overflow-y-auto p-4">
                <h2 className="text-lg font-bold">Task&apos;s</h2>
                <div className="mt-2 flex gap-4 border-b border-zinc-200 text-xs dark:border-zinc-800">
                    {(["pending", "completed"] as const).map((k) => (
                        <button key={k} type="button" onClick={() => setTab(k)} className={cn("-mb-px border-b-2 pb-1.5 capitalize", tab === k ? "border-zinc-900 font-semibold dark:border-zinc-100" : "border-transparent text-zinc-400")}>
                            {k} <span className="font-mono text-[10px]">{k === "pending" ? pending.length : completed.length}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-3 space-y-2">
                    {tab === "pending" && startCard}
                    {(tab === "pending" ? pending : completed).length === 0 ? (
                        <p className="py-8 text-center text-xs text-zinc-400">{tab === "pending" ? "No pending tasks." : "Nothing completed yet."}</p>
                    ) : (
                        (tab === "pending" ? pending : completed).map(taskCard)
                    )}
                </div>
            </div>
            {nav}
        </div>
    );
}

/* ------------------------------ Forms ------------------------------ */

function SurveyForm({ title, subtitle, survey, submitLabel, emptyMessage, onBack, onSubmit }: { title: string; subtitle?: string; survey?: SurveyModel; submitLabel?: string; emptyMessage?: string; onBack: () => void; onSubmit: (answers: Record<string, unknown>) => void }) {
    const [answers, setAnswers] = useState<Record<string, any>>({});
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <button type="button" onClick={onBack} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0">
                    <div className="truncate text-xs font-bold">{title}</div>
                    {subtitle && <div className="truncate text-[10px] text-zinc-500">{subtitle}</div>}
                </div>
            </div>
            <div className="min-h-0 flex-1">
                {survey ? (
                    <PreviewAllQuestions survey={survey} locale={survey.defaultLocale || "en"} runtimeAnswers={answers} onChangeAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} onSubmit={() => onSubmit(answers)} submitLabel={submitLabel} />
                ) : (
                    <p className="p-6 text-center text-xs text-rose-600">{emptyMessage || "Survey template not found."}</p>
                )}
            </div>
        </div>
    );
}
