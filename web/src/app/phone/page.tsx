"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ListTodo, RotateCcw, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyService } from "@/app/layouts/survey-builder/services/survey-service";
import { SurveyModel } from "@/app/layouts/survey-builder/types/survey-schema";
import { PreviewAllQuestions } from "@/app/layouts/survey-builder/components/preview/preview-runtime";
import { Workflow } from "@/app/layouts/survey-workflow/workflow-store";
import { Farmer, LatLng, LocationSource, STATUS, Task, isPendingOnApp } from "@/lib/orchestration/engine";
import { Route, Surveyor, Village, distanceKm, routeFor, stopLocation } from "@/lib/orchestration/routes";
import {
    phoneWorkflows,
    loadFarmers,
    loadPhoneSurveyor,
    loadRoutes,
    loadSurveyors,
    loadToday,
    loadVillages,
    refreshTasks,
    registerFarmer,
    resetSimulation,
    savePhoneSurveyor,
    saveToday,
    submitTask,
} from "@/lib/orchestration/store";

/**
 * Surveyor phone (simulation). Registering a farmer fills the workflow's first survey; the
 * engine then creates the next tasks immediately, and they show up under Pending.
 * "Today" can be moved to see day-based tasks appear and expire; Reset deletes all farmers, tasks and routes.
 * Picking a surveyor shows their route for today (assigned on the HQ Tasks page) as Stop 1, 2, 3…, then the
 * pending tasks on no route. These are the only simulation controls (the HQ Tasks page has no date selection).
 */
