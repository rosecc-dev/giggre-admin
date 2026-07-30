This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environments

This app talks to two Firebase projects: `simpleproject-8ff7a` (development) and `giggre-prod` (production), aliased in [.firebaserc](.firebaserc). `.env.local` determines which one the app and scripts hit at any given time.

| Command | What it does |
| --- | --- |
| `npm run env:dev` | Pulls development env vars from Vercel into `.env.local`. |
| `npm run env:prod -- "<path-to-prod-service-account.json>"` | Pulls production env vars from Vercel into `.env.local`, then patches in the real `FIREBASE_SERVICE_ACCOUNT_KEY` (Vercel returns it as `[SENSITIVE]` for the production scope, so it can't be pulled directly). |
| `npm run firebase:use:dev` | Points the Firebase CLI at the development project. |
| `npm run firebase:use:prod` | Points the Firebase CLI at the production project. |

Whichever environment `.env.local` is set to is the one `npm run dev` / `npm run build` / `npm run start` will run against — switch with `env:dev` / `env:prod` before running them.

## App Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Next.js dev server at [http://localhost:3000](http://localhost:3000). |
| `npm run build` | Builds the app for production. |
| `npm run start` | Runs the production build (run `build` first). |

## Deploying

| Command | What it does |
| --- | --- |
| `npm run deploy:dev` | Deploys Firestore rules/indexes, Storage rules, and functions to the development project. |
| `npm run deploy:prod` | Same, but to the production project. |

## One-off Scripts

| Command | What it does |
| --- | --- |
| `node --env-file=.env.local scripts/seed-admin.js <email> <name> [role]` | Bootstraps a pending admin doc so the first Google sign-in with that email auto-promotes to admin (default role `super_admin`). Requires `.env.local` to be pointed at the target project. |
| `node scripts/seed-skills.js` | Seeds the `/skills` collection with the canonical category → skill list. Safe to re-run — existing skills (matched case-insensitively) are skipped. Reads `FIREBASE_SERVICE_ACCOUNT_KEY` from the environment or `.env.local`. |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
