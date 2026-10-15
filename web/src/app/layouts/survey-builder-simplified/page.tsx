"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Plus,
    Smartphone,
    Layers,
    FolderOpen,
} from "lucide-react";
import { NavBarType4 } from "@/components/nav-bars/NavBarType4";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AuditLogEntry, BackendQuestionType, LocaleDefinition, NumberUnitMode, QuestionModel, SurveyAvailabilityConfig, SurveyModel, SurveyVersionSnapshot } from "./types/survey-schema";
import { QUESTION_TYPE_REGISTRY } from "./registry/question-type-registry";
import { MOCK_AZS } from "./services/mock-surveys";
import { SurveyService } from "./services/survey-service";
import { generateColumnName, recalculateQuestionNumbers } from "./lib/survey-normalizer";
import { validateSurvey, SurveyValidationResult, ValidationItem } from "./lib/survey-validator";
import { QuestionListPanel } from "./components/question-list/question-list-panel";
import { QuestionEditor } from "./components/editor/question-editor";
import { MobilePreview } from "./components/preview/mobile-preview";
import { SurveyHeader } from "./components/header/survey-header";
import { VersionHistorySheet } from "./components/versioning/version-history-sheet";
import { SurveyHubView } from "./components/hub/survey-hub-view";
import { SurveyTableView } from "./components/table-view/survey-table-view";
import { EditSurveyDetailsDialog } from "./components/header/edit-survey-details-dialog";
import { AvailabilityManagerDialog } from "./components/scheduling/availability-manager-dialog";
import { QuestionSelectorModal } from "./components/common/question-selector-modal";

