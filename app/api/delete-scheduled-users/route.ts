import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, adminStorage } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─────────────────────────────────────────────────────────────────────────────
//  Delete all documents the user uploaded (identity verification + skill requests)
// ─────────────────────────────────────────────────────────────────────────────
async function deleteUserUploadedDocuments(userId: string): Promise<number> {
  const [verificationSnap, skillRequestsSnap] = await Promise.all([
    adminDb.collection("verification_requests").where("userId", "==", userId).get(),
    adminDb.collection("skill_requests").where("userId", "==", userId).get(),
  ]);

  const verificationPaths = verificationSnap.docs.flatMap((d) => {
    const documents = d.data().documents;
    return Array.isArray(documents)
      ? documents.map((doc: any) => doc?.storagePath).filter((p: any) => typeof p === "string" && p)
      : [];
  });

  const skillRequestPaths = skillRequestsSnap.docs.flatMap((d) => {
    const proofPaths = d.data().proofPaths;
    return Array.isArray(proofPaths)
      ? proofPaths.filter((p: any) => typeof p === "string" && p)
      : [];
  });

  const storagePaths = Array.from(new Set([...verificationPaths, ...skillRequestPaths]));
  if (storagePaths.length === 0) return 0;

  const bucket = adminStorage.bucket();
  const results = await Promise.allSettled(
    storagePaths.map((path) => bucket.file(path).delete())
  );

  let deletedCount = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled" || (result.reason as any)?.code === 404) {
      deletedCount++;
    } else {
      console.error(
        `[delete-scheduled-users] failed to delete storage file "${storagePaths[i]}" for user ${userId}:`,
        result.reason
      );
    }
  });

  return deletedCount;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared per-doc deletion logic
