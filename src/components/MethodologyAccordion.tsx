import { useState } from 'react';
import { ChevronDown, Beaker, ListOrdered } from 'lucide-react';
import { cn } from '../lib/utils';

export function MethodologyAccordion() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden mb-6 transition-all duration-300">
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
          <div className="p-5 border-t border-slate-200 space-y-6">
            
            {/* The Science of Prompting */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                The Science of Prompting
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-100">
                We don't just rewrite your text; we engineer it. Using Gemini 3.1 Pro's high-level thinking capabilities,
                we analyze your intent and restructure it using proven techniques like Chain-of-Thought, XML scaffolding,
                and constraint layering. The result is a prompt that costs up to <strong>55% less in tokens</strong> while
                delivering significantly better AI performance.
              </p>
            </div>

            {/* Step-by-Step Guide */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                Step-by-Step Guide
              </h3>
              <div className="space-y-3 pl-3">
                <div className="flex gap-3 text-sm text-slate-600 items-start">
                  <div className="w-5 h-5 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs mt-0.5">1</div>
                  <p><strong>Choose a Framework (Optional):</strong> Select a specialized task from our Enhancements Library on the left.</p>
                </div>
                <div className="flex gap-3 text-sm text-slate-600 items-start">
                  <div className="w-5 h-5 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs mt-0.5">2</div>
                  <p><strong>Provide Context:</strong> Type out your raw goal, objective or upload context documents below.</p>
                </div>
                <div className="flex gap-3 text-sm text-slate-600 items-start">
                  <div className="w-5 h-5 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs mt-0.5">3</div>
                  <p><strong>Generate:</strong> Click 'Analyze & Optimize' to let our engine construct the perfect prompt.</p>
                </div>
                <div className="flex gap-3 text-sm text-slate-600 items-start">
                  <div className="w-5 h-5 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs mt-0.5">4</div>
                  <p><strong>Copy & Deploy:</strong> Take your token-efficient prompt and deploy it in Claude, ChatGPT, or Gemini.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
