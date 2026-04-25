# Deployment Checklist - Job Analyzer

## ✅ GitHub Repository Status
- [x] Repository created: `https://github.com/rogerleecormier/job-analyzer`
- [x] Code pushed to `main` branch (143 commits)
- [x] Remote configured correctly: `origin`
- [x] Branch tracking configured: `origin/main`
- [x] Monorepo structure clean (no nested .git directories)

## 🚀 Pre-Deployment: Cloudflare Workers Setup

### 1. Verify Wrangler Authentication
```bash
cd app
pnpm exec wrangler whoami
```
Expected: Shows your Cloudflare account email and account ID

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Generate Database Migrations (if needed)
If you've modified the schema since the migrations were created:
```bash
pnpm db:generate
```

### 4. Apply Local Migrations
Test migrations locally first:
```bash
pnpm db:migrate:local
```

### 5. Build for Production
```bash
pnpm build
```

### 6. Deploy to Cloudflare Workers
```bash
pnpm deploy
```

## 📋 Cloudflare Resource Configuration

The following resources are already configured in `wrangler.jsonc`:

| Resource | Type | Binding | Status |
|---|---|---|---|
| Database | D1 SQLite | `DB` | Configured (ID: `3f58eb0a...`) |
| Object Storage | R2 Bucket | `R2` | Configured (`job-analyzer-documents`) |
| Cache/Sessions | KV Namespace | `KV` | Configured (ID: `07de8044...`) |
| AI Model | Workers AI | `AI` | Configured |
| Browser Rendering | Browser API | `BROWSER` | Configured |

**If any resource IDs are missing**, you'll need to:
1. Create the resource in Cloudflare Dashboard
2. Update the ID in `wrangler.jsonc`

## 🔍 Verification Steps

After deployment, verify everything works:

```bash
# View live logs
pnpm exec wrangler tail

# Test the application
curl https://job-analyzer.rogerleecormier.workers.dev/

# Check database connectivity
pnpm exec wrangler d1 execute job-analyzer-db --remote --command "SELECT 1"
```

## 🐛 Troubleshooting

| Issue | Solution |
|---|---|
| "Workers KV namespace not found" | Verify KV ID in `wrangler.jsonc` matches Cloudflare Dashboard |
| "D1 database not found" | Verify D1 ID and ensure migrations ran: `pnpm db:migrate:remote` |
| "R2 bucket not found" | Verify bucket name in `wrangler.jsonc` |
| "Authentication failed" | Run `pnpm exec wrangler login` and authenticate again |
| "Build fails: Cannot find module" | Run `pnpm install` and ensure all dependencies installed |

## 📝 Deploy Command Summary

Quick deployment from the project root:
```bash
cd app
pnpm install && pnpm build && pnpm deploy
```

Or with migrations:
```bash
cd app
pnpm install && pnpm db:migrate:remote && pnpm build && pnpm deploy
```

## ✨ After Successful Deployment

1. **Get your deployment URL** - Check Wrangler output or Cloudflare Dashboard
2. **Set domain** - Configure custom domain in Cloudflare Workers dashboard if desired
3. **Monitor** - Use `pnpm exec wrangler tail` to watch live logs
4. **Database** - Access data via Drizzle Studio: `pnpm db:studio`

---

**Last Updated:** April 25, 2026
**Repository:** https://github.com/rogerleecormier/job-analyzer
