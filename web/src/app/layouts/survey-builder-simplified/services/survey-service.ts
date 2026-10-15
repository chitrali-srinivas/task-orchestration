import {
    AuditLogEntry,
    LegacyBackendSurveyJSON,
    SurveyModel,
    SurveyVersionSnapshot,
} from "../types/survey-schema";
import {
    AZOption,
    MOCK_AZS,
    RAW_MOCK_SURVEYS,
} from "./mock-surveys";
import { normalizeBackendSurvey } from "../lib/survey-normalizer";
import { computeSurveyDiff, SurveyVersionDiff } from "../lib/version-diff-engine";

// In-memory state storage simulating persistent backend database for Survey Builder V1.1 (Simplified)
let inMemorySurveys: SurveyModel[] = JSON.parse(JSON.stringify(RAW_MOCK_SURVEYS)).map((raw: any) => normalizeBackendSurvey(raw));

// Update AZ survey counts dynamically
MOCK_AZS.forEach((az) => {
    az.surveyCount = inMemorySurveys.filter((s) => s.azId === az.id).length;
});

// Historical version snapshots store: surveyId -> version snapshots[]
const inMemoryVersionSnapshots = new Map<string, SurveyVersionSnapshot[]>();

// Initialize version snapshots for mock surveys (including realistic multi-version history)
inMemorySurveys.forEach((s) => {
    if (s.id === "srv_wheat_enrollment_001") {
        // Flagship survey: simulate rich version history (v1, v2, v3 Published)
        s.version = 3;
        s.versionTag = "v3";
        s.status = "Published";
        s.publishedAt = "2026-09-01T08:30:00.000Z";

        const v1Snapshot: SurveyModel = {
            ...JSON.parse(JSON.stringify(s)),
            version: 1,
            versionTag: "v1",
            status: "Published",
            publishedAt: "2026-08-10T10:00:00.000Z",
            createdAt: "2026-08-10T10:00:00.000Z",
            updatedAt: "2026-08-10T10:00:00.000Z",
            questions: s.questions.slice(0, 12),
        };

        const v2Snapshot: SurveyModel = {
            ...JSON.parse(JSON.stringify(s)),
            version: 2,
            versionTag: "v2",
            status: "Published",
            publishedAt: "2026-08-22T14:15:00.000Z",
            createdAt: "2026-08-10T10:00:00.000Z",
            updatedAt: "2026-08-22T14:15:00.000Z",
            questions: s.questions.slice(0, 15),
        };

        const v3Snapshot: SurveyModel = {
            ...JSON.parse(JSON.stringify(s)),
            version: 3,
            versionTag: "v3",
            status: "Published",
            publishedAt: "2026-09-01T08:30:00.000Z",
            createdAt: "2026-08-10T10:00:00.000Z",
            updatedAt: "2026-09-01T08:30:00.000Z",
        };

        inMemoryVersionSnapshots.set(s.id, [
            {
                version: 3,
                versionTag: "v3",
                status: "Published",
                createdAt: v3Snapshot.createdAt,
                createdBy: v3Snapshot.createdBy,
                publishedAt: v3Snapshot.publishedAt,
                changeSummary: "Added plot polygon boundary mapping and surveyor remarks.",
                surveySnapshot: v3Snapshot,
            },
            {
                version: 2,
                versionTag: "v2",
                status: "Published",
                createdAt: v2Snapshot.createdAt,
                createdBy: v2Snapshot.createdBy,
                publishedAt: v2Snapshot.publishedAt,
                changeSummary: "Added soil sample repeater questions with QR scanner validation.",
                surveySnapshot: v2Snapshot,
            },
            {
                version: 1,
                versionTag: "v1",
                status: "Published",
                createdAt: v1Snapshot.createdAt,
                createdBy: v1Snapshot.createdBy,
                publishedAt: v1Snapshot.publishedAt,
                changeSummary: "Initial operational release with farmer ownership and land area verification.",
                surveySnapshot: v1Snapshot,
            },
        ]);
    } else {
        inMemoryVersionSnapshots.set(s.id, [
            {
                version: s.version,
                versionTag: s.versionTag,
                status: s.status,
                createdAt: s.createdAt,
                createdBy: s.createdBy,
                publishedAt: s.status === "Published" ? s.updatedAt : undefined,
                changeSummary: `Initial baseline ${s.versionTag} configuration with ${s.questions.length} questions.`,
                surveySnapshot: JSON.parse(JSON.stringify(s)),
            },
        ]);
    }
});

