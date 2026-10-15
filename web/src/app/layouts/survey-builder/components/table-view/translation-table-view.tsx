"use client";

import React, { useMemo } from "react";
import { Globe, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OptionItem, QuestionModel, SurveyModel } from "../../types/survey-schema";

interface TranslationTableViewProps {
    survey: SurveyModel;
    onUpdateSurvey: (updated: SurveyModel) => void;
    onOpenLanguageManager: () => void;
    isPublished?: boolean;
}

type TextKind = "title" | "hint" | "placeholder" | "option";

interface TextRow {
    key: string;
    question: QuestionModel;
    kind: TextKind;
    label: string;              // e.g. "Q1 · Title", "Q1 · Option yes"
    values: Record<string, string>;
    optionIndex?: number;
}

/**
 * Every text the survey shows to a surveyor, one row each, with a column per language.
 * The default language is the source (read-only here); the other languages are edited inline.
 */
export function TranslationTableView({ survey, onUpdateSurvey, onOpenLanguageManager, isPublished = false }: TranslationTableViewProps) {
    const defaultLocale = survey.defaultLocale || "en";
    const locales = survey.locales?.length ? survey.locales : [{ code: defaultLocale, label: "English", isDefault: true }];
    const otherLocales = locales.filter((l) => l.code !== defaultLocale);

    const rows = useMemo<TextRow[]>(() => {
        const out: TextRow[] = [];
        survey.questions.forEach((q) => {
            const n = q.displayIndex || String(q.number);
            out.push({ key: `${q.id}:title`, question: q, kind: "title", label: `Q${n} · Question`, values: q.titles || {} });
            if (q.descriptions && Object.values(q.descriptions).some(Boolean)) {
                out.push({ key: `${q.id}:hint`, question: q, kind: "hint", label: `Q${n} · Help text`, values: q.descriptions });
            }
            if (q.placeholders && Object.values(q.placeholders).some(Boolean)) {
                out.push({ key: `${q.id}:placeholder`, question: q, kind: "placeholder", label: `Q${n} · Placeholder`, values: q.placeholders });
            }
            (q.options || []).forEach((opt: OptionItem, i: number) => {
                out.push({ key: `${q.id}:opt:${opt.id}`, question: q, kind: "option", label: `Q${n} · Option ${i + 1}`, values: opt.labels || {}, optionIndex: i });
            });
        });
        return out;
    }, [survey.questions]);

    const updateText = (row: TextRow, localeCode: string, value: string) => {
        const stamp = { status: "manual" as const, translatedAt: new Date().toISOString() };
        const questions = survey.questions.map((q) => {
            if (q.id !== row.question.id) return q;
            const meta = { ...(q.translationsMeta || {}), [localeCode]: stamp };
            switch (row.kind) {
                case "title":
                    return { ...q, titles: { ...q.titles, [localeCode]: value }, translationsMeta: meta };
                case "hint":
                    return { ...q, descriptions: { ...(q.descriptions || {}), [localeCode]: value }, translationsMeta: meta };
                case "placeholder":
                    return { ...q, placeholders: { ...(q.placeholders || {}), [localeCode]: value }, translationsMeta: meta };
                case "option": {
                    const options = (q.options || []).map((opt, i) =>
                        i === row.optionIndex ? { ...opt, labels: { ...opt.labels, [localeCode]: value } } : opt
                    );
                    return { ...q, options, translationsMeta: meta };
                }
            }
        });
        onUpdateSurvey({ ...survey, questions, updatedAt: new Date().toISOString() });
    };

    const missing = (code: string) => rows.filter((r) => !(r.values[code] || "").trim()).length;

    return (
        <div className="flex h-full flex-col bg-zinc-50/40 dark:bg-zinc-950/40">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <Languages className="h-4 w-4 text-zinc-500" /> Translations
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {rows.length} texts · source language {locales.find((l) => l.code === defaultLocale)?.label || defaultLocale}
                        {otherLocales.length === 0 ? " · add a language to start translating" : ""}
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onOpenLanguageManager} className="h-8 gap-1.5 text-xs">
                    <Globe className="h-3.5 w-3.5" /> Manage languages
                </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
                {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-xs text-zinc-500 dark:border-zinc-700">
                        No texts yet. Add questions in the Builder first.
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/60">
                                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                    <th className="w-40 px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300">Text</th>
                                    <th className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300">
                                        {locales.find((l) => l.code === defaultLocale)?.label || defaultLocale}
                                        <span className="ml-1 font-mono text-[10px] text-zinc-400">{defaultLocale} · source</span>
                                    </th>
                                    {otherLocales.map((l) => (
                                        <th key={l.code} className="px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-300">
                                            {l.label}
                                            <span className="ml-1 font-mono text-[10px] text-zinc-400">{l.code}</span>
                                            {missing(l.code) > 0 && (
                                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                                    {missing(l.code)} missing
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                                        <td className="px-3 py-2 align-top">
                                            <span className="font-mono text-[10px] font-semibold text-zinc-500">{row.label}</span>
                                        </td>
                                        <td className="px-3 py-2 align-top text-zinc-900 dark:text-zinc-100">
                                            {row.values[defaultLocale] || <span className="italic text-zinc-400">(empty)</span>}
                                        </td>
                                        {otherLocales.map((l) => (
                                            <td key={l.code} className="px-3 py-1.5 align-top">
                                                <Input
                                                    value={row.values[l.code] || ""}
                                                    disabled={isPublished}
                                                    placeholder={row.values[defaultLocale] || ""}
                                                    onChange={(e) => updateText(row, l.code, e.target.value)}
                                                    className={cn(
                                                        "h-8 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600",
                                                        !(row.values[l.code] || "").trim() && "border-amber-200 dark:border-amber-900/50"
                                                    )}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
