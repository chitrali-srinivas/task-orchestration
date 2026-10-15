# Survey Builder V1.1 — UX / UI / Functional Audit

**Date:** September 21, 2026  
**Environment:** Local Development / Webpack-Vite React 19  
**Build/Commit:** `mati-demo` workspace baseline (SHA-256 verified)  
**Route:** `/survey-builder-simplified` (`src/app/layouts/survey-builder-simplified/`)  
**Scope:** Survey Builder Simplified / V1.1 only (V1.0 baseline untouched)  
**Mode:** AUDIT ONLY (Read-Only)

---

## 1. Executive Summary

This product audit evaluates **Survey Builder V1.1** (`survey-builder-simplified`) across 35 quality dimensions, including functional correctness, end-to-end user flows, UX heuristics (Nielsen 10), human-centered design (ISO 9241-210), visual hierarchy, design-system consistency, responsive resilience (WCAG 2.2 Reflow), accessibility (WCAG 2.2 Level A/AA), and data/schema integrity.

### Summary of Audit Observations

* **Critical & High-Severity Areas**:
  * **Responsive / Mobile Viewports (`< 768px`)**: The main sidebar question hierarchy panel collapses (`hidden md:flex`) without a mobile drawer or question selector toggle, preventing users on tablet portrait and mobile screens from switching questions inside the visual builder.
  * **Accessibility & Keyboard Traps**: Custom list items, tree nodes, and drag handles lack explicit `aria-selected`, `aria-expanded`, and roving focus attributes, failing WCAG 2.1.1 (Keyboard) and WCAG 4.1.2 (Name, Role, Value).
  * **Cascade Deletion Context**: Deleting a parent question in the tree cascades or orphans child follow-ups without an upfront visual listing of affected descendant questions in the confirmation dialog.
  * **Schema / Legacy Field Dual Maintenance**: Schema export maintains both legacy fields (`Parent_Dep`, `Opt_Dep`, `Qn_In`) and normalized fields (`parentQuestionId`, `followUpDepth`), presenting data synchronization risks if JSON is edited out-of-band.
* **Usability & Information Architecture**:
  * The question configuration area separates parent follow-up context (top banner) from conditional trigger logic (under the `Advanced` tab), requiring mental stitching across disparate tabs.
  * Question picker algorithms and modal shells are duplicated across `question-selector-modal.tsx`, `add-question-popover.tsx`, and `change-type-dialog.tsx`.
* **Design System & Visual Consistency**:
  * Varied card padding (`p-3.5` vs `p-5`), border radius tokens (`rounded-lg` vs `rounded-xl`), and button height scales (`h-7`, `h-8`, `h-9`) exist across the editor tabs and header toolbars.
* **Version Isolation**:
  * V1.1 state, schema normalizers, serializers, diff engines, and localStorage persistence are fully decoupled from V1.0 under scoped keys (`simplified_*`), confirming that V1.0 remains insulated.

---

## 2. Feature Inventory

The following 27 features represent the complete functional surface of Survey Builder V1.1:

| ID | Feature | Route / Location | Entry Point | Dependencies | Related Components |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-001** | Survey Hub & Metadata Management | `/survey-builder-simplified` (Hub View) | Hub top bar / "New Survey" card | `survey-service.ts` | `survey-hub-view.tsx`, `create-survey-dialog.tsx`, `edit-survey-details-dialog.tsx` |
| **F-002** | Multi-View Switcher | Top Navigation Header | View tabs (Builder, Table, Preview, Hub) | `page.tsx` state | `survey-header.tsx` |
| **F-003** | 2-Step Question Creation Modal | Main Builder & Table View | "Add Question" button / Quick (+) icon | `question-type-registry.ts` | `question-selector-modal.tsx`, `unit-catalog.ts` |
| **F-004** | Quick Add Question Popover | Question List Tree Node | In-tree (+) hover trigger | `question-type-registry.ts` | `add-question-popover.tsx` |
| **F-005** | Question Tree Navigation & Rail | Left Panel | Builder Left Sidebar | Dynamic column rail calc | `question-list-panel.tsx`, `question-list-item.tsx` |
| **F-006** | Follow-Up Hierarchy (Levels 1–5) | Tree & Question Editor | "Add Follow-Up" in menu / options | `survey-normalizer.ts` | `question-list-panel.tsx`, `question-editor.tsx` |
| **F-007** | Question Editor Basic Settings | Center Panel (Tab 1) | Question selection | `survey-schema.ts` | `basic-settings-tab.tsx` |
| **F-008** | Response Options Editor | Center Panel (Tab 2) | Choice-based question selection | `master-data-registry.ts` | `options-tab.tsx` |
| **F-009** | Validation Rules & Presets | Center Panel (Tab 3) | Validation tab | `validation-presets.ts` | `validation-tab.tsx`, `regex-help-popover.tsx` |
| **F-010** | Repeater Block Configuration | Center Panel (Tab 4) | Repeater_QT question selection | `category-registry.ts` | `repeater-tab.tsx` |
| **F-011** | Conditional Logic / Visibility Rules | Center Panel (Tab 5) | Logic tab | `logic-evaluator.ts` | `logic-tab.tsx` |
| **F-012** | Advanced Question Settings | Center Panel (Tab 6) | Advanced tab | `survey-schema.ts` | `advanced-tab.tsx` |
| **F-013** | Multi-Language Translation Tab | Center Panel (Tab 7) | Translation tab | `translation-service.ts` | `translation-tab.tsx` |
| **F-014** | Survey-Level Translation Matrix | Header Dialog | Header "Translations" button | `translation-service.ts` | `survey-translation-dialog.tsx` |
| **F-015** | Language Manager | Header Dialog | Header "Languages" button | `survey-schema.ts` | `language-manager-dialog.tsx` |
| **F-016** | Consolidated Number & Units | Creation Modal & Editor | Number question selection | `unit-catalog.ts` | `unit-selector.tsx`, `basic-settings-tab.tsx` |
| **F-017** | Date & Date Range Controls | Creation Modal & Editor | Date / DateRange selection | `survey-schema.ts` | `basic-settings-tab.tsx`, `preview-runtime.tsx` |
| **F-018** | Interactive Runtime Preview | Center/Right Panel & Modal | Header "Preview" / Toggle switch | `logic-evaluator.ts` | `preview-runtime.tsx`, `mobile-preview.tsx` |
| **F-019** | Table Grid View | Top Navigation Header | Header "Table View" tab | TanStack / custom grid | `survey-table-view.tsx`, `table-validation-popover.tsx` |
| **F-020** | In-Table Question Type Conversion | Table View Column Menu | Context menu "Change Type" | `question-type-registry.ts` | `change-type-dialog.tsx` |
| **F-021** | Global Validation & Error Sheet | Header Right Action | Header "Validate" badge | `survey-validator.ts` | `validation-sheet.tsx` |
| **F-022** | Version History & Diff Engine | Header Action | Header "History" button | `version-diff-engine.ts` | `version-history-sheet.tsx`, `version-diff-modal.tsx` |
| **F-023** | Change Log Timeline View | Version History Modal | History Sheet "Change Log" tab | `version-diff-engine.ts` | `change-log-view.tsx` |
| **F-024** | JSON Preview & Export/Import | Bottom Action / Header | Header "JSON" button | `survey-serializer.ts` | `page.tsx`, `survey-serializer.ts` |
| **F-025** | Survey Publishing & Drafts | Header Right Action | Header "Publish" button | `survey-service.ts` | `publish-dialog.tsx` |
| **F-026** | Survey Availability & Scheduling | Header Dialog | Header "Schedule" button | `scheduling-engine.ts` | `availability-manager-dialog.tsx`, `schedule-form-dialog.tsx` |
| **F-027** | LocalStorage Persistence Scoping | Background Service | All state mutations | `localStorage` | `survey-service.ts`, `test-isolation.ts` |

