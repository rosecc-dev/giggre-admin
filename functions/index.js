const { onDocumentUpdated, onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();

// Firestore triggers must deploy in the same region as the project's
// Firestore database. Production's default database is "nam5" (a US
// multi-region compatible with us-central1, the fallback below); the
// development project's is specifically "asia-east2" — set per-project via
// FUNCTIONS_REGION in functions/.env.<project-id> (loaded automatically by
// firebase-functions based on which project you're deploying to).
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'us-central1' });

// Required ModuleKey for the Verification Requests section — must match
// lib/notifications.ts's NOTIFICATION_TYPE_PERMISSIONS.verification_request
// and lib/modules.ts's "verification" ModuleKey on the Next.js side (this
// codebase doesn't share a package with it, so keep both in sync by hand).
const VERIFICATION_REQUEST_PERMISSION = 'verification';

// Collection watched by the Firebase "Trigger Email" extension
// (firebase/firestore-send-email) — must match the collection you choose
// during `firebase ext:install`. Base URL for building an absolute link in
// the email body — set in functions/.env as ADMIN_CONSOLE_URL.
const MAIL_COLLECTION = 'mail';
const ADMIN_CONSOLE_URL = (process.env.ADMIN_CONSOLE_URL || '').replace(/\/$/, '');

const AIRSTAFF_DOMAIN = 'airstaffs.com';
const AIRSTAFF_REFERRAL_CODE = 'AIRSTAFF';

const emailDomain = (email) => (email || '').split('@').pop().toLowerCase();

// ── Auto-verify Air Staff employees by email domain whenever their user doc is written. ──
// ── The email is read from the Auth record (not the Firestore doc) so it can't be spoofed. ──
exports.autoVerifyByEmailDomain = onDocumentWritten('users/{userId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after || after.isVerified === 'verified') return null;

  const userId = event.params.userId;
  let email;
  try {
    email = (await admin.auth().getUser(userId)).email;
  } catch (err) {
    console.warn(`[autoVerifyByEmailDomain] Could not look up auth user ${userId}:`, err.message);
    return null;
  }

  if (emailDomain(email) !== AIRSTAFF_DOMAIN) return null;

  await event.data.after.ref.update({ isVerified: 'verified' });
  console.log(`[autoVerifyByEmailDomain] User ${userId} (${email}) auto-verified via @${AIRSTAFF_DOMAIN} domain.`);
  return null;
});

// ── Auto-verify users who signed up with the AIRSTAFF referral code, ──
// ── regardless of email domain. Code match only — no referrer lookup. ──
// ── The code is recorded on the referrer's referrals_list subdoc, not on ──
// ── the referred user's own doc, so this listens one level deeper. ──
exports.autoVerifyByReferralCode = onDocumentWritten('users/{referrerId}/referrals_list/{referredUserId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after) return null;

  const referralCode = (after.referral_code_used || '').trim().toUpperCase();
  if (referralCode !== AIRSTAFF_REFERRAL_CODE) return null;

  const referredUserId = event.params.referredUserId;
  const referredUserRef = admin.firestore().collection('users').doc(referredUserId);
  const snap = await referredUserRef.get();
  if (!snap.exists || snap.data().isVerified === 'verified') return null;

  await referredUserRef.update({ isVerified: 'verified' });
  console.log(`[autoVerifyByReferralCode] User ${referredUserId} auto-verified via ${AIRSTAFF_REFERRAL_CODE} referral code.`);
  return null;
});