export default function SurveyBuilderPage() {
    // Navigation Screen State: "hub" (surveys catalog) | "editor" (builder workspace)
    const [currentScreen, setCurrentScreen] = useState<"hub" | "editor">("hub");

    // View Switcher: "builder" vs "table"
    const [currentView, setCurrentView] = useState<"builder" | "table">("builder");

    // Multi-AZ & Survey Management
    const [azs] = useState(MOCK_AZS);
    const [selectedAzId, setSelectedAzId] = useState<string>("AZ2");
    const [surveys, setSurveys] = useState<SurveyModel[]>([]);
    const [currentSurvey, setCurrentSurvey] = useState<SurveyModel | null>(null);
    const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);

    // Active Question Selection & State
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    // Dialogs & Panels
    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
    const [editDetailsOpen, setEditDetailsOpen] = useState(false);
    const [availabilityManagerOpen, setAvailabilityManagerOpen] = useState(false);
    const [versions, setVersions] = useState<SurveyVersionSnapshot[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [languageManagerOpen, setLanguageManagerOpen] = useState(false);
    const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(true);

    // Follow-up Question Modal State
    const [followUpTargetParent, setFollowUpTargetParent] = useState<QuestionModel | null>(null);
    const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

    const handleOpenAddFollowUp = (targetQ: QuestionModel) => {
        setFollowUpTargetParent(targetQ);
        setIsFollowUpModalOpen(true);
    };

    // Resizable Questions List Panel Width State
    const [leftPanelWidth, setLeftPanelWidth] = useState<number>(360);
    const [isResizingLeftPanel, setIsResizingLeftPanel] = useState<boolean>(false);
    const workspaceRef = useRef<HTMLDivElement>(null);

    // Simulated Runtime State
    const [runtimeAnswers, setRuntimeAnswers] = useState<Record<string, any>>({});
    // Option B: Preserved preview session state across close/reopen
    const [previewActiveQuestionId, setPreviewActiveQuestionId] = useState<string | null>(null);
    const [previewActiveRepeaterTab, setPreviewActiveRepeaterTab] = useState<number>(0);
    const [previewLocale, setPreviewLocale] = useState<string>("en");

    // Load surveys when AZ changes
    useEffect(() => {
        let isMounted = true;
        async function fetchSurveys() {
            setIsLoadingSurveys(true);
            try {
                const list = await SurveyService.getSurveysByAZ(selectedAzId);
                if (isMounted) {
                    setSurveys(list);
                    if (list.length > 0) {
                        const target = list[0];
                        setCurrentSurvey(target);
                        if (target.questions.length > 0) {
                            setSelectedQuestionId(target.questions[0].id);
                        }
                    } else {
                        setCurrentSurvey(null);
                        setSelectedQuestionId(null);
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoadingSurveys(false);
                }
            }
        }
        fetchSurveys();
        return () => {
            isMounted = false;
        };
    }, [selectedAzId]);

    // Load version history and audit logs when opening history
    useEffect(() => {
        if (versionHistoryOpen && currentSurvey) {
            SurveyService.getVersionHistory(currentSurvey.id).then(setVersions);
            SurveyService.getAuditLogs(currentSurvey.id).then(setAuditLogs);
        }
    }, [versionHistoryOpen, currentSurvey]);

    // Interactive mouse drag handler for questions panel width adjuster
    useEffect(() => {
        if (!isResizingLeftPanel) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!workspaceRef.current) return;
            const rect = workspaceRef.current.getBoundingClientRect();
            const rawWidth = e.clientX - rect.left;
            const boundedWidth = Math.min(Math.max(rawWidth, 260), 560);
            setLeftPanelWidth(boundedWidth);
        };

        const handleMouseUp = () => {
            setIsResizingLeftPanel(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isResizingLeftPanel]);

    // Active Question
    const activeQuestion = React.useMemo(() => {
        if (!currentSurvey || !selectedQuestionId) return null;
        return currentSurvey.questions.find((q) => q.id === selectedQuestionId) || currentSurvey.questions[0] || null;
    }, [currentSurvey, selectedQuestionId]);

    // Validation
    const validation: SurveyValidationResult = React.useMemo(() => {
        if (!currentSurvey) {
            return { isValid: false, errorCount: 0, warningCount: 0, errors: [], warnings: [] };
        }
        return validateSurvey(currentSurvey);
    }, [currentSurvey]);

    const errorQuestionIds = React.useMemo(() => {
        const set = new Set<string>();
        validation.errors.forEach((issue: ValidationItem) => {
            if (issue.questionId) set.add(issue.questionId);
        });
        return set;
    }, [validation]);

    // Survey Switching & Creation
    const handleSelectSurvey = (surveyId: string) => {
        const found = surveys.find((s) => s.id === surveyId);
        if (found) {
            setCurrentSurvey(found);
            if (found.questions.length > 0) {
                setSelectedQuestionId(found.questions[0].id);
            } else {
                setSelectedQuestionId(null);
            }
            setIsDirty(false);
            setRuntimeAnswers({});
            setCurrentScreen("editor");
        }
    };

    const handleCreateSurvey = async (payload: {
        name: string;
        description?: string;
        azId: string;
        defaultLocale: string;
        category?: string;
    }) => {
        const newSurvey: SurveyModel = {
            id: `srv_${Date.now()}`,
            name: payload.name,
            description: payload.description,
            azId: payload.azId,
            version: 1,
            versionTag: "v1",
            status: "Draft",
            category: payload.category || "Field Operations",
            defaultLocale: payload.defaultLocale,
            locales: [
                { code: "en", label: "English", isDefault: payload.defaultLocale === "en" },
                ...(payload.defaultLocale !== "en"
                    ? [{ code: payload.defaultLocale, label: payload.defaultLocale.toUpperCase(), isDefault: true }]
                    : []),
            ],
            questions: [
                {
                    id: `q_1`,
                    number: 1,
                    displayIndex: "1",
                    type: "Radio",
                    displayType: "Radio",
                    columnName: "first_response",
                    titles: {
                        en: "First operational question",
                        hi: "पहला सवाल",
                    },
                    options: [
                        { id: "opt_1_1", value: "yes", labels: { en: "Yes", hi: "हाँ" } },
                        { id: "opt_1_2", value: "no", labels: { en: "No", hi: "नहीं" } },
                    ],
                    validation: { required: true },
                    visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
                },
            ],
            createdBy: "Operations Team",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setSurveys((prev) => [newSurvey, ...prev]);
        setCurrentSurvey(newSurvey);
        setSelectedQuestionId(newSurvey.questions[0].id);
        setIsDirty(false);
        setRuntimeAnswers({});
        setCurrentScreen("editor");
    };

    // Save Draft
    const handleSaveDraft = async () => {
        if (!currentSurvey) return;
        setIsSaving(true);
        try {
            const updatedSurvey: SurveyModel = {
                ...currentSurvey,
                updatedAt: new Date().toISOString(),
            };
            const saved = await SurveyService.saveDraft(currentSurvey.id, updatedSurvey);
            setCurrentSurvey(saved);
            setSurveys((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
            setIsDirty(false);
            setLastSavedAt(new Date());
        } catch (err: any) {
            console.error("Failed to save survey:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Publish Survey
    const handlePublishSurvey = async (changeSummary: string) => {
        if (!currentSurvey) return;
        setIsSaving(true);
        try {
            const published = await SurveyService.publishSurvey(currentSurvey.id, changeSummary);
            setCurrentSurvey(published);
            setSurveys((prev) => prev.map((s) => (s.id === published.id ? published : s)));
            setIsDirty(false);
            setLastSavedAt(new Date());
            SurveyService.getVersionHistory(published.id).then(setVersions);
            SurveyService.getAuditLogs(published.id).then(setAuditLogs);
        } catch (err: any) {
            console.error("Failed to publish survey:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Edit Published Survey -> Creates Draft based on this version
    const handleForkDraft = async () => {
        if (!currentSurvey) return;
        const forked = await SurveyService.createDraftFromVersion(currentSurvey.id, currentSurvey.version);
        setCurrentSurvey(forked);
        setSurveys((prev) => prev.map((s) => (s.id === forked.id ? forked : s)));
        setIsDirty(true);
        SurveyService.getVersionHistory(forked.id).then(setVersions);
        SurveyService.getAuditLogs(forked.id).then(setAuditLogs);
    };

    // Duplicate Survey into new identity (v1 Draft)
    const handleDuplicateSurvey = async () => {
        if (!currentSurvey) return;
        setIsSaving(true);
        try {
            const duplicated = await SurveyService.duplicateSurvey(currentSurvey.id);
            setSurveys((prev) => [duplicated, ...prev]);
            setCurrentSurvey(duplicated);
            if (duplicated.questions.length > 0) {
                setSelectedQuestionId(duplicated.questions[0].id);
            }
            setIsDirty(false);
            setLastSavedAt(new Date());
            SurveyService.getVersionHistory(duplicated.id).then(setVersions);
            SurveyService.getAuditLogs(duplicated.id).then(setAuditLogs);
        } catch (err: any) {
            console.error("Failed to duplicate survey:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // Save Survey Details (Edit Metadata)
    const handleSaveSurveyDetails = async (details: {
        name: string;
        description?: string;
        category?: string;
        defaultLocale?: string;
        azId?: string;
    }) => {
        if (!currentSurvey) return;
        const updated = await SurveyService.updateSurveyDetails(currentSurvey.id, details);
        setCurrentSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setIsDirty(false);
        setLastSavedAt(new Date());
    };

    // Update Availability & Scheduling
    const handleUpdateAvailability = (config: SurveyAvailabilityConfig) => {
        if (!currentSurvey) return;
        const updated: SurveyModel = {
            ...currentSurvey,
            availability: config,
            updatedAt: new Date().toISOString(),
        };
        setCurrentSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setIsDirty(true);
    };

    // Locale Management
    const handleUpdateLocales = (updatedLocales: LocaleDefinition[], newDefaultLocale?: string) => {
        if (!currentSurvey) return;
        const updatedSurvey: SurveyModel = {
            ...currentSurvey,
            locales: updatedLocales,
            defaultLocale: newDefaultLocale || currentSurvey.defaultLocale,
            updatedAt: new Date().toISOString(),
        };
        setCurrentSurvey(updatedSurvey);
        setSurveys((prev) => prev.map((s) => (s.id === updatedSurvey.id ? updatedSurvey : s)));
        setIsDirty(true);
    };

    // Question Mutations
    const handleUpdateQuestion = (updatedQ: QuestionModel) => {
        if (!currentSurvey) return;
        const updatedQuestions = currentSurvey.questions.map((q) => (q.id === updatedQ.id ? updatedQ : q));
        const recalculated = recalculateQuestionNumbers(updatedQuestions);
        setCurrentSurvey({
            ...currentSurvey,
            questions: recalculated,
        });
        setIsDirty(true);
    };

    const handleAddQuestion = (
        typeOrConfig:
            | BackendQuestionType
            | {
                  type: BackendQuestionType;
                  title: string;
                  columnName: string;
                  required: boolean;
                  numberFormat?: "integer" | "decimal";
                  minValue?: number;
                  maxValue?: number;
                  decimalPlaces?: number;
                  unitMode?: NumberUnitMode;
                  unit?: string;
                  allowedUnits?: string[];
                  defaultUnit?: string;
                  parentQuestionId?: string;
                  operator?: string;
                  triggerValue?: string;
              }
    ) => {
        if (!currentSurvey) return;

        const isConfigObj = typeof typeOrConfig === "object" && typeOrConfig !== null;
        const type = isConfigObj ? typeOrConfig.type : typeOrConfig;
        const typeDescriptor = QUESTION_TYPE_REGISTRY[type];
        const newId = `q_${Date.now()}`;
        const enTitle = isConfigObj && typeOrConfig.title ? typeOrConfig.title : typeDescriptor ? typeDescriptor.defaultConfig.titles.en : `New ${type} question`;
        const colName = isConfigObj && typeOrConfig.columnName ? typeOrConfig.columnName : generateColumnName(enTitle);
        const parentQuestionId = isConfigObj ? typeOrConfig.parentQuestionId : undefined;
        const rawOperator = isConfigObj && (typeOrConfig as any).operator ? (typeOrConfig as any).operator : "equals";
        const operator = rawOperator === "isFilled" ? "isNotEmpty" : rawOperator;
        const rawTriggerValue = isConfigObj ? (typeOrConfig as any).triggerValue : undefined;

        const parentQ = parentQuestionId ? currentSurvey.questions.find((q) => q.id === parentQuestionId) : undefined;
        const parentDepth = parentQ?.followUpDepth || 1;
        const newDepth = parentQ ? Math.min(parentDepth + 1, 5) : 1;

        let formattedTriggerValue: any = rawTriggerValue;
        if (formattedTriggerValue === undefined) {
            formattedTriggerValue = parentQ?.options?.[0]?.value ?? "yes";
        }
        if (
            operator === "greaterThan" ||
            operator === "lessThan" ||
            operator === "greaterThanOrEqual" ||
            operator === "lessThanOrEqual" ||
            (parentQ &&
                (parentQ.type === "Number" ||
                    parentQ.type.includes("Decimal") ||
                    parentQ.type.includes("WholeNum") ||
                    parentQ.type.includes("NaturalNum")) &&
                operator !== "isNotEmpty" &&
                operator !== "isEmpty")
        ) {
            const num = Number(formattedTriggerValue);
            if (!isNaN(num)) {
                formattedTriggerValue = num;
            }
        } else if (operator === "isNotEmpty" || operator === "isEmpty") {
            formattedTriggerValue = "";
        }

        const newQuestion: QuestionModel = {
            id: newId,
            number: currentSurvey.questions.length + 1,
            displayIndex: parentQ ? `${parentQ.displayIndex || parentQ.number}.1` : `${currentSurvey.questions.length + 1}`,
            columnName: colName,
            type,
            displayType: type,
            parentQuestionId: parentQuestionId,
            followUpDepth: newDepth,
            titles: {
                en: enTitle,
                hi: "",
            },
            options: typeDescriptor?.defaultConfig.options
                ? typeDescriptor.defaultConfig.options.map((opt, i) => ({
                      id: `opt_${Date.now()}_${i + 1}`,
                      value: opt.value,
                      labels: { en: opt.labels.en, hi: opt.labels.hi },
                  }))
                : undefined,
            numberConfig: type === "Number" ? {
                format: isConfigObj && typeOrConfig.numberFormat ? typeOrConfig.numberFormat : "decimal",
                decimalPlaces: isConfigObj && typeOrConfig.decimalPlaces !== undefined ? typeOrConfig.decimalPlaces : 2,
                minValue: isConfigObj ? typeOrConfig.minValue : undefined,
                maxValue: isConfigObj ? typeOrConfig.maxValue : undefined,
                unitMode: isConfigObj && typeOrConfig.unitMode ? typeOrConfig.unitMode : (isConfigObj && typeOrConfig.unit ? "fixed" : "none"),
                unit: isConfigObj ? typeOrConfig.unit : undefined,
                allowedUnits: isConfigObj ? typeOrConfig.allowedUnits : undefined,
                defaultUnit: isConfigObj ? typeOrConfig.defaultUnit : undefined,
            } : undefined,
            validation: {
                required: isConfigObj ? Boolean(typeOrConfig.required) : false,
                numberFormat: isConfigObj ? typeOrConfig.numberFormat : (type === "Number" ? "decimal" : undefined),
                minValue: isConfigObj ? typeOrConfig.minValue : undefined,
                maxValue: isConfigObj ? typeOrConfig.maxValue : undefined,
                decimalPlaces: isConfigObj ? typeOrConfig.decimalPlaces : (type === "Number" ? 2 : undefined),
                unitMode: isConfigObj && typeOrConfig.unitMode ? typeOrConfig.unitMode : (isConfigObj && typeOrConfig.unit ? "fixed" : "none"),
                unit: isConfigObj ? typeOrConfig.unit : undefined,
                allowedUnits: isConfigObj ? typeOrConfig.allowedUnits : undefined,
                defaultUnit: isConfigObj ? typeOrConfig.defaultUnit : undefined,
            },
            visibility: {
                enabled: Boolean(parentQuestionId),
                ruleGroup: {
                    conjunction: "AND",
                    conditions: parentQuestionId
                        ? [
                              {
                                  id: `cond_${Date.now()}`,
                                  questionId: parentQuestionId,
                                  operator: operator as any,
                                  value: formattedTriggerValue,
                              },
                          ]
                        : [],
                },
            },
        };

        let nextQuestions = [...currentSurvey.questions];
        if (parentQuestionId) {
            const parentIdx = currentSurvey.questions.findIndex((q) => q.id === parentQuestionId);
            if (parentIdx !== -1) {
                const descendantIds = new Set<string>();
                const findDescendants = (pId: string) => {
                    currentSurvey.questions.forEach((q) => {
                        if (
                            q.parentQuestionId === pId ||
                            (q.visibility?.enabled &&
                                q.visibility.ruleGroup?.conditions?.some((c) => c.questionId === pId))
                        ) {
                            if (!descendantIds.has(q.id)) {
                                descendantIds.add(q.id);
                                findDescendants(q.id);
                            }
                        }
                    });
                };
                findDescendants(parentQuestionId);

                let insertIdx = parentIdx + 1;
                while (insertIdx < currentSurvey.questions.length && descendantIds.has(currentSurvey.questions[insertIdx].id)) {
                    insertIdx++;
                }
                nextQuestions.splice(insertIdx, 0, newQuestion);
            } else {
                nextQuestions.push(newQuestion);
            }
        } else {
            nextQuestions.push(newQuestion);
        }

        const updatedQuestions = recalculateQuestionNumbers(nextQuestions);
        setCurrentSurvey({
            ...currentSurvey,
            questions: updatedQuestions,
        });
        setSelectedQuestionId(newId);
        setIsDirty(true);
    };

    const handleDuplicateQuestion = (target: string | QuestionModel) => {
        if (!currentSurvey) return;
        const questionId = typeof target === "string" ? target : target.id;
        const index = currentSurvey.questions.findIndex((q) => q.id === questionId);
        if (index === -1) return;
        const targetQ = currentSurvey.questions[index];

        const newId = `q_${Date.now()}`;
        const duplicated: QuestionModel = {
            ...JSON.parse(JSON.stringify(targetQ)),
            id: newId,
            columnName: `${targetQ.columnName}_copy`,
            titles: {
                ...targetQ.titles,
                en: `${targetQ.titles.en || "Question"} (Copy)`,
            },
        };

        const nextQuestions = [...currentSurvey.questions];
        nextQuestions.splice(index + 1, 0, duplicated);

        const recalculated = recalculateQuestionNumbers(nextQuestions);
        setCurrentSurvey({
            ...currentSurvey,
            questions: recalculated,
        });
        setSelectedQuestionId(newId);
        setIsDirty(true);
    };

    const handleDeleteQuestion = (questionId: string) => {
        if (!currentSurvey) return;
        const remaining = currentSurvey.questions.filter((q) => q.id !== questionId);
        const recalculated = recalculateQuestionNumbers(remaining);
        setCurrentSurvey({
            ...currentSurvey,
            questions: recalculated,
        });
        if (selectedQuestionId === questionId) {
            setSelectedQuestionId(recalculated.length > 0 ? recalculated[0].id : null);
        }
        setIsDirty(true);
    };

    const handleReorderQuestions = (reordered: QuestionModel[]) => {
        if (!currentSurvey) return;
        const recalculated = recalculateQuestionNumbers(reordered);
        setCurrentSurvey({
            ...currentSurvey,
            questions: recalculated,
        });
        setIsDirty(true);
    };

    const handleRestoreVersionAsDraft = (snapshot: SurveyModel | SurveyVersionSnapshot) => {
        if (!currentSurvey) return;
        const snap = "surveySnapshot" in snapshot ? snapshot.surveySnapshot : snapshot;
        const restoredDraft: SurveyModel = {
            ...JSON.parse(JSON.stringify(snap)),
            version: currentSurvey.version + 1,
            versionTag: `v${currentSurvey.version + 1}`,
            status: "Draft",
            updatedAt: new Date().toISOString(),
        };
        setCurrentSurvey(restoredDraft);
        setSurveys((prev) => prev.map((s) => (s.id === restoredDraft.id ? restoredDraft : s)));
        setIsDirty(true);
        setVersionHistoryOpen(false);
        if (restoredDraft.questions.length > 0) {
            setSelectedQuestionId(restoredDraft.questions[0].id);
        }
    };

    const togglePreview = () => {
        setIsPreviewOpen((prev) => !prev);
    };

    // View a specific snapshot version in read-only mode in builder
    const handleViewVersionSnapshot = (surveyId: string, snapshot: SurveyVersionSnapshot) => {
        setCurrentSurvey(snapshot.surveySnapshot);
        if (snapshot.surveySnapshot.questions.length > 0) {
            setSelectedQuestionId(snapshot.surveySnapshot.questions[0].id);
        } else {
            setSelectedQuestionId(null);
        }
        setIsDirty(false);
        setRuntimeAnswers({});
        setCurrentScreen("editor");
    };

    // Edit a specific version (creates a draft based on that version snapshot)
    const handleEditVersion = async (surveyId: string, versionNumber: number) => {
        setIsLoadingSurveys(true);
        try {
            const draft = await SurveyService.createDraftFromVersion(surveyId, versionNumber);
            setSurveys((prev) => prev.map((s) => (s.id === draft.id ? draft : s)));
            setCurrentSurvey(draft);
            if (draft.questions.length > 0) {
                setSelectedQuestionId(draft.questions[0].id);
            } else {
                setSelectedQuestionId(null);
            }
            setIsDirty(false);
            setRuntimeAnswers({});
            setCurrentScreen("editor");
        } finally {
            setIsLoadingSurveys(false);
        }
    };

    return (
        <NavBarType4
            pageTitle="Survey builder (simplified) / V1.1"
            pageDescription="Visual operational survey builder (Simplified V1.1) for creating, configuring, testing, versioning, and publishing field surveys."
        >
            <div className="h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden select-none">
                {/* 1. SURVEYS HUB SCREEN (Catalog, AZ Filter, Create Dialog) */}
                {currentScreen === "hub" ? (
                    <SurveyHubView
                        azs={azs}
                        selectedAzId={selectedAzId}
                        onSelectAz={setSelectedAzId}
                        surveys={surveys}
                        onSelectSurvey={handleSelectSurvey}
                        onEditVersion={handleEditVersion}
                        onViewVersion={handleViewVersionSnapshot}
                        onCreateSurvey={handleCreateSurvey}
                        isLoading={isLoadingSurveys}
                    />
                ) : (
                    /* 2. SURVEY BUILDER WORKSPACE SCREEN */
                    currentSurvey && (
                        <div className="h-full max-h-full flex flex-col min-h-0 overflow-hidden w-full">
                            {/* Top Survey Header Bar (h-14 / 56px) */}
                            <SurveyHeader
                                survey={currentSurvey}
                                allSurveys={surveys}
                                onSelectAnotherSurvey={handleSelectSurvey}
                                onBackToHub={() => setCurrentScreen("hub")}
                                isDirty={isDirty}
                                isSaving={isSaving}
                                lastSavedAt={lastSavedAt}
                                validation={validation}
                                isPreviewPanelOpen={isPreviewOpen}
                                onTogglePreviewPanel={togglePreview}
                                currentView={currentView}
                                onViewChange={setCurrentView}
                                onOpenEditDetails={() => setEditDetailsOpen(true)}
                                onDuplicateSurvey={handleDuplicateSurvey}
                                onOpenAvailabilityManager={() => setAvailabilityManagerOpen(true)}
                                onSave={handleSaveDraft}
                                onPublish={handlePublishSurvey}
                                onForkDraft={handleForkDraft}
                                onOpenVersionHistory={() => setVersionHistoryOpen(true)}
                                onSelectQuestion={(qId) => setSelectedQuestionId(qId)}
                                onUpdateLocales={handleUpdateLocales}
                                languageManagerOpen={languageManagerOpen}
                                setLanguageManagerOpen={setLanguageManagerOpen}
                            />

                            {/* TABLE VIEW vs BUILDER VIEW */}
                            {currentView === "table" ? (
                                <div className="flex-1 flex flex-row min-h-0 h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-hidden w-full">
                                    <div className="flex-1 min-w-0 h-full max-h-full overflow-hidden flex flex-col">
                                        <SurveyTableView
                                            survey={currentSurvey}
                                            onUpdateSurvey={(updated) => {
                                                setCurrentSurvey(updated);
                                                setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                                                setIsDirty(true);
                                            }}
                                            onOpenLanguageManager={() => setLanguageManagerOpen(true)}
                                            isPublished={currentSurvey.status === "Published"}
                                            selectedQuestionId={selectedQuestionId}
                                            onSelectQuestion={(qId) => setSelectedQuestionId(qId)}
                                        />
                                    </div>

                                    {/* RIGHT COLUMN: LIVE INTERACTIVE MOBILE PREVIEW IN TABLE VIEW */}
                                    {isPreviewOpen && (
                                        <div className="w-[360px] 2xl:w-[410px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 h-full max-h-full min-h-0 overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-200 bg-zinc-50/50 dark:bg-zinc-900/50">
                                            <MobilePreview
                                                survey={currentSurvey}
                                                selectedQuestionId={selectedQuestionId}
                                                runtimeAnswers={runtimeAnswers}
                                                onChangeAnswer={(qId, val) => setRuntimeAnswers((prev) => ({ ...prev, [qId]: val }))}
                                                onResetAnswers={() => setRuntimeAnswers({})}
                                                onSelectQuestion={setSelectedQuestionId}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Responsive Mobile Preview Drawer on Small Viewports */}
                                    <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentScreen("hub")}
                                            className="h-8 text-xs gap-1.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                        >
                                            <FolderOpen className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />
                                            <span>All Surveys</span>
                                        </Button>

                                        <Sheet open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
                                            <SheetTrigger asChild>
                                                <Button size="sm" className="h-8 text-xs gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold">
                                                    <Smartphone className="h-3.5 w-3.5" />
                                                    <span>Mobile Runtime</span>
                                                </Button>
                                            </SheetTrigger>
                                            <SheetContent side="right" className="w-full sm:w-[420px] p-0 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                                                <MobilePreview
                                                    survey={currentSurvey}
                                                    selectedQuestionId={selectedQuestionId}
                                                    runtimeAnswers={runtimeAnswers}
                                                    onChangeAnswer={(qId, val) => setRuntimeAnswers((prev) => ({ ...prev, [qId]: val }))}
                                                    onResetAnswers={() => setRuntimeAnswers({})}
                                                    onSelectQuestion={setSelectedQuestionId}
                                                    activeQuestionId={previewActiveQuestionId}
                                                    onActiveQuestionChange={setPreviewActiveQuestionId}
                                                    activeRepeaterTab={previewActiveRepeaterTab}
                                                    onActiveRepeaterTabChange={setPreviewActiveRepeaterTab}
                                                    currentLocale={previewLocale}
                                                    onSelectLocale={setPreviewLocale}
                                                />
                                            </SheetContent>
                                        </Sheet>
                                    </div>

                                    {/* FULL-WIDTH BUILDER WORKSPACE (Question List + Splitter + Editor + Mobile Preview) */}
                                    <div
                                        ref={workspaceRef}
                                        className="flex-1 flex flex-row min-h-0 h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-hidden w-full"
                                    >
                                        {/* LEFT COLUMN: RESIZABLE QUESTION LIST */}
                                        <div
                                            style={{ width: `${leftPanelWidth}px` }}
                                            className="shrink-0 bg-white dark:bg-zinc-900 hidden md:flex md:flex-col h-full max-h-full min-h-0 overflow-hidden"
                                        >
                                            <QuestionListPanel
                                                questions={currentSurvey.questions}
                                                selectedQuestionId={selectedQuestionId}
                                                errorQuestionIds={errorQuestionIds}
                                                validationErrors={validation.errors}
                                                isPublished={currentSurvey.status === "Published"}
                                                onSelectQuestion={setSelectedQuestionId}
                                                onAddQuestion={handleAddQuestion}
                                                onDuplicateQuestion={(qId) => handleDuplicateQuestion(qId)}
                                                onDeleteQuestion={(qId) => handleDeleteQuestion(qId)}
                                                onReorderQuestions={handleReorderQuestions}
                                            />
                                        </div>

                                        {/* Splitter Divider */}
                                        <div
                                            role="separator"
                                            aria-orientation="vertical"
                                            onMouseDown={() => setIsResizingLeftPanel(true)}
                                            className={cn(
                                                "relative hidden md:flex w-[1px] bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-600 cursor-col-resize select-none shrink-0 transition-colors z-20",
                                                "after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:z-10",
                                                isResizingLeftPanel && "bg-zinc-400 dark:bg-zinc-500"
                                            )}
                                            title="Drag to resize"
                                        />

                                        {/* CENTER COLUMN: QUESTION CONFIGURATION EDITOR */}
                                        <div className="flex-1 min-w-0 flex flex-col h-full max-h-full overflow-hidden bg-zinc-50/30 dark:bg-zinc-950/30">
                                            {activeQuestion ? (
                                                <QuestionEditor
                                                    question={activeQuestion}
                                                    survey={currentSurvey}
                                                    onChangeQuestion={handleUpdateQuestion}
                                                    onDuplicateQuestion={(qId) => handleDuplicateQuestion(qId)}
                                                    onDeleteQuestion={(q) => handleDeleteQuestion(q.id)}
                                                    onOpenLanguageManager={() => setLanguageManagerOpen(true)}
                                                    onUpdateSurveyQuestions={handleReorderQuestions}
                                                    onSelectQuestion={setSelectedQuestionId}
                                                    onAddFollowUp={handleOpenAddFollowUp}
                                                    isPublished={currentSurvey.status === "Published"}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-500 space-y-3">
                                                    <Layers className="h-10 w-10 text-zinc-400" />
                                                    <div className="space-y-1">
                                                        <p className="font-bold text-zinc-800 dark:text-zinc-200">No Question Selected</p>
                                                        <p className="text-xs text-zinc-500">
                                                            Select a question from the list or add a new question to configure settings.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAddQuestion("Radio")}
                                                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold text-xs gap-1.5"
                                                    >
                                                        <Plus className="h-4 w-4" /> Add First Question
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* RIGHT COLUMN: LIVE INTERACTIVE MOBILE PREVIEW */}
                                        {isPreviewOpen && (
                                            <div className="w-[360px] 2xl:w-[410px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 h-full max-h-full min-h-0 overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-200">
                                                <MobilePreview
                                                    survey={currentSurvey}
                                                    selectedQuestionId={selectedQuestionId}
                                                    runtimeAnswers={runtimeAnswers}
                                                    onChangeAnswer={(qId, val) => setRuntimeAnswers((prev) => ({ ...prev, [qId]: val }))}
                                                    onResetAnswers={() => setRuntimeAnswers({})}
                                                    onSelectQuestion={setSelectedQuestionId}
                                                    activeQuestionId={previewActiveQuestionId}
                                                    onActiveQuestionChange={setPreviewActiveQuestionId}
                                                    activeRepeaterTab={previewActiveRepeaterTab}
                                                    onActiveRepeaterTabChange={setPreviewActiveRepeaterTab}
                                                    currentLocale={previewLocale}
                                                    onSelectLocale={setPreviewLocale}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )
                )}

                {/* Version History Sheet */}
                {currentSurvey && (
                    <VersionHistorySheet
                        open={versionHistoryOpen}
                        onOpenChange={setVersionHistoryOpen}
                        currentSurvey={currentSurvey}
                        versions={versions}
                        auditLogs={auditLogs}
                        onRestoreVersionAsDraft={handleRestoreVersionAsDraft}
                    />
                )}

                {/* Edit Survey Details Dialog */}
                {currentSurvey && (
                    <EditSurveyDetailsDialog
                        open={editDetailsOpen}
                        onOpenChange={setEditDetailsOpen}
                        survey={currentSurvey}
                        azs={azs}
                        onSaveDetails={handleSaveSurveyDetails}
                    />
                )}

                {/* Availability & Multi-Schedule Manager Dialog */}
                {currentSurvey && (
                    <AvailabilityManagerDialog
                        open={availabilityManagerOpen}
                        onOpenChange={setAvailabilityManagerOpen}
                        survey={currentSurvey}
                        onUpdateAvailability={handleUpdateAvailability}
                        isPublished={currentSurvey.status === "Published"}
                    />
                )}

                {/* Guided Follow-up Question Selector Modal (Opened from Header, Basic Settings, or elsewhere) */}
                {currentSurvey && (
                    <QuestionSelectorModal
                        open={isFollowUpModalOpen}
                        onOpenChange={(open) => {
                            setIsFollowUpModalOpen(open);
                            if (!open) setFollowUpTargetParent(null);
                        }}
                        mode="createFollowUp"
                        parentQuestion={followUpTargetParent || undefined}
                        parentDepth={
                            followUpTargetParent
                                ? followUpTargetParent.followUpDepth ||
                                  (followUpTargetParent.displayIndex ? followUpTargetParent.displayIndex.split(".").length : 1)
                                : 1
                        }
                        allQuestions={currentSurvey.questions}
                        onCreateQuestion={(config) => {
                            handleAddQuestion(config);
                            setIsFollowUpModalOpen(false);
                            setFollowUpTargetParent(null);
                        }}
                    />
                )}
            </div>
        </NavBarType4>
    );
}
