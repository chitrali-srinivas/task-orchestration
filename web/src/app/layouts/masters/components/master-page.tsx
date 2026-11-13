"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    derivedKeys,
    loadMasterRecords,
    saveMasterRecords,
} from "../../survey-builder/lib/master-data-registry";
import { LocationPicker, pointOf } from "./location-picker";

/**
 * One master's page (Masters - Village, Users, Fleet, Drivers, Suppliers in the sidebar). Anything entered here is
 * what the survey builder's "Master Data" option source and the phone preview use; Villages and Surveyor users also
 * feed Plans (jobs).
 */
export function MasterPage({ setId }: { setId: string }) {
    const def = MASTER_DEFINITIONS.find((d) => d.id === setId)!;
    return (
        <NavBarType4 pageTitle={`Masters - ${def.name}`} activeItemUrl={`/layouts/masters/${setId}`} pageDescription={def.description}>
            <div className="h-full overflow-auto bg-zinc-50/40 p-5 dark:bg-zinc-950/40">
                <MasterEditor setId={setId} />
            </div>
        </NavBarType4>
    );
}

function MasterEditor({ setId }: { setId: string }) {
    const def = MASTER_DEFINITIONS.find((d) => d.id === setId)!;
    // Every master's records, loaded once on the client (localStorage is not available during SSR): picks from
    // another master (a user's base village, a driver's vehicle) need theirs.
    const [records, setRecords] = useState<Record<string, MasterRecord[]>>({});
    useEffect(() => {
        setRecords(loadAllRecords());
    }, []);

    const update = (next: MasterRecord[]) => {
        saveMasterRecords(setId, next);
        setRecords((r) => ({ ...r, [setId]: next }));
    };

    return (
        <MasterTable
            setId={setId}
            name={def.name}
            itemName={def.itemName}
            description={def.description}
            fields={def.fields}
            records={records[setId] || []}
            allRecords={records}
            onChange={update}
        />
    );
}

const loadAllRecords = () => Object.fromEntries(MASTER_DEFINITIONS.map((d) => [d.id, loadMasterRecords(d.id)]));

/** A location field's two numbers as "21.25670, 77.51040". */
const locationText = (f: MasterFieldDefinition, r: MasterRecord) => {
    if (f.editor?.kind !== "location") return "";
    const p = pointOf(r[f.editor.latKey], r[f.editor.lngKey]);
    return p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "";
};

/** Whether a field is asked for this record (e.g. visits per day only for surveyors). */
const shownFor = (f: MasterFieldDefinition, r: MasterRecord) => !f.showWhen || r[f.showWhen.key] === f.showWhen.value;

/** Whether a field must be filled in for this record (e.g. a surveyor's home). */
const requiredFor = (f: MasterFieldDefinition, r: MasterRecord) => Boolean(f.requiredWhen) && r[f.requiredWhen!.key] === f.requiredWhen!.value;

/** Whether a field has a value: a location needs both numbers, anything else non-blank text. */
const filled = (f: MasterFieldDefinition, r: MasterRecord) =>
    f.editor?.kind === "location" ? Boolean(pointOf(r[f.editor.latKey], r[f.editor.lngKey])) : Boolean(String(r[f.key] ?? "").trim());

interface MasterTableProps {
    setId: string;
    name: string;
    itemName: string;
    description: string;
    fields: MasterFieldDefinition[];
    records: MasterRecord[];
    allRecords: Record<string, MasterRecord[]>;
    onChange: (next: MasterRecord[]) => void;
}