// ─────────────────────────────────────────────────────────────────────────────
async function deleteRequestDoc(
  requestDoc: FirebaseFirestore.DocumentSnapshot,
  actor: { id: string; name: string; email: string | null },
  now: Date,
) {
  const data = requestDoc.data()!;
  const userId = data.userId ?? "";
  const email = data.email ?? "";
  const scheduledAt = data.deletionScheduledAt instanceof Timestamp
    ? data.deletionScheduledAt.toDate().toISOString()
    : now.toISOString();

  try {
    await adminAuth.deleteUser(userId);
  } catch (authErr: any) {
    if (authErr?.code !== "auth/user-not-found") throw authErr;
  }

  let deletedDocsCount = 0;
  try {
    deletedDocsCount = await deleteUserUploadedDocuments(userId);
  } catch (storageErr: any) {
    console.error(`[delete-scheduled-users] failed to delete uploaded documents for ${userId}:`, storageErr);
  }

  const userSnap = await adminDb.collection("users").doc(userId).get().catch(() => null);
  const currentName: string = userSnap?.data()?.name ?? "";
  const deletedName = currentName.endsWith("(deleted)") ? currentName : `${currentName} (deleted)`;
  await adminDb.collection("users").doc(userId).update({
    isDeleted: true,
    deletedAt: FieldValue.serverTimestamp(),
    pendingDeletion: false,
    scheduledDeleteAt: null,
    name: deletedName,
  }).catch(() => {});

  await requestDoc.ref.update({
    status: "completed",
    deletedAt: FieldValue.serverTimestamp(),
    processedBy: actor.name,
    notes: `Processed by ${actor.name} on ${now.toISOString()}`,
  });

  return { requestId: requestDoc.id, userId, email, deletionScheduledAt: scheduledAt, deletedDocsCount };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Delete a single request by ID immediately
// ─────────────────────────────────────────────────────────────────────────────
async function runSingleDeletion(
  requestId: string,
  actor: { id: string; name: string; email: string | null },
) {
  const now = new Date();
  const requestDoc = await adminDb.collection("account_delete_requests").doc(requestId).get();

  if (!requestDoc.exists) {
    return { deleted: [], count: 0, errors: [{ requestId, userId: "", error: "Request not found" }], ranAt: now.toISOString() };
  }

  const deleted: { requestId: string; userId: string; email: string; deletionScheduledAt: string; deletedDocsCount: number }[] = [];
  const errors: { requestId: string; userId: string; error: string }[] = [];

  try {
    const result = await deleteRequestDoc(requestDoc, actor, now);
    deleted.push(result);
  } catch (err: any) {
    errors.push({ requestId, userId: requestDoc.data()?.userId ?? "", error: err?.message ?? "Unknown error" });
  }

  if (deleted.length > 0) {
    await adminDb.collection("activityLogs").add({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      module: "user_management",
      action: "user_deleted",
      description: `Deleted account: ${deleted[0].email} (ID: ${deleted[0].userId})`,
      targetSection: null,
      targetId: deleted[0].userId,
      targetName: deleted[0].email,
      affectedFiles: [`users/${deleted[0].userId}`],
      meta: { from: null, to: null, other: { count: 1, users: deleted } },
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { deleted, count: deleted.length, errors: errors.length > 0 ? errors : undefined, ranAt: now.toISOString() };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bulk deletion runner — processes scheduled + approved requests
// ─────────────────────────────────────────────────────────────────────────────
async function runBulkDeletion(actor: { id: string; name: string; email: string | null }) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const cutoff = Timestamp.fromDate(endOfToday);

  const scheduledSnap = await adminDb
    .collection("account_delete_requests")
    .where("status", "==", "pending_deletion")
    .where("deletionScheduledAt", "<=", cutoff)
    .get();

  const allDocs = scheduledSnap.docs;

  if (allDocs.length === 0) {
    return { deleted: [], count: 0, ranAt: now.toISOString() };
  }

  const deleted: { requestId: string; userId: string; email: string; deletionScheduledAt: string; deletedDocsCount: number }[] = [];
  const errors: { requestId: string; userId: string; error: string }[] = [];

  await Promise.all(
    allDocs.map(async (requestDoc) => {
      try {
        const result = await deleteRequestDoc(requestDoc, actor, now);
        deleted.push(result);
      } catch (err: any) {
        errors.push({ requestId: requestDoc.id, userId: requestDoc.data()?.userId ?? "", error: err?.message ?? "Unknown error" });
      }
    })
  );

  if (deleted.length > 0) {
    const userList = deleted
      .map((u) => `• ${u.email} (ID: ${u.userId}) — request: ${u.requestId}`)
      .join("\n");

    await adminDb.collection("activityLogs").add({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      module: "user_management",
      action: "user_deleted",
      description: `Deleted ${deleted.length} scheduled account${deleted.length !== 1 ? "s" : ""}:\n${userList}`,
      targetSection: null,
      targetId: null,
      targetName: null,
      affectedFiles: deleted.map((u) => `users/${u.userId}`),
      meta: {
        from: null,
        to: null,
        other: { count: deleted.length, users: deleted },
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { deleted, count: deleted.length, errors: errors.length > 0 ? errors : undefined, ranAt: now.toISOString() };
}

// Cron-triggered — actor is System
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runBulkDeletion({ id: "system", name: "System (Cron)", email: null });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[delete-scheduled-users] GET fatal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error", deleted: [], count: 0 },
      { status: 500 }
    );
  }
}

// Admin-triggered — bulk or single depending on whether requestId is in body
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const callerDoc = await adminDb.doc(`admins/${decoded.uid}`).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const callerData = callerDoc.data();
    const actor = {
      id: decoded.uid,
      name: callerData?.name ?? decoded.name ?? decoded.email ?? "Admin",
      email: decoded.email ?? null,
    };

    const body = await req.json().catch(() => ({}));
    const result = body?.requestId
      ? await runSingleDeletion(body.requestId, actor)
      : await runBulkDeletion(actor);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[delete-scheduled-users] POST fatal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error", deleted: [], count: 0 },
      { status: 500 }
    );
  }
}
