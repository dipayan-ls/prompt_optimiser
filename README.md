# Prompt Token Optimizer

A powerful React application that analyzes, estimates, and optimizes LLM prompts across major model families (Gemini, Claude, and ChatGPT). It helps developers and prompt engineers reduce token usage, save costs, and write more efficient instructions — without losing critical context.

**Live at:** [https://dipayan.shop/prompt_optimiser/](https://dipayan.shop/prompt_optimiser/)

---

## Table of Contents

1. [Core Features](#core-features)
2. [Architecture](#architecture)
3. [How recommendations.md is Updated](#how-recommendationsmd-is-updated)
4. [Local Development Setup](#local-development-setup)
5. [GitHub Actions Deployment](#github-actions-deployment)
6. [GitHub Secrets Configuration (Required)](#github-secrets-configuration-required)
7. [Custom Domain Setup](#custom-domain-setup)
8. [Troubleshooting](#troubleshooting)

---

## Core Features

### 1. Multi-Model Token Estimation
Estimates input and output token consumption for Gemini 3 Pro, Claude (Sonnet & Opus), and ChatGPT (Go & Plus), accounting for their different tokenizers.

### 2. Intelligent Prompt Optimization
Uses Gemini 3.1 Pro (with `ThinkingLevel.HIGH`) to rewrite prompts with a maximum ~55% token reduction — preserving complete context and intent.

### 3. Dynamic Prompt Structuring
Automatically selects the most effective output format:
- **JSON** — for API-heavy apps or strict data payloads
- **XML** — for complex multi-step tasks, clear sectioning, or structured document generation
- **Plain Text** — for research, general questions, or simple conversational tasks

### 4. Advanced Prompt Engineering Insights
Generates 3–5 tailored, expert-level recommendations per analysis, covering techniques like Chain-of-Thought, Few-Shot Prompting, Role Framing, XML Tagging, Constraint Layering, and more.

### 5. Multi-File Queue
Upload multiple `.txt` or `.md` files at once. The app queues them for individual analysis in a master-detail interface.

### 6. Automatic Recommendation Storage
Every successful analysis **appends** the "How to write better prompts" recommendations to [`recommendations.md`](./recommendations.md) in this repository via the GitHub Contents API — building a permanent, timestamped history.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     dipayan.shop/prompt_optimiser/           │
│               (GitHub Pages via custom domain CNAME)         │
└──────────────────────────┬───────────────────────────────────┘
                           │  serves static assets
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                  React SPA (Vite bundle)                      │
│  ┌───────────────────────────────────────┐                   │
│  │  handleAnalyze()                      │                   │
│  │   └── GoogleGenAI.generateContent()  │──► api.google.com │
│  │   └── saveRecommendationToGit()      │──► api.github.com │
│  └───────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
                           │  appends to
                           ▼
              recommendations.md in GitHub repo
```

**Tech Stack:**
| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| AI Engine | `@google/genai` → `gemini-3.1-pro-preview` with `ThinkingLevel.HIGH` |
| Icons | `lucide-react` |
| Hosting | GitHub Pages → `dipayan.shop` (CNAME) |
| Recommendation Storage | GitHub Contents REST API (authenticated with PAT) |

---

## How `recommendations.md` is Updated

When a user clicks **"Analyze & Optimize"**, the app:

1. Calls the Gemini API and receives a JSON result that includes a `recommendations` array.
2. Immediately updates the UI with the results.
3. Calls `saveRecommendationToGit()` which:
   - **GET** `https://api.github.com/repos/dipayan-ls/prompt_optimiser/contents/recommendations.md` — fetches the current file and its `sha`.
   - **PUT** the same endpoint — sends the current content + a new timestamped entry containing the recommendations, encoded as Base64.

This requires a **GitHub Personal Access Token (PAT)** with `contents:write` permission on this repository, baked into the Vite bundle at build time via `VITE_GITHUB_TOKEN`.

---

## Local Development Setup

### Prerequisites
- **Node.js** v18+
- **npm** v9+
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com)
- *(Optional)* A GitHub PAT with `contents:write` scope for recommendation storage

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/dipayan-ls/prompt_optimiser.git
   cd prompt_optimiser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy `.env.example` to `.env` and fill in your values:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"

   # Optional — enables automatic recommendations.md storage
   VITE_GITHUB_TOKEN="your_github_pat_with_contents_write_scope"
   VITE_GITHUB_REPO="dipayan-ls/prompt_optimiser"
   VITE_RECO_FILE_PATH="recommendations.md"
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## GitHub Actions Deployment

The app is automatically deployed to GitHub Pages on every push to `main` via [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

**Workflow steps:**
1. Checkout source
2. Set up Node.js 20
3. `npm ci` — install dependencies
4. `npm run build` — Vite builds the static bundle, **baking all `VITE_*` env vars from GitHub Secrets into the bundle at compile time**
5. Upload `dist/` as a Pages artifact and deploy

> **Key insight:** Because this is a static SPA, all secrets must be available at **build time**. Vite's `define` plugin substitutes `process.env.VITE_*` variables with their literal string values during bundling. If a secret is missing at build time, Vite substitutes `undefined` — and the GitHub API calls are silently disabled.

---

## GitHub Secrets Configuration (Required)

> **This is a mandatory one-time setup.** Without these secrets, `recommendations.md` will never be updated from the live app.

Go to: **[Repository Settings → Secrets → Actions](https://github.com/dipayan-ls/prompt_optimiser/settings/secrets/actions)**

Add the following **Repository Secrets**:

| Secret Name | Value | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Your Gemini API key | Powers the AI analysis |
| `VITE_GITHUB_TOKEN` | GitHub PAT with `contents:write` scope | Authenticates the recommendations write |
| `VITE_GITHUB_REPO` | `dipayan-ls/prompt_optimiser` | Target repository for the write |
| `VITE_RECO_FILE_PATH` | `recommendations.md` | Target file path in the repo |

**How to create a suitable GitHub PAT:**
1. Go to [GitHub → Settings → Developer Settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **"Generate new token"**
3. Set **Repository access** → *Only select repositories* → `dipayan-ls/prompt_optimiser`
4. Under **Permissions → Repository permissions**, set **Contents** → **Read and write**
5. Click **Generate token** and copy it into the `VITE_GITHUB_TOKEN` secret

After adding all secrets, **trigger a new deployment** to bake the values into the bundle:
- Either push any change to `main`, or
- Go to [Actions tab](https://github.com/dipayan-ls/prompt_optimiser/actions) → Select the workflow → **"Run workflow"**

---

## Custom Domain Setup

The app is served at `https://dipayan.shop/prompt_optimiser/` via a **parent domain CNAME setup**:

- The umbrella domain `dipayan.shop` has its DNS CNAME record pointing to `dipayan-ls.github.io`
- This repository does **not** have a `/public/CNAME` file (the CNAME lives on the parent domain's repo)
- Vite's `base` is set to `/prompt_optimiser/` so all asset paths are correctly scoped
- The custom domain does **not** affect the GitHub Contents API calls — `api.github.com` is called directly from the browser and CORS is permitted for authenticated requests from any origin

---

## Troubleshooting

### `recommendations.md` is not being updated

**Symptom:** Users optimize prompts successfully but `recommendations.md` never gets new entries.

**Diagnosis steps:**
1. Open browser DevTools → Console while using the app
2. Look for either:
   - `"GitHub storage not configured: Set VITE_GITHUB_TOKEN and VITE_GITHUB_REPO in .env"` → **secrets not baked into bundle**
   - `"Failed to sync recommendations to GitHub: ..."` → **API auth or permissions error**
3. Check the bundle: in DevTools → Sources, search for `github_pat` or your token value. If not found, the build ran without the secrets.

**Root cause (confirmed):** The GitHub Actions build was missing `VITE_GITHUB_TOKEN`, `VITE_GITHUB_REPO`, and `VITE_RECO_FILE_PATH` in its `env` block. Vite tree-shook the entire API-call body at build time since all three variables evaluated to `undefined`, leaving only:
```js
// Dead bundle (before fix):
C = async (R, x) => {
  { console.warn("GitHub storage not configured..."); return }
}
```

**Fix applied (commit `0a425c4`):** The deploy workflow now passes all three secrets to `npm run build`. After adding the secrets in GitHub Settings and re-running the workflow, the bundle will contain the full working function.

---

### The custom domain redirect breaks something

**It does not.** The `dipayan.shop → dipayan-ls.github.io` relationship is a DNS CNAME, not an HTTP redirect. The static assets are served directly from `dipayan.shop`. The GitHub Contents API calls go directly to `api.github.com`, which allows CORS from any origin for authenticated requests. The custom domain has no effect on API connectivity.

---

### Build succeeds but old bundle is still served

GitHub Pages caches aggressively. After a new deployment:
- Wait 2–3 minutes for propagation
- Hard-refresh the browser: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- Check the bundle filename in `dist/assets/` — Vite content-hashes the filename, so a changed bundle will always have a different name (e.g., `index-B13BFC53.js` → `index-XXXXXXXX.js`)
