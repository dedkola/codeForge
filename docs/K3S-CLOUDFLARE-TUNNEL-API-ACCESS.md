# K3s API Access via Cloudflare Tunnel

Expose your K3s API server through a Cloudflare Tunnel so that CodeForge (hosted on Vercel, a VPS, or any external machine) can manage code-server pods remotely.

## Overview

```
CodeForge (Vercel / VPS)            Cloudflare Edge            K3s Node
  │                                     │                        │
  │  K8S_API_SERVER=                    │                        │
  │  https://k8s.tkweb.site            │                        │
  │  ─────────────────────────────────► │                        │
  │                                     │  cloudflared tunnel    │
  │                                     │  ──────────────────►   │
  │                                     │     localhost:6443     │
  │                                     │                        │
  │  ◄───────── K8s API response ────── │ ◄───────────────────── │
```

The tunnel lets you avoid opening port 6443 to the internet. All traffic is encrypted end-to-end through Cloudflare's network.

---

## Prerequisites

- A K3s cluster already running (single node is fine)
- A Cloudflare account with your domain (`tkweb.site`) added
- `cloudflared` installed on the K3s node
- `kubectl` access to the cluster (SSH or local)

---

## Step 1 — Authenticate cloudflared

On the K3s node:

```bash
cloudflared tunnel login
```

This opens a browser. Select your domain (`tkweb.site`). A certificate is saved to `~/.cloudflared/cert.pem`.

---

## Step 2 — Create the tunnel

```bash
cloudflared tunnel create k3s-api
```

This generates a tunnel ID and a credentials file at:

```
~/.cloudflared/<TUNNEL_ID>.json
```

Note the **tunnel ID** — you'll need it in the next steps.

---

## Step 3 — Configure the tunnel

Create (or edit) `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  # K8s API server
  - hostname: k8s.tkweb.site
    service: https://localhost:6443
    originRequest:
      noTLSVerify: true # K3s uses a self-signed cert on 6443

  # Catch-all (required by cloudflared)
  - service: http_status:404
```

> **Note**: `noTLSVerify: true` tells cloudflared to accept the K3s self-signed certificate on the local connection. The traffic between Cloudflare edge and the client is still TLS-encrypted.

---

## Step 4 — Create a DNS record for the tunnel

```bash
cloudflared tunnel route dns k3s-api k8s.tkweb.site
```

This creates a CNAME record `k8s.tkweb.site → <TUNNEL_ID>.cfargotunnel.com` in Cloudflare DNS.

---

## Step 5 — Run the tunnel

**Quick test:**

```bash
cloudflared tunnel run k3s-api
```

**As a systemd service (production):**

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

Verify the tunnel is online:

```bash
cloudflared tunnel info k3s-api
```

---

## Step 6 — Create a ServiceAccount token for CodeForge

On the K3s node (or anywhere with kubectl access), apply the CodeForge RBAC that already exists in the repo:

```bash
kubectl apply -k k8s/
```

This creates the `codeforge-sa` ServiceAccount in the `codelearn` namespace with permissions to manage pods, services, PVCs, and ingresses.

Now create a long-lived token for the ServiceAccount:

```bash
kubectl -n codelearn create token codeforge-sa --duration=8760h
```

This gives you a JWT valid for 1 year. Copy it — this is your `K8S_AUTH_TOKEN`.

> **Alternative — non-expiring Secret-bound token** (if your cluster supports it):
>
> ```yaml
> apiVersion: v1
> kind: Secret
> metadata:
>   name: codeforge-sa-token
>   namespace: codelearn
>   annotations:
>     kubernetes.io/service-account.name: codeforge-sa
> type: kubernetes.io/service-account-token
> ```
>
> ```bash
> kubectl apply -f - <<EOF
> apiVersion: v1
> kind: Secret
> metadata:
>   name: codeforge-sa-token
>   namespace: codelearn
>   annotations:
>     kubernetes.io/service-account.name: codeforge-sa
> type: kubernetes.io/service-account-token
> EOF
>
> kubectl -n codelearn get secret codeforge-sa-token -o jsonpath='{.data.token}' | base64 -d
> ```

