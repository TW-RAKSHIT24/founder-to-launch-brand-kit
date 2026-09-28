'use client';

import { useEffect, useState } from 'react';
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  Copy,
  Download,
  Layers3,
  LoaderCircle,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { api } from '@/api';
import { readPreviewState, writePreviewState } from '@/api/preview-state';
import type { PreviewDataState } from '@/api/types';
import { BrandModel } from '@/components/brand-model';
import {
  BrandSchema,
  CheckConsistencyRequestSchema,
  FounderDataSchema,
  FixPathSchema,
  type Brand,
  type ConsistencyFix,
  type FounderData,
  type Messaging,
} from '@/lib/contracts';
import {
  createInitialWorkflow,
  parseSavedWorkflow,
  WORKFLOW_STORAGE_KEY,
  type WorkflowState,
} from '@/lib/workflow-state';
import { applyConsistencyFix, currentFixValue } from '@/lib/fix-application';

const STAGES = ['Start', 'Interview', 'Brand battle', 'Refine', 'Check', 'Kit'];
const FALLBACK_BRAND_COLORS = ['#193E43', '#4D9B84', '#E0B76B'];
const EMPTY_FOUNDER: FounderData = {
  startupName: '',
  customer: '',
  problem: '',
  personality: '',
  inspirations: [],
};
const SAMPLE_FOUNDER: FounderData = {
  startupName: 'Lecture Loop',
  customer: 'college students who learn best by revisiting clear class notes',
  problem: 'turning fast, scattered lectures into notes that are useful later',
  personality: 'curious, calm, and a little playful',
  inspirations: ['field guides', 'well-organized notebooks'],
};

type ThemePreference = 'light' | 'dark' | 'system';
type RetryAction = 'generate' | 'refine' | 'check' | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}

function selectedBrandOf(workflow: WorkflowState): Brand | null {
  return workflow.brands.find((brand) => brand.id === workflow.selectedBrandId) ?? null;
}

function kitText(brand: Brand, messaging: Messaging): string {
  return [
    `${brand.name} | ${brand.descriptor}`,
    `Tagline: ${brand.tagline}`,
    `Audience: ${brand.audience}`,
    `Positioning: ${brand.positioning}`,
    `Voice: ${brand.voice}`,
    `Mission: ${brand.mission}`,
    `Story: ${brand.story}`,
    `Value proposition: ${messaging.valueProposition}`,
    `Elevator pitch: ${messaging.elevatorPitch}`,
    `Message pillars:\n${messaging.messagePillars.map((pillar) => `- ${pillar}`).join('\n')}`,
    `Colors: ${brand.colors.join(', ')}`,
    `Words to avoid: ${brand.wordsToAvoid.join(', ')}`,
  ].join('\n\n');
}

