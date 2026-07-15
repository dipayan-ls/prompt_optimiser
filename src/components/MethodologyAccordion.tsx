import { useState } from 'react';
import { ChevronDown, Beaker } from 'lucide-react';
import { cn } from '../lib/utils';

const INTENSITY_DETAILS = [
  {
    label: 'Compress',
    color: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    when: 'For prompts that already work',
    description:
      'Strips redundancy, filler phrases, and verbose qualifiers without changing your intent. The output prompt does the same job with fewer tokens.',
    best: 'Production prompts you want cheaper. When the logic is sound but the wording is bloated.',
    avoid: 'Vague or underspecified prompts — compression will preserve the vagueness.',
  },
  {
    label: 'Balanced',
    color: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    when: 'Best starting point for most prompts',
    description:
      'Restructures for clarity without dramatically changing length. Fixes ambiguity, sharpens role and context framing, and strengthens instruction order.',
    best: 'First-time optimization of any prompt. When results are close but not quite right.',
    avoid: 'When you explicitly need either a shorter or a deeply engineered result.',
  },
  {
    label: 'Engineer',
    color: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    when: 'When quality matters more than token cost',
    description:
      'Builds a complete prompt specification: explicit role, structured task breakdown, deliverables, constraints, output format, and verification criteria. Expect it to get significantly longer.',
    best: 'Complex tasks, agentic workflows, high-stakes outputs (contracts, code, analysis). When a vague prompt keeps producing inconsistent results.',
    avoid: 'Simple one-liners or tasks where token cost is a real constraint.',
  },
];

const TONE_DETAILS = [
  {
    label: 'Neutral',
    when: 'Default. No stylistic bias — lets the model decide based on context.',
    example: 'Summarize this document.',
  },
  {
    label: 'Professional',
    when: 'Business writing, executive summaries, stakeholder communications, formal reports.',
    example: 'Draft a concise status update for the steering committee.',
  },
  {
    label: 'Creative',
    when: 'Marketing copy, storytelling, brainstorming, campaign ideation. Encourages expressive, open-ended outputs.',
    example: 'Write a product launch announcement with a bold hook.',
  },
  {
    label: 'Concise',
    when: 'Summaries, bullet points, TL;DRs, quick answers. Every word earns its place.',
    example: 'Give me 5 bullet points from this article.',
  },
  {
    label: 'Technical',
    when: 'Code generation, engineering specs, API documentation, architecture decisions. Precise, jargon-appropriate.',
    example: 'Write a TypeScript interface for this data model.',
  },
  {
    label: 'Friendly',
    when: 'Customer-facing content, onboarding flows, support replies, tutorials. Warm and conversational.',
    example: 'Write a welcome email for new users of our app.',
  },
  {
    label: 'Academic',
    when: 'Research summaries, literature reviews, formal analysis, citation-ready writing.',
    example: 'Summarize the key findings from this paper in academic language.',
  },
];

const VARIATION_DETAILS = [
  {
    count: 1,
    label: 'Single',
    description: 'One best-effort result using the optimal strategy for your prompt.',
    best: 'When you have a clear goal and just want the result. Fastest and cheapest.',
  },
  {
    count: 2,
    label: 'Compare',
    description: 'Two structurally different approaches — not just different wording, but different strategies.',
    best: 'When you\'re uncertain about framing, or want to compare a direct vs. scaffolded approach.',
  },
  {
    count: 3,
    label: 'Explore',
    description: 'Three distinct strategies. Maximum diversity across role framing, structure, and constraint style.',
    best: 'Exploring a new task type, creative work, or when you want options to cherry-pick from.',
  },
];

export function MethodologyAccordion() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-slate-800 tracking-tight">How it Works & Guide</span>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-slate-500 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-5 border-t border-slate-200 space-y-8">

            {/* The Science of Prompting */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-blue-500 rounded-full shrink-0"></span>
                The Science of Prompting
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-100">
                We don't just rewrite your text — we engineer it. We analyze your intent and restructure it
                using proven techniques like Chain-of-Thought, XML scaffolding, and constraint layering.
                Token counts are measured with a real tokenizer, not estimated, so the savings you see are
                the savings you get. No API key needed, and your prompts are never stored.
              </p>
            </div>

            {/* Step-by-Step Guide */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-emerald-500 rounded-full shrink-0"></span>
                Step-by-Step Guide
              </h3>
              <div className="space-y-3 pl-3">
                {[
                  { n: 1, title: 'Choose a Framework (Optional)', body: 'Select a specialized task from the Enhancements Library on the left to pre-load a starting template.' },
                  { n: 2, title: 'Paste Your Prompt', body: 'Type your raw goal or paste an existing prompt. The rougher it is, the more the optimizer can do.' },
                  { n: 3, title: 'Configure Controls', body: 'Set Intensity, Tone, and Variations to match your goal (see the reference below).' },
                  { n: 4, title: 'Analyze & Optimize', body: 'Click the button. The engine will rewrite your prompt and show you token savings.' },
                  { n: 5, title: 'Refine (Optional)', body: 'Not quite right? Describe what to change in the refinement box and re-run.' },
                  { n: 6, title: 'Copy & Deploy', body: 'Take your token-efficient prompt into any AI assistant.' },
                ].map(({ n, title, body }) => (
                  <div key={n} className="flex gap-3 text-sm text-slate-600 items-start">
                    <div className="w-5 h-5 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs mt-0.5">{n}</div>
                    <p><strong>{title}:</strong> {body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Intensity Guide */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-blue-500 rounded-full shrink-0"></span>
                Intensity — What Each Level Does
              </h3>
              <div className="space-y-3">
                {INTENSITY_DETAILS.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', item.color)} />
                      <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                      <span className={cn('ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded border', item.badge)}>
                        {item.when}
                      </span>
                    </div>
                    <div className="px-3 py-2.5 space-y-1.5">
                      <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        <span className="font-medium text-emerald-700">Best for:</span> {item.best}
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        <span className="font-medium text-red-600">Avoid when:</span> {item.avoid}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tone Guide */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-violet-500 rounded-full shrink-0"></span>
                Tone — When to Use Each
              </h3>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {TONE_DETAILS.map((item) => (
                  <div key={item.label} className="flex gap-3 px-3 py-2.5 text-xs text-slate-600 items-start bg-white hover:bg-slate-50 transition-colors">
                    <span className="font-semibold text-slate-800 w-[72px] shrink-0 pt-0.5">{item.label}</span>
                    <div className="space-y-0.5">
                      <p className="leading-relaxed">{item.when}</p>
                      <p className="text-slate-400 italic">e.g. "{item.example}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Variations Guide */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-amber-500 rounded-full shrink-0"></span>
                Variations — How Many to Generate
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {VARIATION_DETAILS.map((item) => (
                  <div key={item.count} className="rounded-lg border border-slate-200 p-3 bg-white space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {item.count}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.best}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed pl-1">
                Each variation uses a different strategy — different role framing, structure, or constraint approach — not just different wording.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
