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
import { JOB_STATUS, Job, JobStatus, Surveyor, Village, distanceKm, openJobsByTask, stopLocation, unfinishedStops } from "@/lib/orchestration/jobs";
import {
    phoneWorkflows,
    jobAction,
    loadFarmers,
    loadJobs,
    loadPhoneSurveyor,
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
 * "Today" can be moved to see day-based tasks appear and expire; Reset deletes all farmers, tasks and jobs.
 * Picking a surveyor shows their jobs (assigned on HQ Task planning): accept or decline, start, visit the stops in
 * order, and close the job sheet with a reason for anything not done; then the pending tasks no job holds.
 * These are the only simulation controls (the HQ pages have no date selection).
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
    const [jobs, setJobs] = useState<Job[]>([]);
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
        setJobs(loadJobs());
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
        setJobs([]);
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
                                No surveyors yet. Add them in <a href="/layouts/masters" className="underline">Masters</a> to see their jobs.
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
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-300">Delete all farmers, tasks and jobs? Surveys, workflows and masters are kept.</p>
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
                        jobs={jobs}
                        villageMaster={villages}
                        onTasks={setTasks}
                        onJobs={setJobs}
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
    jobs: Job[];
    /** Villages master (centres), as opposed to the village names farmers were registered with. */
    villageMaster: Village[];
    onTasks: (t: Task[]) => void;
    onJobs: (j: Job[]) => void;
    onFarmers: (f: Farmer[]) => void;
}

type Screen = { name: "tasks" } | { name: "farmers" } | { name: "register" } | { name: "task"; task: Task } | { name: "close"; jobId: string };

/** Job statuses the surveyor sees (created jobs are still with HQ; closed ones are done). */
const PHONE_JOB_LABEL: Partial<Record<JobStatus, string>> = {
    [JOB_STATUS.assigned]: "New job",
    [JOB_STATUS.accepted]: "Accepted",
    [JOB_STATUS.inProgress]: "In progress",
};

