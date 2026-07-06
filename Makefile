PYTHON ?= .venv/bin/python

.PHONY: install dev run api web test benchmark build

install:
	$(PYTHON) -m pip install -r requirements-dev.txt
	cd frontend && npm install

dev:
	$(MAKE) -j2 api web

run:
	$(PYTHON) -m backend.main

api:
	$(PYTHON) -m backend.main

web:
	cd frontend && npm run dev

test:
	$(PYTHON) -m pytest
	cd frontend && npm test

build:
	cd frontend && npm run build

benchmark:
	$(PYTHON) -m benchmark.benchmark_pipeline --output benchmark/results/latest.json
