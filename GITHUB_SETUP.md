# GitHub Repository Setup Guide

## Step 1: Create the GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **"+"** icon in the top right → **New repository**
3. Configure the repository:
   - **Repository name**: `job-analyzer`
   - **Description**: Job Analyzer - AI-powered job application analysis tool
   - **Visibility**: Choose `Public` or `Private` as preferred
   - **Do NOT** initialize with README, .gitignore, or license (we already have these)
   - Click **Create repository**

## Step 2: Add Remote and Push Code

After creating the repository, GitHub will show you commands. Replace `YOUR_USERNAME` with your GitHub username and run:

```bash
cd /run/media/rogerleecormier/Storage/dev/job-analyzer

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/job-analyzer.git

# Rename branch to main (optional, but recommended)
git branch -m master main

# Push to GitHub
git push -u origin main
```

Or if you prefer SSH (requires SSH key setup):

```bash
git remote add origin git@github.com:YOUR_USERNAME/job-analyzer.git
git branch -m master main
git push -u origin main
```

## Step 3: Deploy to Cloudflare Workers

The project is configured for Cloudflare Workers deployment. Before deploying, ensure you have:

### Prerequisites

1. **Cloudflare Account** - Sign up at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. **Wrangler CLI** - Already in dependencies (`pnpm install` installs it)
3. **Authentication** - Run:
   ```bash
   cd app
   pnpm exec wrangler login
   ```

### Create Cloudflare Project

1. In your Cloudflare dashboard, create a new Workers project
2. Configure the following bindings in `wrangler.jsonc`:
   - **D1 Database**: `job-analyzer-db` (SQLite)
   - **R2 Bucket**: `job-analyzer-files` (for PDFs)
   - **KV Namespace**: `job-analyzer-kv` (for sessions & cache)
   - **Workers AI**: Enable Llama 3.3 70B model
   - **Browser Rendering**: Enable for job scraping

### Build and Deploy

```bash
cd app

# Install dependencies
pnpm install

# Generate database migrations (if schema changed)
pnpm db:generate

# Apply migrations to local D1 (testing)
pnpm db:migrate:local

# Build for production
pnpm build

# Deploy to Cloudflare Workers
pnpm deploy
```

### After Deployment

- Get your deployment URL from Wrangler output
- Set environment variables if needed
- Monitor logs: `pnpm exec wrangler tail`
- Apply remote migrations: `pnpm db:migrate:remote`

## Troubleshooting

**Git push fails with authentication error:**
- Use HTTPS with GitHub personal access token instead of password
- Or set up SSH keys: [GitHub SSH Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

**Cloudflare deployment issues:**
- Check `wrangler.jsonc` bindings match your Cloudflare dashboard setup
- Ensure D1, R2, and KV are created with correct names
- Run `pnpm exec wrangler whoami` to verify authentication

**Database connection issues:**
- Verify D1 binding in `wrangler.jsonc`
- Check migrations ran successfully: `pnpm db:migrate:local`
- Review `app/src/db/schema.ts` for table definitions

## Quick Commands Reference

```bash
# Git commands
git status
git push                          # Push commits to GitHub
git pull                          # Pull latest from GitHub

# Development
cd app && pnpm dev               # Start dev server
pnpm build                        # Build for production
pnpm preview                      # Preview production build locally

# Database
pnpm db:generate                 # Generate new migration from schema
pnpm db:migrate:local            # Apply migrations to local D1
pnpm db:migrate:remote           # Apply migrations to production D1
pnpm db:studio                   # Open Drizzle Studio

# Deployment
pnpm deploy                       # Deploy to Cloudflare Workers
pnpm exec wrangler tail          # View live logs
```

---

**Need help?** Check the [Project README](./app/README.md) and [Architecture Guide](./ARCHITECTURE.md)
