import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type LogAction =
  | "created_admin"
  | "updated_admin"
  | "deleted_admin"
  | "updated_permissions"
  | "toggled_admin_status"
  | "changed_role"
  | "admin_login";

interface LogParams {
  actorId: string;
  actorName: string;
  action: LogAction;
  targetId?: string;
  targetName?: string;
  meta?: Record<string, unknown>;
}

export async function writeLog(params: LogParams): Promise<void> {
  try {
    await addDoc(collection(db, "activityLogs"), {
      ...params,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[activityLog] Failed to write log:", err);
  }
}