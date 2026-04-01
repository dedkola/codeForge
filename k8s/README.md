# Kubernetes Deployment Guide for TK Docs

This directory contains Kubernetes manifests for deploying the TK Docs application to a Kubernetes cluster.

## 🚀 Quick Start (Docker Desktop Kubernetes)

```bash
# 1. Enable Kubernetes in Docker Desktop (Settings → Kubernetes)

# 2. Build image locally
docker build -t dedkola/tk-docs:latest .

# 3. Deploy to Kubernetes
kubectl apply -f k8s/

# 4. Check status
kubectl get all

# 5. Access app at http://localhost (LoadBalancer auto-maps to localhost)
kubectl get service tk-docs-service
```

## Prerequisites

**For local development:**

- Docker Desktop with Kubernetes enabled (Settings → Kubernetes → Enable Kubernetes)
- `kubectl` (included with Docker Desktop)
- VS Code Kubernetes Extension (optional but recommended)

**For cloud/remote clusters:**

- Kubernetes cluster (AWS EKS, GCP GKE, Azure AKS, DigitalOcean, etc.)
- `kubectl` configured to access your cluster
- Docker installed for building images
- Container registry access (Docker Hub, GitHub Container Registry, etc.)

## Quick Start

### 1. Build Docker Image

Kubernetes requires a container image.

**For local development (Docker Desktop Kubernetes):**

```bash
# Build the image locally (no push needed)
docker build -t dedkola/tk-docs:latest .

# Image is automatically available to Docker Desktop Kubernetes
```

**For cloud/remote clusters, push to a registry:**

```bash
# Build the image
docker build -t dedkola/tk-docs:latest .

# Login to Docker Hub (or your preferred registry)
docker login

# Push the image
docker push dedkola/tk-docs:latest
```

**Alternative registries:**

- GitHub Container Registry: `ghcr.io/dedkola/tk-docs:latest`
- Google Container Registry: `gcr.io/your-project/tk-docs:latest`
- AWS ECR: `<account-id>.dkr.ecr.<region>.amazonaws.com/tk-docs:latest`

### 2. Update Image Reference (if needed)

The deployment is already configured with `dedkola/tk-docs:latest`.

For Docker Desktop Kubernetes, use the local image name:

```yaml
image: dedkola/tk-docs:latest
imagePullPolicy: IfNotPresent # or Never for local-only images
```

For cloud/remote clusters, use your registry:

```yaml
image: dedkola/tk-docs:latest # or your-registry/tk-docs:latest
imagePullPolicy: Always
```

### 3. Deploy to Kubernetes

**Option A: Using kubectl (command line)**

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml  # Optional
```

**Option B: Using VS Code Kubernetes Extension**

1. Open VS Code
2. Navigate to Kubernetes sidebar (left panel)
3. Right-click on your cluster
4. Select "Apply" → Choose the `k8s` folder
5. Or right-click individual manifest files → "Kubernetes: Apply"

### 4. Verify Deployment

```bash
# Check deployment status
kubectl get deployments
kubectl get pods
kubectl get services

# View logs
kubectl logs -l app=tk-docs -f

# Describe pod for troubleshooting
kubectl describe pod <pod-name>
```

### 5. Access Your Application

**For Docker Desktop Kubernetes:**

```bash
# LoadBalancer will show 'localhost' as EXTERNAL-IP
kubectl get service tk-docs-service

# Access at http://localhost (port 80)
# or http://localhost:80
```

**For cloud clusters (AWS/GCP/Azure):**

```bash
# Get the LoadBalancer external IP (may take 1-2 minutes to provision)
kubectl get service tk-docs-service -w

# Wait for EXTERNAL-IP column to show an IP address
# Then access your app at: http://<EXTERNAL-IP>
```

**Alternative (any cluster):**

```bash
# Use port-forward for custom local port
kubectl port-forward service/tk-docs-service 3000:80
# Access at http://localhost:3000
```

## Accessing Your Application

### Option 1: LoadBalancer (Primary Method)

The service is configured as LoadBalancer type, which automatically provisions an external IP:

```bash
# Get the external IP (may take a minute to provision)
kubectl get service tk-docs-service

# Wait for EXTERNAL-IP (shows <pending> initially)
# Example output:
# NAME               TYPE           EXTERNAL-IP      PORT(S)        AGE
# tk-docs-service    LoadBalancer   203.0.113.10     80:32000/TCP   2m

