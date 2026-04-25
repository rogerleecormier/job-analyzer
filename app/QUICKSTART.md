# Job Analyzer — Quick Start Guide

## Local Development

```bash
# Start the dev server
pnpm run dev

# Open in browser
# http://localhost:5173/
```

Dev server runs with hot reload. All changes auto-refresh.

---

## Cloudflare Deployment

### 1. Login to Cloudflare

```bash
pnpm exec wrangler login
```

### 2. Provision Resources

```bash
# Create D1 database
pnpm exec wrangler d1 create job-analyzer-db

# Create KV namespace
pnpm exec wrangler kv:namespace create job-analyzer-kv

# Create R2 bucket
pnpm exec wrangler r2 bucket create job-analyzer-documents
```

Copy the returned IDs and update `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_id": "<paste-id-here>"
  }],
  "kv_namespaces": [{
    "binding": "KV",
    "id": "<paste-id-here>"
  }]
}
```

### 3. Add Secrets

```bash
pnpm exec wrangler secret put ANTHROPIC_API_KEY
# Paste your Anthropic API key when prompted
```

### 4. Run Migrations

```bash
pnpm run db:migrate:remote
```

### 5. Deploy

```bash
pnpm run deploy
```

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Start local dev server on http://localhost:5173 |
| `pnpm run build` | Build for production |
| `pnpm run deploy` | Build + deploy to Cloudflare |
| `pnpm run preview` | Preview build locally |
| `pnpm run db:generate` | Generate Drizzle migrations |
| `pnpm run db:migrate:local` | Apply migrations locally |
| `pnpm run db:migrate:remote` | Apply migrations to live D1 |
| `pnpm run db:studio` | Open Drizzle Studio for DB inspection |

---

## Wrangler Commands (via pnpm exec)

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 list
pnpm exec wrangler kv:namespace list
pnpm exec wrangler r2 bucket list
pnpm exec wrangler secret list
pnpm exec wrangler deploy
pnpm exec wrangler tail          # Stream live logs
```

---

## Project Structure

```
app/
├── src/
│   ├── routes/           # File-based routing (TanStack Router)
│   ├── server/           # Server functions & cron handlers
│   ├── components/       # React components (UI + features)
│   ├── lib/              # Utilities (CF env, AI, PDF, ATS)
│   ├── db/               # Drizzle schema + client
│   └── styles/           # Tailwind CSS
├── dist/                 # Build output
├── drizzle/              # DB migrations
├── wrangler.jsonc        # Cloudflare config
├── vite.config.ts        # Vite + TanStack Start config
└── package.json
```

---

## Troubleshooting

### "pnpm: command not found"
```bash
export PATH="$HOME/.local/bin:$PATH"
pnpm run dev
```

### "wrangler: command not found"
```bash
pnpm exec wrangler login
```

### Dev server fails to start
```bash
# Kill any running processes
pkill -f "vite dev"

# Restart
pnpm run dev
```

### Port already in use
```bash
# List what's using port 5173
lsof -i :5173

# Start on different port
vite dev --port 3000
```

---

## Next Steps

1. ✅ Dev server is running locally
2. ⬜ Login to Cloudflare (for deployment)
3. ⬜ Provision D1, R2, KV resources
4. ⬜ Add ANTHROPIC_API_KEY secret
5. ⬜ Run database migrations
6. ⬜ Deploy with `pnpm run deploy`

See [ARCHITECTURE.md](../ARCHITECTURE.md) for full system design.
