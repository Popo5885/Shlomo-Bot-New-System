# Shlomo Popovitz - Business Automation Solutions

Premium multi-tenant SaaS scaffold for omni-channel distribution, approvals, invoices, analytics and WhatsApp Group Status via Baileys.

## Stack

- Next.js 16 + React 19 + Tailwind 4
- Express custom server
- Baileys for WhatsApp
- NextAuth for Google / credentials authentication scaffolding
- Nodemailer mailer helpers
- BullMQ + ioredis groundwork

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```

## Git Bootstrap

```bash
git init
git add .
git commit -m "Initial Build: Shlomo Popovic Omni-Channel SaaS v5.0"
git branch -M main
git remote add origin https://github.com/Popo5885/Shlomo-Bot-New-System.git
git push -u origin main
```

## Notes

- `db/schema.sql` contains the PostgreSQL tables plus RLS policies keyed by `workspace_id`.
- `scripts/auto-push.js` is a local watcher that can auto-commit and push when Git credentials are configured.
- The runtime currently uses `data/platform-data.json` as a seed store for the UI and onboarding/admin flows while the PostgreSQL layer is being wired.