# Access your application at http://<EXTERNAL-IP>
```

**Cloud-specific notes:**

- **Docker Desktop Kubernetes**: LoadBalancer automatically maps to `localhost` (port 80)
- **AWS EKS**: Creates an ELB (Elastic Load Balancer)
- **GCP GKE**: Creates a Cloud Load Balancer
- **Azure AKS**: Creates an Azure Load Balancer
- **DigitalOcean**: Creates a DigitalOcean Load Balancer
- **Minikube**: Requires `minikube tunnel` for LoadBalancer support
- **Kind**: LoadBalancer shows `<pending>` - use port-forward instead

### Option 2: Port Forward (Quick Testing)

For quick local testing without waiting for LoadBalancer:

```bash
# Forward local port 3000 to the service
kubectl port-forward service/tk-docs-service 3000:80

# Access at http://localhost:3000
```

### Option 3: Ingress (Production with Domain)

For production deployments with custom domains and HTTPS:

1. Update `ingress.yaml` with your domain:

   ```yaml
   host: docs.yourdomain.com # Change this
   ```

2. Apply the ingress:

   ```bash
   kubectl apply -f k8s/ingress.yaml
   ```

3. Get the ingress IP and configure your DNS:

   ```bash
   kubectl get ingress tk-docs-ingress

   # Point your domain A record to the INGRESS-IP
   # Example: docs.yourdomain.com -> 203.0.113.20
   ```

**Note:** If using Ingress, you may want to change the service type back to `ClusterIP` in `service.yaml` to avoid provisioning an unnecessary LoadBalancer.

## Configuration

### Environment Variables

Edit `deployment.yaml` to add environment variables:

```yaml
env:
  - name: NEXT_PUBLIC_SITE_URL
    value: "https://docs.example.com"
  - name: NEXT_PUBLIC_GA_ID
    valueFrom:
      configMapKeyRef:
        name: tk-docs-config
        key: NEXT_PUBLIC_GA_ID
```

### ConfigMap

Edit `configmap.yaml` to add configuration values:

```yaml
data:
  NEXT_PUBLIC_SITE_URL: "https://docs.example.com"
  NEXT_PUBLIC_GA_ID: "G-XXXXXXXXXX"
```

Apply changes:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/tk-docs
```

### Secrets (for sensitive data)

For sensitive information (API keys, tokens):

```bash
# Create a secret
kubectl create secret generic tk-docs-secrets \
  --from-literal=API_KEY=your-secret-key

# Reference in deployment.yaml
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: tk-docs-secrets
      key: API_KEY
```

## Scaling

### Manual Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment tk-docs --replicas=3

# Or edit deployment.yaml and change spec.replicas
```

### Horizontal Pod Autoscaler (HPA)

```bash
# Auto-scale based on CPU usage
kubectl autoscale deployment tk-docs \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

## Updating the Application

### Rolling Update

**For Docker Desktop (local):**

```bash
# Rebuild image with new tag
docker build -t dedkola/tk-docs:v2 .

# Update deployment
kubectl set image deployment/tk-docs \
  tk-docs=dedkola/tk-docs:v2

# Monitor rollout
kubectl rollout status deployment/tk-docs

# Rollback if needed
kubectl rollout undo deployment/tk-docs
```

**For cloud/remote clusters:**

```bash
# Build and push new image with a new tag
docker build -t dedkola/tk-docs:v2 .
docker push dedkola/tk-docs:v2

# Update deployment
kubectl set image deployment/tk-docs \
  tk-docs=dedkola/tk-docs:v2

# Monitor rollout
kubectl rollout status deployment/tk-docs

# Rollback if needed
kubectl rollout undo deployment/tk-docs
```

## Troubleshooting

### Common Issues

**1. ImagePullBackOff**

```bash
# Check image name and credentials
kubectl describe pod <pod-name>

# For private registries, create imagePullSecret
kubectl create secret docker-registry regcred \
  --docker-server=<your-registry> \
  --docker-username=<username> \
  --docker-password=<password>

# Add to deployment.yaml:
# spec:
#   imagePullSecrets:
#   - name: regcred
```

**2. CrashLoopBackOff**

```bash
# View logs
kubectl logs -l app=tk-docs --tail=100

# Check pod events
kubectl describe pod <pod-name>
```

**3. Service Not Accessible**

