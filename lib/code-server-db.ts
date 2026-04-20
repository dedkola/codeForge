import { pool } from "./db";

export interface CodeServerInstance {
  id: string;
  pod_name: string;
  svc_name: string;
  pvc_name: string;
  status: string;
  reset_count: number;
  created_at: Date;
  last_active: Date;
}

export async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS code_server_instance (
      id          TEXT PRIMARY KEY,
      pod_name    TEXT NOT NULL,
      svc_name    TEXT NOT NULL,
      pvc_name    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Add reset_count column if upgrading from older schema
  await pool.query(`
    ALTER TABLE code_server_instance
    ADD COLUMN IF NOT EXISTS reset_count INTEGER NOT NULL DEFAULT 0
  `);
}

export async function getInstanceByUserId(
  userId: string,
): Promise<CodeServerInstance | null> {
  const result = await pool.query(
    "SELECT * FROM code_server_instance WHERE id = $1",
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function upsertInstance(
  userId: string,
  podName: string,
  svcName: string,
  pvcName: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO code_server_instance (id, pod_name, svc_name, pvc_name, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (id) DO UPDATE SET
       pod_name = $2, svc_name = $3, pvc_name = $4, status = 'pending', last_active = NOW()`,
    [userId, podName, svcName, pvcName],
  );
}

export async function updateStatus(
  userId: string,
  status: string,
): Promise<void> {
  await pool.query(
    "UPDATE code_server_instance SET status = $1, last_active = NOW() WHERE id = $2",
    [status, userId],
  );
}

export async function touchLastActive(userId: string): Promise<void> {
  await pool.query(
    "UPDATE code_server_instance SET last_active = NOW() WHERE id = $1",
    [userId],
  );
}

export async function getStaleInstances(
  olderThan: Date,
): Promise<CodeServerInstance[]> {
  const result = await pool.query(
    "SELECT * FROM code_server_instance WHERE last_active < $1 AND status = 'running'",
    [olderThan],
  );
  return result.rows;
}

export async function incrementResetCount(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE code_server_instance
     SET reset_count = reset_count + 1, last_active = NOW()
     WHERE id = $1
     RETURNING reset_count`,
    [userId],
  );
  return result.rows[0]?.reset_count ?? 0;
}
