# Workshop design — Aether Games

## Audience

Platform / SRE / observability owners at gaming companies consolidating Prometheus + Grafana into Elastic Observability. Secondary audience: security/fraud partners who need account abuse coverage.

## Narrative rules

- Brand the fictional studio **Aether Games** only
- Never name real game publishers or titles in slides, assignments, or the Vercel demo
- Lead with **metrics adoption** and cost/ops consolidation; fraud is a parallel Security story

## Instruqt vs Vercel

| Concern | Instruqt | Vercel |
| --- | --- | --- |
| Observability project | Ephemeral per play | Fixed `otel-demo-a5630c` |
| Security project | Not provisioned (A2A stub) | Fixed `my-security-project-ac9463` deep links |
| Hands-on migrate | Yes (`grafana-migrate`) | No (narrative + links) |

## Lab flow (~90–120 minutes)

1. Open / framing (10m)
2. Lab 1 migrate + verify dashboards (45–60m)
3. Lab 2 alerts + A2A stub walkthrough (20–30m)
4. Optional: open Vercel demo Security links (10–15m)
5. Debrief (10m)

## Assets

Fourteen Grafana JSON boards under `assets/grafana/` covering matchmaking, session gateway, regions, auth, store, voice/chat, SLO, party, presence, inventory, anti-cheat O11Y signals, CDN, and dependencies. Fleet emitter `tools/otel_gaming_fleet.py` emits matching metric names.