```bash
# Check service endpoints
kubectl get endpoints tk-docs-service

# Test from within cluster
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
wget -O- http://tk-docs-service
```

## Monitoring and Logs

### View Logs

```bash
# All pods
kubectl logs -l app=tk-docs -f

# Specific pod
kubectl logs <pod-name> -f

# Previous container logs (after crash)
kubectl logs <pod-name> --previous
```

### Pod Shell Access

```bash
kubectl exec -it <pod-name> -- sh
```

### Resource Usage

```bash
kubectl top pods -l app=tk-docs
kubectl top nodes
```

## Cleanup

### Delete All Resources

```bash
# Delete all manifests
kubectl delete -f k8s/

# Or delete individually
kubectl delete deployment tk-docs
kubectl delete service tk-docs-service
kubectl delete ingress tk-docs-ingress
kubectl delete configmap tk-docs-config
```

## Local Kubernetes Testing

### Using Docker Desktop Kubernetes (Recommended)

Docker Desktop includes a single-node Kubernetes cluster that's perfect for local development.

**1. Enable Kubernetes:**

- Open Docker Desktop → Settings → Kubernetes
- Check "Enable Kubernetes"
- Click "Apply & Restart"
- Wait for Kubernetes status to show green

**2. Verify cluster:**

```bash
# Check cluster info
kubectl cluster-info
kubectl get nodes
```

**3. Build and deploy:**

```bash
# Build image locally (automatically available to Docker Desktop k8s)
docker build -t dedkola/tk-docs:latest .

# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get all
```

**4. Access your application:**

```bash
# LoadBalancer automatically maps to localhost
kubectl get service tk-docs-service

# Access at http://localhost (port 80)
# or http://localhost:80
```

**Benefits of Docker Desktop Kubernetes:**

- No additional tools needed (already using Docker)
- LoadBalancer works out of the box (maps to localhost)
- Shares Docker images with local Docker daemon
- Single-click enable/disable
- Resource limits controlled via Docker Desktop settings

**Troubleshooting:**

```bash
# If service shows <pending> for EXTERNAL-IP
kubectl describe service tk-docs-service

# Reset Kubernetes cluster (if needed)
# Docker Desktop → Settings → Kubernetes → Reset Kubernetes Cluster

# Check Docker Desktop resources
# Settings → Resources → Adjust CPU/Memory if needed
```

### Using Minikube (Alternative)

```bash
# Start minikube
minikube start

# Use minikube's Docker daemon (no need to push to registry)
eval $(minikube docker-env)
docker build -t dedkola/tk-docs:latest .

# Apply manifests
kubectl apply -f k8s/

# Access via LoadBalancer (minikube tunnel required)
minikube tunnel  # Run in separate terminal, requires sudo
# Then get external IP: kubectl get service tk-docs-service

# OR use minikube service command (opens in browser)
minikube service tk-docs-service
```

### Using Kind (Kubernetes in Docker)

```bash
# Create cluster
kind create cluster --name tk-docs

# Load image into kind
kind load docker-image dedkola/tk-docs:latest --name tk-docs

# Apply manifests
kubectl apply -f k8s/

# Port forward to access (LoadBalancer not supported)
kubectl port-forward service/tk-docs-service 3000:80
```

## Production Best Practices

1. **Use specific image tags** (not `latest`)

   ```yaml
   image: dedkola/tk-docs:v1.0.0
   ```

2. **Set resource limits** (already configured in deployment.yaml)

3. **Enable health checks** (already configured: liveness & readiness probes)

4. **Use multiple replicas** for high availability

5. **Configure HTTPS** with cert-manager + Let's Encrypt

6. **Use namespaces** for isolation:

   ```bash
   kubectl create namespace tk-docs
   kubectl apply -f k8s/ -n tk-docs
   ```

7. **Add labels and annotations** for better organization

8. **Use Helm** for complex deployments (optional)

9. **For production, push to a registry** (not just local images):

   ```bash
   docker push dedkola/tk-docs:v1.0.0
   ```

   And update `imagePullPolicy` to `Always` in deployment.yaml

## Next Steps

- [ ] Configure ingress with your domain
- [ ] Set up HTTPS with cert-manager
- [ ] Add monitoring (Prometheus/Grafana)
- [ ] Configure persistent storage if needed
- [ ] Set up CI/CD pipeline for automatic deployments
- [ ] Configure backup and disaster recovery

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [VS Code Kubernetes Tools](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
