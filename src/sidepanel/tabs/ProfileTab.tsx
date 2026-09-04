import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  GraduationCap,
  Sparkles,
  Briefcase,
  Award,
  BookOpen,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  Trash2,
  RotateCcw,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Save,
  X,
} from "lucide-react";
import {
  ProfileImport,
  ProfileSource,
  UserProfile,
  SkillRating as SkillRatingValue,
  createEmptyProfile,
} from "../../types/profile";
import { Resume } from "../../types/resume";
import {
  checkProfileCompleteness,
  PROFILE_MIN_SKILLS,
  profileStorage,
  resumeToProfileImport,
  parseLinkedInExportFiles,
} from "../../services/profile";
import { LinkedInImportResult } from "../../background/linkedinImport";
import { BasicsForm } from "../../components/profile/BasicsForm";
import {
  EducationForm,
  educationEntryErrors,
  DEGREE_LEVEL_OPTIONS,
} from "../../components/profile/EducationForm";
import {
  ExperienceForm,
  experienceEntryErrors,
  EXPERIENCE_TYPE_OPTIONS,
} from "../../components/profile/ExperienceForm";
import { CertificationForm } from "../../components/profile/CertificationForm";
import { StoryForm } from "../../components/profile/StoryForm";
import {
  SkillPicker,
  sortSkillsByRating,
} from "../../components/profile/SkillPicker";
import { SkillRating } from "../../components/profile/SkillRating";
import { CompletenessBar } from "../../components/profile/CompletenessBar";
import { ImportRow, ImportStatus } from "../../components/profile/ImportRow";
import {
  primaryButtonClass,
  secondaryButtonClass,
  ghostButtonClass,
  dangerButtonClass,
  sectionTitleClass,
  errorTextClass,
  hintTextClass,
} from "../../components/profile/fieldStyles";

