PYTHON ?= $(shell if [ -x /Users/karanpatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 ]; then echo /Users/karanpatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3; elif command -v python3.12 >/dev/null 2>&1; then command -v python3.12; elif command -v python3.11 >/dev/null 2>&1; then command -v python3.11; else command -v python3; fi)
VENV ?= .venv
PIP := $(VENV)/bin/python -m pip
PY := $(VENV)/bin/python

.PHONY: setup check-runtime inspect-dta test serve frontend

setup:
	$(PYTHON) -c "import sys; sys.exit('Python 3.11+ is required') if sys.version_info < (3, 11) else None"
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements-dev.txt

check-runtime:
	$(PY) -m northport.backend.runtime_check

inspect-dta:
	$(PY) -m northport.backend.ingest.inspect_dta /Users/karanpatel/Downloads/gcap_slice/2025q4.dta --limit 10

test:
	$(PY) -m pytest

serve: check-runtime
	$(PY) -m uvicorn northport.backend.api.app:app --reload

frontend:
	cd frontend && npm install && npm run dev
