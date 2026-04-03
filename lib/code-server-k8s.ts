import { createHash } from "crypto";
import { getCoreV1Api, NAMESPACE } from "./k8s";
import {
  CODE_SERVER_IMAGE,
  CODE_SERVER_PVC_SIZE,
  CODE_SERVER_STORAGE_CLASS,
} from "./code-server-config";

/** Produce a K8s-safe slug from a user ID (lowercase hex, 12 chars). */
export function userSlug(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

export function resourceNames(userId: string) {
  const slug = userSlug(userId);
  return {
    pod: `cs-${slug}`,
    svc: `cs-svc-${slug}`,
    pvc: `cs-pvc-${slug}`,
    slug,
  };
}

function userResourceLabels(slug: string): Record<string, string> {
  return {
    app: "code-server-user",
    userId: slug,
    "app.kubernetes.io/name": "code-server",
    "app.kubernetes.io/part-of": "codeforge",
    "app.kubernetes.io/managed-by": "codeforge-runtime",
  };
}

function shouldRecreatePodOnState(phase: string | undefined): boolean {
  return phase === "Failed" || phase === "Succeeded";
}

function hasRecoverableContainerError(
  containerStatuses:
    | Array<{
        state?: {
          waiting?: {
            reason?: string;
          };
        };
      }>
    | undefined,
): boolean {
  const recoverableReasons = new Set([
    "ErrImagePull",
    "ImagePullBackOff",
    "CrashLoopBackOff",
    "CreateContainerConfigError",
    "CreateContainerError",
    "RunContainerError",
    "InvalidImageName",
  ]);

  return (containerStatuses ?? []).some((status) => {
    const reason = status.state?.waiting?.reason;
    return !!reason && recoverableReasons.has(reason);
  });
}

async function waitForPodDeletion(
  name: string,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await getCoreV1Api().readNamespacedPod({ name, namespace: NAMESPACE });
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      return;
    }
  }
}

export async function createPVC(userId: string): Promise<void> {
  const { pvc, slug } = resourceNames(userId);
  try {
    await getCoreV1Api().readNamespacedPersistentVolumeClaim({
      name: pvc,
      namespace: NAMESPACE,
    });
    return; // already exists
  } catch {
    // does not exist, create it
  }

  await getCoreV1Api().createNamespacedPersistentVolumeClaim({
    namespace: NAMESPACE,
    body: {
      metadata: {
        name: pvc,
        namespace: NAMESPACE,
        labels: userResourceLabels(slug),
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        storageClassName: CODE_SERVER_STORAGE_CLASS,
        resources: { requests: { storage: CODE_SERVER_PVC_SIZE } },
      },
    },
  });
}

export async function createPod(userId: string): Promise<void> {
  const { pod, pvc, slug } = resourceNames(userId);
  try {
    const existing = await getCoreV1Api().readNamespacedPod({
      name: pod,
      namespace: NAMESPACE,
    });

    const phase = existing.status?.phase;
    const containerStatuses =
      existing.status?.containerStatuses?.map((status) => ({
        state: {
          waiting: {
            reason: status.state?.waiting?.reason,
          },
        },
      })) ?? [];

    if (
      !shouldRecreatePodOnState(phase) &&
      !hasRecoverableContainerError(containerStatuses)
    ) {
      return; // healthy enough to keep
    }

    await getCoreV1Api().deleteNamespacedPod({
      name: pod,
      namespace: NAMESPACE,
    });
    await waitForPodDeletion(pod);
  } catch {
    // does not exist, create it
  }

  await getCoreV1Api().createNamespacedPod({
    namespace: NAMESPACE,
    body: {
      metadata: {
        name: pod,
        namespace: NAMESPACE,
        labels: userResourceLabels(slug),
      },
      spec: {
        containers: [
          {
            name: "code-server",
            image: CODE_SERVER_IMAGE,
            args: [
              "--bind-addr=0.0.0.0:80",
              "--auth=none",
              "--disable-telemetry",
              "/home/coder/project",
            ],
            ports: [{ containerPort: 80 }],
            env: [
              { name: "HOME", value: "/home/coder" },
              { name: "CS_DISABLE_IFRAME_PROTECTION", value: "true" },
            ],
            resources: {
              requests: { memory: "256Mi", cpu: "100m" },
              limits: { memory: "512Mi", cpu: "500m" },
            },
            volumeMounts: [
              { name: "workspace", mountPath: "/home/coder/project" },
            ],
            readinessProbe: {
              httpGet: { path: "/healthz", port: 80 },
              initialDelaySeconds: 5,
              periodSeconds: 3,
            },
            livenessProbe: {
              httpGet: { path: "/healthz", port: 80 },
              initialDelaySeconds: 15,
              periodSeconds: 10,
            },
          },
        ],
        volumes: [
          {
            name: "workspace",
            persistentVolumeClaim: { claimName: pvc },
          },
        ],
      },
    },
  });
}

export async function createService(userId: string): Promise<void> {
  const { svc, slug } = resourceNames(userId);
  try {
    await getCoreV1Api().readNamespacedService({
      name: svc,
      namespace: NAMESPACE,
    });
    return; // already exists
  } catch {
    // does not exist, create it
  }

  await getCoreV1Api().createNamespacedService({
    namespace: NAMESPACE,
    body: {
      metadata: {
        name: svc,
        namespace: NAMESPACE,
        labels: userResourceLabels(slug),
      },
      spec: {
        type: "ClusterIP",
        selector: { app: "code-server-user", userId: slug },
        ports: [{ port: 80, targetPort: 80, protocol: "TCP", name: "http" }],
      },
    },
  });
}

export async function deletePod(userId: string): Promise<void> {
  const { pod } = resourceNames(userId);
  try {
    await getCoreV1Api().deleteNamespacedPod({
      name: pod,
      namespace: NAMESPACE,
    });
  } catch {
    // pod may not exist
  }
}

export async function deleteService(userId: string): Promise<void> {
  const { svc } = resourceNames(userId);
  try {
    await getCoreV1Api().deleteNamespacedService({
      name: svc,
      namespace: NAMESPACE,
    });
  } catch {
    // service may not exist
  }
}

export async function getPodStatus(userId: string): Promise<string | null> {
  const { pod } = resourceNames(userId);
  try {
    const response = await getCoreV1Api().readNamespacedPod({
      name: pod,
      namespace: NAMESPACE,
    });
    return response.status?.phase ?? null;
  } catch {
    return null;
  }
}

export async function isPodReady(userId: string): Promise<boolean> {
  const { pod } = resourceNames(userId);
  try {
    const response = await getCoreV1Api().readNamespacedPod({
      name: pod,
      namespace: NAMESPACE,
    });
    const conditions = response.status?.conditions ?? [];
    return conditions.some((c) => c.type === "Ready" && c.status === "True");
  } catch {
    return false;
  }
}

export async function waitForPodReady(
  userId: string,
  timeoutMs: number = 15000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPodReady(userId)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
