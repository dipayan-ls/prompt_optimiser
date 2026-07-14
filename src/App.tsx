import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  TrendingDown,
  Trash2,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import { DEFAULT_OPTIONS, type OptimizeOptions, type OptimizeResponse } from '../shared/types';
import { optimizePrompt, UserFacingError } from './lib/api';
import { countTokens, savingsPercent, type TokenCount } from './lib/tokens';
import { cn } from './lib/utils';
import { EnhancementsSidebar } from './components/EnhancementsSidebar';
import { MethodologyAccordion } from './components/MethodologyAccordion';
import { OptimizerControls } from './components/OptimizerControls';

interface Analysis {
  response: OptimizeResponse;
  originalTokens: TokenCount[];
  /** Token counts per variation, index-aligned with response.variations. */
  variationTokens: TokenCount[][];
}

interface PromptItem {
  id: string;
  name: string;
  content: string;
  options: OptimizeOptions;
  isAnalyzing: boolean;
  analysis?: Analysis | null;
  error?: string | null;
  selectedVariation: number;
  feedback: string;
}

function newItem(name: string, content = ''): PromptItem {
  return {
    id: Math.random().toString(36).substring(7),
    name,
    content,
    options: { ...DEFAULT_OPTIONS },
    isAnalyzing: false,
    selectedVariation: 0,
    feedback: '',
  };
}

