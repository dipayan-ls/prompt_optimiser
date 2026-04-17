import { Code2, BookOpen, PenTool, LineChart, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Enhancement {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  template: string;
}

export const ENHANCEMENT_CATEGORIES = [
  {
    id: 'coding',
    title: 'Coding & Dev',
    icon: Code2,
    items: [
      {
        id: 'xml-code-review',
        categoryId: 'coding',
        title: 'Anthropic-style XML Code Review',
        description: 'Frames the prompt to enforce strict XML output tags for codebase review, preventing hallucinated code.',
        template: '<context>\n[Paste your code here]\n</context>\n\n<instructions>\nPerform a strict code review. Output your findings exclusively within <review> XML tags. Do not hallucinate code changes.\n</instructions>',
      },
      {
        id: 'claude-thinking',
        categoryId: 'coding',
        title: 'Claude Thinking-enabled Design',
        description: 'Forces the model to output a <thinking> block before writing functional logic.',
        template: 'Design a [Language/Framework] function that [Describe goal].\n\nBefore writing code, you MUST output a <thinking> block explaining your architectural decisions and edge cases considered.',
      }
    ]
  },
  {
    id: 'research',
    title: 'Research & Analysis',
    icon: BookOpen,
    items: [
      {
        id: 'multi-source',
        categoryId: 'research',
        title: 'Multi-source Synthesis',
        description: 'Sets up strict citation constraints and comparative analysis rules.',
        template: '<source1>\n[Text 1]\n</source1>\n<source2>\n[Text 2]\n</source2>\n\nAnalyze these sources. You must cite claims using [Source X]. Compare their primary arguments.',
      },
      {
        id: 'doc-summarization',
        categoryId: 'research',
        title: 'Academic Document Summarization',
        description: 'Structured academic summarization extracting methodology, results, and limitations.',
        template: 'Summarize the provided academic text.\nOutput format must exactly match:\n1. Hypothesis\n2. Methodology\n3. Key Findings\n4. Limitations',
      }
    ]
  },
  {
    id: 'writing',
    title: 'Writing & Content',
    icon: PenTool,
    items: [
      {
        id: 'seo-blog',
        categoryId: 'writing',
        title: 'SEO-optimized Blog Post',
        description: 'Integrates keyword density constraints and readability formatting rules.',
        template: 'Write a blog post about [Topic].\nTarget Keyword: [Keyword]\nConstraints:\n- Include keyword in H1 and first paragraph\n- Max 800 words\n- Use short, readable sentences',
      },
      {
        id: 'email-sequence',
        categoryId: 'writing',
        title: 'Personalized Multi-email Sequence',
        description: 'Framework for creating high-converting step-by-step email drips.',
        template: 'Create a 3-part email sequence for [Product].\nEmail 1: Value introduction\nEmail 2: Case study/Social proof\nEmail 3: Final CTA / Urgency',
      }
    ]
  },
  {
    id: 'data',
    title: 'Data Analysis',
    icon: LineChart,
    items: [
      {
        id: 'viz-insights',
        categoryId: 'data',
        title: 'Visualization & Insights',
        description: 'Asks the model to act as a data scientist analyzing structured data.',
        template: 'Act as a Senior Data Scientist. I have a dataset with columns: [A, B, C].\n1. Suggest 3 specific charting visualizations.\n2. Identify any obvious anomalies or trends I should look for.',
      }
    ]
  }
];

interface EnhancementsSidebarProps {
  onSelectEnhancement: (template: string) => void;
}

export function EnhancementsSidebar({ onSelectEnhancement }: EnhancementsSidebarProps) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden h-full">
      <div className="shrink-0 pt-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Enhancements Library</h2>
        <p className="text-xs text-slate-400">Select a framework to auto-fill the editor.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-8 scrollbar-thin">
        {ENHANCEMENT_CATEGORIES.map((category) => (
          <div key={category.id} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <category.icon className="w-4 h-4 text-blue-500" />
              {category.title}
            </h3>
            <div className="space-y-2">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectEnhancement(item.template)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors group flex items-start justify-between"
                >
                  <div className="flex-1 pr-3">
                    <div className="text-sm font-medium text-slate-800 group-hover:text-blue-900 mb-0.5">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
