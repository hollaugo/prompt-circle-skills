# Makefile for Prompt Circle Skills

.PHONY: help build validate lint test clean

# Default target
help:
	@echo "Prompt Circle Skills - Available Commands"
	@echo "========================================"
	@echo ""
	@echo "  make build          - Build all skill packages"
	@echo "  make build SKILL=x  - Build a specific skill package"
	@echo "  make validate       - Validate manifest"
	@echo "  make lint           - Run linting (ruff + mypy)"
	@echo "  make test           - Run tests"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make all            - Build, validate, lint, and test"
	@echo ""

# Build
build:
	python3 scripts/build_packages.py -v

build SKILL=%:
	python3 scripts/build_packages.py -v --skill $(SKILL)

# Validate
validate:
	python3 scripts/validate_manifest.py --strict

# Lint
lint:
	ruff check skills/ scripts/
	mypy skills/ scripts/

# Test
test:
	pytest tests/ -v --tb=short

# Clean
clean:
	rm -rf packages/*/
	rm -rf __pycache__/
	find . -name "*.pyc" -delete
	find . -name "*.pyo" -delete

# All
all: validate lint test build

# Install development dependencies
install-dev:
	pip install -r requirements.txt
	pip install -e ".[dev]"

# Install pre-commit hooks
install-hooks:
	pre-commit install
