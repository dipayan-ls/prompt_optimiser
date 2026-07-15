# Prompt Optimiser

**An independent prompt optimization tool by Dipayan.**
Live at **[dipayan.shop/prompt_optimiser](https://dipayan.shop/prompt_optimiser/)**

Paste a prompt, get back a rewrite that is clearer, better structured, and cheaper in tokens — plus specific lessons on why. **No API key. No account. No stored prompts.**

---

## What it does

| Capability | How |
| --- | --- |
| **Clarity & specificity** | Model-driven rewrite guided by a prompt-engineering system prompt |
| **Structure** | Auto-selects Text / Markdown / XML / JSON to fit the task |
| **Tone** | 7 presets: neutral, professional, creative, concise, technical, friendly, academic |
| **Length** | Shorten (~40–60%), Preserve, or Expand |
| **Variations** | Up to 3 materially different rewrites per run |
| **Multi-turn refinement** | Give feedback on a result and iterate on it |
| **Token measurement** | Counted with a real tokenizer, not guessed |
| **Multilingual** | Replies in the prompt's own language |

### Token counts are measured, not estimated

Earlier versions asked the model to *estimate* token counts. Language models cannot count their own tokens — those numbers were guesses presented as measurements. The tool now runs the real `o200k_base` tokenizer in your browser.

ChatGPT counts are **exact**. Claude and Gemini are **scaled approximations** (neither tokenizer is public) and are labelled `est` in the UI. The encoder is ~1.5MB, so it lazy-loads on first analysis rather than shipping in the initial bundle.

---

## Architecture

GitHub Pages serves static files and cannot run a model. A static bundle also cannot hold a secret — anything the build injects into JavaScript is readable by every visitor. So inference lives in a Cloudflare Worker, and the static site calls it:

```
Browser (GitHub Pages, dipayan.shop/prompt_optimiser/)
   │  POST /optimize   { prompt, tone, length, variations }
   ▼
Cloudflare Worker  ← GROQ_API_KEY lives here as an encrypted secret
   │
   ├─ 1. GroqAdapter        free tier, fast (default)
   ├─ 2. WorkersAiAdapter   free daily allocation, no third-party key
   └─ 3. rule-based         deterministic, always available
```

Every layer is free tier. The chain falls forward on its own: if Groq is rate-limited, Workers AI answers; if both are down, the deterministic optimizer answers. **The endpoint never 500s** — it degrades, and the UI says so rather than pretending.

If the browser cannot reach the Worker at all, the *same* rule-based optimizer runs client-side. The tool always returns something useful.

### Layout

| Path | Role |
| --- | --- |
| `shared/types.ts` | `ModelAdapter` interface and shared contracts |
| `shared/prompt.ts` | System prompt, tone/length guidance, JSON schema |
| `shared/adapters/` | `groq.ts`, `ollama.ts`, `workersAi.ts` + `createAdapters()` factory |
| `shared/pipeline.ts` | Request validation, fallback chain, timeouts |
| `shared/validate.ts` | JSON recovery, gibberish detection, safety filter |
| `shared/ruleBased.ts` | Deterministic optimizer (runs in browser *and* worker) |
| `worker/index.ts` | Cloudflare Worker: routing, CORS, rate limiting |
| `src/lib/api.ts` | Frontend client + offline fallback |
| `src/lib/tokens.ts` | Real tokenizer |

### Adding a backend

Implement one method and add it to the factory in `shared/adapters/index.ts`:

```ts
export class MyAdapter implements ModelAdapter {
  readonly name = 'my-backend:model';
  async optimize(prompt: string, options: OptimizeOptions, signal: AbortSignal): Promise<ModelResult> {
    // ...call your model, then:
    return validateModelResult(extractJson(raw), options.variations);
  }
}
```

Adapters are pure request/response. Retries, fallback, and timeouts belong to the pipeline — don't reimplement them per adapter.

---

## Local development

```bash
make install
make worker     # API on :8787   (shell 1)
make dev        # UI  on :3000   (shell 2)
```

Vite proxies `/api` → `:8787`, so local dev exercises the same path as production.

With no `GROQ_API_KEY` set, the Worker serves rule-based results — the app works immediately, just without model rewrites. For real rewrites locally, pick one:

**Groq free tier** (fastest — get a key at [console.groq.com/keys](https://console.groq.com/keys)):

```bash
echo 'GROQ_API_KEY="gsk_..."' >> .dev.vars   # gitignored
```

**Ollama** (fully local, nothing leaves your machine):

```bash
make ollama && make ollama-pull    # ~4.7GB, first run only
cat >> .dev.vars <<'EOF'
MODEL_BACKEND="ollama"
OLLAMA_BASE_URL="http://host.docker.internal:11434"
EOF
```

> Ollama is **dev-only**. A visitor's browser cannot reach your machine's localhost, and GitHub Pages has no server to run it on.

```bash
make test     # 63 tests, no network needed
make check    # lint + test + build — run before pushing
```

---

## Deploying

### 1. Deploy the Worker (one-time)

```bash
npx wrangler login
npx wrangler secret put GROQ_API_KEY   # paste the key; encrypted, never in git
npm run deploy:worker
```

Verify it:

```bash
curl https://prompt-optimiser-api.<your-subdomain>.workers.dev/health
# {"ok":true,"engines":["groq:llama-3.3-70b-versatile","workers-ai:..."],"fallback":"rule-based"}
```

### 2. Point the frontend at it

**Option A — cross-origin (works with your DNS as it is today).**

`dipayan.shop` currently CNAMEs straight to `dipayan-ls.github.io`, so there is no proxy in front of it that could route a `/api` path. Use the Worker's own URL:

1. Set the repo **variable** (Settings → Secrets and variables → Actions → **Variables**, *not* Secrets):
   `VITE_API_BASE = https://prompt-optimiser-api.<your-subdomain>.workers.dev`
2. Confirm `ALLOWED_ORIGINS` in `wrangler.toml` includes `https://dipayan.shop`, then redeploy the Worker.

Costs one CORS preflight per request. Otherwise identical.

**Option B — same-origin (nicer, needs a DNS move).**

If you move `dipayan.shop`'s DNS to Cloudflare (free plan; proxied CNAME → `dipayan-ls.github.io` keeps Pages working), you can add a Worker route `dipayan.shop/api/*` → `prompt-optimiser-api` and set `VITE_API_BASE = /api`. No CORS, no preflight, one less origin to trust.

> `VITE_API_BASE` is a **variable, not a secret** — it is just the URL the browser calls. Nothing secret can ever go in a `VITE_` var; Vite inlines them into the public bundle.

If `VITE_API_BASE` is wrong or unset, the app still works — it falls back to the in-browser rule-based optimizer and shows a banner explaining why. Degraded, not broken, and self-diagnosing.

### 3. Push

`git push` runs the tests, builds, and deploys to Pages.

### Abuse protection

The Worker's in-memory limiter (`RATE_LIMIT_PER_MINUTE`, default 12) is **best-effort only** — Worker isolates are per-location and short-lived, so it blunts casual abuse but will not stop a determined caller. For real protection add a **free Cloudflare WAF rate-limiting rule** on the Worker route (Security → WAF → Rate limiting rules), which runs at the edge before the Worker does.

### Cost

| | Free tier | This app's usage |
| --- | --- | --- |
| GitHub Pages | 100GB/mo bandwidth | Static bundle |
| Cloudflare Workers | 100k requests/day | 1 request per optimization |
| Groq | Generous free RPM/RPD | 1 call per optimization |
| Workers AI | 10k neurons/day | Only when Groq is limited |

Nothing here bills. When a free limit is hit, the tool degrades to rule-based rather than failing or charging.

---

## Configuration

Full reference in [`.env.example`](.env.example).

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE` | Frontend (**public**) | `/api` | Worker URL. Empty = offline-only build |
| `MODEL_BACKEND` | Worker `[vars]` | `auto` | `auto` \| `groq` \| `workers-ai` \| `ollama` \| `rule-based` |
| `GROQ_API_KEY` | Worker **secret** | — | `wrangler secret put`. Never in git |
| `GROQ_MODEL` | Worker `[vars]` | `llama-3.3-70b-versatile` | |
| `ALLOWED_ORIGINS` | Worker `[vars]` | `dipayan.shop`, localhost | CORS allowlist |
| `RATE_LIMIT_PER_MINUTE` | Worker `[vars]` | `12` | Per-IP, best-effort. `0` disables |

`MODEL_BACKEND` unset is valid and defaults to `auto`.

---

## Privacy

Prompts are never stored, logged, or written to disk. Responses are `Cache-Control: no-store`. Failures log the adapter name and error kind only — a test asserts that prompt content never reaches the logs.

Two behaviours from earlier versions were removed:

- **Auto-committing to a public repo.** Every analysis used to push recommendations and your prompt's filename to a public `recommendations.md`, with no consent and no opt-out. Removed entirely; earlier entries remain in Git history.
- **Secrets in the bundle.** The build used to inline an API key *and* a GitHub write-access token into the public JavaScript via Vite's `define`. Both are now server-side only. **If you are forking from a commit before this one, revoke those credentials first.**

See [PRIVACY.md](PRIVACY.md).

---

## Edge cases

| Case | Behaviour |
| --- | --- |
| Empty prompt | Blocked in the UI; Worker returns 400 |
| Prompt > 48k chars | Routed to rule-based (no context limit) with an explanation — never silently truncated |
| Prompt > 400k chars | 413 with guidance to split it |
| Model returns fenced JSON or prose | Recovered |
| Model returns gibberish | Detected and rejected → next adapter |
| Model echoes a prompt injection | Rejected, no fallback (fails closed) |
| Model times out (>20s) | Aborted → next adapter |
| Rate limited | Degrades to rule-based, explains why |
| Non-English prompt | Preserved; the gibberish detector is script-aware |

---

## License

See [LICENSE.md](LICENSE.md).
