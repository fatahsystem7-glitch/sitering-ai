# Pushing sitering-ai to GitHub

The repository is committed and ready: 6 commits, 63 files, clean working tree.
You just need to run the push from a machine that holds your GitHub credentials.

> **Don't paste a token into a chat window.** Anything shared in a conversation
> lands in logs and history, and would need revoking. Use `gh auth login` or an
> SSH key on your own machine instead.

---

## Option A — GitHub CLI (easiest)

From the `sitering-ai` directory:

```bash
gh auth login                     # once, if you haven't
gh repo create <your-org>/sitering-ai --private --source=. --push
```

Done. That creates the repo and pushes `main` with full history.

## Option B — existing empty repo

```bash
git remote add origin git@github.com:<your-org>/sitering-ai.git
git push -u origin main
```

Use the SSH URL if you have a key loaded; use
`https://github.com/<your-org>/sitering-ai.git` if you'd rather authenticate
through the credential helper.

## Option C — you don't have this checkout locally

A complete git bundle (all 6 commits, full history) is at
`/home/user/sitering-ai.bundle` — download it, then:

```bash
git clone sitering-ai.bundle sitering-ai
cd sitering-ai
git remote remove origin
git remote add origin git@github.com:<your-org>/sitering-ai.git
git push -u origin main
```

---

## What's in the commits

```
7ef9da9  feat: multi-tenant Supabase schema, RLS and auth triggers
b47f422  feat(agent): LiveKit voice worker with OpenAI + Fish Audio
b10624c  feat(telephony): Twilio UK provisioning, sole-trader branch, zero-downtime renewal
413e626  feat(dashboard): signup, onboarding fork, config editor, document re-upload
a08c85b  test: 44 tests, preflight and email preview tooling
5a3505c  docs: deploy, auth/SMTP, UK compliance and go-live runbooks
```

## Secret hygiene — already verified

- No `.env`, `.pem` or `.key` files exist in the tree; only `.env.example`
  with empty values.
- Scanned for credential-shaped strings (`sk-…`, `re_…`, `AC…32hex`, JWTs,
  PEM headers). The single match is Twilio's own `ACaaaaaaaa…` placeholder
  inside a test fixture copied from their public docs.
- `.gitignore` covers `.env`, `.env.local`, `node_modules/`, `.next/`,
  `__pycache__/`, `.venv/`, `.vercel` and `email-previews/`.

Nothing sensitive is tracked. Real keys go into Railway and Vercel environment
variables — see `docs/DEPLOY.md`.

---

## After the push

1. **Railway** — new project, connect the repo, add two services from the same
   repo with root directories `services/agent` and `services/telephony-worker`.
   Both already carry a `railway.json` pinning the Dockerfile builder.
2. **Vercel** — import the repo, set root directory to `apps/dashboard`.
3. **Supabase** — `supabase link --project-ref <ref> && supabase db push`
   (7 migrations, they apply in filename order).
4. **Verify** — `npm run preflight` with real env, then work through
   `docs/GO_LIVE.md`.

Branch protection on `main` is worth enabling before you add anyone else:
Settings → Branches → require a PR and require the test workflow to pass.
