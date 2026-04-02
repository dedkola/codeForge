# CodeLearn — Per-User Code-Server

Each authenticated user gets their own isolated code-server pod, created dynamically when they navigate to a lesson.

## Architecture

- **Per-user pods** are created by the Next.js app via the Kubernetes API
- **cs-proxy** authenticates and proxies traffic to each user's pod (see `../cs-proxy/`)
- **Namespace**: `codelearn` (defined in `namespace.yaml`)

## Per-User Resources (created dynamically)

For each user, the app creates:

- **Pod** `cs-<userSlug>`: `ghcr.io/coder/code-server:4.105.2` with password auth
- **PVC** `cs-pvc-<userSlug>`: 1Gi persistent workspace
- **Service** `cs-svc-<userSlug>`: ClusterIP routing to the pod

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

3. Deploy the proxy service:

   ```bash
   kubectl apply -f ../cs-proxy/k8s/
   ```

4. Create DNS record `cs-proxy.tkweb.site` pointing to the cluster.