export interface ProfileTabProps {
  profile: UserProfile | null;
  resumes: Resume[];
  /** Called after ProfileTab has persisted a change via profileStorage. */
  onProfileSaved: (profile: UserProfile) => void;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type StepKey =
  | "basics"
  | "education"
  | "skills"
  | "experiences"
  | "certifications"
  | "story"
  | "review";

const STEPS: {
  key: StepKey;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  optional?: boolean;
}[] = [
  {
    key: "basics",
    title: "Basics",
    description: "How employers reach you.",
    icon: User,
  },
  {
    key: "education",
    title: "Education",
    description: "Schools and your graduating class.",
    icon: GraduationCap,
  },
  {
    key: "skills",
    title: "Skills",
    description: "Rate what you know from 1 (familiar) to 5 (expert).",
    icon: Sparkles,
  },
  {
    key: "experiences",
    title: "Experience",
    description: "Jobs, internships, research and projects.",
    icon: Briefcase,
  },
  {
    key: "certifications",
    title: "Certifications",
    description: "Optional, but they boost fit for some roles.",
    icon: Award,
    optional: true,
  },
  {
    key: "story",
    title: "Your story",
    description: "What you want next and why.",
    icon: BookOpen,
    optional: true,
  },
  {
    key: "review",
    title: "Review",
    description: "Check everything before finishing.",
    icon: ClipboardCheck,
  },
];

type SectionKey = Exclude<StepKey, "review">;

function hasText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Requirements still unmet on a single step, in display order. */
function stepIssues(step: StepKey, profile: UserProfile): string[] {
  switch (step) {
    case "basics":
      return hasText(profile.contact.name) ? [] : ["Add your name"];
    case "education": {
      if (profile.education.length === 0)
        return [
          "Add at least one education entry with a school and graduating year",
        ];
      const issues: string[] = [];
      profile.education.forEach((entry, idx) => {
        const errors = educationEntryErrors(entry);
        if (errors.institution)
          issues.push(
            `Education ${idx + 1}: ${errors.institution.toLowerCase()}`,
          );
        if (errors.graduationYear)
          issues.push(
            `Education ${idx + 1}: ${errors.graduationYear.toLowerCase()}`,
          );
      });
      return issues;
    }
    case "skills": {
      const count = profile.skills.filter((s) => hasText(s.name)).length;
      if (count >= PROFILE_MIN_SKILLS) return [];
      return [
        count === 0
          ? `Add at least ${PROFILE_MIN_SKILLS} skills`
          : `Add at least ${PROFILE_MIN_SKILLS} skills (you have ${count})`,
      ];
    }
    case "experiences": {
      if (profile.experiences.length === 0)
        return [
          "Add at least one experience or project",
        ];
      const issues: string[] = [];
      profile.experiences.forEach((entry, idx) => {
        const errors = experienceEntryErrors(entry);
        const parts = [errors.company, errors.title].filter(Boolean);
        if (parts.length > 0)
          issues.push(
            `${entry.type === 'project' ? 'Project' : 'Experience'} ${idx + 1}: ${parts.join(", ").toLowerCase()}`,
          );
      });
      return issues;
    }
    case "certifications":
    case "story":
      return [];
    case "review":
      return checkProfileCompleteness(profile).missing;
  }
}

function firstIncompleteStep(profile: UserProfile): number {
  const idx = STEPS.findIndex(
    (s) => s.key !== "review" && stepIssues(s.key, profile).length > 0,
  );
  return idx === -1 ? STEPS.length - 1 : idx;
}

/** Trims text and drops entries that are entirely blank before persisting. */
function cleanProfile(profile: UserProfile): UserProfile {
  const trim = (v: string | undefined) =>
    typeof v === "string" ? v.trim() : v;
  return {
    ...profile,
    contact: {
      ...profile.contact,
      name: profile.contact.name.trim(),
      email: trim(profile.contact.email),
      phone: trim(profile.contact.phone),
      location: trim(profile.contact.location),
      linkedinUrl: trim(profile.contact.linkedinUrl),
      github: trim(profile.contact.github),
      website: trim(profile.contact.website),
    },
    education: profile.education.map((e) => ({
      ...e,
      institution: e.institution.trim(),
    })),
    skills: profile.skills
      .filter((s) => hasText(s.name))
      .map((s) => ({ ...s, name: s.name.trim() })),
    experiences: profile.experiences.map((x) => ({
      ...x,
      company: x.company.trim(),
      title: x.title.trim(),
      bullets: x.bullets.map((b) => b.trim()).filter(Boolean),
    })),
    certifications: profile.certifications
      .filter((c) => hasText(c.name))
      .map((c) => ({ ...c, name: c.name.trim() })),
    story: { ...profile.story, summary: profile.story.summary.trim() },
  };
}

function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function summarizeImport(imp: ProfileImport): string {
  const parts = [
    plural(imp.experiences?.length || 0, "experience"),
    plural(imp.education?.length || 0, "school"),
    plural(imp.skills?.length || 0, "skill"),
  ];
  if (imp.certifications?.length)
    parts.push(plural(imp.certifications.length, "certification"));
  return `Imported ${parts.join(", ")}.`;
}

function importHasData(imp: ProfileImport): boolean {
  return (
    (imp.experiences?.length || 0) > 0 ||
    (imp.education?.length || 0) > 0 ||
    (imp.skills?.length || 0) > 0 ||
    (imp.certifications?.length || 0) > 0 ||
    Object.keys(imp.contact || {}).length > 0
  );
}

const SOURCE_LABELS: Record<ProfileSource["kind"], string> = {
  manual: "Entered manually",
  resume: "Imported from resume",
  linkedin_page: "Imported from LinkedIn",
  linkedin_export: "Imported from LinkedIn data export",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function openUrl(url: string): void {
  if (
    typeof chrome !== "undefined" &&
    chrome.tabs &&
    typeof chrome.tabs.create === "function"
  ) {
    void chrome.tabs.create({ url, active: true });
  } else if (
    typeof window !== "undefined" &&
    typeof window.open === "function"
  ) {
    window.open(url, "_blank", "noopener");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  resumes,
  onProfileSaved,
}) => {
  const [draft, setDraft] = useState<UserProfile>(
    () => profile ?? createEmptyProfile(),
  );
  // null = follow completeness; true/false = user (or wizard flow) pinned the mode.
  const [wizardPinned, setWizardPinned] = useState<boolean | null>(null);
  const [step, setStep] = useState<number>(() =>
    profile ? firstIncompleteStep(profile) : 0,
  );
  const [touchedSteps, setTouchedSteps] = useState<Set<StepKey>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    kind: "idle",
  });
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const snapshotRef = useRef<UserProfile | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Adopt a profile the parent loaded elsewhere, but ignore the echo of our own save.
  useEffect(() => {
    if (!profile) return;
    setDraft((current) =>
      current.id === profile.id && current.updatedAt === profile.updatedAt
        ? current
        : profile,
    );
  }, [profile]);