exports.onVerificationChange = onDocumentUpdated('users/{userId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // ── Guard: only proceed if isVerified actually changed ──
  if (before.isVerified === after.isVerified) return null;

  // ── Guard: only proceed if this user was referred by someone ──
  const referrerId = after.referredBy;
  if (!referrerId) return null;

  const userId      = event.params.userId;
  const referrerRef = admin.firestore().collection('users').doc(referrerId);
  const referralDoc = referrerRef.collection('referrals_list').doc(userId);

  const counterKey = (status) => {
    switch (status) {
      case 'unverified' : return 'referrals.not_verified_referrals';
      case 'pending'    : return 'referrals.pending_referrals';
      case 'verified'   : return 'referrals.verified_referrals';
      case 'cancelled'  : return 'referrals.cancelled_referrals';
      case 'rejected'   : return 'referrals.rejected_referrals';
      default           : return null;
    }
  };

  const decrementKey = counterKey(before.isVerified);
  const incrementKey = counterKey(after.isVerified);

  const batch = admin.firestore().batch();

  // ── 1. Mirror isVerified on the referrals_list doc ──
  batch.update(referralDoc, { isVerified: after.isVerified });

  // ── 2. Swap the counters on the referrer ──
  const updates = {};
  if (decrementKey) updates[decrementKey] = admin.firestore.FieldValue.increment(-1);
  if (incrementKey) updates[incrementKey] = admin.firestore.FieldValue.increment(1);

  if (Object.keys(updates).length > 0) {
    batch.update(referrerRef, updates);
  }

  await batch.commit();

  console.log(
    `[onVerificationChange] User ${userId}: "${before.isVerified}" → "${after.isVerified}". ` +
    `Referrer ${referrerId} updated.`
  );

  return null;
});

// ── Centralized admin notification: fires when a new Verification Request ──
// ── is created. Only admins currently authorized for the "verification" ──
// ── permission (or super_admin) get a notification and an alert. ──
exports.onVerificationRequestCreated = onDocumentCreated('verification_requests/{docId}', async (event) => {
  const snap = event.data;
  if (!snap) return null;
  const data = snap.data();
  const requestId = event.params.docId;
  const db = admin.firestore();

  // ── 1. Determine which admins are currently authorized ──────────────────
  const [superAdminsSnap, permittedAdminsSnap] = await Promise.all([
    db.collection('admins').where('role', '==', 'super_admin').where('isActive', '==', true).get(),
    db.collection('admins').where('permissions', 'array-contains', VERIFICATION_REQUEST_PERMISSION).where('isActive', '==', true).get(),
  ]);

  const eligibleAdmins = new Map();
  for (const adminDoc of [...superAdminsSnap.docs, ...permittedAdminsSnap.docs]) {
    const adminData = adminDoc.data();
    if (adminData.isPending === true) continue; // mirror isAdmin()'s isPending == false check
    eligibleAdmins.set(adminDoc.id, { id: adminDoc.id, email: adminData.email ?? null, name: adminData.name ?? null });
  }

  if (eligibleAdmins.size === 0) {
    console.log(`[onVerificationRequestCreated] No authorized admins found for request ${requestId} — nothing to do.`);
    return null;
  }

  // ── 2. Create the centralized notification ───────────────────────────────
  await db.collection('admin_notifications').add({
    type: 'verification_request',
    requiredPermission: VERIFICATION_REQUEST_PERMISSION,
    title: 'New Verification Request',
    message: `${data.name || 'A user'} submitted a verification request.`,
    link: `/verification?requestId=${requestId}`,
    sourceCollection: 'verification_requests',
    sourceId: requestId,
    meta: { userId: data.userId ?? null, name: data.name ?? null, email: data.email ?? null },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    readBy: {},
  });

  // ── 3. Send one batched digest email per admin, reflecting only requests ──
  // ── that admin personally hasn't seen yet (kept separate from status). ──
  await sendVerificationRequestDigests(Array.from(eligibleAdmins.values()));

  console.log(`[onVerificationRequestCreated] Notified ${eligibleAdmins.size} admin(s) for verification request ${requestId}.`);
  return null;
});