function themeValue(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

export default function Home() {
  const [workflow, setWorkflow] = useState<WorkflowState>(createInitialWorkflow);
  const [founderDraft, setFounderDraft] = useState<FounderData>(EMPTY_FOUNDER);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inspirationDraft, setInspirationDraft] = useState('');
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [previewState, setPreviewState] = useState<PreviewDataState>('data');
  const [notice, setNotice] = useState('');
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const restore = (): void => {
      const saved = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
      if (saved) {
        try {
          const restored = parseSavedWorkflow(JSON.parse(saved) as unknown);
          if (restored) {
            setWorkflow(restored);
            setFounderDraft(restored.founderDraft);
          } else {
            window.localStorage.removeItem(WORKFLOW_STORAGE_KEY);
          }
        } catch {
          window.localStorage.removeItem(WORKFLOW_STORAGE_KEY);
        }
      }
      const savedTheme = window.localStorage.getItem('app-theme');
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setThemePreference(savedTheme);
      }
      setPreviewState(readPreviewState());
      setHydrated(true);
    };
    queueMicrotask(restore);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflow));
  }, [hydrated, workflow]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      document.documentElement.dataset.theme = themeValue(themePreference, media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    window.localStorage.setItem('app-theme', themePreference);
    return () => media.removeEventListener('change', apply);
  }, [themePreference]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const brand = selectedBrandOf(workflow);

  function invalidateFromInterview(nextDraft: FounderData): void {
    setFounderDraft(nextDraft);
    setWorkflow((current) => ({
      ...current,
      step: 1,
      founderDraft: nextDraft,
      founderData: null,
      brands: [],
      selectedBrandId: null,
      messaging: null,
      genericPhrasesFound: [],
      consistency: null,
      appliedFixIds: [],
      sourceMode: null,
    }));
    setError(null);
    setFieldErrors({});
  }

  function updateFounderField<K extends keyof FounderData>(field: K, value: FounderData[K]): void {
    const nextDraft = { ...founderDraft, [field]: value };
    invalidateFromInterview(nextDraft);
  }

  async function generate(input: FounderData): Promise<void> {
    setBusy(true);
    setError(null);
    setRetryAction(null);
    try {
      const result = await api.generateBrands(input);
      setWorkflow((current) => ({
        ...current,
        step: 2,
        founderDraft: input,
        founderData: input,
        brands: result.brands,
        selectedBrandId: result.brands[0]?.id ?? null,
        messaging: null,
        genericPhrasesFound: [],
        consistency: null,
        appliedFixIds: [],
        sourceMode: result.mode,
      }));
    } catch (requestError) {
      setError(errorMessage(requestError));
      setRetryAction('generate');
    } finally {
      setBusy(false);
    }
  }

  async function submitInterview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = FounderDataSchema.safeParse(founderDraft);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      setError('Check the highlighted fields before generating directions.');
      return;
    }
    setFieldErrors({});
    await generate(parsed.data);
  }

  async function refine(): Promise<void> {
    if (!workflow.founderData || !brand) return;
    setBusy(true);
    setError(null);
    setRetryAction(null);
    try {
      const result = await api.refineBrand(workflow.founderData, brand);
      setWorkflow((current) => ({
        ...current,
        step: 3,
        messaging: result.messaging,
        genericPhrasesFound: result.genericPhrasesFound,
        consistency: null,
        appliedFixIds: [],
        sourceMode: result.mode,
      }));
    } catch (requestError) {
      setError(errorMessage(requestError));
      setRetryAction('refine');
    } finally {
      setBusy(false);
    }
  }

  async function runConsistency(
    selected: Brand = brand as Brand,
    messaging: Messaging = workflow.messaging as Messaging,
    nextStep = true,
  ): Promise<void> {
    if (!workflow.founderData || !selected || !messaging) return;
    const input = { founderData: workflow.founderData, selectedBrand: selected, messaging };
    const parsed = CheckConsistencyRequestSchema.safeParse(input);
    if (!parsed.success) {
      setError('The current brand details are incomplete. Return to the previous step and retry.');
      return;
    }
    setBusy(true);
    setError(null);
    setRetryAction(null);
    try {
      const result = await api.checkConsistency(parsed.data.founderData, parsed.data.selectedBrand, parsed.data.messaging);
      setWorkflow((current) => ({
        ...current,
        step: nextStep ? 4 : current.step,
        consistency: { checks: result.checks, fixes: result.fixes },
        sourceMode: result.mode,
      }));
    } catch (requestError) {
      setError(errorMessage(requestError));
      setRetryAction('check');
    } finally {
      setBusy(false);
    }
  }

  function chooseBrand(nextBrand: Brand): void {
    setWorkflow((current) => ({
      ...current,
      selectedBrandId: nextBrand.id,
      messaging: null,
      genericPhrasesFound: [],
      consistency: null,
      appliedFixIds: [],
    }));
    setError(null);
  }

  async function applyApprovedFix(fix: ConsistencyFix): Promise<void> {
    if (!brand || !workflow.messaging || !workflow.founderData) return;
    if (!FixPathSchema.safeParse(fix.path).success) {
      setError('This fix uses a path that is not allowed. Run the check again.');
      return;
    }
    const currentValue = currentFixValue(fix, brand, workflow.messaging);
    if (currentValue === null || currentValue !== fix.currentValue) {
      setError('This suggestion is out of date because its current value changed. Run the consistency check again.');
      return;
    }
    if (!window.confirm(`Apply this change?\n\n${currentValue}\n\n→ ${fix.proposedValue}`)) return;
    const result = applyConsistencyFix(fix, brand, workflow.messaging);
    if (!result) {
      setError('This suggestion is out of date because its current value changed. Run the consistency check again.');
      return;
    }
    const checkedBrand = BrandSchema.parse(result.brand);
    const selectedId = checkedBrand.id;
    setWorkflow((current) => ({
      ...current,
      brands: current.brands.map((item) => item.id === selectedId ? checkedBrand : item),
      consistency: null,
      appliedFixIds: [...current.appliedFixIds, fix.id],
    }));
    await runConsistency(checkedBrand, result.messaging, false);
  }

  function resetWorkflow(): void {
    if (!window.confirm('Reset this brand project and clear its saved progress?')) return;
    window.localStorage.removeItem(WORKFLOW_STORAGE_KEY);
    setWorkflow(createInitialWorkflow());
    setFounderDraft(EMPTY_FOUNDER);
    setError(null);
    setFieldErrors({});
    setRetryAction(null);
  }

  function fillSampleBrief(): void {
    invalidateFromInterview(SAMPLE_FOUNDER);
  }

  function addInspiration(): void {
    const value = inspirationDraft.trim();
    if (!value || founderDraft.inspirations.length >= 3) return;
    updateFounderField('inspirations', [...founderDraft.inspirations, value]);
    setInspirationDraft('');
  }

  function removeInspiration(index: number): void {
    updateFounderField('inspirations', founderDraft.inspirations.filter((_, itemIndex) => itemIndex !== index));
  }

  async function copyKit(): Promise<void> {
    if (!brand || !workflow.messaging) return;
    try {
      await navigator.clipboard.writeText(kitText(brand, workflow.messaging));
      setNotice('Brand kit copied');
    } catch {
      setError('Clipboard access is unavailable in this browser. Use Download instead.');
    }
  }

  function downloadKit(): void {
    if (!brand || !workflow.messaging) return;
    const file = new Blob([kitText(brand, workflow.messaging)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-brand-kit.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Brand kit downloaded');
  }

  function changePreviewState(next: PreviewDataState): void {
    writePreviewState(next);
    setPreviewState(next);
  }

  async function retry(): Promise<void> {
    if (retryAction === 'generate' && workflow.founderData) await generate(workflow.founderData);
    if (retryAction === 'refine') await refine();
    if (retryAction === 'check') await runConsistency();
  }

  const modeLabel = workflow.sourceMode === 'mock'
    ? 'Sample output'
    : workflow.sourceMode === 'live'
      ? 'Live provider'
      : 'No output yet';

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brandmark" href="#top" aria-label="Founder-to-Launch home">
          <span className="brandmark-symbol"><Aperture size={19} strokeWidth={2.3} /></span>
          <span>FOUNDER TO LAUNCH</span>
        </a>
        <div className="topbar-tools">
          <span className="sample-label"><span className="sample-dot" />{modeLabel}</span>
          <button
            className="icon-button"
            type="button"
            title={`Theme: ${themePreference}. Click to change.`}
            aria-label={`Theme ${themePreference}; change theme`}
            onClick={() => setThemePreference((current) => current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light')}
          >
            {themePreference === 'dark' ? <Moon size={16} /> : themePreference === 'system' ? <Monitor size={16} /> : <Sun size={16} />}
          </button>
          <button className="icon-button" type="button" title="Reset project" aria-label="Reset project" onClick={resetWorkflow}>
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      <div id="top" className="progress-wrap" aria-label="Brand kit workflow">
        <div className="progress-track" aria-hidden="true">
          {STAGES.map((stage, index) => <div key={stage} className="progress-step" data-active={index <= workflow.step} />)}
        </div>
        <div className="progress-labels">
          {STAGES.map((stage, index) => <span key={stage} className="progress-label" data-active={index === workflow.step}>{stage}</span>)}
        </div>
      </div>

      <main className="main-content">
        <motion.div
          key={workflow.step}
          className="view-enter"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: 'easeOut' }}
        >
          {workflow.step === 0 && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">A founder&apos;s field guide to a clearer brand</span>
                  <h1>Make your first brand feel like yours.</h1>
                  <p>Start with what you know about your people and the problem. Shape it into a voice, a point of view, and a kit you can actually use.</p>
                  <div className="hero-actions">
                    <button className="button button-primary" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 1 }))}>
                      Start your interview <ArrowRight size={15} />
                    </button>
                    <button className="button button-secondary" type="button" onClick={fillSampleBrief}>
                      <Clipboard size={14} /> Try the lecture-notes example
                    </button>
                  </div>
                </div>
                <BrandModel colors={brand?.colors ?? FALLBACK_BRAND_COLORS} label={brand?.descriptor ?? 'Your brand direction'} />
              </section>
              <div className="section-heading">
                <div><span className="eyebrow">From raw thought to ready-to-share</span><h2>Six deliberate steps</h2></div>
                <p>Your progress stays in this browser.</p>
              </div>
              <div className="feature-grid">
                <Feature title="Find your angle" copy="Compare three distinct directions, then choose the one that sounds like you." icon={<Layers3 size={18} />} />
                <Feature title="Say it plainly" copy="Trade stock phrases for language rooted in your customer and problem." icon={<Sparkles size={18} />} />
                <Feature title="Keep it consistent" copy="Review concrete checks and approve any change before it touches your kit." icon={<CheckCircle2 size={18} />} />
              </div>
            </>
          )}

          {workflow.step === 1 && (
            <section className="panel panel-pad">
              <FlowHeading eyebrow="01 / Founder interview" title="Start with what you know." copy="A few specific answers are more useful than a polished pitch. Required fields need at least two characters." />
              <form onSubmit={submitInterview} noValidate>
                <div className="form-grid">
                  <Field id="startup-name" label="Startup or project name" error={fieldErrors.startupName}>
                    <input id="startup-name" className="text-input" value={founderDraft.startupName} onChange={(event) => updateFounderField('startupName', event.target.value)} placeholder="e.g. Lecture Loop" autoComplete="organization" />
                  </Field>
                  <Field id="founder-customer" label="Who is it for?" error={fieldErrors.customer} hint="Be more specific than “everyone.”">
                    <input id="founder-customer" className="text-input" value={founderDraft.customer} onChange={(event) => updateFounderField('customer', event.target.value)} placeholder="e.g. college students taking fast-moving lectures" />
                  </Field>
                  <Field id="founder-problem" label="What problem are they facing?" error={fieldErrors.problem} hint="Describe the friction, not your solution.">
                    <textarea id="founder-problem" className="text-area" value={founderDraft.problem} onChange={(event) => updateFounderField('problem', event.target.value)} placeholder="What gets harder, slower, or more confusing for them?" />
                  </Field>
                  <Field id="founder-personality" label="What should the brand feel like?" error={fieldErrors.personality} hint="A few real adjectives are enough.">
                    <textarea id="founder-personality" className="text-area" value={founderDraft.personality} onChange={(event) => updateFounderField('personality', event.target.value)} placeholder="e.g. curious, calm, a little playful" />
                  </Field>
                  <Field id="founder-inspiration" label={`Optional inspirations (${founderDraft.inspirations.length}/3)`} hint="A brand, place, product, book, or feeling. These are context, not instructions to copy.">
                    <div className="inspiration-row">
                      <input id="founder-inspiration" className="text-input" value={inspirationDraft} maxLength={120} onChange={(event) => setInspirationDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addInspiration(); } }} placeholder="e.g. field guides" />
                      <button className="button button-secondary" type="button" onClick={addInspiration} disabled={!inspirationDraft.trim() || founderDraft.inspirations.length >= 3}><Plus size={14} /> Add</button>
                    </div>
                    {founderDraft.inspirations.length > 0 && <div className="inspiration-list">{founderDraft.inspirations.map((item, index) => <span className="inspiration-chip" key={`${item}-${index}`}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => removeInspiration(index)}><X size={12} /></button></span>)}</div>}
                  </Field>
                </div>
                {error && <div className="form-error" role="alert"><CircleAlert size={15} />{error}{retryAction && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void retry()}>Retry</button>}</div>}
                <div className="form-footer">
                  <button className="button button-quiet" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 0 }))}><ArrowLeft size={14} /> Back</button>
                  <div className="form-footer-right">
                    <button className="button button-secondary" type="button" onClick={fillSampleBrief}>Use sample answers</button>
                    <button className="button button-primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={15} /> Shaping directions...</> : <>Generate 3 directions <ArrowRight size={14} /></>}</button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {workflow.step === 2 && (
            <>
              <FlowHeading eyebrow="02 / Brand battle" title="Three ways to show up." copy="Choose a direction to carry into the next step. The second option is just as selectable as the others." />
              {brand && <section className="brand-showcase" aria-label="Selected direction 3D model">
                <BrandModel compact colors={brand.colors} label={brand.descriptor} />
                <div className="brand-showcase-copy">
                  <span className="eyebrow">Selected direction / {brand.name.split(' / ')[1] ?? brand.name}</span>
                  <h2>{brand.descriptor}</h2>
                  <p>{brand.positioning}</p>
                  <div className="model-palette-list" aria-label="Selected direction colors">
                    {brand.colors.map((color) => <span key={color}><i style={{ backgroundColor: color }} />{color}</span>)}
                  </div>
                </div>
              </section>}
              {workflow.brands.length === 0 ? (
                <EmptyState title="No directions yet" copy="Your saved interview is ready. Generate three directions to compare." action="Generate directions" onAction={() => workflow.founderData && void generate(workflow.founderData)} />
              ) : (
                <div className="directions-grid">
                  {workflow.brands.map((item, index) => <DirectionCard key={item.id} brand={item} index={index} selected={item.id === workflow.selectedBrandId} onSelect={() => chooseBrand(item)} />)}
                </div>
              )}
              {error && <RequestError message={error} retryAction={retryAction ? () => void retry() : undefined} busy={busy} />}
              <div className="form-footer">
                <button className="button button-quiet" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 1 }))}><ArrowLeft size={14} /> Edit interview</button>
                <div className="form-footer-right">
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => workflow.founderData && void generate(workflow.founderData)}><RotateCcw size={14} /> Regenerate</button>
                  <button className="button button-primary" type="button" disabled={busy || !brand} onClick={() => void refine()}>{busy ? <><LoaderCircle className="spin" size={15} /> Refining...</> : <>Refine the message <ArrowRight size={14} /></>}</button>
                </div>
              </div>
            </>
          )}

          {workflow.step === 3 && (
            <>
              <FlowHeading eyebrow="03 / Anti-generic" title="Keep the meaning. Lose the filler." copy="A deterministic phrase pass flags common brand shorthand, then shows the exact before and after. Nothing is silently rewritten." />
              {!brand || !workflow.messaging ? <EmptyState title="Choose a direction first" copy="Return to Brand battle and select a direction before refining the message." action="Choose a direction" onAction={() => setWorkflow((current) => ({ ...current, step: 2 }))} /> : (
                <>
                  <section className="panel panel-pad">
                    <div className="copy-block">
                      <div className="copy-block-header"><span>Value proposition / before</span><span>{brand.name}</span></div>
                      <p>{brand.valueProposition}</p>
                    </div>
                    <div className="copy-block">
                      <div className="copy-block-header"><span>Value proposition / after</span><Check size={14} /></div>
                      <p>{workflow.messaging.valueProposition}</p>
                    </div>
                    <div className="diff-row">
                      <div className="diff-before"><span className="diff-label">Elevator pitch / before</span><p>{brand.elevatorPitch}</p></div>
                      <div className="diff-after"><span className="diff-label">Elevator pitch / after</span><p>{workflow.messaging.elevatorPitch}</p></div>
                    </div>
                    {workflow.genericPhrasesFound.length > 0 ? (
                      <>
                        <div className="section-heading"><div><span className="eyebrow">Phrase findings</span><h2>{workflow.genericPhrasesFound.reduce((total, item) => total + item.count, 0)} generic phrase{workflow.genericPhrasesFound.reduce((total, item) => total + item.count, 0) === 1 ? '' : 's'} found</h2></div></div>
                        <div className="finding-list">{workflow.genericPhrasesFound.map((item) => <div className="finding-row" key={item.phrase}><strong>{item.phrase}</strong><span>→ {item.replacement}</span><b className="count-badge">×{item.count}</b><span>Replaced using your brief</span></div>)}</div>
                      </>
                    ) : <EmptyState title="Nothing generic surfaced" copy="The current message is already specific enough for this phrase check. Your wording is unchanged." />}
                  </section>
                  {error && <RequestError message={error} retryAction={retryAction ? () => void retry() : undefined} busy={busy} />}
                  <div className="form-footer">
                    <button className="button button-quiet" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 2 }))}><ArrowLeft size={14} /> Change direction</button>
                    <button className="button button-primary" type="button" disabled={busy} onClick={() => void runConsistency()}>{busy ? <><LoaderCircle className="spin" size={15} /> Checking...</> : <>Check consistency <ArrowRight size={14} /></>}</button>
                  </div>
                </>
              )}
            </>
          )}

          {workflow.step === 4 && (
            <>
              <FlowHeading eyebrow="04 / Consistency guardian" title="Does it all sound like one brand?" copy="Review four focused checks. Suggestions are proposals only; each fix needs your approval and is rechecked after applying." />
              {!brand || !workflow.messaging || !workflow.consistency ? (
                <EmptyState title="Consistency check needed" copy="Run the check against your current message to see its four dimensions." action={busy ? 'Checking…' : 'Run consistency check'} onAction={() => void runConsistency()} />
              ) : (
                <>
                  <div className="check-list">
                    {workflow.consistency.checks.map((check) => <div className="check-row" key={check.dimension}>
                      <span className="check-icon" data-status={check.status}>{check.status === 'pass' ? <Check size={14} /> : <CircleAlert size={14} />}</span>
                      <div className="check-copy"><strong>{dimensionTitle(check.dimension)}</strong><p>{check.finding} {check.suggestion}</p></div>
                      <span className="status-label">{check.status}</span>
                    </div>)}
                  </div>
                  {workflow.consistency.fixes.length > 0 && (
                    <>
                      <div className="section-heading"><div><span className="eyebrow">Your call</span><h2>Suggested fixes</h2></div><p>Current values are checked before every apply.</p></div>
                      <div className="fix-list">{workflow.consistency.fixes.map((fix) => {
                        const stale = currentFixValue(fix, brand, workflow.messaging as Messaging) !== fix.currentValue;
                        const applied = workflow.appliedFixIds.includes(fix.id);
                        return <article className="fix-card" key={fix.id}>
                          <p className="fix-reason">{fix.reason}</p>
                          <div className="fix-values"><div className="fix-value"><small>Current</small><span>{fix.currentValue}</span></div><div className="fix-value"><small>Proposed</small><span>{fix.proposedValue}</span></div></div>
                          <button className="button button-secondary" type="button" disabled={busy || stale || applied} onClick={() => void applyApprovedFix(fix)}>{applied ? <><Check size={14} /> Applied and rechecked</> : stale ? 'Out of date · rerun check' : <>Apply this fix <ArrowRight size={13} /></>}</button>
                        </article>;
                      })}</div>
                    </>
                  )}
                  {workflow.consistency.fixes.length === 0 && <EmptyState title="No fixes needed" copy="All four checks passed. Your brand is ready to review as a kit." />}
                </>
              )}
              {error && <RequestError message={error} retryAction={retryAction ? () => void retry() : undefined} busy={busy} />}
              <div className="form-footer">
                <button className="button button-quiet" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 3 }))}><ArrowLeft size={14} /> Back to refinement</button>
                <div className="form-footer-right">
                  <button className="button button-secondary" type="button" disabled={busy || !brand || !workflow.messaging} onClick={() => void runConsistency(brand ?? undefined, workflow.messaging ?? undefined, false)}><RotateCcw size={14} /> Rerun checks</button>
                  <button className="button button-primary" type="button" disabled={!workflow.consistency || busy || !brand || !workflow.messaging} onClick={() => setWorkflow((current) => ({ ...current, step: 5 }))}>Review final kit <ArrowRight size={14} /></button>
                </div>
              </div>
            </>
          )}

          {workflow.step === 5 && (
            <>
              <FlowHeading eyebrow="05 / Final brand kit" title={brand?.name ?? 'Your brand kit'} copy="A working snapshot of the current saved direction. Copy or download it whenever you are ready." />
              {!brand || !workflow.messaging ? <EmptyState title="Your kit is not ready yet" copy="Choose a direction and complete the checks before exporting." action="Return to Brand battle" onAction={() => setWorkflow((current) => ({ ...current, step: 2 }))} /> : (
                <>
                  <div className="kit-grid">
                    <section className="panel">
                      <div className="kit-section"><h3>Position</h3><span className="kit-label">One-line descriptor</span><p className="kit-value">{brand.descriptor}</p><span className="kit-label">Tagline</span><p className="kit-value">{brand.tagline}</p><span className="kit-label">Positioning</span><p className="kit-value">{brand.positioning}</p></div>
                      <div className="kit-section"><h3>Messaging</h3><span className="kit-label">Value proposition</span><p className="kit-value">{workflow.messaging.valueProposition}</p><span className="kit-label">Elevator pitch</span><p className="kit-value">{workflow.messaging.elevatorPitch}</p></div>
                      <div className="kit-section"><h3>Message pillars</h3><div className="pillar-list">{workflow.messaging.messagePillars.map((pillar, index) => <div className="pillar" key={`${index}-${pillar}`}><span className="pillar-index">0{index + 1}</span><span>{pillar}</span></div>)}</div></div>
                    </section>
                    <aside className="panel">
                      <div className="kit-section"><h3>Voice & audience</h3><span className="kit-label">Voice</span><p className="kit-value">{brand.voice}</p><span className="kit-label">For</span><p className="kit-value">{brand.audience}</p></div>
                      <div className="kit-section"><h3>Mission & story</h3><span className="kit-label">Mission</span><p className="kit-value">{brand.mission}</p><span className="kit-label">Origin</span><p className="kit-value">{brand.story}</p></div>
                      <div className="kit-section"><h3>Color direction</h3><div className="swatches">{brand.colors.map((color) => <span className="swatch" key={color} title={color} style={{ backgroundColor: color }} />)}</div><div className="color-labels">{brand.colors.map((color) => <span key={color}>{color}</span>)}</div></div>
                      <div className="kit-section"><h3>Words to avoid</h3><div className="avoid-list">{brand.wordsToAvoid.map((word) => <span className="avoid-word" key={word}>{word}</span>)}</div></div>
                    </aside>
                  </div>
                  <div className="form-footer">
                    <button className="button button-quiet" type="button" onClick={() => setWorkflow((current) => ({ ...current, step: 4 }))}><ArrowLeft size={14} /> Review checks</button>
                    <div className="form-footer-right">
                      <button className="button button-secondary" type="button" onClick={() => void copyKit()}><Copy size={14} /> Copy kit</button>
                      <button className="button button-primary" type="button" onClick={downloadKit}><Download size={14} /> Download .txt</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {error && workflow.step === 0 && <RequestError message={error} retryAction={retryAction ? () => void retry() : undefined} busy={busy} />}
          {previewState !== 'data' && workflow.step >= 2 && <PreviewStatePanel state={previewState} onReset={() => changePreviewState('data')} />}
        </motion.div>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
      {process.env.NODE_ENV === 'development' && <div className="dev-switcher" aria-label="Preview state selector">
        {(['data', 'loading', 'empty', 'error'] as PreviewDataState[]).map((state) => <button key={state} type="button" data-active={previewState === state} aria-pressed={previewState === state} onClick={() => changePreviewState(state)}>{state}</button>)}
      </div>}
      <footer className="footer-note">Your working kit is saved in this browser only. Sample output is illustrative and makes no claims about product capabilities.</footer>
    </div>
  );
}

function Feature({ title, copy, icon }: { title: string; copy: string; icon: React.ReactNode }) {
  return <article className="feature-item"><span className="feature-icon">{icon}</span><h3>{title}</h3><p>{copy}</p></article>;
}

function FlowHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="flow-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div></div>;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <span className="field-hint">{hint}</span>}{error && <span className="input-error" role="alert">{error}</span>}</div>;
}

function DirectionCard({ brand, index, selected, onSelect }: { brand: Brand; index: number; selected: boolean; onSelect: () => void }) {
  return <button className="direction-card" type="button" data-selected={selected} aria-pressed={selected} onClick={onSelect}>
    <span className="direction-number">DIRECTION 0{index + 1}</span><span className="select-mark">{selected && <Check size={13} />}</span>
    <h3>{brand.name.split(' / ')[1] ?? brand.name}</h3><span className="direction-descriptor">{brand.descriptor}</span>
    <p className="direction-tagline">“{brand.tagline}”</p>
    <div className="direction-detail"><strong>For</strong><span>{brand.audience}</span></div>
    <div className="direction-detail"><strong>Voice</strong><span>{brand.voice}</span></div>
    <div className="swatches">{brand.colors.map((color) => <span className="swatch" key={color} title={color} style={{ backgroundColor: color }} />)}</div>
    <span className="button button-secondary">{selected ? 'Selected' : 'Choose direction'}</span>
  </button>;
}

function EmptyState({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) {
  return <section className="empty-state"><Sparkles className="empty-state-icon" size={40} strokeWidth={1.5} /><h3>{title}</h3><p>{copy}</p>{action && onAction && <button className="button button-primary" type="button" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</section>;
}

function RequestError({ message, retryAction, busy }: { message: string; retryAction?: () => void; busy: boolean }) {
  return <div className="request-error" role="alert"><span><CircleAlert size={16} />{message}</span>{retryAction && <button className="button button-secondary" type="button" disabled={busy} onClick={retryAction}><RotateCcw size={13} /> Retry</button>}</div>;
}

function PreviewStatePanel({ state, onReset }: { state: Exclude<PreviewDataState, 'data'>; onReset: () => void }) {
  if (state === 'loading') return <section className="preview-state panel" aria-live="polite"><LoaderCircle className="spin" size={22} /><strong>Loading sample data</strong><span>Waiting for the current stage to resolve.</span></section>;
  if (state === 'error') return <section className="preview-state panel" role="alert"><CircleAlert size={23} /><strong>Could not load this stage</strong><span>The error state is available for retry testing.</span><button className="button button-secondary" type="button" onClick={onReset}><RotateCcw size={13} /> Return to data</button></section>;
  return <section className="preview-state panel"><Sparkles size={24} /><strong>No items to show</strong><span>This empty state is available for layout and accessibility review.</span><button className="button button-secondary" type="button" onClick={onReset}>Return to data</button></section>;
}

function dimensionTitle(dimension: string): string {
  switch (dimension) {
    case 'audience': return 'Audience';
    case 'tone': return 'Tone';
    case 'positioning': return 'Positioning';
    case 'tagline-personality': return 'Tagline & personality';
    default: return dimension;
  }
}
