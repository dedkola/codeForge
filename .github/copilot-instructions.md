# CodeForge - Copilot Instructions

## Next.js version

This repo runs on **Next.js 16.2.3**. Before changing App Router behavior or Next.js APIs, check the relevant guide in `node_modules/next/dist/docs/` because this version has breaking changes compared with older examples.

## Build, lint, and test commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm exec eslint app/lessons/[slug]/page.tsx
pnpm build
```

There is no automated test suite and no `pnpm test` script configured, so there is no single-test command.

## High-level architecture

CodeForge is a Next.js lesson platform where each authenticated user gets a dedicated browser-based VS Code workspace running in Kubernetes.

- **Lesson flow:** `app/lessons/[slug]/page.tsx` is a server component that authenticates the user, calls `await connection()` to stay dynamic, loads lesson content from `data/lessons.ts`, ensures the user's code-server workspace exists, and passes the workspace URL into the split-panel UI.
- **Auth and persistence:** Better Auth is configured in `lib/auth.ts` against the shared `pg.Pool` in `lib/db.ts`. Workspace lifecycle state is stored in the `code_server_instance` table managed by `lib/code-server-db.ts`.
- **Workspace runtime:** `lib/code-server-manager.ts` is the import surface for workspace actions. It re-exports the orchestrator in `lib/code-server-orchestrator.ts`, which combines PostgreSQL state from `lib/code-server-db.ts`, Kubernetes resource management from `lib/code-server-k8s.ts`, and environment-driven settings from `lib/code-server-config.ts`.
- **Ingress model:** the browser connects directly to a per-user host like `https://<slug>.<domain>` backed by a Pod + Service + Ingress + PVC. The app creates those resources through the Kubernetes API; there is no proxy layer in the Next.js app.
- **Workspace frontend:** `components/CodeServerPanel.tsx` owns the iframe UX. It polls `/api/code-server/status` while a pod is starting, reloads the iframe, and can reset the workspace through `/api/code-server/reset`.
- **Lesson content and templates:** `data/lessons.ts` stores lesson metadata and markdown steps. Lessons can point at a shared starter template with `starterTemplate`; the lesson page and API routes resolve that mapping before building the code-server URL.
- **Workspace image seeding:** `code-server/entrypoint.sh` seeds the PVC-backed workspace from `/home/coder/template` and also creates `/home/coder/ws-<resetCount>/lessons/<templateSlug>` folders for every lesson template slug so each lesson can open a scoped folder inside the same persistent workspace.
- **Startup wiring:** `instrumentation.ts` runs `ensureTable()` on Node.js startup so the `code_server_instance` table exists before workspace orchestration runs.

## Key conventions

- **Import workspace actions from the barrel:** use `@/lib/code-server-manager`, not the orchestrator file directly.
- **Server-side auth pattern:** use `auth.api.getSession({ headers: await headers() })` in server components and route handlers. `headers()` must be awaited.
- **Force dynamic rendering for K8s-backed pages:** lesson pages call `await connection()` before doing Kubernetes work.
- **Do not hand-build workspace URLs:** use `buildCodeServerUrl()` from `lib/code-server-config.ts` so folder paths, reset counters, and lesson template folders stay aligned.
- **Lesson slug resolution matters:** when an API route receives a lesson slug, resolve it through `resolveLessonTemplateSlug()` or `getLessonTemplateSlug()` before building the workspace URL. A lesson's visible slug and its starter template slug may differ.
- **Kubernetes naming is deterministic:** per-user resources are derived from `userSlug(userId)` / `resourceNames(userId)` in `lib/code-server-k8s.ts`. Resource names follow `cs-<slug>`, `cs-svc-<slug>`, `cs-pvc-<slug>`, and `cs-ing-<slug>`.
- **All runtime config lives in one place:** use constants from `lib/code-server-config.ts` for image names, domains, timeouts, resources, and cleanup settings instead of hardcoding values in routes or K8s helpers.
- **Kubernetes access is auto-selected:** `lib/k8s.ts` chooses in-cluster credentials first, then `K8S_API_SERVER` + `K8S_AUTH_TOKEN`, then the local kubeconfig. Reuse that factory instead of creating ad hoc clients.
- **Database bootstrap is centralized:** `instrumentation.ts` owns the `ensureTable()` call. Do not duplicate table initialization elsewhere.
- **Workspace resets are versioned by path:** resetting a workspace increments `reset_count`, which changes the workspace root to `/home/coder/ws-<resetCount>` so code-server does not restore stale editor state from the previous workspace.
- **Styling is not Tailwind-based here:** app styling uses CSS custom properties and shared utility classes from `app/globals.css`, plus inline styles in components. Follow that pattern instead of introducing Tailwind utilities.
- **Lesson slugs are constrained:** lesson and template slugs are expected to match `^[a-z0-9-]+$` because they are reused in workspace folder paths and seed logic.
