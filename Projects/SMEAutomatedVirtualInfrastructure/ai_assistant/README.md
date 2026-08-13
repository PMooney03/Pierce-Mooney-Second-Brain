# SME Infrastructure AI Support Agent

Optional local AI support for `SMEAutomatedVirtualInfrastructure`: documentation Q&A, log analysis, and setup guidance.

## Purpose

**Documentation Q&A (`ask`)** — search README/docs, answer with Ollama, show sources.

**Log analysis (`ai-log` / `ai-alert`)** — analyses:

- setup and deployment logs
- Vagrant provisioning failures
- Ansible errors
- monitoring alert payloads (Prometheus-style JSON)

It returns:

- summary
- likely cause
- suggested fix
- commands to try
- severity

## Safety

- Advisory only
- No automatic command execution
- Users must review and approve all suggested fixes manually

## Setup

Uses the OpenAI API and the Python standard library only (no extra pip packages).

Set your API key before running:

**PowerShell**

```powershell
$env:OPENAI_API_KEY = "your-api-key"
```

**bash**

```bash
export OPENAI_API_KEY="your-api-key"
```

Optional overrides:

```powershell
$env:OPENAI_MODEL = "gpt-4.1-mini"
$env:OPENAI_BASE_URL = "https://api.openai.com/v1"
```

Install the project so CLI entry points are available:

```powershell
pip install -e .
```

## Automatic log collection (not model training)

Each `python cli.py up ...` or `resume` saves Vagrant output to `logs/vagrant/up-<timestamp>-<hosts>.log`.
Inside each VM, bootstrap scripts append to `/var/log/vagrant-provision.log` on the next `vagrant provision`.

The AI **analyses** these files when you run `ai-log` — it does **not** train or permanently learn from them.
That keeps the assistant optional, free (with Ollama), and easy to update without retraining.

```bash
python cli.py up --preset minimal
python cli.py ai-log --latest
```

## Usage (main CLI)

Ask a question (documentation retrieval + LLM):

```bash
python cli.py ask "Why is my Vagrant VM not starting?"
python cli.py ask "How do I check if Ansible completed successfully?"
python cli.py ask -i
```

See `evaluation_questions.md` for a 15-question test checklist.

Analyse a setup log file:

```bash
python cli.py ai-log ai_assistant/examples/sample_setup_error.log
python cli.py ai-log setup.log --show-excerpt
```

Analyse a VM provisioning log over SSH (VM must be running):

```bash
python cli.py ai-log --host-debug dc-1
```

Analyse a monitoring alert JSON file:

```bash
python cli.py ai-alert ai_assistant/examples/sample_prometheus_alert.json
```

Override the model for one run:

```bash
python cli.py ai-log setup.log --model gpt-4.1-mini
```

## Usage (standalone scripts / console scripts)

```bash
python ai_assistant/analyse_setup_log.py ai_assistant/examples/sample_setup_error.log
python ai_assistant/analyse_alert.py ai_assistant/examples/sample_prometheus_alert.json
```

After `pip install -e .`:

```bash
sme-ai-log ai_assistant/examples/sample_setup_error.log
sme-ai-alert ai_assistant/examples/sample_prometheus_alert.json
```

## Testing with sample data

With `OPENAI_API_KEY` set:

```bash
python cli.py ai-log ai_assistant/examples/sample_setup_error.log
python cli.py ai-alert ai_assistant/examples/sample_prometheus_alert.json
```

These sample files are included in the repo for dry runs without touching live infrastructure.

## When deploy or provision fails

The main CLI prints a reminder after Ansible deploy failures. You can paste output into a `.log` file or fetch a host log with `--host-debug`.
