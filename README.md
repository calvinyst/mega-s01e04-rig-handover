# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

To export a page for review, keep rig running and pass its local URL and an output path
outside this repository. The exporter writes the self-contained HTML response and creates
the destination directory if needed:

```sh
node scripts/export-preview.mjs http://127.0.0.1:8787/digest/2026-10-28 ../hosting/public/index.html
```

After review, and only with separate approval, unset `LANE_MARKER` and run the same export
again to overwrite that file with the unmarked page.

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
