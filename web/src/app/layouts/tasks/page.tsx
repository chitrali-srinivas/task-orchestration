"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ListTodo, RotateCcw } from "lucide-react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SurveyService } from "../survey-builder/services/survey-service";
import { SurveyModel } from "../survey-builder/types/survey-schema";
import { Farmer, STATUS, Task } from "@/lib/orchestration/engine";
import { changeStatus, loadFarmers, loadToday, refreshTasks, resetSimulation, saveToday, ready } from "@/lib/orchestration/store";

/** HQ view of every task the workflow created: id, survey template, farmer, status, dates. */
export default function TasksPage() {
    return (
        <NavBarType4 pageTitle="Tasks" activeItemUrl="/layouts/tasks" pageDescription="Every task created by the survey workflows, per farmer.">
            <div className="h-full overflow-auto bg-zinc-50/40 p-5 dark:bg-zinc-950/40">
                <TaskSummary />
            </div>
        </NavBarType4>
    );
}

export const STATUS_STYLE: Record<string, string> = {
    planned: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    collected: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    expired: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: string }) {
    return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize", STATUS_STYLE[status] || STATUS_STYLE.planned)}>{status}</span>;
}

function TaskSummary() {
    const [today, setToday] = useState("");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [surveys, setSurveys] = useState<SurveyModel[]>([]);
    const [filter, setFilter] = useState<string>("all");

    useEffect(() => {
        ready().then(() => {
            const t = loadToday();
            setToday(t);
            setTasks(refreshTasks(t));
            setFarmers(loadFarmers());
            SurveyService.getAllSurveys().then(setSurveys);
        });
    }, []);

    const changeToday = (t: string) => {
        if (!t) return;
        saveToday(t);
        setToday(t);
        setTasks(refreshTasks(t));
    };

    const surveyById = useMemo(() => new Map(surveys.map((s) => [s.id, s])), [surveys]);
    const farmerById = useMemo(() => new Map(farmers.map((f) => [f.id, f])), [farmers]);
    const statuses = Array.from(new Set([...Object.values(STATUS), ...tasks.map((t) => t.status)]));
    const counts = (s: string) => tasks.filter((t) => t.status === s).length;
    const rows = [...tasks].filter((t) => filter === "all" || t.status === filter).sort((a, b) => b.taskNo - a.taskNo);

    return (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <ListTodo className="h-4 w-4 text-zinc-500" /> Task summary
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Tasks are created by the workflow when a previous survey reaches the configured status.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="sim-today" className="text-xs text-zinc-500">Today</Label>
                    <Input id="sim-today" type="date" value={today} onChange={(e) => changeToday(e.target.value)} className="h-8 w-40 text-xs" />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        title="Delete all farmers and tasks"
                        onClick={() => {
                            resetSimulation();
                            setTasks([]);
                            setFarmers([]);
                        }}
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                {["all", ...statuses].map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setFilter(s)}
                        className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                            filter === s ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
                        )}
                    >
                        {s} <span className="font-mono opacity-70">{s === "all" ? tasks.length : counts(s)}</span>
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">No tasks yet. Register a farmer in the Phone simulator to create the first ones.</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs">Task id</TableHead>
                            <TableHead className="text-xs">Survey template</TableHead>
                            <TableHead className="text-xs">Farmer</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Planned start</TableHead>
                            <TableHead className="text-xs">Planned end</TableHead>
                            <TableHead className="text-xs">Created from</TableHead>
                            <TableHead className="w-40" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((t) => {
                            const s = surveyById.get(t.surveyId);
                            const f = farmerById.get(t.farmerId);
                            const parent = tasks.find((p) => p.id === t.parentTaskId);
                            return (
                                <TableRow key={t.id}>
                                    <TableCell className="font-mono text-xs font-semibold">T{t.taskNo}</TableCell>
                                    <TableCell className="text-xs">
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{s?.name || "(missing survey)"}</div>
                                        <div className="font-mono text-[10px] text-zinc-400">{t.surveyId}{s ? ` · v${s.version}` : ""}</div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {f ? <>{f.name} <span className="text-zinc-400">· {f.village}</span></> : <span className="text-zinc-400">—</span>}
                                    </TableCell>
                                    <TableCell><StatusBadge status={t.status} /></TableCell>
                                    <TableCell className={cn("font-mono text-xs", t.plannedStart > today && "text-zinc-400")} title={t.plannedStart > today ? "Not yet on the app" : ""}>{t.plannedStart}</TableCell>
                                    <TableCell className="font-mono text-xs">{t.plannedEnd || <span className="text-zinc-400">indefinite</span>}</TableCell>
                                    <TableCell className="font-mono text-[10px] text-zinc-500">{parent ? `T${parent.taskNo} ${parent.status}` : "registration"}</TableCell>
                                    <TableCell className="text-right">
                                        {t.status === STATUS.collected && (
                                            <div className="flex justify-end gap-1">
                                                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setTasks(changeStatus(t.id, STATUS.verified, today))}>Verify</Button>
                                                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] text-rose-600" onClick={() => setTasks(changeStatus(t.id, STATUS.cancelled, today))}>Cancel</Button>
                                            </div>
                                        )}
                                        {t.status === STATUS.planned && (
                                            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] text-rose-600" onClick={() => setTasks(changeStatus(t.id, STATUS.cancelled, today))}>Cancel</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