export default function PhonePage() {
    const [today, setToday] = useState("");
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [workflowId, setWorkflowId] = useState("");
    const [surveys, setSurveys] = useState<SurveyModel[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [surveyors, setSurveyors] = useState<Surveyor[]>([]);
    const [surveyorId, setSurveyorId] = useState("");
    const [routes, setRoutes] = useState<Route[]>([]);
    const [villages, setVillages] = useState<Village[]>([]);

    useEffect(() => {
        const t = loadToday();
        setToday(t);
        const wfs = phoneWorkflows();
        setWorkflows(wfs);
        setWorkflowId(wfs[0]?.id || "");
        setTasks(refreshTasks(t));
        setFarmers(loadFarmers());
        setSurveyors(loadSurveyors());
        setSurveyorId(loadPhoneSurveyor());
        setRoutes(loadRoutes());
        setVillages(loadVillages());
        SurveyService.getAllSurveys().then(setSurveys);
    }, []);

    const changeSurveyor = (id: string) => {
        savePhoneSurveyor(id);
        setSurveyorId(id);
    };

    const changeToday = (t: string) => {
        if (!t) return;
        saveToday(t);
        setToday(t);
        setTasks(refreshTasks(t));
    };
    const [confirmReset, setConfirmReset] = useState(false);
    const reset = () => {
        resetSimulation();
        setTasks([]);
        setFarmers([]);
        setRoutes([]);
        setConfirmReset(false);
    };
    const workflow = workflows.find((w) => w.id === workflowId) || null;
    const surveyor = surveyors.find((s) => s.id === surveyorId);

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
                    <div className="space-y-1">
                        <Label className="text-xs">Surveyor</Label>
                        {surveyors.length === 0 ? (
                            <p className="text-[11px] text-zinc-500">
                                No surveyors yet. Add them in <a href="/layouts/masters" className="underline">Masters</a> to see routes.
                            </p>
                        ) : (
                            <Select value={surveyorId || NO_SURVEYOR} onValueChange={(v) => changeSurveyor(v === NO_SURVEYOR ? "" : v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_SURVEYOR} className="text-xs">Not set · all pending tasks</SelectItem>
                                    {surveyors.filter((s) => s.active || s.id === surveyorId).map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <a href="/layouts/tasks" className="block text-[11px] text-zinc-500 underline underline-offset-2">Open task summary (HQ)</a>
                    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                        {confirmReset ? (
                            <div className="space-y-2">
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">Delete all farmers, tasks and routes? Surveys, workflows and masters are kept.</p>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={() => setConfirmReset(false)}>Keep</Button>
                                    <Button type="button" size="sm" className="h-7 flex-1 bg-rose-600 text-[11px] text-white hover:bg-rose-700" onClick={reset}>Delete all</Button>
                                </div>
                            </div>
                        ) : (
                            <Button type="button" variant="outline" size="sm" className="h-7 w-full gap-1 text-[11px] text-rose-600" onClick={() => setConfirmReset(true)}>
                                <RotateCcw className="h-3 w-3" /> Reset simulation
                            </Button>
                        )}
                    </div>
                </div>

                {/* Phone */}
                <div className="mx-auto w-[320px] overflow-hidden rounded-[2rem] border-[6px] border-zinc-900 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950" style={{ height: 640 }}>
                    <PhoneApp
                        today={today}
                        workflow={workflow}
                        surveys={surveys}
                        tasks={tasks}
                        farmers={farmers}
                        surveyor={surveyor}
                        routes={routes}
                        villageMaster={villages}
                        onTasks={setTasks}
                        onFarmers={setFarmers}
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Phone app ------------------------------ */

const NO_SURVEYOR = "none";
const LOCATION_LABEL: Record<LocationSource, string> = { gps: "GPS", plot: "plot centre", village: "village centre" };

interface PhoneAppProps {
    today: string;
    workflow: Workflow | null;
    surveys: SurveyModel[];
    tasks: Task[];
    farmers: Farmer[];
    surveyor?: Surveyor;
    routes: Route[];
    /** Villages master (centres), as opposed to the village names farmers were registered with. */
    villageMaster: Village[];
    onTasks: (t: Task[]) => void;
    onFarmers: (f: Farmer[]) => void;
}

type Screen = { name: "tasks" } | { name: "farmers" } | { name: "register" } | { name: "task"; task: Task };

function PhoneApp({ today, workflow, surveys, tasks, farmers, surveyor, routes, villageMaster, onTasks, onFarmers }: PhoneAppProps) {
    const [screen, setScreen] = useState<Screen>({ name: "tasks" });
    const [village, setVillage] = useState<string>("all");
    const [tab, setTab] = useState<"pending" | "completed">("pending");

    const surveyById = useMemo(() => new Map(surveys.map((s) => [s.id, s])), [surveys]);
    const farmerById = useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers]);
    const villages = Array.from(new Set(farmers.map((f) => f.village).filter(Boolean))).sort();
    const inVillage = (farmerId: string) => village === "all" || farmerById.get(farmerId)?.village === village;

    // With a surveyor picked, Pending is their route for today, then the pending tasks on no route for today or later
    // (tasks on another surveyor's route, or on a later day, are not theirs to do now).
    const route = surveyor ? routeFor(routes, surveyor.id, today) : undefined;
    const routed = new Set(routes.filter((r) => r.status === "published" && r.date >= today).flatMap((r) => r.stops.flatMap((st) => st.taskIds)));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    // Each leg is measured from the previous stop (the first from the surveyor's base village), straight-line.
    const base: LatLng | undefined = villageMaster.find((v) => v.id === surveyor?.baseVillageId)?.centre;
    const locations = (route?.stops ?? []).map((stop) => stopLocation(farmerById.get(stop.farmerId), villageMaster));
    const stops = (route?.stops ?? []).map((stop, i) => {
        const location = locations[i];
        const from = i === 0 ? base : locations[i - 1];
        const km = from && location ? distanceKm(from, location) : undefined;
        const stopTasks = stop.taskIds.map((id) => taskById.get(id)).filter((t): t is Task => Boolean(t));
        return { no: i + 1, farmerId: stop.farmerId, tasks: stopTasks, km, source: location?.source, done: stopTasks.every((t) => t.status !== STATUS.planned) };
    });
    const routeStops = stops.filter((st) => inVillage(st.farmerId));
    const routePending = routeStops.flatMap((st) => st.tasks).filter((t) => t.status === STATUS.planned).length;

    const pending = tasks
        .filter((t) => isPendingOnApp(t, today) && inVillage(t.farmerId) && !(surveyor && routed.has(t.id)))
        .sort((a, b) => a.taskNo - b.taskNo);
    const completed = tasks.filter((t) => t.status !== STATUS.planned && t.status !== STATUS.expired && inVillage(t.farmerId)).sort((a, b) => b.taskNo - a.taskNo);

    const header = (
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <button type="button" className="flex items-center gap-1 text-xs font-semibold" onClick={() => setVillage(village === "all" ? villages[0] || "all" : villages[(villages.indexOf(village) + 1) % villages.length] === village ? "all" : villages[(villages.indexOf(village) + 1) % villages.length])} title="Switch village">
                {village === "all" ? "All villages" : village} <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" title={surveyor?.name}>
                {surveyor ? surveyor.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "SR"}
            </div>
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

    const routeSection = surveyor && (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Today&apos;s route</span>
                {route && <span className="font-mono text-[10px] text-zinc-400">{route.stops.length} {route.stops.length === 1 ? "stop" : "stops"}</span>}
            </div>
            {!route ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-[11px] text-zinc-400 dark:border-zinc-700">
                    No route for {surveyor.name} today. HQ assigns tasks on the Tasks page.
                </p>
            ) : routeStops.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-zinc-400">No stops in this village.</p>
            ) : (
                routeStops.map((st) => {
                    const farmer = farmerById.get(st.farmerId);
                    return (
                        <div key={st.farmerId} className={cn("space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800", st.done && "opacity-60")}>
                            <div className="flex items-start justify-between gap-2 px-1">
                                <div className="min-w-0">
                                    <div className="truncate text-xs font-bold">Stop {st.no} · {farmer?.name || "?"}</div>
                                    <div className="truncate text-[10px] text-zinc-500">{farmer?.village || "No village"}</div>
                                </div>
                                <div className="shrink-0 text-right font-mono text-[10px] text-zinc-500">
                                    {st.done ? (
                                        <span className="font-semibold text-emerald-600">Done</span>
                                    ) : (
                                        <>
                                            {st.km !== undefined && <div>{st.km.toFixed(1)} km</div>}
                                            <div>{st.source ? LOCATION_LABEL[st.source] : "No location"}</div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {st.tasks.map(taskCard)}
                        </div>
                    );
                })
            )}
            <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Other pending tasks</div>
        </div>
    );

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
                            {k} <span className="font-mono text-[10px]">{k === "pending" ? pending.length + routePending : completed.length}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-3 space-y-2">
                    {tab === "pending" && startCard}
                    {tab === "pending" && routeSection}
                    {(tab === "pending" ? pending : completed).length === 0 ? (
                        <p className={cn("text-center text-xs text-zinc-400", surveyor && tab === "pending" ? "py-3" : "py-8")}>
                            {tab === "pending" ? (surveyor ? "No other pending tasks." : "No pending tasks.") : "Nothing completed yet."}
                        </p>
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