function PhoneApp({ today, workflow, surveys, tasks, farmers, surveyor, jobs, villageMaster, onTasks, onJobs, onFarmers }: PhoneAppProps) {
    const [screen, setScreen] = useState<Screen>({ name: "tasks" });
    const [declining, setDeclining] = useState<{ jobId: string; reason: string } | null>(null);
    const [village, setVillage] = useState<string>("all");
    const [tab, setTab] = useState<"pending" | "completed">("pending");

    const surveyById = useMemo(() => new Map(surveys.map((s) => [s.id, s])), [surveys]);
    const farmerById = useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers]);
    const villages = Array.from(new Set(farmers.map((f) => f.village).filter(Boolean))).sort();
    const inVillage = (farmerId: string) => village === "all" || farmerById.get(farmerId)?.village === village;

    // With a surveyor picked, Pending shows their jobs, then the pending tasks no open job holds (tasks on another
    // surveyor's job, or on a created job HQ hasn't sent yet, are not theirs to do).
    const held = openJobsByTask(jobs);
    const myJobs = surveyor
        ? jobs.filter((j) => j.surveyorId === surveyor.id && PHONE_JOB_LABEL[j.status]).sort((a, b) => a.date.localeCompare(b.date) || a.jobNo - b.jobNo)
        : [];
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const base: LatLng | undefined = villageMaster.find((v) => v.id === surveyor?.baseVillageId)?.centre;
    /** A job's stops with their tasks, the leg from the previous stop (the first from the base village) and done-ness. */
    const stopsOf = (job: Job) => {
        const locations = job.stops.map((stop) => stopLocation(farmerById.get(stop.farmerId), villageMaster));
        return job.stops
            .map((stop, i) => {
                const from = i === 0 ? base : locations[i - 1];
                const km = from && locations[i] ? distanceKm(from, locations[i]!) : undefined;
                const stopTasks = stop.taskIds.map((id) => taskById.get(id)).filter((t): t is Task => Boolean(t));
                return { no: i + 1, farmerId: stop.farmerId, tasks: stopTasks, km, source: locations[i]?.source, done: stopTasks.every((t) => t.status !== STATUS.planned) };
            })
            .filter((st) => inVillage(st.farmerId));
    };
    /** The surveyor can open a job's tasks once it is accepted (or started) and its day has come. */
    const workable = (job: Job) => (job.status === JOB_STATUS.accepted || job.status === JOB_STATUS.inProgress) && job.date <= today;
    const jobPending = myJobs.filter(workable).flatMap((j) => stopsOf(j).flatMap((st) => st.tasks)).filter((t) => isPendingOnApp(t, today)).length;
    const act = (jobId: string, action: "accept" | "decline" | "start", note?: string) => onJobs(jobAction(jobId, action, { by: surveyor?.name ?? "Surveyor", note }));

    const pending = tasks
        .filter((t) => isPendingOnApp(t, today) && inVillage(t.farmerId) && !(surveyor && held.has(t.id)))
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

    const jobsSection = surveyor && (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">My jobs</span>
                <span className="font-mono text-[10px] text-zinc-400">{myJobs.length}</span>
            </div>
            {myJobs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-center text-[11px] text-zinc-400 dark:border-zinc-700">
                    No jobs for {surveyor.name}. HQ assigns them on Task planning.
                </p>
            ) : (
                myJobs.map((job) => {
                    const stops = stopsOf(job);
                    const open = workable(job);
                    const taskTotal = job.stops.reduce((n, st) => n + st.taskIds.length, 0);
                    return (
                        <div key={job.id} className="space-y-2 rounded-xl border border-zinc-300 p-2.5 dark:border-zinc-700">
                            <div className="flex items-start justify-between gap-2 px-0.5">
                                <div className="min-w-0">
                                    <div className="text-xs font-bold">
                                        J{job.jobNo} · {job.date}
                                        {job.date === today && <span className="text-sky-600"> · Today</span>}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        {job.stops.length} {job.stops.length === 1 ? "stop" : "stops"} · {taskTotal} {taskTotal === 1 ? "task" : "tasks"}
                                    </div>
                                </div>
                                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-zinc-800">{PHONE_JOB_LABEL[job.status]}</span>
                            </div>

                            {job.status === JOB_STATUS.assigned &&
                                (declining?.jobId === job.id ? (
                                    <div className="space-y-1.5">
                                        <Input
                                            autoFocus
                                            placeholder="Why can't you take this job?"
                                            value={declining.reason}
                                            onChange={(e) => setDeclining({ jobId: job.id, reason: e.target.value })}
                                            className="h-8 text-xs"
                                        />
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={() => setDeclining(null)}>Back</Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="h-7 flex-1 bg-rose-600 text-[11px] text-white hover:bg-rose-700"
                                                disabled={!declining.reason.trim()}
                                                onClick={() => {
                                                    act(job.id, "decline", declining.reason);
                                                    setDeclining(null);
                                                }}
                                            >
                                                Decline job
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setDeclining({ jobId: job.id, reason: "" })}>Decline</Button>
                                        <Button type="button" size="sm" className="h-8 flex-1 text-xs" onClick={() => act(job.id, "accept")}>Accept</Button>
                                    </div>
                                ))}
                            {job.status === JOB_STATUS.accepted &&
                                (job.date <= today ? (
                                    <Button type="button" size="sm" className="h-8 w-full text-xs" onClick={() => act(job.id, "start")}>Start job</Button>
                                ) : (
                                    <p className="px-0.5 text-[10px] text-zinc-500">Starts on {job.date}.</p>
                                ))}

                            {stops.length === 0 && <p className="py-1 text-center text-[11px] text-zinc-400">No stops in this village.</p>}
                            {stops.map((st) => {
                                const farmer = farmerById.get(st.farmerId);
                                return (
                                    <div key={st.farmerId} className={cn("space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800", st.done && "opacity-60")}>
                                        <div className="flex items-start justify-between gap-2 px-1">
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-bold">Stop {st.no} · {farmer?.name || "?"}</div>
                                                <div className="truncate text-[10px] text-zinc-500">
                                                    {farmer?.village || "No village"}
                                                    {!open && ` · ${st.tasks.map((t) => `T${t.taskNo}`).join(", ")}`}
                                                </div>
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
                                        {open && st.tasks.map(taskCard)}
                                    </div>
                                );
                            })}

                            {open && (
                                <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => setScreen({ name: "close", jobId: job.id })}>
                                    Close job sheet
                                </Button>
                            )}
                        </div>
                    );
                })
            )}
            <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Other pending tasks</div>
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
                    onJobs(loadJobs()); // the first task submitted on an accepted job starts it
                    setScreen({ name: "tasks" });
                }}
            />
        );
    }

    if (screen.name === "close") {
        const job = jobs.find((j) => j.id === screen.jobId);
        return (
            <CloseJobSheetScreen
                job={job}
                unfinished={job ? unfinishedStops(job, tasks) : []}
                farmerName={(id) => farmerById.get(id)?.name || "?"}
                taskLabel={(id) => (taskById.get(id) ? `T${taskById.get(id)!.taskNo}` : "?")}
                isPlanned={(id) => taskById.get(id)?.status === STATUS.planned}
                onBack={() => setScreen({ name: "tasks" })}
                onConfirm={(reasons) => {
                    if (job) onJobs(jobAction(job.id, "close", { by: surveyor?.name ?? "Surveyor", reasons }));
                    setScreen({ name: "tasks" });
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
                            {k} <span className="font-mono text-[10px]">{k === "pending" ? pending.length + jobPending : completed.length}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-3 space-y-2">
                    {tab === "pending" && startCard}
                    {tab === "pending" && jobsSection}
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

/* ------------------------------ Close job sheet ------------------------------ */

function CloseJobSheetScreen({ job, unfinished, farmerName, taskLabel, isPlanned, onBack, onConfirm }: {
    job?: Job;
    unfinished: number[];
    farmerName: (farmerId: string) => string;
    taskLabel: (taskId: string) => string;
    isPlanned: (taskId: string) => boolean;
    onBack: () => void;
    onConfirm: (reasons: Record<number, string>) => void;
}) {
    const [reasons, setReasons] = useState<Record<number, string>>({});
    const complete = unfinished.every((i) => reasons[i]?.trim());
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <button type="button" onClick={onBack} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0">
                    <div className="truncate text-xs font-bold">Close job sheet{job ? ` · J${job.jobNo}` : ""}</div>
                    <div className="truncate text-[10px] text-zinc-500">{job?.date}</div>
                </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {!job ? (
                    <p className="text-center text-xs text-rose-600">Job not found.</p>
                ) : (
                    <>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                            {job.stops.length - unfinished.length} of {job.stops.length} stops done.
                            {unfinished.length > 0 && " Say why each remaining stop wasn't done. Its tasks go back to HQ for the next plan."}
                        </p>
                        {unfinished.map((i) => (
                            <div key={i} className="space-y-1 rounded-lg bg-zinc-100 p-2.5 dark:bg-zinc-900">
                                <div className="text-xs font-semibold">Stop {i + 1} · {farmerName(job.stops[i].farmerId)}</div>
                                <div className="text-[10px] text-zinc-500">{job.stops[i].taskIds.filter(isPlanned).map(taskLabel).join(", ")} not done</div>
                                <Input
                                    placeholder="Reason (e.g. farmer away)"
                                    value={reasons[i] ?? ""}
                                    onChange={(e) => setReasons((r) => ({ ...r, [i]: e.target.value }))}
                                    className="h-8 bg-white text-xs dark:bg-zinc-950"
                                />
                            </div>
                        ))}
                    </>
                )}
            </div>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                <Button type="button" className="h-9 w-full text-xs" disabled={!job || !complete} onClick={() => onConfirm(reasons)}>
                    Close job sheet
                </Button>
            </div>
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