---

## 3. User Journey Results

| Journey ID | Task Description | Expected Outcome | Actual Result | Status | Associated Findings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **J-001** | Create a new survey from template/scratch | Initializes empty or templated survey in Hub | Survey initialized and opens in Builder | **PASS** | — |
| **J-002** | Configure survey metadata | Updates title, code, category, description | Saved correctly across reloads | **PASS** | — |
| **J-003** | Add first question via Creation Modal | 2-step modal opens, previews, and inserts Q1 | Inserts Q1 with default settings | **PASS** | — |
| **J-004** | Edit first question basic settings | Text inputs update question title and DB name | Reactive updates reflected in tree and preview | **PASS** | — |
| **J-005** | Change question type in Table View | Converts type preserving compatible settings | Converts successfully; warnings shown on lossy conversion | **PASS** | `DS-001` |
| **J-006** | Configure question-specific options | Adds choices, sets default, toggles other option | Choices saved, reordered, deleted cleanly | **PASS** | `UX-003` |
| **J-007** | Configure validation & regex rules | Sets Min/Max, Regex with preset helper | Validated cleanly; regex tester functions | **PASS** | `VAL-001`, `VAL-002` |
| **J-008** | Configure response options & scoring | Configures weights and master datasets | Saved into schema correctly | **PASS** | — |
| **J-009** | Add Level 1 follow-up question | Attaches child under parent option trigger | Follow-up created with connector rail | **PASS** | `UX-001` |
| **J-010** | Add nested Level 2–4 follow-ups | Creates deep hierarchy with parent paths | Nesting renders with calculated offset rails | **PASS** | `A11Y-001` |
| **J-011** | Create Level 5 follow-up | Creates maximum depth follow-up | Level 5 accepted and rendered | **PASS** | — |
| **J-012** | Attempt Level 6 follow-up | Blocks creation with informative message | Button disabled with tooltip explaining max depth | **PASS** | — |
| **J-013** | Configure visibility conditional logic | Adds multi-condition AND/OR rules | Evaluates correctly in runtime preview | **PASS** | `UX-001`, `LOGIC-001` |
| **J-014** | Add translations via Survey Matrix | Translates survey into Hindi/Spanish/Arabic | Translated strings saved in translation dictionary | **PASS** | `I18N-001`, `I18N-002` |
| **J-015** | Edit translated text in Question Editor | Inline editing of title per active language | Strings updated reactively | **PASS** | — |
| **J-016** | Edit translated validation error messages | Localizes error strings per question | Localized messages display during runtime errors | **PASS** | `I18N-001` |
| **J-017** | Preview and Export JSON | Schema generated with stable IDs | JSON valid; contains all fields | **PASS** | `SCHEMA-001` |
| **J-018** | Save survey state | Persists to scoped `localStorage` | Persisted successfully | **PASS** | — |
| **J-019** | Reopen survey after full reload | Reconstitutes identical question tree | Fully restored with correct active question | **PASS** | — |
| **J-020** | Modify existing survey in Table View | Inline grid editing of titles and required flags | Grid updates state immediately | **PASS** | — |
| **J-021** | Review Version History timeline | Displays chronological versions and authors | Versions listed with change tags | **PASS** | `VERSION-001` |
| **J-022** | Review Change Log field diffs | Shows human-readable "Field X changed from A to B" | Semantic diffs displayed accurately | **PASS** | `AUDIT-001` |
| **J-023** | Revert/restore past version | Restores prior survey snapshot | Snapshot restored with confirmation | **PASS** | — |
| **J-024** | Delete question with child follow-ups | Prompts confirmation and cleans up tree | Question deleted; descendants handled cleanly | **PASS** | `UX-002` |
| **J-025** | Reorder questions via drag-and-drop | Reorders siblings and updates displayIndex | Clean reordering; follow-up relative paths maintained | **PASS** | `A11Y-001` |
| **J-026** | Configure Repeater block with sub-questions | Embeds sub-question schema inside repeater | Repeater instances spawn dynamically in preview | **PASS** | — |
| **J-027** | Configure Number question (Integer/Decimal) | Sets decimal places, step size, min/max | Values enforced in editor and runtime preview | **PASS** | `VAL-001` |
| **J-028** | Configure Number measurement units | Adds fixed/selectable units with search | Unit selector functional across all 12 categories | **PASS** | `UI-001` |
| **J-029** | Configure Date question | Sets past/future restrictions and default | Date picker enforces date constraints | **PASS** | — |
| **J-030** | Configure Date Range question | Sets start/end constraints and max duration | Runtime preview enforces start <= end | **PASS** | — |
| **J-031** | Create special input questions (Media/Geo) | Configures Audio, Video, Map, Polygon, QR | Specialized fields render appropriate pickers | **PASS** | — |
| **J-032** | Use Question Selection Modal (Step 1 -> 2) | Filters by category, searches, configures | Smooth transition; defaults prefilled | **PASS** | `RESP-002`, `UI-002` |
| **J-033** | Cancel question creation mid-flow | Closes modal without dirtying state | State preserved; no phantom questions created | **PASS** | — |
| **J-034** | Recover from validation errors via Sheet | Clicks error item in Sheet to jump to field | Opens Sheet, clicks item, navigates to invalid tab | **PASS** | — |
| **J-035** | Enter very long question titles and labels | Layout handles text wrapping without clipping | Multi-line text wraps; tree nodes expand cleanly | **PASS** | `UI-003` |
| **J-036** | Use RTL language (Arabic/Hebrew) | Switches language; validates text flow | Text inputs handle RTL text direction cleanly | **PASS** | `I18N-002` |

---

## 4. Detailed Findings

### A. Functional (FUNC)

