# Aether Games demo

Vite + React front door for gaming POV demos.

**Live:** https://011y-gaming.vercel.app  
**Atrium (org):** https://field.elastic.dev/p/atrium/index → search *Aether Games* (asset `c349415e-0178-4931-b5f7-4fff5a2793e3`)

```bash
cp .env.example .env
npm install
npm run dev
```

Deep links default to `elastic-observability-f74145` (O11Y) and `my-security-project-ac9463` (Security).

The Git-connected Vercel project uses **Root Directory** `demo/`. Deploy from the **repo root**:

```bash
vercel --prod --scope poulsbopetes-projects
```

### Atrium (static HTML)

Atrium hosts a single-file build; API calls go to the Vercel origin (`apiBase.js`).

```bash
npm run build:atrium
# from elastic-hub-cli:
eh atrium push ../011y-gaming/demo/aether-games-interactive.html \
  --title "Aether Games: Grafana → Elastic Observability Serverless" \
  --visibility org --category observability \
  --tags "aether-games,gaming,observability,grafana,otel,workflows,serverless,fraud,DEMO,interactive"
```
