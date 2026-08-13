# Publishing to GitHub

Quick checklist before your first push.

## 1. Review what will be committed

```powershell
git status
```

You should see the AI assistant, README updates, bootstrap `provision-log.sh`, tests, and **not** `venv/`, `.vagrant/`, or `logs/vagrant/*.log`.

## 2. Stage and commit

```powershell
git add .
git status
git commit -m "Add AI support agent, guided setup, and documentation updates"
```

Adjust the message if you prefer.

## 3. Create the GitHub repository

On GitHub: **New repository** → name it (e.g. `SMEAutomatedVirtualInfrastructure`) → **do not** add a README if this repo already has one.

## 4. Push

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Use your actual remote URL and branch name.

## 5. Optional repo settings

- **Description:** SME virtual infrastructure lab with optional local AI setup guide and log troubleshooting (Python + Ollama).
- **Topics:** `vagrant`, `ansible`, `python`, `ollama`, `infrastructure`, `final-year-project`

## What was fixed for publish

- Added `ai_assistant/examples/sample_setup_error.log`
- Fixed `MANIFEST.in` (removed missing `Project_Overview.txt`)
- Updated `.gitignore` for `logs/vagrant/` runtime files
- Removed dev-only `test_prov_check.py` and `docs/REFACTORING_SUMMARY.md`
