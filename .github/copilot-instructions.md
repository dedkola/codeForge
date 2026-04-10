# CodeForge — Copilot Instructions

## ⚠️ Next.js Version Warning

This project uses **Next.js 16.2.1** — a version with breaking changes that may differ from training data. Before writing any Next.js code, check `node_modules/next/dist/docs/` for the relevant guide and heed all deprecation notices.

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # local dev server
pnpm lint          # eslint (run before committing)
pnpm build         # production build
```

There is no test suite.

## Architecture

CodeForge is an interactive coding lesson platform. Authenticated users get an isolated, browser-based VS Code environment (code-server) served inside an iframe alongside lesson content.

```
Browser
  ├── Next.js App (app/)
  │     ├── /lessons/[slug]  — split panel: lesson markdown + code-server iframe
  │     ├── /api/auth/[...all]  — Better Auth
  │     └── /api/code-server/{ensure,status,cleanup}
  │
  └── iframe → https://<slug>.codelearn.tkweb.site → per-user code-server pod (--auth=none)
                  └── PVC: /home/coder/project (1 Gi, persists across pod restarts)

K3s cluster (namespace: codelearn)
  ├── Per-user (dynamic): Pod + Service + Ingress + PVC
  └── CronJob: cs-cleanup (runs every 30 min, deletes idle pods)
```

**Key data flow for a lesson page:**

1. Server component authenticates via `auth.api.getSession({ headers: await headers() })`
2. Calls `ensureUserCodeServer(userId)` → creates/checks K8s Pod + Service + Ingress + PVC
3. Returns `{ status: "ready" | "starting" | "error", url }` — URL is the per-user subdomain (`<slug>.codelearn.tkweb.site`)
4. `CodeServerPanel` (client component) polls `/api/code-server/status` every 3s while `status === "starting"`

## Key Modules

| File                              | Responsibility                                                               |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `lib/code-server-manager.ts`      | Re-export barrel — import from here, not the orchestrator directly           |
| `lib/code-server-orchestrator.ts` | Business logic: ensure/stop/cleanup/status for a user's workspace            |
| `lib/code-server-k8s.ts`          | Raw K8s API calls (create/delete Pod, Service, Ingress, PVC)                 |
| `lib/code-server-db.ts`           | PostgreSQL tracking of workspace instances (`code_server_instance` table)    |
| `lib/code-server-config.ts`       | All env-var-driven config constants — single source of truth                 |
| `lib/k8s.ts`                      | K8s client factory (auto-detects in-cluster vs env vars vs local kubeconfig) |
| `lib/auth.ts`                     | Better Auth instance (email/password + Google + GitHub OAuth)                |
| `lib/auth-client.ts`              | Browser-side Better Auth client                                              |
| `lib/db.ts`                       | Shared `pg.Pool` instance                                                    |
| `data/lessons.ts`                 | Static lesson content (no CMS); add new lessons here                         |

## Conventions

**K8s resource naming:** All per-user resources derive from a 32-char hex slug (128-bit entropy): `sha256(userId).hex.slice(0,32)`. Resources are named `cs-<slug>`, `cs-svc-<slug>`, `cs-pvc-<slug>`, `cs-ing-<slug>`. Never hardcode these — use `resourceNames(userId)` from `lib/code-server-k8s.ts`.

**Config constants:** All runtime-tunable values (image, timeouts, domain, storage class) live in `lib/code-server-config.ts`. Import from there — never hardcode in K8s or orchestrator logic.

**DB init:** `instrumentation.ts` calls `ensureTable()` on Node.js startup via Next.js's instrumentation API. Don't call `ensureTable()` elsewhere.

**Auth (server-side):** Always use `auth.api.getSession({ headers: await headers() })` in Server Components and API routes. The `headers()` call must be awaited.

**Force dynamic rendering:** Lesson pages call `await connection()` (from `next/server`) to opt out of static rendering when K8s API calls are needed.

**CSS:** All styling uses CSS custom properties defined in `app/globals.css` (e.g., `--bg-base`, `--accent-primary`, `--text-muted`, `--radius-md`). No Tailwind — use these tokens in inline styles or add utility classes to `globals.css`.

**Path alias:** `@/` maps to the repo root (e.g., `@/lib/auth`, `@/components/TopBar`).

**`"use client"` boundary:** All interactive components (panels, auth forms, layout) are client components. Server components handle auth and K8s calls, then pass data down as props.

## K8s Access Modes

The K8s client (`lib/k8s.ts`) auto-selects:

1. In-cluster via ServiceAccount (when `KUBERNETES_SERVICE_HOST` is set)
2. Remote via `K8S_API_SERVER` + `K8S_AUTH_TOKEN` env vars (e.g., from Vercel through Cloudflare Tunnel)
3. Local `~/.kube/config` (default for local dev)

## Deployment

Docker images are built by GitHub Actions (`.github/workflows/`) and pushed to `ghcr.io/dedkola/codeforge`. Rollout is manual:

```bash
kubectl rollout restart deployment/codeforge -n codelearn
```

Apply K8s manifest changes with:

```bash
kubectl apply -k k8s/           # full stack
kubectl apply -k k8s/overlays/dev/  # dev overlay
```

See `UPDATE.md` for the full operations runbook, troubleshooting, and useful `kubectl` commands.
