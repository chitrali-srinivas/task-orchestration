"use client";

// Survey category picker for the create and edit-details dialogs. Farmer Enrollment is the category whose surveys
// register farmers, so it adds the system fields (lib/system-fields.ts); the hint says so.
import React from "react";
import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_REGISTRY } from "../../lib/category-registry";
import { SYSTEM_FIELDS, isFarmerEnrollment } from "../../lib/system-fields";

/** The registry name for a stored category (older surveys may hold an id, or a name in another case). */
const toName = (category?: string) => {
    const c = (category || "").trim().toLowerCase();
    return CATEGORY_REGISTRY.find((d) => d.id === c || d.name.toLowerCase() === c)?.name ?? category ?? "";
};

export function CategoryField({ id, value, onChange, disabled }: { id: string; value?: string; onChange: (category: string) => void; disabled?: boolean }) {
    const name = toName(value);
    const known = CATEGORY_REGISTRY.some((d) => d.name === name);
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Category
            </Label>
            <Select value={name} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger id={id} className="h-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                    {!known && name && <SelectItem value={name} className="text-xs">{name}</SelectItem>}
                    {CATEGORY_REGISTRY.map((d) => (
                        <SelectItem key={d.id} value={d.name} className="text-xs">
                            {d.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {isFarmerEnrollment({ category: name }) && (
                <p className="flex items-start gap-1.5 text-[11px] text-sky-700 dark:text-sky-300">
                    <Lock className="h-3 w-3 shrink-0 mt-px" />
                    <span>
                        Registers farmers. Always asks for {SYSTEM_FIELDS.map((f) => f.label.toLowerCase()).join(", ")} as locked system fields, which planning needs.
                    </span>
                </p>
            )}
        </div>
    );
}
