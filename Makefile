SHELL := /bin/bash

PYTHON ?= python3.12
BACKEND_DIR := backend
BACKEND_VENV := $(BACKEND_DIR)/.venv
BACKEND_UVICORN := $(BACKEND_VENV)/bin/uvicorn
BACKEND_PIP := $(BACKEND_VENV)/bin/pip

.PHONY: backend-setup backend-run extension-build mcp-run stack-up

backend-setup:
	@if ! command -v $(PYTHON) >/dev/null 2>&1; then \
		echo "Missing $(PYTHON). Install Python 3.12+ first."; \
		exit 1; \
	fi
	$(PYTHON) -m venv $(BACKEND_VENV)
	$(BACKEND_PIP) install -r $(BACKEND_DIR)/requirements.txt

backend-run:
	@if [ ! -x "$(BACKEND_UVICORN)" ]; then \
		echo "Backend virtualenv is missing. Run 'make backend-setup' first."; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && ./.venv/bin/uvicorn app.main:app --reload --port 8000

extension-build:
	pnpm extension:build

mcp-run:
	pnpm mcp

stack-up: extension-build
	@if [ ! -x "$(BACKEND_UVICORN)" ]; then \
		echo "Backend virtualenv is missing. Run 'make backend-setup' first."; \
		exit 1; \
	fi
	@trap 'kill 0' INT TERM EXIT; \
		pnpm mcp & \
		( cd $(BACKEND_DIR) && ./.venv/bin/uvicorn app.main:app --reload --port 8000 ) & \
		wait
