# Flux Fleet Repo Update Guide

After the April 2026 refactor, the CodeForge Kubernetes manifests moved to a Kustomize-based structure and a dedicated `cs-proxy` image was introduced. Your `dedkola/fleet` Flux repo needs the following updates.

---

## Summary of changes needed

| Resource | Action | Why |
|----------|--------|-----|
| `Kustomization/codeforge` | **Update `path`** | Manifests moved to `k8s/overlays/prod` |
| `ImageRepository/codeforge-cs-proxy` | **Create** | New image: `ghcr.io/dedkola/codeforge/cs-proxy` |
| `ImagePolicy/codeforge-cs-proxy` | **Create** | Flux needs a policy to pick the latest cs-proxy tag |
| `ImageUpdateAutomation/codeforge` | **Verify `update.path`** | Must cover `./k8s` to update both deployments |
| `GitRepository/codeforge` | Verify | URL and branch should still be correct |
| `ImageRepository/codeforge` | Verify | Image path unchanged |
| `ImagePolicy/codeforge` | Verify | Tag pattern unchanged |

---

## 1. Update the Kustomization path

The old manifest layout (flat `k8s/` or `code-server/`) has been replaced with a Kustomize base/overlays structure.

**Find your existing Kustomization** (likely named `codeforge`) and update the `path`:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: codeforge
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: codeforge
  # OLD (one of these):
  #   path: ./k8s
  #   path: ./code-server
  # NEW:
  path: ./k8s/overlays/prod
  prune: true
  targetNamespace: codelearn
```

**Alternative:** You can also use `path: ./k8s` — the root `k8s/kustomization.yaml` is an umbrella that points to `overlays/prod`. Both work the same way.

---

## 2. Create ImageRepository for cs-proxy

The cs-proxy now has its own container image at `ghcr.io/dedkola/codeforge/cs-proxy`. Flux needs to watch it for new tags.

**Create this new file** in your fleet repo:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: codeforge-cs-proxy
  namespace: flux-system
spec:
  image: ghcr.io/dedkola/codeforge/cs-proxy
  interval: 1m
  secretRef:
    name: ghcr-auth   # your existing GHCR credentials secret in flux-system
```

> If your GHCR secret has a different name, adjust `secretRef.name` accordingly. Check your existing `ImageRepository/codeforge` for the correct secret name.

---

## 3. Create ImagePolicy for cs-proxy

The cs-proxy uses the same tag format as the main app: `YYYYMMDDHHmmss-<sha>` (e.g., `20260401162731-e15bc10`).

**Create this new file** in your fleet repo:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: codeforge-cs-proxy
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: codeforge-cs-proxy
  filterTags:
    pattern: '^(?P<ts>\d{14})-[a-f0-9]+$'
    extract: '$ts'
  policy:
    alphabetical:
      order: asc
```

This selects the tag with the latest timestamp, which is the most recent build.

---

## 4. Verify ImageUpdateAutomation covers both deployments

Your existing `ImageUpdateAutomation` must scan the `./k8s` directory (not just `./k8s/base`) so it finds the `$imagepolicy` markers in both deployment files.

**Check your existing resource** and ensure `update.path` is `./k8s`:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: codeforge
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: codeforge
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        name: flux
        email: flux@tkweb.site
      messageTemplate: 'chore: update image tags'
    push:
      branch: main
  update:
    path: ./k8s       # Must be ./k8s to cover both base/ and overlays/
    strategy: Setters
```

The `$imagepolicy` markers that Flux will find:

| File | Marker |
|------|--------|
| `k8s/base/deployment.yaml` | `{"$imagepolicy": "flux-system:codeforge"}` |
| `k8s/base/cs-proxy/deployment.yaml` | `{"$imagepolicy": "flux-system:codeforge-cs-proxy"}` |
| `k8s/deployment.yaml` | `{"$imagepolicy": "flux-system:codeforge"}` |

---

## 5. Verify existing resources

These should already exist. Just confirm they are still correct after the refactor.

### GitRepository

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: codeforge
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/dedkola/codeForge
  ref:
    branch: main
  # If private repo:
  secretRef:
    name: github-auth   # your existing GitHub credentials
```

### ImageRepository (main app)

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: codeforge
  namespace: flux-system
spec:
  image: ghcr.io/dedkola/codeforge
  interval: 1m
  secretRef:
    name: ghcr-auth
```

### ImagePolicy (main app)

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: codeforge
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: codeforge
  filterTags:
    pattern: '^(?P<ts>\d{14})-[a-f0-9]+$'
    extract: '$ts'
  policy:
    alphabetical:
      order: asc
```

---

## 6. Verification after applying changes

Run these commands on your k3s cluster to verify Flux is working:

```bash
# Check all Flux resources are healthy
flux get all -n flux-system

# Specifically check image policies are resolving
flux get image policy -n flux-system
# Expected output should show latest tags for both:
#   codeforge            ghcr.io/dedkola/codeforge:20260401...-...
#   codeforge-cs-proxy   ghcr.io/dedkola/codeforge/cs-proxy:20260401...-...

# Check the Kustomization is reconciling
flux get kustomizations -n flux-system
# codeforge should show "Ready" with the new path

# Check image update automation is running
flux get image update -n flux-system

# Verify deployed images match the latest tags
kubectl get deployment codeforge -n codelearn -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl get deployment cs-proxy -n codelearn -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## 7. Suggested fleet repo file structure

```
fleet/
├── clusters/
│   └── k3s/                          # or whatever your cluster is named
│       ├── codeforge-source.yaml     # GitRepository
│       ├── codeforge-kustomization.yaml  # Kustomization (UPDATE path here)
│       ├── codeforge-images.yaml     # ImageRepository + ImagePolicy for main app
│       ├── codeforge-cs-proxy-images.yaml  # NEW: ImageRepository + ImagePolicy for cs-proxy
│       └── codeforge-image-update.yaml    # ImageUpdateAutomation (verify update.path)
```

> Your actual structure may differ. The key is that all the resources listed above exist somewhere in the fleet repo and are reconciled by Flux.

---

## 8. Quick checklist

- [ ] Updated `Kustomization/codeforge` path to `./k8s/overlays/prod` (or `./k8s`)
- [ ] Created `ImageRepository/codeforge-cs-proxy` for `ghcr.io/dedkola/codeforge/cs-proxy`
- [ ] Created `ImagePolicy/codeforge-cs-proxy` with tag filter `^\d{14}-[a-f0-9]+$`
- [ ] Verified `ImageUpdateAutomation` `update.path` is `./k8s`
- [ ] Verified `GitRepository` URL and branch are correct
- [ ] Verified existing `ImageRepository` and `ImagePolicy` for main app are unchanged
- [ ] Pushed changes to fleet repo
- [ ] Ran `flux reconcile source git flux-system` to trigger immediate sync
- [ ] Checked `flux get all` shows all resources healthy
