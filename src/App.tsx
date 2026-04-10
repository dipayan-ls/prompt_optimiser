import { useState, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { Loader2, Sparkles, Zap, ArrowRight, Copy, CheckCircle2, AlertCircle, TrendingDown, Upload, Plus, FileText, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';

interface AnalysisResult {
  analysis: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    reasoning: string;
  }[];
  optimizedPrompt: string;
  optimizedFormat: string;
  savings: number;
  recommendations: string[];
}

interface PromptItem {
  id: string;
  name: string;
  content: string;
  isAnalyzing: boolean;
  result?: AnalysisResult | null;
  error?: string | null;
}

export default function App() {
  const [items, setItems] = useState<PromptItem[]>([
    { id: 'default', name: 'Manual Input', content: '', isAnalyzing: false }
  ]);
  const [activeId, setActiveId] = useState<string | null>('default');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const activeItem = items.find(i => i.id === activeId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: PromptItem[] = await Promise.all(files.map(async (file) => {
      const text = await file.text();
      return {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        content: text,
        isAnalyzing: false
      };
    }));

    setItems(prev => [...prev, ...newItems]);
    setActiveId(newItems[0].id);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddNew = () => {
    const newId = Math.random().toString(36).substring(7);
    setItems(prev => [...prev, { id: newId, name: `Prompt ${prev.length + 1}`, content: '', isAnalyzing: false }]);
    setActiveId(newId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => {
      const filtered = prev.filter(i => i.id !== id);
      if (activeId === id) {
        setActiveId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleContentChange = (id: string, newContent: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, content: newContent, result: null, error: null } : i));
  };

  const handleAnalyze = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.content.trim()) return;
    
    setItems(prev => prev.map(i => i.id === id ? { ...i, isAnalyzing: true, error: null, result: null } : i));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Analyze the following prompt for token usage across Gemini 3 Pro, Claude (Sonnet & Opus), and ChatGPT (Go & Plus).
        
        Original Prompt:
        """
        ${item.content}
        """
        
        Tasks:
        1. Estimate the input tokens for the original prompt for each model family (they use different tokenizers, so estimates will vary slightly).
        2. Estimate the expected output tokens based on what the prompt is asking the AI to do. Provide a brief reasoning.
        3. Rewrite and optimize the prompt to consume fewer input tokens while achieving the exact same goal. CRITICAL: Target a maximum of ~55% token reduction. DO NOT over-optimize. You MUST preserve proper context, examples, and necessary details so the receiving AI fully understands the complex intent in a single prompt. Keep the prompt comprehensive but efficient.
           IMPORTANT FORMATTING RULE: Choose the best structural format for the optimized prompt based on the user's intent:
           - Use JSON format if the user is trying to create an app with heavy API usage or requires strict data payloads.
           - Use XML format for complex tasks requiring clear sectioning, multi-step instructions, or structured document generation.
           - Use Plain Text for research-based prompts, general questions, or simple conversational tasks.
        4. Estimate the percentage of input tokens saved by your optimized prompt (should not exceed ~55%).
        5. Provide 3-5 advanced, highly impactful, and novel prompt engineering insights specific to this prompt. 
           Incorporate and teach the following expert techniques where relevant to this specific task:
           - Chain-of-Thought (CoT): Guide the model to reason step-by-step.
           - Few-Shot Prompting: Provide clear illustrative examples.
           - Role + Context Framing: Establish a high-authority persona and rich situation.
           - XML / Structural Tagging: Use tags like <instructions> or <context> for clarity.
           - Negative Prompting: Explicitly list what NOT to do.
           - Self-Consistency: Ask for multiple paths and a final selection.
           - Skeleton / Scaffolded Prompting: Provide a template for the output.
           - Constraint Layering: Stack requirements in priority order.
           - Meta-Prompting: Direct the model to improve its own instructions.
           - Iterative Refinement: Have the model critique and rewrite its initial draft.
           - Persona Anchoring with Stakes: Assign specific consequences to performance.
           - Output Format Specification: Use strict format schemas.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    model: { type: Type.STRING, description: "Model name (e.g., 'Gemini 3 Pro', 'Claude 3.5 Sonnet/Opus', 'ChatGPT Go/Plus')" },
                    inputTokens: { type: Type.NUMBER, description: "Estimated input tokens for the original prompt" },
                    outputTokens: { type: Type.NUMBER, description: "Estimated output tokens based on the prompt instructions" },
                    reasoning: { type: Type.STRING, description: "Brief reasoning for the output token estimation" }
                  },
                  required: ["model", "inputTokens", "outputTokens", "reasoning"]
                }
              },
              optimizedPrompt: { type: Type.STRING, description: "The rewritten prompt optimized for minimal token usage without losing intent" },
              optimizedFormat: { type: Type.STRING, description: "The format chosen for the optimized prompt: 'JSON', 'XML', or 'Text'" },
              savings: { type: Type.NUMBER, description: "Estimated percentage of input tokens saved by the optimized prompt (e.g., 25)" },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Actionable recommendation to write better prompts" }
              }
            },
            required: ["analysis", "optimizedPrompt", "optimizedFormat", "savings", "recommendations"]
          }
        }
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as AnalysisResult;
        setItems(prev => prev.map(i => i.id === id ? { ...i, isAnalyzing: false, result: parsedResult } : i));
        
        // Save to recommendations.md incrementally
        saveRecommendationToGit(item.name, parsedResult.recommendations);
      } else {
        throw new Error("Failed to generate analysis.");
      }
    } catch (err: any) {
      console.error(err);
      setItems(prev => prev.map(i => i.id === id ? { ...i, isAnalyzing: false, error: err.message || "An error occurred while analyzing the prompt." } : i));
    }
  };

  const saveRecommendationToGit = async (promptName: string, recommendations: string[]) => {
    const token = process.env.VITE_GITHUB_TOKEN;
    const repo = process.env.VITE_GITHUB_REPO;
    const filePath = process.env.VITE_RECO_FILE_PATH || 'recommendations.md';

    if (!token || !repo || token === "your_github_personal_access_token") {
      console.warn("GitHub storage not configured: Set VITE_GITHUB_TOKEN and VITE_GITHUB_REPO in .env");
      return;
    }

    try {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
      
      // 1. Get current file content (if exists)
      let currentContent = "";
      let sha = "";
      
      const res = await fetch(apiUrl, {
        headers: { 
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        currentContent = decodeURIComponent(escape(atob(data.content)));
        sha = data.sha;
      }

      // 2. Prepare new entry
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'UTC', 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      });
      
      const newEntry = `\n## [${promptName}] - ${timestamp} UTC\n\n` + 
        recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') + 
        "\n\n---\n";

      const updatedContent = currentContent + newEntry;

      // 3. Update file
      await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Update recommendations for ${promptName}`,
          content: btoa(unescape(encodeURIComponent(updatedContent))),
          sha: sha || undefined
        })
      });
      
      console.log(`Stored ${recommendations.length} recommendations to ${filePath}`);
    } catch (err) {
      console.error("Failed to sync recommendations to GitHub:", err);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans selection:bg-blue-200 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Token Optimizer</h1>
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
            Powered by <Sparkles className="w-4 h-4 text-blue-500" /> Gemini 3.1 Pro
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Left Sidebar: File Queue */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 h-full">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Your Prompts</h2>
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
              items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group",
                    activeId === item.id 
                      ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500" 
                      : "bg-white/50 border-slate-200 hover:bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className={cn("w-4 h-4 shrink-0", activeId === item.id ? "text-blue-500" : "text-slate-400")} />
                    <span className="text-sm font-medium truncate text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isAnalyzing && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                    {!item.isAnalyzing && item.result && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {!item.isAnalyzing && item.error && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
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

        {/* Right Content: Active Item Details */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
          {activeItem ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-8 pb-8">
                
                {/* Input Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-400" />
                      {activeItem.name}
                    </h2>
                  </div>
                  
                  <textarea
                    value={activeItem.content}
                    onChange={(e) => handleContentChange(activeItem.id, e.target.value)}
                    placeholder="Paste your prompt here..."
                    className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white resize-y transition-all text-sm leading-relaxed font-mono"
                  />

                  <button
                    onClick={() => handleAnalyze(activeItem.id)}
                    disabled={activeItem.isAnalyzing || !activeItem.content.trim()}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {activeItem.isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing with High Thinking...
                      </>
                    ) : (
                      <>
                        Analyze & Optimize
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
                </div>

                {/* Results Section */}
                {activeItem.result && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 border-t border-slate-100 pt-8">
                    
                    {/* Token Estimates Grid */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Estimated Token Usage
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {activeItem.result.analysis.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="font-medium text-sm mb-3 text-slate-800">{item.model}</div>
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs text-slate-500">Input</span>
                              <span className="font-mono font-semibold text-blue-600">{item.inputTokens}</span>
                            </div>
                            <div className="flex justify-between items-end mb-3">
                              <span className="text-xs text-slate-500">Output (Est.)</span>
                              <span className="font-mono font-semibold text-orange-600">{item.outputTokens}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-tight border-t border-slate-200 pt-3 mt-1">
                              {item.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Optimized Prompt */}
                    <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-sm font-medium text-slate-200">Optimized Prompt</h3>
                          <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                            {activeItem.result.optimizedFormat}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-400/10 px-2 py-1 rounded-full">
                            <TrendingDown className="w-3 h-3" />
                            ~{activeItem.result.savings}% tokens saved
                          </span>
                          <button
                            onClick={() => handleCopy(activeItem.result!.optimizedPrompt)}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Copy to clipboard"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-300 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                          {activeItem.result.optimizedPrompt}
                        </p>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5">
                      <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        How to write better prompts
                      </h3>
                      <ul className="space-y-3">
                        {activeItem.result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm text-blue-800">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Prompt Selected</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Select a prompt from the sidebar, create a new one, or upload .txt/.md files to begin analysis.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