// ── Delivery via the Firebase "Trigger Email" extension: writing a doc to ──
// ── MAIL_COLLECTION is the entire integration — the extension's own Cloud ──
// ── Function picks it up and sends over whatever SMTP connection it was ──
// ── configured with at install time. Kept separate from notification ──
// ── creation/read-state above — this only ever fires for admins already ──
// ── determined to be authorized. ──
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── For each eligible admin, look up ONLY the verification-request ──
// ── notifications that specific admin hasn't seen yet (readBy is per- ──
// ── admin and tracked independently of the request's approve/reject ──
// ── status — opening a request must never be conflated with reviewing ──
// ── it), then queue at most one digest email per admin summarizing the ──
// ── whole unseen backlog. This runs on every new request, so an admin ──
// ── sitting on an unseen backlog gets a fresh, up-to-date total each ──
// ── time — never a flood of one-request-at-a-time emails. ──
async function sendVerificationRequestDigests(admins) {
  const recipientAdmins = admins.filter((a) => a.email);
  if (recipientAdmins.length === 0) return null;

  const notifsSnap = await admin.firestore()
    .collection('admin_notifications')
    .where('requiredPermission', '==', VERIFICATION_REQUEST_PERMISSION)
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
  const allNotifs = notifsSnap.docs.map((d) => d.data());

  await Promise.all(recipientAdmins.map((adminInfo) => {
    const unseen = allNotifs.filter((n) => !(n.readBy && n.readBy[adminInfo.id]));
    if (unseen.length === 0) return null;
    return queueVerificationDigestEmail(adminInfo, unseen);
  }));

  return null;
}

async function queueVerificationDigestEmail(adminInfo, unseenNotifs) {
  if (!ADMIN_CONSOLE_URL) {
    console.warn('[queueVerificationDigestEmail] ADMIN_CONSOLE_URL is not set — email links will be relative.');
  }
  const allLink = ADMIN_CONSOLE_URL ? `${ADMIN_CONSOLE_URL}/verification` : '/verification';
  const logoUrl = ADMIN_CONSOLE_URL ? `${ADMIN_CONSOLE_URL}/images/logo.png` : null;

  const count = unseenNotifs.length;
  const countLabel = `${count} verification request${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} your attention`;
  const latestThree = unseenNotifs.slice(0, 3);

  const rowsHtml = latestThree.map((n) => {
    const name = escapeHtml(n.meta?.name || 'A user');
    const reqLink = ADMIN_CONSOLE_URL ? `${ADMIN_CONSOLE_URL}${n.link}` : n.link;
    return `<li style="margin:0 0 8px;"><a href="${reqLink}" style="color:#2563EB;text-decoration:none;font-size:14px;font-weight:600;">${name}</a></li>`;
  }).join('');
  const rowsText = latestThree.map((n) => {
    const name = n.meta?.name || 'A user';
    const reqLink = ADMIN_CONSOLE_URL ? `${ADMIN_CONSOLE_URL}${n.link}` : n.link;
    return `- ${name}: ${reqLink}`;
  }).join('\n');

  const html = `
<div style="background:#F1F5F9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
    <div style="padding:28px 32px 0;">
      ${logoUrl ? `<img src="${logoUrl}" alt="Giggre" height="28" style="display:block;margin-bottom:20px;" />` : ''}
      <span style="display:inline-block;background:#DBEAFE;color:#2563EB;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">
        Verification
      </span>
    </div>
    <div style="padding:16px 32px 28px;">
      <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#0F172A;">${countLabel}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">Most recent:</p>
      <ul style="margin:0 0 24px;padding-left:18px;">
        ${rowsHtml}
      </ul>
      <a href="${allLink}" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">
        See all verification requests
      </a>
    </div>
    <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
      <p style="margin:0;font-size:12px;color:#94A3B8;">You're receiving this because you have access to Verification Requests in the Giggre Admin console.</p>
    </div>
  </div>
</div>`.trim();

  await admin.firestore().collection(MAIL_COLLECTION).add({
    to: [adminInfo.email],
    message: {
      subject: countLabel,
      text: `${countLabel}\n\nMost recent:\n${rowsText}\n\nSee all verification requests: ${allLink}`,
      html,
    },
  });

  console.log(`[queueVerificationDigestEmail] Queued digest (${count} unseen) to ${adminInfo.email}.`);
  return null;
}