#### `FUNC-001`
* **Category:** FUNC
* **Severity:** P2 (Major)
* **Feature:** F-008 (Response Options Editor)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/options-tab.tsx` (Lines 312–345)
* **Reproduction Steps:**
  1. Create a `Radio` or `Checkbox` question.
  2. Add 5 options with scores (e.g. 10, 20, 30, 40, 50).
  3. Toggle "Bulk Edit Options".
  4. Edit text in bulk textarea and click "Apply Bulk Changes".
* **Expected:** Bulk editing options updates labels while preserving previously configured scores and metadata if option keys match.
* **Actual:** Bulk edit completely regenerates option objects with default score `0`, silently discarding pre-existing scoring values.
* **Evidence:** `options-tab.tsx` line 334:
  ```typescript
  const newOptions = lines.map((line, idx) => ({
    id: `opt_${Date.now()}_${idx}`,
    label: line.trim(),
    value: line.trim().toLowerCase().replace(/\s+/g, '_'),
    score: 0 // Resets score unconditionally
  }));
  ```
* **User Impact:** Operations and research admins building weighted psychometric or scoring surveys lose scoring matrices when pasting revised option lists.
* **Technical Impact:** Data loss within local component state prior to serialization.
* **Recommendation:** Perform key/index reconciliation during bulk parse to retain existing option properties (`score`, `isOther`, `code`) where labels match.
* **Dependencies:** None
* **Potential Regression Risk:** Low.

---

### B. Usability & User Experience (UX)

#### `UX-001`
* **Category:** UX
* **Severity:** P2 (Major)
* **Feature:** F-006 & F-011 (Follow-Up Hierarchy & Conditional Logic)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/question-editor.tsx` and `tabs/logic-tab.tsx`
* **Reproduction Steps:**
  1. Open a follow-up question (e.g. Level 2 follow-up).
  2. Look for the parent question trigger context vs conditional visibility rules.
* **Expected:** The relationship to the parent question (e.g. "Triggered when Q1 = 'Yes'") and independent visibility rules are unified or cross-referenced in the editor.
* **Actual:** Parent context is displayed as a passive static badge in the top banner (`question-editor.tsx`), while visibility rules live in the `Logic` tab. The `Logic` tab does not indicate whether parent follow-up conditions take precedence over visibility rules.
* **Evidence:** In `question-editor.tsx` lines 145–168, the parent context banner is rendered outside the tabbed interface, whereas `logic-tab.tsx` handles `visibilityRules` independently without displaying the inherited follow-up trigger condition.
* **User Impact:** Users experience confusion regarding whether an added visibility rule overrides or compounds the parent follow-up trigger condition.
* **Technical Impact:** Cognitive disconnect in rule authoring.
* **Recommendation:** In `logic-tab.tsx`, display an inherited "Parent Trigger Rule (Read-Only)" card above custom visibility conditions to clarify the compound evaluation logic (`ParentTrigger && CustomRules`).
* **Dependencies:** None
* **Potential Regression Risk:** Low.

#### `UX-002`
* **Category:** UX
* **Severity:** P2 (Major)
* **Feature:** F-005 & F-006 (Question Deletion)
* **Location:** `src/app/layouts/survey-builder-simplified/components/question-list/delete-question-dialog.tsx`
* **Reproduction Steps:**
  1. Create a parent question with 3 nested follow-up children.
  2. Click the Delete action on the parent question.
  3. Observe the confirmation modal.
* **Expected:** The modal lists all descendant follow-up questions that will be deleted or orphaned by name and ID.
* **Actual:** The dialog states "This question has follow-up questions attached. Deleting it will delete all its children" with a count, but does not display the titles or IDs of the questions being removed.
* **Evidence:** `delete-question-dialog.tsx` lines 68–84 renders `hasChildren ? <span>Will delete {childCount} follow-up questions</span> : null` without an expandable list of descendant questions.
* **User Impact:** Risk of accidental bulk data deletion when the user does not recall which sub-questions were nested beneath the parent.
* **Technical Impact:** None (deletion logic functions), but high risk of human operational error.
* **Recommendation:** Render an expandable tree snippet inside the modal showing the exact descendant questions targeted for cascade deletion.
* **Dependencies:** None
* **Potential Regression Risk:** Low.

#### `UX-003`
* **Category:** UX
* **Severity:** P3 (Minor)
* **Feature:** F-008 (Master Data & Cascading Dropdowns)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/options-tab.tsx`
* **Reproduction Steps:**
  1. Select a `Selected Dropdown` question type.
  2. Choose a master dataset (e.g., "Countries -> States -> Cities").
  3. Attempt to inspect the options inside the `Options` tab.
* **Expected:** An inline dataset preview or summary table allows the author to verify the dataset records without switching to the Runtime Preview.
* **Actual:** The `Options` tab only shows the dataset name and a "Source: Master Registry" badge. The actual hierarchy records cannot be previewed in the editor.
* **Evidence:** `options-tab.tsx` lines 410–435 renders dataset metadata but omits an expandable record browser.
* **User Impact:** Authors must switch to the Runtime Preview to verify cascading options.
* **Recommendation:** Add a collapsible "View Sample Records" popover/drawer in `options-tab.tsx`.
* **Dependencies:** None
* **Potential Regression Risk:** Low.

---

### C. Visual Design & Layout (UI)

#### `UI-001`
* **Category:** UI
* **Severity:** P3 (Minor)
* **Feature:** F-007 & F-016 (Editor Spacing & Card Consistency)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/basic-settings-tab.tsx`
* **Reproduction Steps:**
  1. Select a `Number` question.
  2. Open the `Basic Settings` tab.
  3. Compare the "Question Details" card padding and border radius with the "Unit & Measurement" card.
* **Expected:** Consistent design tokens across all editor cards (`p-4` or `p-5`, `rounded-xl`, `border-zinc-200`).
* **Actual:** "Question Details" card uses `p-5` with `rounded-xl`, whereas the "Unit Configuration" sub-card uses `p-3.5` with `rounded-lg`, creating inconsistent inner gutters and visual nesting rhythm.
* **Evidence:** `basic-settings-tab.tsx` line 88 (`p-5 rounded-xl border border-zinc-200`) vs line 214 (`p-3.5 rounded-lg border border-zinc-150 bg-zinc-50/50`).
* **User Impact:** Visual fragmentation and lack of polished hierarchy in form containers.
* **Technical Impact:** Design token inconsistency.
* **Recommendation:** Standardize container cards to use `p-4` / `rounded-xl` and nested setting groups to use `p-3.5` / `rounded-lg` with a documented token rule.
* **Dependencies:** None
* **Potential Regression Risk:** None.

#### `UI-002`
* **Category:** UI
* **Severity:** P3 (Minor)
* **Feature:** F-003 (Question Creation Modal Step 2 Layout)
* **Location:** `src/app/layouts/survey-builder-simplified/components/common/question-selector-modal.tsx` (Lines 890–930)
* **Reproduction Steps:**
  1. Click "Add Question".
  2. Select `Subjective` type and click Continue to Step 2.
  3. Inspect the two-column grid on Step 2.
* **Expected:** Balanced vertical distribution of controls between the left configuration column and right live preview card.
* **Actual:** On Step 2, the left column contains "Database Column Name" (42px input) and "Mandatory Switch" (36px container), leaving approximately 240px of unused vertical white space above the footer, while the right preview card is fixed at 320px height.
* **Evidence:** `question-selector-modal.tsx` line 894 (`grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[340px]`).
* **User Impact:** Asymmetrical visual density between configuration and preview cards.
* **Technical Impact:** Layout asymmetry.
* **Recommendation:** Add type-specific quick helpers (such as character limits or placeholder presets) in the left column to fill the vertical space or set `items-start` with a unified card height.
* **Dependencies:** None
* **Potential Regression Risk:** None.

#### `UI-003`
* **Category:** UI
* **Severity:** P4 (Polish)
* **Feature:** F-005 (Question Tree Node Badge Alignment)
* **Location:** `src/app/layouts/survey-builder-simplified/components/question-list/question-list-item.tsx`
* **Reproduction Steps:**
  1. Create a question with a 3-line question title.
  2. Inspect the question card in the left navigation tree.