  const completeness = useMemo(() => checkProfileCompleteness(draft), [draft]);
  const mode: "wizard" | "editor" =
    wizardPinned === null
      ? completeness.isComplete
        ? "editor"
        : "wizard"
      : wizardPinned
        ? "wizard"
        : "editor";

  const skillNames = useMemo(
    () => sortSkillsByRating(draft.skills).map((s) => s.name),
    [draft.skills],
  );

  // ---- persistence ---------------------------------------------------------

  const persist = async (next: UserProfile): Promise<UserProfile | null> => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await profileStorage.saveProfile(cleanProfile(next));
      if (mountedRef.current) setDraft(saved);
      onProfileSaved(saved);
      return saved;
    } catch (err) {
      if (mountedRef.current)
        setSaveError(
          err instanceof Error ? err.message : "Could not save your profile.",
        );
      return null;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const updateDraft = (patch: Partial<UserProfile>, stepKey?: StepKey) => {
    setDraft((current) => ({ ...current, ...patch }));
    // An edit inside the wizard keeps the wizard open even if it makes the profile complete.
    if (mode === "wizard" && wizardPinned === null) setWizardPinned(true);
    if (stepKey) {
      setTouchedSteps((current) => {
        if (current.has(stepKey)) return current;
        const next = new Set(current);
        next.add(stepKey);
        return next;
      });
    }
  };

  // ---- imports -------------------------------------------------------------

  const applyImport = async (
    imp: ProfileImport,
    options?: { resumeId?: string },
  ) => {
    // Keep unsaved wizard edits: save the draft first so mergeImport merges into it.
    await profileStorage.saveProfile(cleanProfile(draft));
    const saved = await profileStorage.mergeImport(imp, options);
    if (mountedRef.current) {
      setDraft(saved);
      setImportStatus({
        kind: "success",
        message: summarizeImport(imp),
        warnings: imp.warnings || [],
      });
      if (mode === "wizard") setWizardPinned(true);
    }
    onProfileSaved(saved);
  };

  const handleImportLinkedIn = async () => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      setImportStatus({
        kind: "error",
        message: "LinkedIn import is only available inside the extension.",
        warnings: [],
      });
      return;
    }
    setImportStatus({
      kind: "busy",
      source: "linkedin",
      message: "Opening your LinkedIn profile in a new tab…",
    });
    try {
      const result = (await chrome.runtime.sendMessage({
        type: "IMPORT_LINKEDIN_PROFILE",
      })) as LinkedInImportResult | undefined;
      if (!result || !result.success || !result.profile) {
        setImportStatus({
          kind: "error",
          message: result?.error || "LinkedIn import failed.",
          warnings: [],
        });
        return;
      }
      await applyImport(result.profile);
    } catch (err) {
      setImportStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "LinkedIn import failed.",
        warnings: [],
      });
    }
  };

  const handleImportResume = async (resumeId: string) => {
    const resume = resumes.find((r) => r.id === resumeId);
    if (!resume) {
      setImportStatus({
        kind: "error",
        message: "That resume is no longer available.",
        warnings: [],
      });
      return;
    }
    setImportStatus({
      kind: "busy",
      source: "resume",
      message: `Reading ${resume.name}…`,
    });
    try {
      const imp = resumeToProfileImport(resume);
      await applyImport(imp, { resumeId: resume.id });
    } catch (err) {
      setImportStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not import that resume.",
        warnings: [],
      });
    }
  };

  const handleImportExportFiles = async (files: File[]) => {
    setImportStatus({
      kind: "busy",
      source: "export",
      message: `Reading ${plural(files.length, "file")}…`,
    });
    try {
      const texts = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          text: await file.text(),
        })),
      );
      const imp = parseLinkedInExportFiles(texts);
      if (!importHasData(imp)) {
        setImportStatus({
          kind: "error",
          message:
            "No profile data was found in those files. Pick the CSVs from your LinkedIn export.",
          warnings: imp.warnings || [],
        });
        return;
      }
      await applyImport(imp);
    } catch (err) {
      setImportStatus({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not read those files.",
        warnings: [],
      });
    }
  };

  // ---- wizard --------------------------------------------------------------

  const current = STEPS[step];
  const issues = stepIssues(current.key, draft);
  const stepValid = issues.length === 0;
  const showValidation = touchedSteps.has(current.key);

  const goNext = async () => {
    if (!stepValid || saving) return;
    setWizardPinned(true);
    const saved = await persist(draft);
    if (saved && mountedRef.current)
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = async () => {
    if (!completeness.isComplete || saving) return;
    const saved = await persist(draft);
    if (saved && mountedRef.current) {
      setWizardPinned(false);
      setEditingSection(null);
    }
  };

  const rerunWizard = () => {
    setStep(0);
    setEditingSection(null);
    setWizardPinned(true);
  };

  // ---- editor --------------------------------------------------------------

  const startEdit = (section: SectionKey) => {
    snapshotRef.current = draft;
    setEditingSection(section);
  };

  const cancelEdit = () => {
    if (snapshotRef.current) setDraft(snapshotRef.current);
    snapshotRef.current = null;
    setEditingSection(null);
  };

  const saveEdit = async () => {
    const saved = await persist(draft);
    if (saved && mountedRef.current) {
      snapshotRef.current = null;
      setEditingSection(null);
    }
  };

  const rateSkillInline = async (id: string, rating: SkillRatingValue) => {
    const next = {
      ...draft,
      skills: draft.skills.map((s) => (s.id === id ? { ...s, rating } : s)),
    };
    setDraft(next);
    await persist(next);
  };

  const clearProfile = async () => {
    setSaving(true);
    try {
      await profileStorage.clearProfile();
      const empty = await profileStorage.saveProfile(createEmptyProfile());
      if (mountedRef.current) {
        setDraft(empty);
        setConfirmClear(false);
        setEditingSection(null);
        setTouchedSteps(new Set());
        setImportStatus({ kind: "idle" });
        setStep(0);
        setWizardPinned(true);
      }
      onProfileSaved(empty);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ---- shared renderers ----------------------------------------------------

  const renderSectionForm = (section: SectionKey, showErrors: boolean) => {
    switch (section) {
      case "basics":
        return (
          <BasicsForm
            contact={draft.contact}
            onChange={(contact) => updateDraft({ contact }, "basics")}
            showValidation={showErrors}
          />
        );
      case "education":
        return (
          <EducationForm
            entries={draft.education}
            onChange={(education) => updateDraft({ education }, "education")}
            showValidation={showErrors}
          />
        );
      case "skills":
        return (
          <SkillPicker
            skills={draft.skills}
            onChange={(skills) => updateDraft({ skills }, "skills")}
            showMinimumHint={mode === "wizard"}
          />
        );
      case "experiences":
        return (
          <ExperienceForm
            entries={draft.experiences}
            onChange={(experiences) =>
              updateDraft({ experiences }, "experiences")
            }
            skillSuggestions={skillNames}
            showValidation={showErrors}
          />
        );
      case "certifications":
        return (
          <CertificationForm
            entries={draft.certifications}
            onChange={(certifications) =>
              updateDraft({ certifications }, "certifications")
            }
          />
        );
      case "story":
        return (
          <StoryForm
            story={draft.story}
            onChange={(story) => updateDraft({ story }, "story")}
          />
        );
    }
  };

  const importRow = (
    <ImportRow
      resumes={resumes}
      status={importStatus}
      onImportLinkedIn={handleImportLinkedIn}
      onImportResume={handleImportResume}
      onImportExportFiles={handleImportExportFiles}
      onOpenUrl={openUrl}
      onDismissStatus={() => setImportStatus({ kind: "idle" })}
    />
  );

  const saveErrorBanner = saveError && (
    <div
      className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"
      data-testid="profile-save-error"
    >
      {saveError}
    </div>
  );

  // ---- wizard view ---------------------------------------------------------

  if (mode === "wizard") {
    const Icon = current.icon;
    const isReview = current.key === "review";
    return (
      <div data-testid="profile-tab" className="space-y-4 pb-8">
        <div
          className="space-y-4"
          data-testid="profile-wizard"
          data-step={current.key}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" />
            <h2 className="text-xs font-semibold text-white tracking-tight">
              Set up your Candidate Profile
            </h2>
          </div>
          <p className="text-[11px] text-surface-400 leading-relaxed -mt-2">
            Best Fit %, tailoring and autofill all read from this profile.
            Everything stays in your browser.
          </p>

          <CompletenessBar completeness={completeness} />

          {importRow}

          {/* Step indicator */}
          <ol className="flex items-center gap-1" aria-label="Wizard steps">
            {STEPS.map((s, idx) => {
              const done = idx < step;
              const active = idx === step;
              return (
                <li key={s.key} className="flex-1">
                  <button
                    type="button"
                    data-testid={`wizard-step-${s.key}`}
                    aria-current={active ? "step" : undefined}
                    title={s.title}
                    disabled={idx > step && !stepValid}
                    onClick={() => {
                      if (idx <= step || stepValid) setStep(idx);
                    }}
                    className={`w-full h-1.5 rounded-full transition-colors ${
                      active
                        ? "bg-brand-400"
                        : done
                          ? "bg-brand-700"
                          : "bg-surface-800"
                    } disabled:cursor-not-allowed`}
                  />
                </li>
              );
            })}
          </ol>

          <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Icon className="w-4 h-4 text-brand-400" />
                  <span>
                    {current.title}
                    {current.optional && (
                      <span className="ml-1.5 text-[10px] font-mono text-surface-500">
                        optional
                      </span>
                    )}
                  </span>
                </div>
                <p className={`${hintTextClass} mt-0.5`}>
                  {current.description}
                </p>
              </div>
              <span className="text-[10px] font-mono text-surface-500 shrink-0">
                Step {step + 1} / {STEPS.length}
              </span>
            </div>

            {isReview ? (
              <div className="space-y-3" data-testid="wizard-review">
                <CompletenessBar completeness={completeness} showDetails />
                <ReviewSummary profile={draft} />
              </div>
            ) : (
              renderSectionForm(current.key as SectionKey, showValidation)
            )}

            {!stepValid && (
              <ul
                className="space-y-0.5 pt-1 border-t border-surface-800"
                data-testid="wizard-step-issues"
              >
                {issues.map((issue) => (
                  <li key={issue} className={errorTextClass}>
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            )}

            {saveErrorBanner}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="wizard-back"
              onClick={goBack}
              disabled={step === 0 || saving}
              className={secondaryButtonClass}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              {current.optional && (
                <button
                  type="button"
                  data-testid="wizard-skip"
                  onClick={() =>
                    setStep((s) => Math.min(STEPS.length - 1, s + 1))
                  }
                  disabled={saving}
                  className={ghostButtonClass}
                >
                  Skip
                </button>
              )}
              {isReview ? (
                <button
                  type="button"
                  data-testid="wizard-finish"
                  onClick={finish}
                  disabled={!completeness.isComplete || saving}
                  className={primaryButtonClass}
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? "Saving…" : "Finish"}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="wizard-next"
                  onClick={goNext}
                  disabled={!stepValid || saving}
                  className={primaryButtonClass}
                >
                  {saving ? "Saving…" : "Next"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- editor view ---------------------------------------------------------

  const sectionCard = (
    section: SectionKey,
    title: string,
    Icon: React.FC<{ className?: string }>,
    view: React.ReactNode,
  ) => {
    const editing = editingSection === section;
    return (
      <div
        className={`rounded-xl border transition-all ${
          editing
            ? "border-brand-500/50 bg-surface-900/90"
            : "border-surface-800 bg-surface-900/50"
        }`}
        data-testid={`section-${section}`}
      >
        <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-brand-400" />
            {title}
          </span>
          {editing ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid={`cancel-${section}`}
                onClick={cancelEdit}
                disabled={saving}
                className={ghostButtonClass}
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                type="button"
                data-testid={`save-${section}`}
                onClick={saveEdit}
                disabled={saving}
                className={primaryButtonClass}
              >
                <Save className="w-3 h-3" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid={`edit-${section}`}
              onClick={() => startEdit(section)}
              disabled={editingSection !== null}
              className={ghostButtonClass}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
        <div className="px-3.5 pb-3.5">
          {editing ? renderSectionForm(section, true) : view}
        </div>
      </div>
    );
  };

  const c = draft.contact;
  const contactLines: {
    icon: React.FC<{ className?: string }>;
    value?: string;
  }[] = [
    { icon: Mail, value: c.email },
    { icon: Phone, value: c.phone },
    { icon: MapPin, value: c.location },
    { icon: Linkedin, value: c.linkedinUrl },
    { icon: Github, value: c.github },
    { icon: Globe, value: c.website },
  ];

  return (
    <div data-testid="profile-tab" className="space-y-4 pb-8">
      <div className="space-y-4" data-testid="profile-editor">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-4 h-4 text-brand-400 shrink-0" />
            <h2 className="text-xs font-semibold text-white tracking-tight truncate">
              {draft.contact.name || "Candidate Profile"}
            </h2>
          </div>
          <span
            data-testid="completeness-badge"
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
              completeness.isComplete
                ? "bg-brand-500/10 text-brand-300 border-brand-500/30"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
            }`}
          >
            Completeness{" "}
            <span data-testid="completeness-score">{completeness.score}%</span>
          </span>
        </div>

        {!completeness.isComplete && (
          <CompletenessBar completeness={completeness} showDetails />
        )}

        {importRow}
        {saveErrorBanner}

        {sectionCard(
          "basics",
          "Basics",
          User,
          <div className="space-y-1">
            <div className="text-xs text-surface-200 font-medium">
              {c.name || <span className="text-surface-500">No name</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-surface-400">
              {contactLines
                .filter((line) => hasText(line.value))
                .map((line, idx) => {
                  const LineIcon = line.icon;
                  return (
                    <span key={idx} className="flex items-center gap-1 min-w-0">
                      <LineIcon className="w-3 h-3 text-brand-400 shrink-0" />
                      <span className="truncate">{line.value}</span>
                    </span>
                  );
                })}
            </div>
          </div>,
        )}

        {sectionCard(
          "education",
          "Education",
          GraduationCap,
          draft.education.length === 0 ? (
            <p className={hintTextClass}>No education yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {draft.education.map((e) => (
                <li key={e.id} className="text-[11px] text-surface-300">
                  <span className="font-medium text-surface-200">
                    {e.institution}
                  </span>
                  {(e.degree || e.fieldOfStudy) && (
                    <span>
                      {" "}
                      —{" "}
                      {[
                        e.degree ||
                          DEGREE_LEVEL_OPTIONS.find(
                            (o) => o.value === e.degreeLevel,
                          )?.label,
                        e.fieldOfStudy,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  <span className="text-surface-500 font-mono">
                    {" "}
                    · {e.status === "in_progress"
                      ? "Class of"
                      : "Graduated"}{" "}
                    {e.graduationYear ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          ),
        )}

        {sectionCard(
          "skills",
          `Skills (${draft.skills.length})`,
          Sparkles,
          draft.skills.length === 0 ? (
            <p className={hintTextClass}>No skills yet.</p>
          ) : (
            <div className="space-y-1.5">
              <ul
                className="flex flex-wrap gap-1.5"
                data-testid="editor-skill-list"
              >
                {sortSkillsByRating(draft.skills).map((s) => (
                  <li
                    key={s.id}
                    data-testid={`skill-chip-${s.name}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-950 border border-surface-800"
                  >
                    <span className="text-[11px] text-surface-200">
                      {s.name}
                    </span>
                    <SkillRating
                      skill={s.name}
                      value={s.rating}
                      onChange={(r) => void rateSkillInline(s.id, r)}
                      disabled={saving}
                    />
                  </li>
                ))}
              </ul>
              <p className={hintTextClass}>
                Click the dots to re-rate a skill; changes save instantly.
              </p>
            </div>
          ),
        )}

        {sectionCard(
          "experiences",
          `Experience (${draft.experiences.length})`,
          Briefcase,
          draft.experiences.length === 0 ? (
            <p className={hintTextClass}>No experiences yet.</p>
          ) : (
            <ul className="space-y-2">
              {draft.experiences.map((x) => (
                <li key={x.id} className="text-[11px]">
                  <div className="text-surface-200 font-medium">
                    {x.title}
                    {x.company ? (
                      <>
                        {" "}
                        <span className="text-surface-500">·</span>{" "}
                        <span className="text-brand-300">{x.company}</span>
                      </>
                    ) : null}
                    {x.type && (
                      <span className="ml-1.5 text-[10px] font-mono text-surface-500">
                        {
                          EXPERIENCE_TYPE_OPTIONS.find(
                            (o) => o.value === x.type,
                          )?.label
                        }
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-surface-500 font-mono">
                    {[x.startDate, x.isCurrent ? "Present" : x.endDate]
                      .filter(Boolean)
                      .join(" – ")}
                    {x.location ? ` · ${x.location}` : ""}
                  </div>
                  {x.bullets.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {x.bullets.slice(0, 3).map((b, idx) => (
                        <li
                          key={idx}
                          className="text-surface-400 leading-snug flex items-start gap-1"
                        >
                          <span className="text-surface-600">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                      {x.bullets.length > 3 && (
                        <li className="text-surface-600">
                          +{x.bullets.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ),
        )}

        {sectionCard(
          "certifications",
          `Certifications (${draft.certifications.length})`,
          Award,
          draft.certifications.length === 0 ? (
            <p className={hintTextClass}>None added.</p>
          ) : (
            <ul className="space-y-1">
              {draft.certifications.map((cert) => (
                <li key={cert.id} className="text-[11px] text-surface-300">
                  <span className="text-surface-200 font-medium">
                    {cert.name}
                  </span>
                  {cert.issuer && (
                    <span className="text-surface-500"> · {cert.issuer}</span>
                  )}
                  {cert.issuedYear && (
                    <span className="text-surface-500 font-mono">
                      {" "}
                      · {cert.issuedYear}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ),
        )}

        {sectionCard(
          "story",
          "Your story",
          BookOpen,
          <div className="space-y-1.5 text-[11px]">
            {draft.story.summary ? (
              <p className="text-surface-300 leading-relaxed">
                {draft.story.summary}
              </p>
            ) : (
              <p className={hintTextClass}>No summary yet.</p>
            )}
            <StoryTags label="Drives" tags={draft.story.drives} />
            <StoryTags label="Target roles" tags={draft.story.targetRoles} />
            <StoryTags label="Industries" tags={draft.story.targetIndustries} />
            <div className="text-surface-500">
              {draft.story.remotePreference === "any"
                ? "Any work setting"
                : `${draft.story.remotePreference} preferred`}
              {draft.story.employmentTypes.length > 0 &&
                ` · ${draft.story.employmentTypes.map((t) => t.replace("_", "-")).join(", ")}`}
              {draft.story.preferredLocations.length > 0 &&
                ` · ${draft.story.preferredLocations.join(", ")}`}
            </div>
          </div>,
        )}

        {/* Sources */}
        <div className="space-y-1">
          <div className={sectionTitleClass}>Sources</div>
          {draft.sources.length === 0 ? (
            <p className={hintTextClass}>Entered manually.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="profile-sources">
              {draft.sources.map((source, idx) => (
                <li key={idx} className="text-[11px] text-surface-400">
                  {SOURCE_LABELS[source.kind]} on{" "}
                  {formatDate(source.importedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-surface-800">
          <button
            type="button"
            data-testid="rerun-wizard"
            onClick={rerunWizard}
            className={ghostButtonClass}
          >
            <RotateCcw className="w-3 h-3" />
            Re-run wizard
          </button>
          {draft.completedAt && (
            <span className="text-[10px] font-mono text-surface-500">
              Completed {formatDate(draft.completedAt)}
            </span>
          )}
        </div>

        {/* Danger zone */}
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
          <div className="text-[10px] font-mono uppercase text-rose-300/80 font-semibold tracking-wider">
            Danger zone
          </div>
          {confirmClear ? (
            <div className="space-y-2">
              <p className="text-[11px] text-rose-200">
                Delete your whole profile? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="clear-profile-confirm"
                  onClick={clearProfile}
                  disabled={saving}
                  className={dangerButtonClass}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {saving ? "Clearing…" : "Yes, clear it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={saving}
                  className={ghostButtonClass}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="clear-profile"
              onClick={() => setConfirmClear(true)}
              className={dangerButtonClass}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

const StoryTags: React.FC<{ label: string; tags: string[] }> = ({
  label,
  tags,
}) => {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-surface-500 mr-0.5">{label}:</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20"
        >
          {tag}
        </span>
      ))}
    </div>
  );
};

const ReviewSummary: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: profile.contact.name || "—" },
    {
      label: "Education",
      value:
        profile.education
          .map((e) => `${e.institution} (${e.graduationYear ?? "—"})`)
          .join("; ") || "—",
    },
    {
      label: "Skills",
      value:
        sortSkillsByRating(profile.skills)
          .map((s) => `${s.name} ${s.rating}/5`)
          .join(", ") || "—",
    },
    {
      label: "Experience",
      value:
        profile.experiences
          .map((x) => `${x.title} @ ${x.company}`)
          .join("; ") || "—",
    },
    {
      label: "Certifications",
      value: profile.certifications.map((c) => c.name).join("; ") || "—",
    },
    { label: "Drives", value: profile.story.drives.join(", ") || "—" },
    {
      label: "Target roles",
      value: profile.story.targetRoles.join(", ") || "—",
    },
  ];
  return (
    <dl className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[88px_1fr] gap-2 text-[11px]"
        >
          <dt className="text-surface-500 font-mono uppercase text-[10px] pt-px">
            {row.label}
          </dt>
          <dd className="text-surface-300 leading-snug break-words">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
