PYTHON=python3
VENV=.venv
REQ=requirements.txt

ifeq ($(OS),Windows_NT)
  VENV_PY=$(VENV)/Scripts/python.exe
  VENV_PIP=$(VENV)/Scripts/pip.exe
else
  VENV_PY=$(VENV)/bin/python
  VENV_PIP=$(VENV)/bin/pip
endif

.PHONY: help dev run_cicids run_unsw run_all clean

help:
	@echo "Targets:"
	@echo "  make dev        - create venv and install requirements"
	@echo "  make run_cicids - run CICIDS2017 pipeline"
	@echo "  make run_unsw   - run UNSW-NB15 pipeline"
	@echo "  make run_all    - run both"
	@echo "  make clean      - remove .venv"

dev:
	@if [ ! -d "$(VENV)" ]; then \
		echo ">>> Creating virtual environment..."; \
		$(PYTHON) -m venv $(VENV) || $(PYTHON) -m virtualenv $(VENV); \
	fi
	@echo ">>> Upgrading pip and installing requirements..."
	@$(VENV_PY) -m pip install --upgrade pip setuptools wheel
	@if [ -f "$(REQ)" ]; then \
		$(VENV_PIP) install -r $(REQ); \
	else \
		echo ">>> No requirements.txt found, skipping dependency install"; \
	fi
	@echo ">>> Dev environment ready."

run_cicids: dev
	@echo ">>> Running CICIDS2017 pipeline..."
	@$(VENV_PY) CICIDS2017/MachineLearningCVE/cicids2017_ml_pipeline.py

run_unsw: dev
	@echo ">>> Running UNSW-NB15 pipeline..."
	@$(VENV_PY) UNSW-NB15/unsw_nb15_ml_pipeline.py

run_all: dev
	@$(VENV_PY) CICIDS2017/MachineLearningCVE/cicids2017_ml_pipeline.py
	@$(VENV_PY) UNSW-NB15/unsw_nb15_ml_pipeline.py

clean:
	@echo ">>> Removing virtual environment..."
	@rm -rf $(VENV) || true