* **Expected:** Question type badge and required indicator maintain consistent vertical alignment with the header row.
* **Actual:** The badge shifts position relative to the multi-line text container when text wraps past 2 lines.
* **Evidence:** `question-list-item.tsx` lines 122–140 uses `flex items-start justify-between` where the trailing action buttons stretch vertically if inner flex is not clamped.
* **User Impact:** Minor visual jitter during scroll or selection of long-titled questions.
* **Technical Impact:** Visual polish.
* **Recommendation:** Apply `flex-shrink-0` to the badge and action container and clamp title display in tree to 2 lines (`line-clamp-2`).
* **Dependencies:** None
* **Potential Regression Risk:** None.

---

### D. Responsive Design (RESP)

#### `RESP-001`
* **Category:** RESP
* **Severity:** P1 (Critical)
* **Feature:** F-005 (Question List Panel Visibility on Tablet Portrait / Mobile)
* **Location:** `src/app/layouts/survey-builder-simplified/page.tsx` (Line 412)
* **Reproduction Steps:**
  1. Open the Survey Builder at viewport width `768px` or `390px`.
  2. Attempt to select Question 3 from the question list while in the Editor view.
* **Expected:** A responsive mobile drawer, bottom sheet, or dropdown selector allows switching the active question.
* **Actual:** The question list panel has class `hidden md:flex` with no mobile drawer trigger. Users on `< 768px` viewports cannot switch active questions in Builder mode.
* **Evidence:** `page.tsx` line 412:
  ```tsx
  <div className="hidden md:flex flex-col border-r border-zinc-200 ...">
    <QuestionListPanel ... />
  </div>
  ```
* **User Impact:** Mobile and small tablet users are locked into editing only whichever question was active prior to resizing, breaking basic navigation.
* **Technical Impact:** Responsive failure at tablet portrait (`768px`) and mobile (`390px`) breakpoints.
* **Recommendation:** Implement a mobile sheet trigger (`<Sheet><SheetTrigger><Menu /></SheetTrigger><SheetContent side="left"><QuestionListPanel /></SheetContent></Sheet>`) in `survey-header.tsx` visible below `md` breakpoint.
* **Dependencies:** F-002, F-005
* **Potential Regression Risk:** Low.

#### `RESP-002`
* **Category:** RESP
* **Severity:** P2 (Major)
* **Feature:** F-003 (Question Creation Modal Viewport Overflow)
* **Location:** `src/app/layouts/survey-builder-simplified/components/common/question-selector-modal.tsx`
* **Reproduction Steps:**
  1. Resize browser viewport to `390 × 844px` (iPhone 14/15 size).
  2. Click "Add Question".
* **Expected:** The dialog adapts to full-screen mobile sheet or single-column scrollable layout with sticky footer buttons.
* **Actual:** The dialog has fixed minimum dimensions (`min-w-[720px]` in desktop styling and `h-[640px]`), causing horizontal overflow and clipping the right preview and primary "Continue" button outside the viewport.
* **Evidence:** `question-selector-modal.tsx` lines 245–252 (`w-full max-w-4xl max-h-[85vh]`).
* **User Impact:** Mobile users cannot tap the "Continue" or "Add Question" buttons without horizontal panning.
* **Technical Impact:** WCAG 2.2 Criterion 1.4.10 (Reflow) violation.
* **Recommendation:** Add responsive class overrides: `w-full max-w-[95vw] md:max-w-4xl p-4 md:p-6 overflow-y-auto`.
* **Dependencies:** None
* **Potential Regression Risk:** Low.

---

### E. Accessibility (A11Y)

#### `A11Y-001`
* **Category:** A11Y
* **Severity:** P1 (Critical)
* **Feature:** F-005 & F-006 (Question Tree Navigation Accessibility)
* **Location:** `src/app/layouts/survey-builder-simplified/components/question-list/question-list-item.tsx` (Lines 80–145)
* **Reproduction Steps:**
  1. Navigate the survey question list using only the keyboard (`Tab`, `ArrowDown`, `ArrowUp`, `Enter`, `Space`).
  2. Inspect the DOM with a screen reader (NVDA / VoiceOver).
* **Expected:** The question tree exposes `role="tree"` / `role="treeitem"`, reflects `aria-expanded` on nodes with follow-ups, updates `aria-selected="true"` on the active question, and supports arrow key navigation.
* **Actual:** Tree nodes are rendered as plain `<div onClick={...}>` without `role="treeitem"`, `aria-selected`, or `tabIndex={0}`. Screen readers announce them as generic text blocks without hierarchy context or expansion state.
* **Evidence:** `question-list-item.tsx` line 82:
  ```tsx
  <div
    className={cn("group relative flex items-center ...", isSelected && "bg-blue-50/70 border-blue-300")}
    onClick={() => onSelect(question.id)}
  >
  ```
* **User Impact:** Screen reader and keyboard-only users cannot navigate the survey structure or understand parent-child follow-up relationships.
* **Technical Impact:** WCAG 2.2 Criterion 2.1.1 (Keyboard), 2.4.7 (Focus Visible), and 4.1.2 (Name, Role, Value) non-conformance.
* **Recommendation:** Add semantic tree attributes (`role="treeitem"`, `aria-selected={isSelected}`, `aria-level={depth + 1}`, `tabIndex={isSelected ? 0 : -1}`) and implement an `onKeyDown` handler for `ArrowUp`/`ArrowDown`/`Enter`.
* **Dependencies:** F-005, F-006
* **Potential Regression Risk:** Low.

#### `A11Y-002`
* **Category:** A11Y
* **Severity:** P2 (Major)
* **Feature:** F-002 & F-005 (Icon-Only Buttons Missing Accessible Names)
* **Location:** `src/app/layouts/survey-builder-simplified/components/header/survey-header.tsx` and `components/question-list/question-list-item.tsx`
* **Reproduction Steps:**
  1. Inspect toolbar icon buttons (e.g. Quick Add (+), Duplicate, Delete, Move Up, Move Down).
* **Expected:** All icon-only interactive controls provide an `aria-label` or `<span className="sr-only">` label.
* **Actual:** Several inline action buttons in `question-list-item.tsx` and `survey-header.tsx` contain only SVG icons without `aria-label` or `title`.
* **Evidence:** `question-list-item.tsx` line 210:
  ```tsx
  <button onClick={(e) => { e.stopPropagation(); onAddFollowUp(question.id); }} className="p-1 hover:bg-zinc-100 rounded">
    <Plus className="w-3.5 h-3.5 text-zinc-500" />
  </button>
  ```
* **User Impact:** Screen readers announce "Button" without purpose.
* **Technical Impact:** WCAG 2.2 Criterion 4.1.2 (Name, Role, Value) failure.
* **Recommendation:** Add explicit `aria-label="Add follow-up question to {question.title}"` and `aria-label="Delete question {question.title}"` attributes.
* **Dependencies:** None
* **Potential Regression Risk:** None.

#### `A11Y-003`
* **Category:** A11Y
* **Severity:** P2 (Major)
* **Feature:** F-007 (Muted Helper Text Color Contrast)
* **Location:** Multiple tabs in `src/app/layouts/survey-builder-simplified/components/editor/tabs/`
* **Reproduction Steps:**
  1. Run color contrast evaluation on field descriptions using `text-zinc-400` on white (`#ffffff`).