export default function App() {
  const [items, setItems] = useState<PromptItem[]>([newItem('Manual Input')]);
  const [activeId, setActiveId] = useState<string | null>(items[0].id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const activeItem = items.find((i) => i.id === activeId);

  const patch = (id: string, changes: Partial<PromptItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const uploaded = await Promise.all(
      files.map(async (file) => newItem(file.name, await file.text())),
    );

    setItems((prev) => [...prev, ...uploaded]);
    setActiveId(uploaded[0].id);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddNew = () => {
    const item = newItem(`Prompt ${items.length + 1}`);
    setItems((prev) => [...prev, item]);
    setActiveId(item.id);
  };

  const handleDelete = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      if (activeId === id) setActiveId(filtered[0]?.id ?? null);
      return filtered;
    });
  };

  const handleContentChange = (id: string, content: string) =>
    patch(id, { content, analysis: null, error: null, selectedVariation: 0 });

  const handleSelectEnhancement = (template: string) => {
    if (activeId) {
      handleContentChange(activeId, template);
    } else {
      const item = newItem('New Prompt', template);
      setItems((prev) => [...prev, item]);
      setActiveId(item.id);
    }
  };

  /**
   * Run the optimizer. `refine` carries the user's feedback plus the rewrite it
   * refers to, so the model revises rather than starting over.
   */
  const handleAnalyze = async (id: string, refine = false) => {
    const item = items.find((i) => i.id === id);
    if (!item || !item.content.trim()) return;

    const previous = refine
      ? item.analysis?.response.variations[item.selectedVariation]?.optimizedPrompt
      : undefined;

    patch(id, { isAnalyzing: true, error: null });

    try {
      const options: OptimizeOptions = {
        ...item.options,
        ...(refine && previous
          ? { feedback: item.feedback, previousPrompt: previous, variations: 1 }
          : {}),
      };

      const response = await optimizePrompt(item.content, options);

      const [originalTokens, ...variationTokens] = await Promise.all([
        countTokens(item.content),
        ...response.variations.map((v) => countTokens(v.optimizedPrompt)),
      ]);

      patch(id, {
        isAnalyzing: false,
        selectedVariation: 0,
        feedback: '',
        analysis: { response, originalTokens, variationTokens },
      });
    } catch (error) {
      patch(id, {
        isAnalyzing: false,
        error:
          error instanceof UserFacingError
            ? error.message
            : 'Something went wrong optimizing that prompt. Try again.',
      });
    }
  };

  const handleCopy = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const analysis = activeItem?.analysis;
  const selected = analysis?.response.variations[activeItem!.selectedVariation];
  const selectedTokens = analysis?.variationTokens[activeItem!.selectedVariation];
  const savings =
    analysis && selectedTokens
      ? savingsPercent(analysis.originalTokens[0].tokens, selectedTokens[0].tokens)
      : 0;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans selection:bg-blue-200 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">PromptCraft Optimizer</h1>
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" /> by Dipayan
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-6 overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left: library + queue */}
        <div className="w-full lg:w-[22rem] flex flex-col gap-6 shrink-0 h-full">
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-sm">
            <EnhancementsSidebar onSelectEnhancement={handleSelectEnhancement} />
          </div>

          <div className="h-[35%] bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm shrink-0">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Your Prompts
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Upload .txt or .md files"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAddNew}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Add manual prompt"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".txt,.md"
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-8">
              {items.length === 0 ? (
                <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                  No prompts yet. Click + to add one or upload files.
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group',
                      activeId === item.id
                        ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                        : 'bg-white/50 border-slate-200 hover:bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText
                        className={cn(
                          'w-4 h-4 shrink-0',
                          activeId === item.id ? 'text-blue-500' : 'text-slate-400',
                        )}
                      />
                      <span className="text-sm font-medium truncate text-slate-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.isAnalyzing && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                      {!item.isAnalyzing && item.analysis && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {!item.isAnalyzing && item.error && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <div
                        onClick={(e) => handleDelete(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: input + controls */}
        <div className="flex-1 min-w-[400px] flex flex-col h-full overflow-hidden">
          <MethodologyAccordion />

          <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {activeItem ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-400" />
                      {activeItem.name}
                    </h2>

                    <textarea
                      value={activeItem.content}
                      onChange={(e) => handleContentChange(activeItem.id, e.target.value)}
                      placeholder="Paste your prompt here..."
                      className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white resize-y transition-all text-sm leading-relaxed font-mono"
                    />

                    <OptimizerControls
                      options={activeItem.options}
                      disabled={activeItem.isAnalyzing}
                      onChange={(options) => patch(activeItem.id, { options })}
                    />

                    <button
                      onClick={() => handleAnalyze(activeItem.id)}
                      disabled={activeItem.isAnalyzing || !activeItem.content.trim()}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      {activeItem.isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          Analyze &amp; Optimize
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>

                    {activeItem.error && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm">{activeItem.error}</p>
                      </div>
                    )}

                    {/* Multi-turn refinement, available once there is a rewrite to refine. */}
                    {activeItem.analysis && (
                      <div className="pt-2 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Refine this result
                        </label>
                        <textarea
                          value={activeItem.feedback}
                          onChange={(e) => patch(activeItem.id, { feedback: e.target.value })}
                          placeholder="e.g. Keep the examples but make the role more specific..."
                          className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white resize-y text-sm"
                        />
                        <button
                          onClick={() => handleAnalyze(activeItem.id, true)}
                          disabled={activeItem.isAnalyzing || !activeItem.feedback.trim()}
                          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                        >
                          <Wand2 className="w-4 h-4" />
                          Refine with feedback
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Prompt Selected</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Select a prompt from the sidebar, create a new one, or upload .txt/.md files to begin
                  analysis.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: results */}
        <div className="w-full lg:w-[32rem] shrink-0 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
          {activeItem && analysis && selected && selectedTokens ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {analysis.response.degraded && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium mb-1">Offline optimizer used</p>
                      <p className="text-sm leading-relaxed">{analysis.response.degradedReason}</p>
                    </div>
                  </div>
                )}

                {/* Token counts */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Input Tokens
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {analysis.originalTokens.map((original, idx) => {
                      const after = selectedTokens[idx];
                      return (
                        <div key={original.family} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="font-medium text-sm mb-3 text-slate-800 flex items-center gap-1.5">
                            {original.family}
                            {!original.exact && (
                              <span
                                className="text-[10px] font-normal text-slate-400 border border-slate-300 rounded px-1"
                                title={original.note}
                              >
                                est
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-end mb-1">
                            <span className="text-xs text-slate-500">Before</span>
                            <span className="font-mono font-semibold text-slate-500 line-through">
                              {original.tokens.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-slate-500">After</span>
                            <span className="font-mono font-semibold text-blue-600">
                              {after.tokens.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-tight border-t border-slate-200 pt-3 mt-3">
                            {original.note}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Variation switcher */}
                {analysis.response.variations.length > 1 && (
                  <div className="flex gap-2">
                    {analysis.response.variations.map((variation, idx) => (
                      <button
                        key={idx}
                        onClick={() => patch(activeItem.id, { selectedVariation: idx })}
                        title={variation.rationale}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                          activeItem.selectedVariation === idx
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                        )}
                      >
                        Variation {idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Optimized prompt */}
                <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-medium text-slate-200">Optimized Prompt</h3>
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                        {selected.optimizedFormat}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full',
                          savings > 0
                            ? 'text-emerald-400 bg-emerald-400/10'
                            : 'text-slate-400 bg-slate-400/10',
                        )}
                      >
                        <TrendingDown className="w-3 h-3" />
                        {savings > 0 ? `${savings}% fewer tokens` : `${Math.abs(savings)}% more tokens`}
                      </span>
                      <button
                        onClick={() => handleCopy(selected.optimizedPrompt)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-slate-300 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                      {selected.optimizedPrompt}
                    </p>
                  </div>
                  {selected.rationale && (
                    <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50">
                      <p className="text-xs text-slate-400 leading-relaxed">{selected.rationale}</p>
                    </div>
                  )}
                </div>

                {analysis.response.recommendations.length > 0 && (
                  <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5">
                    <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      How to write better prompts
                    </h3>
                    <ul className="space-y-3">
                      {analysis.response.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-blue-800">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-slate-400 text-center">
                  Engine: {analysis.response.engine} · Your prompts are never stored.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <Zap className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Awaiting Generation</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Provide context and click Analyze &amp; Optimize in the middle column to see your
                optimized prompt and token savings here.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
