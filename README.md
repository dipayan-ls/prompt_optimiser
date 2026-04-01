# Prompt Token Optimizer

A powerful React application that analyzes, estimates, and optimizes LLM prompts across major model families (Gemini, Claude, and ChatGPT). It helps developers and prompt engineers reduce token usage, save costs, and write more efficient instructions without losing critical context.

## Core Features

### 1. Multi-Model Token Estimation
Accurately estimates input and output token consumption for Gemini 3 Pro, Claude (Sonnet & Opus), and ChatGPT (Go & Plus), accounting for their different tokenizers.

### 2. Intelligent Prompt Optimization
Uses Gemini 3.1 Pro (with High Thinking Mode) to rewrite your prompts. 
- **Context Preservation:** Strips out fluff and redundant instructions while strictly preserving proper context, examples, and necessary details.
- **Optimization Cap:** Targets a maximum of ~55% token reduction to ensure the prompt is never over-optimized to the point of losing its complex intent.

### 3. Dynamic Prompt Structuring
The application intelligently analyzes the user's intent and automatically structures the optimized prompt into the most effective format. The UI displays a badge indicating which format was chosen and why:
- **JSON:** Chosen when the prompt involves creating apps with heavy API usage or requires strict data payloads. JSON ensures the receiving LLM understands structured data constraints and outputs machine-readable formats.
- **XML:** Chosen for complex tasks requiring clear sectioning, multi-step instructions, or structured document generation. XML tags help LLMs parse distinct sections of a prompt (like `<context>`, `<instructions>`, `<examples>`) without confusion.
- **Plain Text:** Chosen for research-based prompts, general questions, or simple conversational tasks where structural overhead is unnecessary and plain text is the most token-efficient.

### 4. Advanced Prompt Engineering Insights
Instead of generic advice (like "be specific" or "say please"), the tool provides 3 advanced, highly impactful, and novel prompt engineering insights tailored to your specific prompt. You'll learn techniques like XML tagging, few-shot framing, chain-of-thought structuring, role-prompting nuances, and information density.

### 5. Granular File Analysis
Upload multiple `.txt` or `.md` files at once. The app queues them up, allowing you to analyze and optimize each file individually in a master-detail interface.

### 6. Robust Clipboard Support
Includes a fallback-enabled copy-to-clipboard mechanism to ensure you can easily extract your optimized prompts, even in restrictive browser environments.

## Architecture

- **Frontend Framework:** React 19 with Vite.
- **Styling:** Tailwind CSS (v4) for utility-first styling.
- **Icons:** `lucide-react` for crisp, scalable SVG icons.
- **AI Engine:** `@google/genai` SDK. The core logic relies on `gemini-3.1-pro-preview` utilizing `ThinkingLevel.HIGH` to perform deep reasoning on prompt structures.
- **State Management:** React `useState` and `useRef` to manage the queue of uploaded files and their individual analysis states.

## Prerequisites

To run this application locally, you will need:

1. **Node.js** (v18 or higher recommended)
2. **npm** (comes with Node.js)
3. **Gemini API Key**: You need an active API key from Google AI Studio.

## How to Run Locally

1. **Clone or Download the Repository**
   Extract the files to a folder on your local machine.

2. **Install Dependencies**
   Open your terminal, navigate to the project folder, and run:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   Create a `.env` file in the root directory of the project (next to `package.json`) and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY="your_actual_api_key_here"
   ```
   *(Note: If you are running this outside of the AI Studio environment, you will need to update `vite.config.ts` or `App.tsx` to read from `import.meta.env.VITE_GEMINI_API_KEY` instead of `process.env.GEMINI_API_KEY` depending on your Vite setup).*

4. **Start the Development Server**
   ```bash
   npm run dev -- --port 5175
   ```
   The terminal will output a local URL (`http://localhost:5175`). Open this URL in your browser to use the app.

## How to Distribute

### 1. Build for Production
To create a highly optimized, static version of the application, run:
```bash
npm run build
```
This will generate a `dist` folder containing the compiled HTML, CSS, and JavaScript files.

### 2. Hosting Options

Because this is a Client-Side Single Page Application (SPA), you can host the `dist` folder on almost any static hosting provider:

- **Vercel / Netlify:** Connect your GitHub repository, set the build command to `npm run build`, and the publish directory to `dist`. They will automatically build and deploy your app.
- **GitHub Pages:** You can use the `gh-pages` npm package to deploy the `dist` folder directly to a GitHub repository branch.
- **Docker / Cloud Run:** You can wrap the `dist` folder in an Nginx Docker container and deploy it to Google Cloud Run, AWS ECS, or any container orchestration platform.

**Important Security Note for Distribution:**
If you distribute this application publicly, **do not hardcode your Gemini API key**. You should either:
1. Require users to input their own API key via the UI.
2. Convert the app to a Full-Stack application (e.g., using an Express backend or Next.js API routes) where the API key is kept securely on the server, and the React frontend makes requests to your own backend.