---

## Step 7 — Verify API access through the tunnel

From any external machine:

```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  https://k8s.tkweb.site/api/v1/namespaces/codelearn/pods | head -20
```

You should get a JSON response listing pods in the `codelearn` namespace (empty list is fine).

If you get a 403 — the token works but RBAC blocks the request (check Role/RoleBinding).
If you get a connection error — the tunnel isn't running or DNS hasn't propagated.

---

## Step 8 — Configure CodeForge environment

In your `.env.local` (or Vercel environment variables):

```bash
K8S_API_SERVER=https://k8s.tkweb.site
K8S_AUTH_TOKEN=<the token from Step 6>
K8S_SKIP_TLS_VERIFY=false
K8S_NAMESPACE=codelearn
```

`K8S_SKIP_TLS_VERIFY=false` is correct here — Cloudflare Tunnel provides a valid TLS certificate for `k8s.tkweb.site`, so there's no need to skip verification.

How this maps to `lib/k8s.ts`:

```typescript
// When K8S_API_SERVER + K8S_AUTH_TOKEN are set, the client connects via:
kc.loadFromOptions({
  clusters: [
    { name: "remote", server: "https://k8s.tkweb.site", skipTLSVerify: false },
  ],
  users: [{ name: "token-user", token: "<TOKEN>" }],
  contexts: [{ name: "remote-ctx", cluster: "remote", user: "token-user" }],
  currentContext: "remote-ctx",
});
```

---

## Step 9 — Test end-to-end

1. Start CodeForge locally: `pnpm dev`
2. Log in and open a lesson
3. Click "Start" — the API should create a pod, service, and ingress in K3s through the tunnel
4. The iframe loads `https://<slug>.tkweb.site` (this goes through your wildcard ingress, NOT the tunnel)

---

## Security considerations

| Concern                     | Mitigation                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| K8s API exposed to internet | Protected by ServiceAccount token (bearer auth). No anonymous access.                                             |
| Token theft                 | Store token in Vercel encrypted env vars or a secrets manager. Rotate annually.                                   |
| Tunnel compromise           | cloudflared uses outbound-only connections — no open inbound ports on K3s node.                                   |
| RBAC scope                  | `codeforge-sa` is scoped to `codelearn` namespace only. Cannot access other namespaces or cluster-wide resources. |
| Brute force                 | Cloudflare rate-limiting + WAF can be enabled on `k8s.tkweb.site` for extra protection.                           |

---

## Troubleshooting

| Problem                              | Fix                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `connection refused` from CodeForge  | Tunnel not running. Check `systemctl status cloudflared`.                                                      |
| `401 Unauthorized`                   | Token expired or invalid. Regenerate with `kubectl create token`.                                              |
| `403 Forbidden`                      | RBAC issue. Verify the Role has the right verbs/resources and the RoleBinding matches.                         |
| DNS not resolving                    | Run `cloudflared tunnel route dns k3s-api k8s.tkweb.site` again. Check Cloudflare DNS dashboard.               |
| Tunnel shows "inactive"              | Restart: `sudo systemctl restart cloudflared`. Check logs: `journalctl -u cloudflared -f`.                     |
| Pods created but iframe doesn't load | K8s API tunnel works but wildcard ingress doesn't. These are separate — check `*.tkweb.site` DNS and TLS cert. |

---

## Architecture summary

Two separate network paths:

1. **K8s API** (`k8s.tkweb.site`): CodeForge → Cloudflare Tunnel → K3s API server (port 6443)
2. **Code-server** (`*.tkweb.site`): Browser iframe → Cloudflare DNS → K3s nginx-ingress → code-server pod

The tunnel is only for the API management plane. User traffic to code-server goes through regular ingress.
