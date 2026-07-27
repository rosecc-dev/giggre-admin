// Points .env.local at either the development (simpleproject-8ff7a) or
// production (giggre-prod) Firebase project, by pulling the matching
// Vercel-scoped env vars.
//
// Usage:
//   node scripts/switch-env.js dev
//   node scripts/switch-env.js prod "C:\path\to\giggre-prod-service-account.json"
//
// FIREBASE_SERVICE_ACCOUNT_KEY is marked Sensitive in Vercel for the
// production scope, so `vercel env pull` can never retrieve its real value
// (it comes back as the literal string "[SENSITIVE]"). For "prod", pass the
// path to the giggre-prod service account JSON and this patches the real
// value in afterward.

const { execFileSync } = require("child_process");
const fs = require("fs");

const target = process.argv[2];
const serviceAccountPath = process.argv[3];

if (target !== "dev" && target !== "prod") {
  console.error("Usage: node scripts/switch-env.js <dev|prod> [path-to-prod-service-account.json]");
  process.exit(1);
}

const environment = target === "dev" ? "development" : "production";

console.log(`Pulling ${environment} env vars into .env.local...`);
execFileSync("npx", ["vercel", "env", "pull", ".env.local", "--environment", environment, "--yes"], {
  stdio: "inherit",
  shell: true,
});

if (target === "prod") {
  if (!serviceAccountPath) {
    console.error(
      "\nFIREBASE_SERVICE_ACCOUNT_KEY still says [SENSITIVE] — pass the giggre-prod\n" +
      "service account JSON path as a second argument to patch in the real value:\n" +
      '  npm run env:prod -- "C:\\path\\to\\giggre-prod-....json"'
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(serviceAccountPath, "utf8");
  JSON.parse(raw); // validate
  if (raw.includes("'")) {
    throw new Error("service account JSON unexpectedly contains a single quote — cannot embed safely");
  }
  const minified = raw.replace(/\r?\n/g, "");
  const newLine = `FIREBASE_SERVICE_ACCOUNT_KEY='${minified}'`;

  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
  if (idx === -1) lines.push(newLine);
  else lines[idx] = newLine;
  fs.writeFileSync(".env.local", lines.join("\n"));
}

console.log(`.env.local is now set to ${target} (${environment}).`);