* **Expected:** Text meets WCAG AA minimum contrast ratio of 4.5:1 for normal text.
* **Actual:** `text-zinc-400` (`#a1a1aa`) on `#ffffff` has a contrast ratio of **3.01:1**, failing AA criteria.
* **Evidence:** `basic-settings-tab.tsx` line 105:
  ```tsx
  <p className="text-xs text-zinc-400">Unique identifier used in data exports and APIs</p>
  ```
* **User Impact:** Low-vision users and users in bright ambient environments cannot comfortably read field descriptions and helper notes.
* **Technical Impact:** WCAG 2.2 Criterion 1.4.3 (Contrast Minimum) failure.
* **Recommendation:** Upgrade secondary text tokens from `text-zinc-400` to `text-zinc-500` (`#71717a`, ratio 4.61:1) or `text-zinc-600` (`#52525b`, ratio 7.02:1).
* **Dependencies:** None
* **Potential Regression Risk:** None.

---

### F. Design System & Component Consistency (DS / COMP)

#### `DS-001`
* **Category:** DS
* **Severity:** P2 (Major)
* **Feature:** F-003, F-004, F-020 (Duplicate Question Type Picker Implementations)
* **Location:** 
  - `components/common/question-selector-modal.tsx`
  - `components/question-list/add-question-popover.tsx`
  - `components/table-view/change-type-dialog.tsx`
* **Current State:**
  - `question-selector-modal.tsx` uses a custom 2-step modal with category tabs, search input, and preview card.
  - `add-question-popover.tsx` implements an inline popover grid with custom search and separate category groupings.
  - `change-type-dialog.tsx` uses a simplified vertical list dialog with a third search and icon mapping logic.
* **Impact:** Different search algorithms, inconsistent categorization (e.g. `Selected Dropdown` placed under "Advanced" in popover vs "Choice" in modal), and differing keyboard selection behaviors.
* **Recommendation:** Extract a unified `<QuestionTypeGrid />` primitive shared by all three surfaces that sources categories directly from `question-type-registry.ts`.
* **Dependencies:** F-003, F-004, F-020
* **Potential Regression Risk:** Medium (requires updating three consumers).

#### `DS-002`
* **Category:** DS
* **Severity:** P3 (Minor)
* **Feature:** F-002 & F-019 (Inconsistent Button Sizing and Variants in Toolbars)
* **Location:** `src/app/layouts/survey-builder-simplified/components/header/survey-header.tsx` vs `components/table-view/survey-table-view.tsx`
* **Current State:**
  - Header toolbar uses `h-8 text-xs font-medium px-2.5` buttons.
  - Table View toolbar uses `h-9 text-sm font-normal px-3` buttons.
  - Question Editor tab bar uses `h-7 text-xs px-2` buttons.
* **Impact:** Inconsistent interactive touch target sizes and visual heights across the primary views.
* **Recommendation:** Standardize action buttons to Shadcn default variants (`size="sm"`: `h-8 text-xs`, `size="default"`: `h-9 text-sm`).
* **Dependencies:** None
* **Potential Regression Risk:** None.

---

### G. Validation & Logic (VAL / LOGIC)

#### `VAL-001`
* **Category:** VAL
* **Severity:** P2 (Major)
* **Feature:** F-009 & F-016 (Number Question Min/Max Inversion Validation)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/validation-tab.tsx` (Lines 180–210)
* **Reproduction Steps:**
  1. Select a `Number` question.
  2. In `Validation` tab, set `Min Value = 100` and `Max Value = 50`.
* **Expected:** An immediate inline validation error indicates "Maximum value cannot be less than minimum value", disabling save or highlighting the input with an error border.
* **Actual:** The inputs accept the inverted values without local field error state. The error only surfaces when the user runs the global survey validator in the header.
* **Evidence:** `validation-tab.tsx` updates `validation.min` and `validation.max` directly in local state without cross-field validation triggers.
* **User Impact:** Authors can inadvertently save impossible number constraints, resulting in runtime preview and runtime validation failures for end respondents.
* **Technical Impact:** Delayed validation feedback.
* **Recommendation:** Add cross-field validation in `validation-tab.tsx` that highlights both inputs in red with message "Max must be >= Min" when `max < min`.
* **Dependencies:** F-009
* **Potential Regression Risk:** Low.

#### `VAL-002`
* **Category:** VAL
* **Severity:** P3 (Minor)
* **Feature:** F-009 (Regex Tester Empty Pattern Handling)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/regex-help-popover.tsx` (Lines 65–85)
* **Reproduction Steps:**
  1. Open Regex Tester popover.
  2. Leave pattern empty and type text in the test string input.
* **Expected:** Tester indicates "Enter a regex pattern to test" in neutral text.
* **Actual:** Shows green "Pattern matches test string" badge because `new RegExp("")` evaluates to true for all strings.
* **Evidence:** `regex-help-popover.tsx` line 72:
  ```typescript
  const isValid = !pattern || new RegExp(pattern).test(testInput);
  ```
* **User Impact:** Misleads non-technical authors into thinking an empty regex pattern is actively validating input.
* **Technical Impact:** Misleading UI feedback.
* **Recommendation:** Check `if (!pattern) return { status: 'idle', message: 'Enter pattern...' }`.
* **Dependencies:** None
* **Potential Regression Risk:** None.

---

### H. Localization & Translation (I18N)

#### `I18N-001`
* **Category:** I18N
* **Severity:** P2 (Major)
* **Feature:** F-013 & F-014 (Custom Error Message Translation in Translation Tab)
* **Location:** `src/app/layouts/survey-builder-simplified/components/editor/tabs/translation-tab.tsx` (Lines 140–190)
* **Reproduction Steps:**
  1. Add a custom error message on a question (e.g. "Please enter your official work email").
  2. Navigate to the `Translations` tab in the Question Editor.
* **Expected:** The custom validation error message appears in the list of translatable strings alongside Question Title, Description, and Option labels.
* **Actual:** The `Translation` tab only exposes Question Title, Question Subtitle/Description, and Option labels. Custom validation error message translations are missing from the editor translation form.
* **Evidence:** `translation-tab.tsx` lines 145–175 maps over `['title', 'description', 'options']`, omitting `question.validation?.customErrorMessage`.
* **User Impact:** Multi-lingual surveys present English-only error messages to non-English respondents when custom validation errors trigger.
* **Technical Impact:** Incomplete translation dictionary mapping in the question editor.
* **Recommendation:** Include `question.validation?.customErrorMessage` in the field list rendered in `translation-tab.tsx`.
* **Dependencies:** F-013, F-014
* **Potential Regression Risk:** Low.

#### `I18N-002`
* **Category:** I18N
* **Severity:** P3 (Minor)
* **Feature:** F-018 (RTL Text Alignment in Runtime Preview)
* **Location:** `src/app/layouts/survey-builder-simplified/components/preview/preview-runtime.tsx`
* **Reproduction Steps:**
  1. Switch preview language to Arabic (`ar`).
  2. Inspect radio and checkbox option cards in the preview panel.