function MasterTable({ setId, name, itemName, description, fields, records, allRecords, onChange }: MasterTableProps) {
    const [editing, setEditing] = useState<MasterRecord | null>(null); // null = closed; {id:""} = new
    // Fields an editor fills in by itself (a ref's id, a location's numbers) are not shown or typed by hand.
    const hidden = derivedKeys(fields);
    const columns = fields.filter((f) => !hidden.includes(f.key));
    const blank = (): MasterRecord => ({ id: "", ...Object.fromEntries(fields.flatMap((f) => (f.defaultValue ? [[f.key, f.defaultValue]] : []))) });

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
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <Database className="h-4 w-4 text-zinc-500" /> {name}
                        <span className="font-mono text-[11px] font-normal text-zinc-400">{records.length}</span>
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{description}</p>
                </div>
                <Button type="button" size="sm" onClick={() => setEditing(blank())} className="h-8 gap-1.5 text-xs">
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
                                        {(f.editor?.kind === "location" ? locationText(f, r) : r[f.key]) ||
                                            (requiredFor(f, r) ? (
                                                <span className="font-medium text-rose-600" title={`Required for ${f.requiredWhen!.value.toLowerCase()}s`}>Missing</span>
                                            ) : (
                                                <span className="text-zinc-300">—</span>
                                            ))}
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
                    title={editing.id ? `Edit ${itemName}` : `Add ${itemName}`}
                    fields={columns}
                    allFields={fields}
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
    /** The fields typed or picked in the dialog. */
    fields: MasterFieldDefinition[];
    allFields: MasterFieldDefinition[];
    initial: MasterRecord;
    allRecords: Record<string, MasterRecord[]>;
    onSave: (rec: MasterRecord) => void;
    onClose: () => void;
}

function RecordDialog({ title, fields, allFields, initial, allRecords, onSave, onClose }: RecordDialogProps) {
    const [draft, setDraft] = useState<MasterRecord>(initial);
    const set = (patch: Record<string, any>) => setDraft((d) => ({ ...d, ...patch }));
    const firstKey = fields[0]?.key;
    const shown = fields.filter((f) => shownFor(f, draft));
    const badLocation = shown.some(
        (f) => f.editor?.kind === "location" && (draft[f.editor.latKey] || draft[f.editor.lngKey]) && !pointOf(draft[f.editor.latKey], draft[f.editor.lngKey])
    );
    const missing = shown.filter((f) => requiredFor(f, draft) && !filled(f, draft));
    const canSave = Boolean(String(draft[firstKey] || "").trim()) && !badLocation && missing.length === 0;
    // Where a map opens when the record has no point yet: the first village with a centre.
    const near = useMemo(() => (allRecords.villages || []).map((v) => pointOf(v.lat, v.lng)).find(Boolean), [allRecords]);

    /** Fields not asked for this record (e.g. a verifier's visits per day) are saved empty, with what they fill in. */
    const save = () => {
        const cleared = Object.fromEntries(
            fields
                .filter((f) => !shownFor(f, draft))
                .flatMap((f) => [f.key, ...derivedKeys([f])])
                .map((k) => [k, ""])
        );
        // Keep only keys this master defines (plus id), so records stay tidy.
        const keys = new Set(["id", ...allFields.map((f) => f.key)]);
        onSave(Object.fromEntries(Object.entries({ ...draft, ...cleared }).filter(([k]) => keys.has(k))) as MasterRecord);
    };

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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">{title}</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500">The first field is used as the display name.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    {shown.map((f) => (
                        <div key={f.key} className="space-y-1">
                            <Label htmlFor={`m-${f.key}`} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                {f.label} {(f.key === firstKey || requiredFor(f, draft)) && <span className="text-rose-500">*</span>}
                            </Label>
                            {requiredFor(f, draft) && f.editor?.kind === "location" && (
                                <p className="text-[11px] text-zinc-500">Required for {f.requiredWhen!.value.toLowerCase()}s: planning starts and ends their day here.</p>
                            )}
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
                                        <SelectValue
                                            placeholder={
                                                refOptions[f.key]?.length
                                                    ? "Select…"
                                                    : `Add ${(MASTER_DEFINITIONS.find((d) => d.id === (f.editor as { setId: string }).setId)?.name || "records").toLowerCase()} first`
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(refOptions[f.key] || []).map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : f.editor?.kind === "location" ? (
                                <LocationPicker
                                    id={`m-${f.key}`}
                                    lat={draft[f.editor.latKey]}
                                    lng={draft[f.editor.lngKey]}
                                    near={near}
                                    onChange={(lat, lng) => {
                                        const ed = f.editor as { latKey: string; lngKey: string };
                                        set({ [ed.latKey]: lat, [ed.lngKey]: lng });
                                    }}
                                />
                            ) : (
                                <Input
                                    id={`m-${f.key}`}
                                    autoFocus={f.key === firstKey}
                                    placeholder={f.editor?.kind === "text" ? f.editor.placeholder : undefined}
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
                    <Button type="button" size="sm" disabled={!canSave} onClick={save} className="h-8 text-xs">Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
