# Privacy Policy for PromptCraft Optimizer

**Last Updated:** April 2026

PromptCraft Optimizer ("we", "our", or "the tool") is designed as a developer utility to optimize language model prompts. This Privacy Policy details how data is handled when you use the open-source tool.

## 1. Information Collection & Usage

### 1.1 No Centralized Data Collection
PromptCraft Optimizer is a client-side (frontend) application hosted statically via GitHub Pages. We do not operate a backend database, nor do we track, collect, or store your personal identity, IP address, or raw prompt text on our proprietary servers.

### 1.2 Prompt Text & Third-Party APIs
When you click "Analyze & Optimize", the prompt text and any uploaded context files are sent directly from your browser to **Google's Gemini API** (Google GenAI). 
- Your prompts are governed by [Google's API Terms of Service and Privacy Policy](https://policies.google.com/privacy). 
- We highly recommend not submitting highly sensitive, proprietary, or personally identifiable information (PII) into the prompt input field.

### 1.3 Telemetry & Meta-Data Storage (GitHub Integration)
To help us improve the tool, PromptCraft Optimizer automatically extracts high-level "prompt engineering recommendations" (e.g., "Use XML tagging here") and appends them to a public `recommendations.md` file in our public GitHub repository. 
- **What is saved:** Only the generalized strategic advice (Recommendations) and the filename/title of your prompt. 
- **What is NOT saved:** Your raw text, context documents, or optimized outputs are **never** synced to this public repository.

## 2. Local Usage & Forking
If you self-host or run PromptCraft Optimizer locally:
- You are responsible for using your own Google Gemini API key.
- You have total control over the GitHub repository connection via the `VITE_GITHUB_TOKEN` environment variable. If you do not configure this, no data will be transmitted out of your local machine other than the direct API request to Google Gemini.

## 3. Changes to this Policy
As this is an open-source project, usage tracking features may evolve. Any changes to data handling will be documented transparently in this file and tracked via Git version history.

---

**Contact:** If you have questions about how data flows through this application, please open an Issue on the GitHub repository.