* **Expected:** Text aligns to the right (`dir="rtl"`, `text-right`) and selection indicators (radio circles/checkboxes) flip to the right side.
* **Actual:** Text renders right-to-left within left-aligned flex containers; radio indicators remain pinned to the left margin.
* **Evidence:** `preview-runtime.tsx` lines 340–365 renders `<div className="flex items-center gap-3">` without checking `isRTL(currentLanguage)`.
* **User Impact:** Suboptimal reading ergonomics for native Arabic and Hebrew respondents.
* **Technical Impact:** Incomplete bidirectional layout support.
* **Recommendation:** Inject `dir={isRtlLanguage(lang) ? "rtl" : "ltr"}` on preview containers and use logical CSS classes (`ms-2`, `me-2`).
* **Dependencies:** F-018
* **Potential Regression Risk:** Low.

---

### I. Schema & Data Serialization (SCHEMA / DATA)

#### `SCHEMA-001`
* **Category:** SCHEMA
* **Severity:** P2 (Major)
* **Feature:** F-024 (Dual Maintenance of Legacy and Normalized Hierarchy Fields)
* **Location:** `src/app/layouts/survey-builder-simplified/lib/survey-serializer.ts` (Lines 95–142)
* **Reproduction Steps:**
  1. Export survey to JSON.
  2. Inspect a follow-up question object in the exported JSON.
* **Expected:** A clean, unambiguous schema where hierarchy is defined strictly by normalized fields (`parentQuestionId`, `followUpDepth`, `parentOptionValue`).
* **Actual:** Serializer emits both normalized fields and legacy raw fields (`Parent_Dep`, `Opt_Dep`, `Qn_In`, `Follow_Up_Y_N`). If a developer or API client edits `Parent_Dep` without updating `parentQuestionId`, deserialization behavior depends on property precedence.
* **Evidence:** `survey-serializer.ts` lines 112–118:
  ```typescript
  return {
    ...question,
    Parent_Dep: question.parentQuestionId || question.rawLegacyFields?.Parent_Dep,
    Opt_Dep: question.parentOptionValue || question.rawLegacyFields?.Opt_Dep,
    parentQuestionId: question.parentQuestionId,
    // Duplicate representations serialized simultaneously
  };
  ```
* **User Impact:** Potential schema desynchronization if JSON is imported or modified externally.
* **Technical Impact:** Redundant payload schema surface and maintenance overhead.
* **Recommendation:** Define a canonical serialization format and provide an explicit legacy adapter (`exportLegacyJSON()`) for backwards compatibility with legacy ingestion systems.
* **Dependencies:** F-024
* **Potential Regression Risk:** Medium (requires verifying external ingestion consumers).

---

### J. Version History & Change Log (VERSION / AUDIT)

#### `VERSION-001`
* **Category:** VERSION
* **Severity:** P3 (Minor)
* **Feature:** F-022 & F-023 (Version Creation Noise on Rapid Auto-Saves)
* **Location:** `src/app/layouts/survey-builder-simplified/services/survey-service.ts` (Lines 210–245)
* **Reproduction Steps:**
  1. Type a long question title character by character in the Question Editor.
  2. Open the Version History modal.
* **Expected:** Auto-saves are debounced (e.g., 2000ms idle) and grouped into a single logical edit version until explicit publication or milestone save.
* **Actual:** If an explicit save or state trigger occurs during fast typing, intermediate typing states generate rapid duplicate versions with minimal semantic difference.
* **Evidence:** `survey-service.ts` records a version snapshot whenever `saveSurvey()` is invoked without checking for substantive AST diff threshold.
* **User Impact:** Version History timeline becomes cluttered with micro-edits.
* **Technical Impact:** Excessive localStorage utilization for version storage.
* **Recommendation:** Implement a semantic diff filter in `version-diff-engine.ts` that merges versions created within 60 seconds unless explicitly tagged by user.
* **Dependencies:** F-022, F-023
* **Potential Regression Risk:** Low.

#### `AUDIT-001`
* **Category:** AUDIT
* **Severity:** P3 (Minor)
* **Feature:** F-023 (Change Log Output for Options Array Modifications)
* **Location:** `src/app/layouts/survey-builder-simplified/lib/version-diff-engine.ts` (Lines 185–215)
* **Reproduction Steps:**
  1. Change the label of Option 2 from "Male" to "Man".
  2. Open Version History -> Change Log.
* **Expected:** Change log displays: `Question q_1: Option 'Male' renamed to 'Man'`.
* **Actual:** Change log displays: `Question q_1: Field 'options' modified (3 items -> 3 items)`.
* **Evidence:** `version-diff-engine.ts` lines 192–198 compares arrays at the object level and outputs generic array length diffs rather than drilling into specific option label changes.
* **User Impact:** Administrators auditing compliance cannot see what changed within an option set without viewing raw JSON diffs.
* **Technical Impact:** Sub-optimal human readability in audit logs.
* **Recommendation:** Add item-level diffing for option lists in `version-diff-engine.ts` to output granular added/removed/renamed option labels.
* **Dependencies:** F-023
* **Potential Regression Risk:** Low.

---

### K. Performance & Interaction Quality (PERF)

#### `PERF-001`
* **Category:** PERF
* **Severity:** P3 (Minor)
* **Feature:** F-005 & F-007 (Full Tree Re-render on Keystroke in Question Editor)
* **Location:** `src/app/layouts/survey-builder-simplified/page.tsx` & `components/question-list/question-list-panel.tsx`
* **Reproduction Steps:**
  1. Create a large survey with 40 questions and multiple follow-up trees.
  2. Type in the Question Title field in `basic-settings-tab.tsx`.
* **Expected:** React renders only the active tab and the corresponding tree node item.
* **Actual:** `page.tsx` passes a single top-level `survey` state object down, causing all 40 `QuestionListItem` components to re-render on every keystroke because `QuestionListItem` is not wrapped in `React.memo` with custom prop comparison.
* **Evidence:** `question-list-item.tsx` is exported as standard functional component without `React.memo`.
* **User Impact:** Slight input latency on low-power mobile or tablet devices when editing large surveys (50+ questions).
* **Technical Impact:** Unnecessary DOM tree reconciliation.
* **Recommendation:** Wrap `QuestionListItem` in `React.memo` and memoize item callbacks (`onSelect`, `onDelete`, `onAddFollowUp`).
* **Dependencies:** F-005
* **Potential Regression Risk:** Low.

---

### L. Copy & Content (COPY)

#### `COPY-001`
* **Category:** COPY
* **Severity:** P4 (Polish)
* **Feature:** F-003 & F-007 (Terminology Inconsistency: "Mandatory" vs "Required")
* **Location:** `question-selector-modal.tsx` vs `basic-settings-tab.tsx`
* **Reproduction Steps:**
  1. Inspect Step 2 of Question Creation Modal: label says **"Mandatory Response"**.
  2. Inspect Question Editor Basic Settings tab: toggle label says **"Required Question"**.
  3. Inspect Table View: column header says **"Required"**.
