// Writes/resets app_content/word_filter in whichever Firebase project
// .env.local currently points at, using the seed list in lib/wordFilterSeed.json.
//
// .env.local only ever targets one project at a time (see scripts/switch-env.js),
// so to seed both projects, run this once per environment:
//   npm run env:dev  && node scripts/seedWordFilter.js
//   npm run env:prod -- "C:\path\to\giggre-prod-service-account.json" && node scripts/seedWordFilter.js
//
// Existing blockedTerms in Firestore are merged with the seed list (union, deduped) —
// this will not remove terms an admin has already added via the admin page.

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local not found. Run `npm run env:dev` or `npm run env:prod` first.");
  process.exit(1);
}

for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  const [, key, rawValue] = match;
  const value = rawValue.replace(/^['"]|['"]$/g, "");
  if (!(key in process.env)) process.env[key] = value;
}

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const seedTerms = require("../lib/wordFilterSeed.json");

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
  const docRef = db.collection("app_content").doc("word_filter");
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data().blockedTerms ?? []) : [];

  const merged = Array.from(
    new Set([...existing, ...seedTerms].map((t) => String(t).trim().toLowerCase()).filter(Boolean))
  ).sort();

  await docRef.set(
    {
      blockedTerms: merged,
      enabled: snap.exists ? (snap.data().enabled ?? true) : true,
      lastUpdated: FieldValue.serverTimestamp(),
      updatedBy: "seed-script",
    },
    { merge: true }
  );

  console.log(
    `Seeded app_content/word_filter (project: ${serviceAccount.project_id}) — ` +
    `${merged.length} total terms (${existing.length} existing + ${seedTerms.length} seed, deduped).`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
