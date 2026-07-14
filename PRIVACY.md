# Privacy Policy for PromptCraft Optimizer

**Last Updated:** July 2026

PromptCraft Optimizer ("the tool") is a developer utility by **Dipayan** for optimizing language model prompts. This policy describes how data is handled.

## 1. What happens to your prompt

When you click "Analyze & Optimize", your prompt is sent from your browser to our optimizer service (a Cloudflare Worker), which forwards it to a model provider to produce the rewrite, then returns the result.

- **Your prompt is never written to disk, logged, or stored.** It exists only in memory for the duration of the request. Responses are served with `Cache-Control: no-store`.
- **No account, no API key, no tracking.** We do not collect your identity, set cookies, or run analytics.
- Your IP address is visible to Cloudflare in transit and is used only for transient, in-memory rate limiting. It is not persisted by us.
- The model provider processes your prompt under its own terms. Avoid pasting secrets, credentials, or personal data into any prompt — here or anywhere else.

If the model provider is unavailable or rate-limited, the tool falls back to a rule-based optimizer that runs entirely in your browser. In that mode your prompt never leaves your device at all. The UI tells you when this happens.

## 2. What we removed

Earlier versions of this tool automatically committed prompt-engineering recommendations, along with your prompt's filename, to a **public** `recommendations.md` file on GitHub. That happened on every analysis, without consent or an opt-out.

**That feature has been removed entirely.** Nothing is written to any repository. Entries committed by previous versions remain in the repository's Git history.

Earlier versions also embedded API credentials in the public JavaScript bundle. That has been fixed: all secrets now live server-side in the Worker and are never sent to the browser.

## 3. Local usage & forking

Run it locally with `MODEL_BACKEND=ollama` and nothing leaves your machine — the model runs on your own hardware. See the README.

Build with `VITE_API_BASE=""` and the tool runs fully offline in the browser using the rule-based optimizer, with no network calls at all.

## 4. Changes to this policy

This is an open-source project. Any change to data handling will be reflected here and is auditable in the Git history.

---

**Contact:** Open an issue on the GitHub repository.