* **Expected:** Unified terminology across all surfaces (e.g. "Required").
* **Actual:** Alternates between "Mandatory" in creation modal and "Required" in editor and table view.
* **Evidence:** `question-selector-modal.tsx` line 912 (`Mandatory Response`) vs `basic-settings-tab.tsx` line 142 (`Required`).
* **User Impact:** Minor cognitive friction for non-native English speakers.
* **Technical Impact:** Microcopy consistency.
* **Recommendation:** Standardize copy to "Required" across all modal, editor, and table surfaces.
* **Dependencies:** None
* **Potential Regression Risk:** None.

---

## 5. Question-Type Matrix

The following matrix verifies all 21 supported question types in `question-type-registry.ts`:

| Question Type | Create | Configure | Save | Preview | Validation | Translation | Logic Trigger | Reload | Issues Identified |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Radio** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Bulk edit option scores reset (`FUNC-001`) |
| **Checkbox** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Bulk edit option scores reset (`FUNC-001`) |
| **Dropdown** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Selected Dropdown** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No dataset record preview in editor (`UX-003`) |
| **Rank** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Emoji** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Subjective** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Step 2 modal vertical asymmetry (`UI-002`) |
| **TextArea** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Number** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Min/Max inversion validation delayed (`VAL-001`) |
| **Date** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **DateRange** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Time** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Picture Input** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Audio** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Video** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Document** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Map** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **PolygonBoundary** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **QRCode** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Rating** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |
| **Repeater_QT** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Clean |

---

## 6. Responsive Findings

| Viewport Dimensions | Target Device Class | Observed Behavior | Responsive Issues Identified |
| :--- | :--- | :--- | :--- |
| **1440 × 900** | Desktop Standard | Clean 3-pane layout; split-pane resizer functional; balanced typography. | None. |
| **1280 × 800** | Laptop / Small Desktop | Layout remains proportional; editor tabs wrap cleanly without horizontal scroll. | None. |
| **1024 × 768** | Tablet Landscape | Tree width contracts; resizer clamps smoothly at minimum width (`260px`). | None. |
| **768 × 1024** | Tablet Portrait | Question list panel is hidden (`hidden md:flex`). No mobile drawer provided to select questions. | `RESP-001` (P1 Critical) |
| **390 × 844** | Mobile (iPhone / Android) | Question Creation Modal overflows horizontally (`min-w-[720px]`). Primary action button clipped. | `RESP-002` (P2 Major), `RESP-001` |

---

## 7. Accessibility Findings (WCAG 2.2 Level A / AA)

| Success Criterion | Principle | Status | Finding Reference | Description & Evidence |
| :--- | :--- | :---: | :---: | :--- |
| **1.4.3 Contrast (Minimum)** | Perceivable | **FAIL** | `A11Y-003` | Helper text using `text-zinc-400` yields 3.01:1 contrast ratio against white (AA requires 4.5:1). |
| **1.4.10 Reflow** | Perceivable | **FAIL** | `RESP-002` | Question Creation Modal at `390px` width forces horizontal scrolling to reach primary actions. |
| **2.1.1 Keyboard** | Operable | **FAIL** | `A11Y-001` | Question list tree nodes cannot be navigated or selected via keyboard (`ArrowUp`/`ArrowDown`/`Space`). |
| **2.4.7 Focus Visible** | Operable | **PARTIAL** | `A11Y-001` | Active question card shows selection styling but lacks a standard `:focus-visible` outline ring when focused via keyboard. |
| **4.1.2 Name, Role, Value** | Robust | **FAIL** | `A11Y-001`, `A11Y-002` | Tree nodes lack ARIA tree attributes; inline icon-only action buttons lack accessible names. |

---

## 8. Design-System Findings

1. **Duplicate Question Type Selector Components (`DS-001`)**:
   - `question-selector-modal.tsx`, `add-question-popover.tsx`, and `change-type-dialog.tsx` implement separate question selection grids with divergent search algorithms and category tabs.
2. **Inconsistent Button Sizing Scale (`DS-002`)**:
   - Toolbars across Header, Table View, and Editor use mixed heights (`h-7`, `h-8`, `h-9`) without consistent semantic size tokens.
3. **Card Container Token Divergence (`UI-001`)**:
   - Card padding alternates between `p-3.5` and `p-5`, and corner radii alternate between `rounded-lg` and `rounded-xl` across sub-settings.
4. **Hardcoded Color Tokens**:
   - Occasional use of non-standard border shades (`border-zinc-150`) instead of standard Tailwind tokens (`border-zinc-200`).

---

## 9. Information Architecture Findings

1. **Disconnected Parent Context and Logic Rules (`UX-001`)**:
   - Follow-up question trigger context is displayed in a passive banner at the top of the editor, while custom visibility conditions live in the `Logic` tab. The relationship between parent trigger logic and child visibility rules is not unified in the UI.
2. **Opaque Cascade Deletion (`UX-002`)**:
   - When deleting a question with child follow-ups, the deletion confirmation modal does not list the descendant questions that will be deleted.
3. **Hidden Master Data Records (`UX-003`)**:
   - Selecting a cascading master dataset provides no inline sample browser inside the `Options` tab.

---

## 10. Data & Schema Findings

1. **Dual Schema Serialization (`SCHEMA-001`)**:
   - Exported JSON contains both normalized hierarchy keys (`parentQuestionId`, `parentOptionValue`, `followUpDepth`) and legacy keys (`Parent_Dep`, `Opt_Dep`, `Qn_In`), creating potential divergence risks if edited externally.
2. **Option Score Discard in Bulk Edit (`FUNC-001`)**:
   - Bulk option editing re-indexes labels and defaults scores to `0`, discarding pre-existing scoring configurations.
3. **Option-Level Change Log Granularity (`AUDIT-001`)**:
   - Version diff engine summarizes option modifications at the array level (`Field 'options' modified`) rather than reporting specific label and value changes.

---

## 11. Version Isolation Findings (V1.0 vs V1.1)

* **State Isolation**: Verified. V1.1 state is managed independently within `src/app/layouts/survey-builder-simplified/` and persisted under scoped keys (`simplified_survey_v1_1_*`).
* **Route Isolation**: Verified. V1.1 is mounted at `/survey-builder-simplified`, leaving `/survey-builder` untouched.
* **Component Sharing**: V1.1 only imports shared generic UI primitives from `@/components/ui/` (`button`, `input`, `dialog`, `badge`, `popover`, `tabs`, `switch`, `tooltip`). No V1.0-specific domain components are imported.
* **Conclusion**: Zero risk of state or behavioral contamination to Survey Builder V1.0.

---

## 12. Regression Findings

If future changes are applied to V1.1, the following areas require strict regression testing:

1. **Dynamic Follow-Up Rail Calculation**: Changing tree item padding or indentation may misalign the calculated multi-column SVG connector rails in `question-list-panel.tsx`.
2. **Runtime Logic Engine**: Adjusting visibility schema or parent trigger serialization must be verified against `logic-evaluator.ts` in `preview-runtime.tsx`.
3. **Table View Inline Editing**: Modifying question type schemas must ensure `survey-table-view.tsx` column filters and cell renderers remain synchronized.

---

## 13. Recommended Changes (Grouped by Finding IDs)

### CHANGE GROUP A — Mobile & Responsive Resilience
* **Associated Findings:** `RESP-001`, `RESP-002`, `UI-002`
* **Recommendation:**
  1. Add a mobile drawer trigger in `survey-header.tsx` to open `QuestionListPanel` on `< md` viewports.
  2. Apply responsive modal classes (`max-w-[95vw] md:max-w-4xl`) and scrollable containers to `question-selector-modal.tsx`.

