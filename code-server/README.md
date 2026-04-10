# CodeLearn — Per-User Code-Server

Each authenticated user gets their own isolated code-server pod, created dynamically when they navigate to a lesson.

## Architecture

- **Per-user pods** are created by the Next.js app via the Kubernetes API
- **Traefik Ingress** routes `<slug>.codelearn.tkweb.site` directly to each user's pod (no proxy)
- **`--auth=none`** — users are already authenticated via Better Auth; workspace URLs use 32-char hex slugs (128-bit entropy)
- **Namespace**: `codelearn` (defined in `namespace.yaml`)

## Per-User Resources (created dynamically)

For each user, the app creates:

- **Pod** `cs-<slug>`: `ghcr.io/coder/code-server:4.105.2` with `--auth=none`
- **PVC** `cs-pvc-<slug>`: 1Gi persistent workspace
- **Service** `cs-svc-<slug>`: ClusterIP routing to the pod
- **Ingress** `cs-ing-<slug>`: Traefik Ingress with wildcard TLS (`*.codelearn.tkweb.site`)

These are managed by the Next.js app and cleaned up by a CronJob (see `../k8s/cleanup-cronjob.yaml`).

## Prerequisites

1. Apply the namespace:

   ```bash
   kubectl apply -f namespace.yaml
   ```

2. Apply RBAC so the app can manage pods:

   ```bash
   kubectl apply -f ../k8s/rbac.yaml
   ```

3. Ensure cert-manager is installed with the `letsencrypt-dns-prod` ClusterIssuer and wildcard certificate:

   ```bash
   kubectl apply -f ../k8s/ssl/clusterissuer.yaml
   kubectl apply -f ../k8s/ssl/cert.yaml
   ```

4. Ensure wildcard DNS `*.codelearn.tkweb.site` points to the K3s node and ports 80/443 are forwarded.