// Audit log entries store: surveyId -> logs[]
const inMemoryAuditLogs = new Map<string, AuditLogEntry[]>();

/**
 * Service API for Survey Builder
 */
export const SurveyService = {
    /**
     * Retrieves all Agricultural Zones
     */
    async getAZs(): Promise<AZOption[]> {
        await new Promise((r) => setTimeout(r, 50));
        return [...MOCK_AZS];
    },

    /**
     * Retrieves all surveys filtered by AZ
     */
    async getSurveysByAZ(azId: string): Promise<SurveyModel[]> {
        await new Promise((r) => setTimeout(r, 80));
        return inMemorySurveys.filter((s) => s.azId === azId);
    },

    /**
     * Retrieves a single survey by ID
     */
    async getSurveyById(surveyId: string): Promise<SurveyModel | null> {
        await new Promise((r) => setTimeout(r, 80));
        const found = inMemorySurveys.find((s) => s.id === surveyId);
        return found ? JSON.parse(JSON.stringify(found)) : null;
    },

    /**
     * Creates a new survey from scratch
     */
    async createSurvey(payload: {
        name: string;
        description?: string;
        azId: string;
        defaultLocale?: string;
        category?: string;
        createdBy?: string;
    }): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 150));
        const newId = `srv_${Date.now()}`;
        const newSurvey: SurveyModel = {
            id: newId,
            azId: payload.azId,
            name: payload.name,
            description: payload.description || "Operational survey form",
            category: payload.category || "Field Operations",
            defaultLocale: payload.defaultLocale || "en",
            locales: [
                { code: "en", label: "English", isDefault: true, direction: "ltr" },
                { code: "hi", label: "Hindi (हिंदी)", isDefault: false, direction: "ltr" },
            ],
            status: "Draft",
            version: 1,
            versionTag: "v1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: payload.createdBy || "Current User",
            questions: [
                {
                    id: "q_1",
                    number: 1,
                    displayIndex: "1",
                    type: "Radio",
                    displayType: "Radio",
                    columnName: "is_verified",
                    titles: {
                        en: "Is plot baseline verified?",
                    },
                    options: [
                        { id: "opt_1", value: "yes", labels: { en: "Yes" } },
                        { id: "opt_2", value: "no", labels: { en: "No" } },
                    ],
                    validation: { required: true },
                    visibility: { enabled: false, ruleGroup: { conjunction: "AND", conditions: [] } },
                },
            ],
        };

        inMemorySurveys.push(newSurvey);
        inMemoryVersionSnapshots.set(newId, [
            {
                version: 1,
                versionTag: "v1",
                status: "Draft",
                createdAt: newSurvey.createdAt,
                createdBy: newSurvey.createdBy,
                changeSummary: "Created new survey draft v1",
                surveySnapshot: JSON.parse(JSON.stringify(newSurvey)),
            },
        ]);

        return JSON.parse(JSON.stringify(newSurvey));
    },

    /**
     * Saves a draft modification
     */
    async saveDraft(surveyId: string, updatedSurvey: SurveyModel): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 120));
        const idx = inMemorySurveys.findIndex((s) => s.id === surveyId);
        if (idx === -1) {
            throw new Error(`Survey "${surveyId}" not found.`);
        }

        const current = inMemorySurveys[idx];
        if (current.status === "Published") {
            throw new Error("Cannot modify an already-published survey. Edit or fork a new draft version first.");
        }

        const modified: SurveyModel = {
            ...updatedSurvey,
            status: "Draft",
            updatedAt: new Date().toISOString(),
        };

        inMemorySurveys[idx] = modified;

        // Log audit event
        const logs = inMemoryAuditLogs.get(surveyId) || [];
        logs.unshift({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: "Current User",
            action: "SAVED_DRAFT",
            summary: `Draft ${modified.versionTag} updated with ${modified.questions.length} questions.`,
        });
        inMemoryAuditLogs.set(surveyId, logs);

        return JSON.parse(JSON.stringify(modified));
    },

    /**
     * Publishes the current draft version and makes it an immutable published snapshot
     * Sequential version assignment guarantees no collision (e.g. max published version + 1)
     */
    async publishSurvey(surveyId: string, changeSummary?: string): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 200));
        const idx = inMemorySurveys.findIndex((s) => s.id === surveyId);
        if (idx === -1) {
            throw new Error(`Survey "${surveyId}" not found.`);
        }

        const current = inMemorySurveys[idx];
        const snapshots = inMemoryVersionSnapshots.get(surveyId) || [];

        // Calculate next sequential version number across all historical snapshots
        const maxPublishedVersion = Math.max(
            0,
            ...snapshots.map((s) => s.version)
        );
        const nextVersion = Math.max(current.version, maxPublishedVersion + 1);
        const nextVersionTag = `v${nextVersion}`;

        const publishedSurvey: SurveyModel = {
            ...current,
            version: nextVersion,
            versionTag: nextVersionTag,
            status: "Published",
            basedOnVersion: undefined,
            basedOnVersionTag: undefined,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        inMemorySurveys[idx] = publishedSurvey;

        // Save new immutable published snapshot to history (newest first)
        const newSnapshot: SurveyVersionSnapshot = {
            version: publishedSurvey.version,
            versionTag: publishedSurvey.versionTag,
            status: "Published",
            createdAt: publishedSurvey.createdAt,
            createdBy: publishedSurvey.createdBy,
            publishedAt: publishedSurvey.publishedAt,
            changeSummary:
                changeSummary ||
                `Published release ${publishedSurvey.versionTag} with ${publishedSurvey.questions.length} operational questions.`,
            surveySnapshot: JSON.parse(JSON.stringify(publishedSurvey)),
        };

        snapshots.unshift(newSnapshot);
        inMemoryVersionSnapshots.set(surveyId, snapshots);

        // Audit log entry
        const logs = inMemoryAuditLogs.get(surveyId) || [];
        logs.unshift({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: "Current User",
            action: "PUBLISHED_RELEASE",
            summary: `Published immutable release ${publishedSurvey.versionTag}.`,
        });
        inMemoryAuditLogs.set(surveyId, logs);

        return JSON.parse(JSON.stringify(publishedSurvey));
    },

    /**
     * Creates a working draft based on a specific historical or current published version
     * (e.g. user clicks [Edit] on v1 when v1, v2, v3 exist)
     */
    async createDraftFromVersion(surveyId: string, targetVersion: number): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 150));
        const idx = inMemorySurveys.findIndex((s) => s.id === surveyId);
        if (idx === -1) {
            throw new Error(`Survey "${surveyId}" not found.`);
        }

        const snapshots = inMemoryVersionSnapshots.get(surveyId) || [];
        const targetSnap = snapshots.find((s) => s.version === targetVersion);

        const baseSurvey = targetSnap ? targetSnap.surveySnapshot : inMemorySurveys[idx];
        const maxVersion = Math.max(0, ...snapshots.map((s) => s.version));
        const nextVersion = maxVersion + 1;

        const newDraft: SurveyModel = {
            ...JSON.parse(JSON.stringify(baseSurvey)),
            status: "Draft",
            version: nextVersion,
            versionTag: `v${nextVersion}`,
            basedOnVersion: targetVersion,
            basedOnVersionTag: targetSnap?.versionTag || `v${targetVersion}`,
            updatedAt: new Date().toISOString(),
            publishedAt: undefined,
        };

        inMemorySurveys[idx] = newDraft;

        // Add audit log entry
        const logs = inMemoryAuditLogs.get(surveyId) || [];
        logs.unshift({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: "Current User",
            action: "CREATED_DRAFT",
            summary: `Created active Draft based on ${newDraft.basedOnVersionTag} (will publish as ${newDraft.versionTag}).`,
        });
        inMemoryAuditLogs.set(surveyId, logs);

        return JSON.parse(JSON.stringify(newDraft));
    },

    /**
     * Forks a new draft version from an immutable published survey (helper)
     */
    async createDraftFromPublished(surveyId: string): Promise<SurveyModel> {
        const found = inMemorySurveys.find((s) => s.id === surveyId);
        const versionToFork = found ? found.version : 1;
        return this.createDraftFromVersion(surveyId, versionToFork);
    },

    /**
     * Checks if a survey currently has an active draft
     */
    async hasActiveDraft(surveyId: string): Promise<{ hasDraft: boolean; draftVersionTag?: string; basedOnVersionTag?: string }> {
        const found = inMemorySurveys.find((s) => s.id === surveyId);
        if (found && found.status === "Draft") {
            return {
                hasDraft: true,
                draftVersionTag: found.versionTag,
                basedOnVersionTag: found.basedOnVersionTag,
            };
        }
        return { hasDraft: false };
    },

    /**
     * Retrieves version history snapshots (sorted newest first)
     */
    async getVersionHistory(surveyId: string): Promise<SurveyVersionSnapshot[]> {
        await new Promise((r) => setTimeout(r, 60));
        const list = inMemoryVersionSnapshots.get(surveyId) || [];
        return JSON.parse(JSON.stringify(list));
    },

    /**
     * Retrieves a single historical snapshot by version number
     */
    async getSnapshotByVersion(surveyId: string, version: number): Promise<SurveyVersionSnapshot | null> {
        const list = inMemoryVersionSnapshots.get(surveyId) || [];
        const found = list.find((s) => s.version === version);
        return found ? JSON.parse(JSON.stringify(found)) : null;
    },

    /**
     * Updates translation resource for a specific version snapshot or active draft
     */
    async saveVersionTranslations(
        surveyId: string,
        version: number,
        localeCode: string,
        translationsData: any
    ): Promise<void> {
        await new Promise((r) => setTimeout(r, 100));
        
        // Update in active survey if version matches
        const active = inMemorySurveys.find((s) => s.id === surveyId);
        if (active && active.version === version) {
            // Apply question/choice translations to active model
            if (translationsData.questions) {
                active.questions.forEach((q) => {
                    const trans = translationsData.questions[q.id];
                    if (trans?.title) {
                        q.titles[localeCode] = trans.title;
                    }
                    if (trans?.hint !== undefined) {
                        if (!q.descriptions) q.descriptions = {};
                        q.descriptions[localeCode] = trans.hint;
                    }
                    if (trans?.placeholder !== undefined) {
                        if (!q.placeholders) q.placeholders = {};
                        q.placeholders[localeCode] = trans.placeholder;
                    }
                    if (!q.validation) q.validation = {};
                    if (trans?.customErrorMessage !== undefined) {
                        const currentMap =
                            typeof q.validation.customErrorMessage === "object" && q.validation.customErrorMessage !== null
                                ? q.validation.customErrorMessage
                                : typeof q.validation.customErrorMessage === "string"
                                ? { en: q.validation.customErrorMessage }
                                : {};
                        q.validation.customErrorMessage = {
                            ...currentMap,
                            [localeCode]: trans.customErrorMessage,
                        };
                    }
                    if (trans?.patternErrorMessage !== undefined) {
                        q.validation.patternErrorMessage = {
                            ...(q.validation.patternErrorMessage || {}),
                            [localeCode]: trans.patternErrorMessage,
                        };
                    }
                    if (trans?.minMaxErrorMessage !== undefined) {
                        q.validation.minMaxErrorMessage = {
                            ...(q.validation.minMaxErrorMessage || {}),
                            [localeCode]: trans.minMaxErrorMessage,
                        };
                    }
                    if (trans?.lengthErrorMessage !== undefined) {
                        q.validation.lengthErrorMessage = {
                            ...(q.validation.lengthErrorMessage || {}),
                            [localeCode]: trans.lengthErrorMessage,
                        };
                    }
                    if (trans?.dateRangeErrorMessage !== undefined) {
                        q.validation.dateRangeErrorMessage = {
                            ...(q.validation.dateRangeErrorMessage || {}),
                            [localeCode]: trans.dateRangeErrorMessage,
                        };
                    }
                    if (trans?.selectionCountErrorMessage !== undefined) {
                        q.validation.selectionCountErrorMessage = {
                            ...(q.validation.selectionCountErrorMessage || {}),
                            [localeCode]: trans.selectionCountErrorMessage,
                        };
                    }
                });
            }
            if (translationsData.choices) {
                active.questions.forEach((q) => {
                    q.options?.forEach((opt) => {
                        const optTrans = translationsData.choices[opt.id] || translationsData.choices[opt.value];
                        if (optTrans) {
                            opt.labels[localeCode] = optTrans;
                        }
                    });
                });
            }
            active.updatedAt = new Date().toISOString();
        }

        // Also update in snapshots
        const snapshots = inMemoryVersionSnapshots.get(surveyId) || [];
        const targetSnap = snapshots.find((s) => s.version === version);
        if (targetSnap) {
            const snapSurvey = targetSnap.surveySnapshot;
            if (translationsData.questions) {
                snapSurvey.questions.forEach((q) => {
                    const trans = translationsData.questions[q.id];
                    if (trans?.title) {
                        q.titles[localeCode] = trans.title;
                    }
                    if (trans?.hint !== undefined) {
                        if (!q.descriptions) q.descriptions = {};
                        q.descriptions[localeCode] = trans.hint;
                    }
                    if (trans?.placeholder !== undefined) {
                        if (!q.placeholders) q.placeholders = {};
                        q.placeholders[localeCode] = trans.placeholder;
                    }
                    if (!q.validation) q.validation = {};
                    if (trans?.customErrorMessage !== undefined) {
                        const currentMap =
                            typeof q.validation.customErrorMessage === "object" && q.validation.customErrorMessage !== null
                                ? q.validation.customErrorMessage
                                : typeof q.validation.customErrorMessage === "string"
                                ? { en: q.validation.customErrorMessage }
                                : {};
                        q.validation.customErrorMessage = {
                            ...currentMap,
                            [localeCode]: trans.customErrorMessage,
                        };
                    }
                    if (trans?.patternErrorMessage !== undefined) {
                        q.validation.patternErrorMessage = {
                            ...(q.validation.patternErrorMessage || {}),
                            [localeCode]: trans.patternErrorMessage,
                        };
                    }
                    if (trans?.minMaxErrorMessage !== undefined) {
                        q.validation.minMaxErrorMessage = {
                            ...(q.validation.minMaxErrorMessage || {}),
                            [localeCode]: trans.minMaxErrorMessage,
                        };
                    }
                    if (trans?.lengthErrorMessage !== undefined) {
                        q.validation.lengthErrorMessage = {
                            ...(q.validation.lengthErrorMessage || {}),
                            [localeCode]: trans.lengthErrorMessage,
                        };
                    }
                    if (trans?.dateRangeErrorMessage !== undefined) {
                        q.validation.dateRangeErrorMessage = {
                            ...(q.validation.dateRangeErrorMessage || {}),
                            [localeCode]: trans.dateRangeErrorMessage,
                        };
                    }
                    if (trans?.selectionCountErrorMessage !== undefined) {
                        q.validation.selectionCountErrorMessage = {
                            ...(q.validation.selectionCountErrorMessage || {}),
                            [localeCode]: trans.selectionCountErrorMessage,
                        };
                    }
                });
            }
            if (translationsData.choices) {
                snapSurvey.questions.forEach((q) => {
                    q.options?.forEach((opt) => {
                        const optTrans = translationsData.choices[opt.id] || translationsData.choices[opt.value];
                        if (optTrans) {
                            opt.labels[localeCode] = optTrans;
                        }
                    });
                });
            }
        }
    },

    /**
     * Computes version diff between two historical version numbers
     */
    async getVersionDiff(surveyId: string, versionA: number, versionB: number): Promise<SurveyVersionDiff | null> {
        await new Promise((r) => setTimeout(r, 80));
        const list = inMemoryVersionSnapshots.get(surveyId) || [];
        const snapA = list.find((s) => s.version === versionA);
        const snapB = list.find((s) => s.version === versionB);

        if (!snapA || !snapB) return null;

        return computeSurveyDiff(snapA.surveySnapshot, snapB.surveySnapshot);
    },

    /**
     * Retrieves audit logs
     */
    async getAuditLogs(surveyId: string): Promise<AuditLogEntry[]> {
        await new Promise((r) => setTimeout(r, 40));
        return inMemoryAuditLogs.get(surveyId) || [];
    },

    /**
     * Duplicates an existing survey into a completely new survey identity (v1 Draft)
     * Resets audit logs, responses, and publication history while copying all questions and metadata
     */
    async duplicateSurvey(surveyId: string): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 180));
        const original = inMemorySurveys.find((s) => s.id === surveyId);
        if (!original) {
            throw new Error(`Survey "${surveyId}" not found.`);
        }

        const newId = `srv_${Date.now()}`;
        const newSurvey: SurveyModel = {
            ...JSON.parse(JSON.stringify(original)),
            id: newId,
            name: `${original.name} (Copy)`,
            version: 1,
            versionTag: "v1",
            status: "Draft",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: undefined,
            createdBy: "Current User",
            // Reset active operational schedules to empty for new draft
            availability: {
                mode: "always",
                schedules: [],
            },
        };

        inMemorySurveys.push(newSurvey);

        // Initial snapshot for the new survey
        inMemoryVersionSnapshots.set(newId, [
            {
                version: 1,
                versionTag: "v1",
                status: "Draft",
                createdAt: newSurvey.createdAt,
                createdBy: newSurvey.createdBy,
                changeSummary: `Cloned from "${original.name}" (${original.versionTag})`,
                surveySnapshot: JSON.parse(JSON.stringify(newSurvey)),
            },
        ]);

        // Initial audit log
        inMemoryAuditLogs.set(newId, [
            {
                id: `log_${Date.now()}`,
                timestamp: new Date().toISOString(),
                user: "Current User",
                action: "DUPLICATED_SURVEY",
                summary: `Duplicated survey from "${original.name}" as fresh v1 draft.`,
            },
        ]);

        return JSON.parse(JSON.stringify(newSurvey));
    },

    /**
     * Updates survey metadata for the active draft version (Strict Version Isolation)
     */
    async updateSurveyDetails(
        surveyId: string,
        details: {
            name?: string;
            description?: string;
            category?: string;
            defaultLocale?: string;
            azId?: string;
        }
    ): Promise<SurveyModel> {
        await new Promise((r) => setTimeout(r, 100));
        const idx = inMemorySurveys.findIndex((s) => s.id === surveyId);
        if (idx === -1) {
            throw new Error(`Survey "${surveyId}" not found.`);
        }

        const current = inMemorySurveys[idx];
        if (current.status === "Published") {
            throw new Error("Cannot directly edit details of a published survey. Fork a new draft first.");
        }

        const updated: SurveyModel = {
            ...current,
            ...details,
            updatedAt: new Date().toISOString(),
        };

        inMemorySurveys[idx] = updated;
        return JSON.parse(JSON.stringify(updated));
    },

    /**
     * Batch translation backend abstraction (Secures cloud credentials on backend)
     */
    async translateTexts(
        sourceLanguage: string,
        targetLanguage: string,
        texts: string[]
    ): Promise<string[]> {
        await new Promise((r) => setTimeout(r, 250)); // Simulates backend API latency

        const DICT_HI: Record<string, string> = {
            "Yes": "हाँ",
            "No": "नहीं",
            "Are you the owner of this plot?": "क्या आप इस खेत के मालिक हैं?",
            "Upload NoC (No Objection Certificate)": "एनओसी (अनापत्ति प्रमाण पत्र) अपलोड करें",
            "Select Soil Situation": "मिट्टी की स्थिति चुनें",
            "Plot Baseline Verification": "प्लॉट बेसलाइन सत्यापन",
            "Enter plot area in acres": "एकड़ में खेत का क्षेत्रफल दर्ज करें",
            "Pass": "उत्तीर्ण",
            "Fail": "अनुत्तीर्ण",
            "High": "उच्च",
            "Medium": "मध्यम",
            "Low": "निम्न",
            "Sandy Soil": "बलुई मिट्टी",
            "Clay Loam": "चिकनी दोमट",
            "Saline / Alkaline": "खारी / क्षारीय",
            "Take photo of plot boundary": "खेत की सीमा की तस्वीर लें",
            "Scan farmer QR badge": "किसान क्यूआर बैज स्कैन करें",
            "This question is required to proceed.": "इस प्रश्न का उत्तर देना अनिवार्य है।",
        };

        const DICT_KN: Record<string, string> = {
            "Yes": "ಹೌದು",
            "No": "ಇಲ್ಲ",
            "Are you the owner of this plot?": "ನೀವು ಈ ಕೃಷಿ ಜಮೀನಿನ ಮಾಲೀಕರಾಗಿದ್ದೀರಾ?",
            "Upload NoC (No Objection Certificate)": "ಅನಪೇಕ್ಷಣಾ ಪ್ರಮಾಣಪತ್ರ (NoC) ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
            "Select Soil Situation": "ಮಣ್ಣಿನ ಪರಿಸ್ಥಿತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
            "Plot Baseline Verification": "ಜಮೀನಿನ ಬೇಸ್‌ಲೈನ್ ಪರಿಶೀಲನೆ",
            "Enter plot area in acres": "ಎಕರೆಗಳಲ್ಲಿ ಜಮೀನಿನ ವಿಸ್ತೀರ್ಣವನ್ನು ನಮೂದಿಸಿ",
            "Pass": "ತೇರ್ಗಡೆ",
            "Fail": "ಅನುತ್ತೀರ್ಣ",
            "High": "ಹೆಚ್ಚು",
            "Medium": "ಮಧ್ಯಮ",
            "Low": "ಕಡಿಮೆ",
            "Sandy Soil": "ಮರಳು ಮಣ್ಣು",
            "Clay Loam": "ಜಿಗುಟು ಮಣ್ಣು",
            "Saline / Alkaline": "ಉಪ್ಪು ಮಿಶ್ರಿತ ಮಣ್ಣು",
            "Take photo of plot boundary": "ಜಮೀನಿನ ಗಡಿಯ ಫೋಟೋ ತೆಗೆದುಕೊಳ್ಳಿ",
            "Scan farmer QR badge": "ರೈತರ ಕ್ಯೂಆರ್ ಬ್ಯಾಡ್ಜ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
            "This question is required to proceed.": "ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸುವುದು ಕಡ್ಡಾಯವಾಗಿದೆ.",
        };

        const DICT_MR: Record<string, string> = {
            "Yes": "होय",
            "No": "नाही",
            "Item A": "आयटम अ",
            "Item B": "आयटम ब",
            "Option 1": "पर्याय १",
            "Option 2": "पर्याय २",
            "Option 3": "पर्याय ३",
            "Are you the owner of the farm?": "तुम्ही शेताचे मालक आहात का?",
            "Are you the owner of this plot?": "तुम्ही या शेताचे मालक आहात का?",
            "Upload NoC (No Objection Certificate)": "ना हरकत प्रमाणपत्र (NoC) अपलोड करा",
            "Select Soil Situation": "मातीची स्थिती निवडा",
            "Plot Baseline Verification": "प्लॉट बेसलाइन पडताळणी",
            "Enter plot area in acres": "एकरमध्ये जमिनीचे क्षेत्रफळ प्रविष्ट करा",
            "Pass": "उत्तीर्ण",
            "Fail": "अनुत्तीर्ण",
            "High": "उच्च",
            "Medium": "मध्यम",
            "Low": "कमी",
            "Sandy Soil": "रेताड माती",
            "Clay Loam": "काळी माती / चिकनमाती",
            "Saline / Alkaline": "खारवट / अल्कधर्मी",
            "Take photo of plot boundary": "शेताच्या सीमेचा फोटो घ्या",
            "Scan farmer QR badge": "शेतकरी क्यूआर बॅज स्कॅन करा",
            "First operational question": "पहिला ऑपरेशनल प्रश्न",
            "How much land area is allocated for MATI deployment? (in Acres)": "माती (MATI) उपक्रमासाठी किती क्षेत्रफळ वाटप केले आहे? (एकरमध्ये)",
            "GPS Coordinates (Lat/Long)!": "जीपीएस निर्देशांक (अक्षांश/रेखांश)",
            "Farmer Mobile Number": "शेतकऱ्याचा मोबाईल क्रमांक",
            "Farmer Aadhaar Number": "शेतकऱ्याचा आधार क्रमांक",
            "This question is required to proceed.": "हा प्रश्न सोडवणे अनिवार्य आहे.",
        };

        const DICT_TE: Record<string, string> = {
            "Yes": "అవును",
            "No": "కాదు",
            "Item A": "అంశం ఎ",
            "Item B": "అంశం బి",
            "Are you the owner of this plot?": "మీరు ఈ పొలానికి యజమానా?",
            "Upload NoC (No Objection Certificate)": "నో అబ్జెక్షన్ సర్టిఫికేట్ (NoC) అప్‌లోಡ್ చేయండి",
            "Select Soil Situation": "నేల రకాన్ని ఎంచుకోండి",
            "This question is required to proceed.": "ఈ ప్రశ్నకు సమాధానం ఇవ్వడం తప్పనిసరి.",
        };

        const DICT_TA: Record<string, string> = {
            "Yes": "ஆம்",
            "No": "இல்லை",
            "Item A": "உருப்படி அ",
            "Item B": "உருப்படி ஆ",
            "Are you the owner of this plot?": "நீங்கள் இந்த நிலத்தின் உரிமையாளரா?",
            "Select Soil Situation": "மண் வகையைத் தேர்ந்தெடுக்கவும்",
            "This question is required to proceed.": "இந்த கேள்விக்கு பதிலளிப்பது கட்டாயமாகும்.",
        };

        return texts.map((t) => {
            if (!t || t.trim() === "") return "";
            const trimmed = t.trim();

            if (targetLanguage === "hi") {
                return DICT_HI[trimmed] || DICT_MR[trimmed] || `(अनुवाद) ${trimmed}`;
            }
            if (targetLanguage === "mr") {
                return DICT_MR[trimmed] || DICT_HI[trimmed] || `(मराठी भाषांतर) ${trimmed}`;
            }
            if (targetLanguage === "kn") {
                return DICT_KN[trimmed] || `(ಅನುವಾದ) ${trimmed}`;
            }
            if (targetLanguage === "te") {
                return DICT_TE[trimmed] || `(అనువాదం) ${trimmed}`;
            }
            if (targetLanguage === "ta") {
                return DICT_TA[trimmed] || `(மொழிபெயர்ப்பு) ${trimmed}`;
            }
            return `[${targetLanguage.toUpperCase()}] ${trimmed}`;
        });
    },
};

