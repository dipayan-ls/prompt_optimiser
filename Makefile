OLLAMA_MODEL ?= llama3.1:8b

.PHONY: help install dev worker ollama ollama-pull ollama-stop test lint build deploy-worker check

help:
	@echo "Prompt Optimiser — by Dipayan"
	@echo ""
	@echo "  make install       Install dependencies"
	@echo "  make dev           Run the frontend on :3000"
	@echo "  make worker        Run the API worker on :8787"
	@echo "  make ollama        Start local Ollama (docker compose)"
	@echo "  make ollama-pull   Pull $(OLLAMA_MODEL) into Ollama (~4.7GB, first run only)"
	@echo "  make ollama-stop   Stop local Ollama"
	@echo "  make test          Run unit + integration tests"
	@echo "  make lint          Typecheck"
	@echo "  make check         Lint + test + build (run before pushing)"
	@echo "  make build         Build the static site into dist/"
	@echo "  make deploy-worker Deploy the API worker to Cloudflare"
	@echo ""
	@echo "Typical local setup:  make install && make worker   (in one shell)"
	@echo "                      make dev                      (in another)"

install:
	npm install

dev:
	npm run dev

worker:
	npm run worker

ollama:
	docker compose up -d
	@echo "Ollama is up on :11434. Run 'make ollama-pull' if you haven't yet."

ollama-pull:
	docker compose exec ollama ollama pull $(OLLAMA_MODEL)

ollama-stop:
	docker compose down

test:
	npm test

lint:
	npm run lint

build:
	npm run build

check: lint test build
	@echo "All checks passed."

deploy-worker:
	npm run deploy:worker
