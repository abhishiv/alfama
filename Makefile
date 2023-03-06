.PHONY: project
project:
	make build

.PHONY: test
test:
	pwd

.PHONY: build
build:
	make tsc

.PHONY: tsc
tsc:
	npx tsc --resolveJsonModule -p ./tsconfig.json --outDir ./dist/esm
	npx tsc --resolveJsonModule -p ./tsconfig.json --module commonjs --outDir ./dist/cjs
