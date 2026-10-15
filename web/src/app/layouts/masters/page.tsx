"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { ready } from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    MASTER_DEFINITIONS,
    MasterFieldDefinition,
    MasterRecord,
    loadMasterRecords,
    saveMasterRecords,
} from "../survey-builder/lib/master-data-registry";

/**
 * Masters: define Supplier info and Fleet master records.
 * Anything entered here is what the survey builder's "Master Data" option source
 * and the phone preview use.
 */
export default function MastersPage() {
    return (
        <NavBarType4
            pageTitle="Masters"
            activeItemUrl="/layouts/masters"
            pageDescription="Reference data used by survey questions that pick from a master."
        >
            <div className="h-full overflow-auto bg-zinc-50/40 p-5 dark:bg-zinc-950/40">
                <MastersEditor />
            </div>
        </NavBarType4>
    );
}

function MastersEditor() {
    // All masters' records, loaded once on the client (localStorage is not available during SSR).
    const [records, setRecords] = useState<Record<string, MasterRecord[]>>({});
    useEffect(() => {
        ready().then(() => {
            const init: Record<string, MasterRecord[]> = {};
            MASTER_DEFINITIONS.forEach((d) => (init[d.id] = loadMasterRecords(d.id)));
            setRecords(init);
        });
    }, []);

    const update = (setId: string, next: MasterRecord[]) => {
        saveMasterRecords(setId, next);
        setRecords((r) => ({ ...r, [setId]: next }));
    };

    return (
        <Tabs defaultValue={MASTER_DEFINITIONS[0].id} className="space-y-4">
            <TabsList className="bg-zinc-100 dark:bg-zinc-900">
                {MASTER_DEFINITIONS.map((d) => (
                    <TabsTrigger key={d.id} value={d.id} className="text-xs">
                        {d.name}
                        <span className="ml-1.5 font-mono text-[10px] text-zinc-400">{(records[d.id] || []).length}</span>
                    </TabsTrigger>
                ))}
            </TabsList>
            {MASTER_DEFINITIONS.map((d) => (
                <TabsContent key={d.id} value={d.id}>
                    <MasterTable
                        setId={d.id}
                        name={d.name}
                        description={d.description}
                        fields={d.fields}
                        records={records[d.id] || []}
                        allRecords={records}
                        onChange={(next) => update(d.id, next)}
                    />
                </TabsContent>
            ))}
        </Tabs>
    );
}

interface MasterTableProps {
    setId: string;
    name: string;
    description: string;
    fields: MasterFieldDefinition[];
    records: MasterRecord[];
    allRecords: Record<string, MasterRecord[]>;
    onChange: (next: MasterRecord[]) => void;
}

function MasterTable({ setId, name, description, fields, records, allRecords, onChange }: MasterTableProps) {
    const [editing, setEditing] = useState<MasterRecord | null>(null); // null = closed; {id:""} = new
    // Fields written automatically from a "ref" pick (e.g. supplierId) are not typed by hand.
    const refIdKeys = fields.flatMap((f) => (f.editor?.kind === "ref" ? [f.editor.idKey] : []));
    const columns = fields.filter((f) => !refIdKeys.includes(f.key));

    const save = (rec: MasterRecord) => {
        if (rec.id) {
            onChange(records.map((r) => (r.id === rec.id ? rec : r)));
        } else {
            onChange([...records, { ...rec, id: `${setId}_${Date.now()}` }]);
        }
        setEditing(null);
    };

    return (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <Database className="h-4 w-4 text-zinc-500" /> {name}
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{description}</p>
                </div>
                <Button type="button" size="sm" onClick={() => setEditing({ id: "" })} className="h-8 gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add
                </Button>
            </div>

            {records.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">No records yet. Click Add to create the first one.</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((f) => (
                                <TableHead key={f.key} className="text-xs">{f.label}</TableHead>
                            ))}
                            <TableHead className="w-20" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((r) => (
                            <TableRow key={r.id}>
                                {columns.map((f) => (
                                    <TableCell key={f.key} className="text-xs text-zinc-800 dark:text-zinc-200">
                                        {r[f.key] || <span className="text-zinc-300">—</span>}
                                    </TableCell>
                                ))}
                                <TableCell className="text-right">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditing(r)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-rose-600"
                                        title="Delete"
                                        onClick={() => onChange(records.filter((x) => x.id !== r.id))}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {editing && (
                <RecordDialog
                    title={editing.id ? `Edit ${name}` : `Add ${name}`}
                    fields={columns}
                    initial={editing}
                    allRecords={allRecords}
                    onSave={save}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}

interface RecordDialogProps {
    title: string;
    fields: MasterFieldDefinition[];
    initial: MasterRecord;
    allRecords: Record<string, MasterRecord[]>;
    onSave: (rec: MasterRecord) => void;
    onClose: () => void;
}

function RecordDialog({ title, fields, initial, allRecords, onSave, onClose }: RecordDialogProps) {
    const [draft, setDraft] = useState<MasterRecord>(initial);
    const set = (patch: Record<string, any>) => setDraft((d) => ({ ...d, ...patch }));
    const firstKey = fields[0]?.key;
    const canSave = Boolean(String(draft[firstKey] || "").trim());

    const refOptions = useMemo(() => {
        const out: Record<string, { id: string; label: string }[]> = {};
        fields.forEach((f) => {
            const ed = f.editor;
            if (ed?.kind === "ref") {
                const def = MASTER_DEFINITIONS.find((d) => d.id === ed.setId);
                out[f.key] = (allRecords[ed.setId] || []).map((r) => ({ id: r.id, label: String(r[def?.displayFieldKey || "id"] || r.id) }));
            }
        });
        return out;
    }, [fields, allRecords]);

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">{title}</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">The first field is used as the display name.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    {fields.map((f) => (
                        <div key={f.key} className="space-y-1">
                            <Label htmlFor={`m-${f.key}`} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {f.label} {f.key === firstKey && <span className="text-rose-500">*</span>}
                            </Label>
                            {f.editor?.kind === "select" ? (
                                <Select value={draft[f.key] || ""} onValueChange={(v) => set({ [f.key]: v })}>
                                    <SelectTrigger id={`m-${f.key}`} className="h-9 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                        {f.editor.options.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : f.editor?.kind === "ref" ? (
                                <Select
                                    value={draft[f.editor.idKey] || ""}
                                    onValueChange={(id) => {
                                        const picked = refOptions[f.key]?.find((o) => o.id === id);
                                        set({ [f.key]: picked?.label || "", [(f.editor as { idKey: string }).idKey]: id });
                                    }}
                                >
                                    <SelectTrigger id={`m-${f.key}`} className="h-9 text-xs">
                                        <SelectValue placeholder={refOptions[f.key]?.length ? "Select…" : "Add suppliers first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(refOptions[f.key] || []).map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id={`m-${f.key}`}
                                    autoFocus={f.key === firstKey}
                                    value={draft[f.key] || ""}
                                    onChange={(e) => set({ [f.key]: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            )}
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancel</Button>
                    <Button type="button" size="sm" disabled={!canSave} onClick={() => onSave(draft)} className="h-8 text-xs">Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