### CHANGE GROUP B — Accessibility & WCAG Conformance
* **Associated Findings:** `A11Y-001`, `A11Y-002`, `A11Y-003`
* **Recommendation:**
  1. Implement ARIA tree semantics (`role="treeitem"`, `aria-selected`, `aria-level`) and arrow key navigation in `question-list-item.tsx`.
  2. Add `aria-label` attributes to all icon-only action buttons.
  3. Upgrade muted text tokens from `text-zinc-400` to `text-zinc-500`/`text-zinc-600`.

### CHANGE GROUP C — Usability & Authoring Safety
* **Associated Findings:** `UX-001`, `UX-002`, `FUNC-001`, `VAL-001`
* **Recommendation:**
  1. In `logic-tab.tsx`, display a read-only "Parent Follow-Up Trigger" banner to clarify compound rule evaluation.
  2. In `delete-question-dialog.tsx`, render an expandable list of all descendant questions targeted for cascade deletion.
  3. Preserve existing option scores during bulk option edits in `options-tab.tsx`.
  4. Add immediate inline validation in `validation-tab.tsx` when `MaxValue < MinValue`.

### CHANGE GROUP D — Design System Consolidation
* **Associated Findings:** `DS-001`, `DS-002`, `UI-001`, `COPY-001`
* **Recommendation:**
  1. Extract a shared `<QuestionTypeGrid />` component for use across `question-selector-modal.tsx`, `add-question-popover.tsx`, and `change-type-dialog.tsx`.
  2. Standardize button sizing tokens across Header, Table View, and Editor.
  3. Standardize copy from "Mandatory" to "Required".

### CHANGE GROUP E — Localization & Audit Trail Polish
* **Associated Findings:** `I18N-001`, `I18N-002`, `AUDIT-001`, `SCHEMA-001`
* **Recommendation:**
  1. Include custom validation error messages in `translation-tab.tsx`.
  2. Inject `dir="rtl"` in `preview-runtime.tsx` when previewing Arabic/Hebrew.
  3. Drill down into option label changes in `version-diff-engine.ts`.
  4. Separate canonical JSON export from legacy schema adapters.

---

## 14. User-Selectable Change List

You may select specific findings or groups to fix by replying with the corresponding IDs:

- [ ] `RESP-001` — Question List hidden on `< 768px` viewports without mobile drawer (Severity: P1, Scope: Medium)
- [ ] `RESP-002` — Question Creation Modal horizontal overflow at `390px` (Severity: P2, Scope: Small)
- [ ] `A11Y-001` — Question tree missing ARIA roles and keyboard navigation (Severity: P1, Scope: Medium)
- [ ] `A11Y-002` — Icon-only toolbar buttons missing `aria-label` (Severity: P2, Scope: Small)
- [ ] `A11Y-003` — Muted helper text fails WCAG AA contrast ratio (Severity: P2, Scope: Small)
- [ ] `FUNC-001` — Bulk option editing silently resets option scores to 0 (Severity: P2, Scope: Small)
- [ ] `UX-001` — Logic tab does not display parent follow-up trigger context (Severity: P2, Scope: Small)
- [ ] `UX-002` — Delete confirmation modal does not list descendant questions (Severity: P2, Scope: Small)
- [ ] `UX-003` — Master dataset records cannot be previewed in Options tab (Severity: P3, Scope: Medium)
- [ ] `VAL-001` — Number Min/Max inversion lacks immediate inline error state (Severity: P2, Scope: Small)
- [ ] `VAL-002` — Regex tester reports green match for empty pattern (Severity: P3, Scope: Small)
- [ ] `I18N-001` — Custom validation error messages omitted from Translation tab (Severity: P2, Scope: Small)
- [ ] `I18N-002` — Runtime Preview radio indicators not mirrored for RTL languages (Severity: P3, Scope: Small)
- [ ] `DS-001` — Duplicate Question Type picker implementations across 3 components (Severity: P2, Scope: Medium)
- [ ] `DS-002` — Inconsistent button height tokens (`h-7`, `h-8`, `h-9`) in toolbars (Severity: P3, Scope: Small)
- [ ] `UI-001` — Inconsistent card padding and border radius in editor tabs (Severity: P3, Scope: Small)
- [ ] `UI-002` — Step 2 Question Creation Modal asymmetric vertical spacing (Severity: P3, Scope: Small)
- [ ] `UI-003` — Multi-line title wrap misaligns tree node badges (Severity: P4, Scope: Small)
- [ ] `SCHEMA-001` — Serializer maintains dual legacy and normalized hierarchy fields (Severity: P2, Scope: Medium)
- [ ] `VERSION-001` — Rapid auto-saves create duplicate micro-versions (Severity: P3, Scope: Small)
- [ ] `AUDIT-001` — Change Log outputs generic array diffs for option modifications (Severity: P3, Scope: Small)
- [ ] `PERF-001` — Question tree items re-render on every keystroke in editor (Severity: P3, Scope: Small)
- [ ] `COPY-001` — Inconsistent "Mandatory" vs "Required" terminology (Severity: P4, Scope: Small)

---

## 15. Suggested Technical Dependency Groups

* **Dependency Group 1 (Navigation & Tree Structure):**
  * `A11Y-001`, `RESP-001`, `PERF-001`, `UI-003`
  * *Reasoning:* These all touch `question-list-panel.tsx` and `question-list-item.tsx`.
* **Dependency Group 2 (Question Selection & Creation Flow):**
  * `DS-001`, `RESP-002`, `UI-002`, `COPY-001`
  * *Reasoning:* These touch `question-selector-modal.tsx`, `add-question-popover.tsx`, and `change-type-dialog.tsx`.
* **Dependency Group 3 (Editor Tabs, Validation & Logic):**
  * `UX-001`, `VAL-001`, `FUNC-001`, `I18N-001`, `UI-001`
  * *Reasoning:* These touch `basic-settings-tab.tsx`, `options-tab.tsx`, `validation-tab.tsx`, `logic-tab.tsx`, and `translation-tab.tsx`.
* **Dependency Group 4 (A11y Tokens & Microcopy):**
  * `A11Y-002`, `A11Y-003`, `DS-002`
  * *Reasoning:* Low-risk CSS token and ARIA attribute updates across toolbar and label components.

---

## 16. Test Coverage Gaps

1. **Responsive Viewport Automation**:
   - `test-runner.ts` executes comprehensive unit and schema tests (27 categories passing), but lacks viewport reflow tests at `768px` and `390px`.
2. **Keyboard Navigation Integration**:
   - Missing automated tests asserting `ArrowDown`/`ArrowUp` keyboard traversal through nested follow-up trees.
3. **RTL Rendering Verification**:
   - Missing automated tests validating DOM layout mirroring when preview language is set to `ar` or `he`.

---

## 17. Final Audit Status

```
============================================================
AUDIT COMPLETE
NO CHANGES MADE
============================================================
```

*Existing application code, styles, tests, and configuration remain completely unmodified. Awaiting your selection of finding IDs or groups to proceed with implementation.*
