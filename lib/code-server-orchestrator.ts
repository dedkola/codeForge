import {
  resourceNames,
  createPVC,
  createPod,
  createService,
  createIngress,
  deletePod,
  deleteService,
  deleteIngress,
  getPodStatus,
  waitForPodReady,
} from "./code-server-k8s";
import {
  getInstanceByUserId,
  upsertInstance,
  updateStatus,
  touchLastActive,
  getStaleInstances,
} from "./code-server-db";
import {
  CODE_SERVER_MAX_IDLE_MINUTES,
  CODE_SERVER_POD_READY_TIMEOUT_MS,
  buildCodeServerUrl,
} from "./code-server-config";

export interface EnsureResult {
  status: "ready" | "starting" | "error";
  url: string;
}

export async function ensureUserCodeServer(
  userId: string,
): Promise<EnsureResult> {
  const { pod, svc, pvc, slug } = resourceNames(userId);
  const url = buildCodeServerUrl(slug);

  const existing = await getInstanceByUserId(userId);

  if (existing && existing.status === "running") {
    const phase = await getPodStatus(userId);
    if (phase === "Running") {
      await touchLastActive(userId);
      return { status: "ready", url };
    }
    await updateStatus(userId, "pending");
  }

  try {
    await createPVC(userId);
    await createPod(userId);
    await createService(userId);
    await createIngress(userId);
  } catch (err) {
    console.error(
      `Failed to create code-server resources for user ${userId}:`,
      err,
    );
    await upsertInstance(userId, pod, svc, pvc);
    await updateStatus(userId, "error");
    return { status: "error", url };
  }

  await upsertInstance(userId, pod, svc, pvc);

  const ready = await waitForPodReady(userId, CODE_SERVER_POD_READY_TIMEOUT_MS);
  if (ready) {
    await updateStatus(userId, "running");
    return { status: "ready", url };
  }

  await updateStatus(userId, "pending");
  return { status: "starting", url };
}

export async function stopUserCodeServer(userId: string): Promise<void> {
  await deletePod(userId);
  await deleteService(userId);
  await deleteIngress(userId);
  await updateStatus(userId, "stopped");
}

export async function cleanupStaleInstances(
  maxIdleMinutes: number = CODE_SERVER_MAX_IDLE_MINUTES,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxIdleMinutes * 60 * 1000);
  const stale = await getStaleInstances(cutoff);

  for (const instance of stale) {
    try {
      await deletePod(instance.id);
      await deleteService(instance.id);
      await deleteIngress(instance.id);
      await updateStatus(instance.id, "stopped");
    } catch (err) {
      console.error(`Failed to cleanup instance for user ${instance.id}:`, err);
    }
  }

  return stale.length;
}

export async function getUserCodeServerStatus(
  userId: string,
): Promise<"ready" | "starting" | "stopped" | "error" | "none"> {
  const instance = await getInstanceByUserId(userId);
  if (!instance) return "none";

  if (instance.status === "running") {
    const phase = await getPodStatus(userId);
    if (phase === "Running") {
      await touchLastActive(userId);
      return "ready";
    }
    return "starting";
  }

  return instance.status as "starting" | "stopped" | "error";
}
