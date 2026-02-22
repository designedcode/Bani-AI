# Contributing to Bani AI

Waheguru ji ka Khalsa, Waheguru ji ki Fateh 🙏  
Thank you for contributing to **Bani AI** — a seva-driven project intended for use in Gurudwara Sahib.  
Because this may be used by the sangat, we prioritise **stability, respect, and accuracy**.

---

## 1) Repo Branching Model

- `main` → always stable / production-ready
- `dev` → integration branch for new work
- `feature/*` → new features
- `enhancement/*` → enhancement on already exisitng features
- `bugfix/*` → bug fixes
- `hotfix/*` → urgent fixes (rare)

✅ **All changes must go through a Pull Request (PR).**  
⛔ **Do not push directly to `main`.**

---

## 2) Workflow (Required)

1. Pick an issue from the GitHub Projects board (or create one): https://github.com/users/designedcode/projects/1
2. Assign yourself on the issue: To avoid duplicates.
3. Always create a branch from `dev`:

   - `feature/<short-name>`
   - `bugfix/<short-name>`

4. Commit small, readable changes.
5. Open a PR into `dev`.
6. Request review (Harjas/Gagan/Japneet).
7. Merge only after review approval.

---

## 3) Branch Naming

Examples:
- `feature/projection-mode-refresh`
- `bugfix/audio-restart-loop`
- `feature/shabad-matching-improve`

We're sticking with v2.0.0 until we release this.
If you're doing a followup on your version, you can do v2.x.x for better tracking.
Example: You merged v2.5.0, now you can add v2.5.1 and so on.
---

## 4) Commit Messages

Use clear messages:
- `Fix: restart mic stream on silence`
- `Feat: add bani schedule selector`
- `Chore: update dependencies`

Avoid vague commits like: `update`, `changes`, `work`.

---

## 5) Pull Request Standards

PR title should explain the change.

PR description must include:
- **What changed**
- **Why**
- **How tested**
- **Any risks**

Small PRs are preferred over large PRs.

---

## 6) Testing / Safety

Before PR:
- Run the app locally
- Ensure no console errors
- Ensure projection view still works
- Ensure no breaking changes to core flow

---

## 7) Respect & Data Safety

- Do not add ads, jokes, or disrespectful content.
- Do not upload private audio recordings or sensitive data to the repo.
- Assume anything you write may be seen by community partners.

---

## 8) Need Help?

Ask in the Google Chat space:
- Tech questions → tag Harjas/Gagan
- Research questions → tag Asis
- Unblocking and general → tag Japneet

Thank you for doing seva through your skills. 🙌
