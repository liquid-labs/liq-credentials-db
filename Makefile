ifneq (grouped-target, $(findstring grouped-target,$(.FEATURES)))
ERROR:=$(error This version of make does not support required 'grouped-target' (4.3+).)
endif

.DELETE_ON_ERROR:
.PHONY: all build clean-test lint lint-fix qa test test-repos-live test-repos-commitable

default: build

CATALYST_SCRIPTS:=npx catalyst-scripts

LIB_SRC:=src
LIB_FILES:=$(shell find $(LIB_SRC) \( -name "*.js" -o -name "*.mjs" \) -not -path "*/test/*" -not -name "*.test.js")
ALL_SRC_FILES:=$(shell find $(LIB_SRC) \( -name "*.js" -o -name "*.mjs" \))

TEST_STAGING=test-staging
TEST_SRC_FILES:=$(shell find $(LIB_SRC) -name "*.js")
TEST_BUILT_FILES:=$(patsubst $(LIB_SRC)/%, $(TEST_STAGING)/%, $(TEST_SRC_FILES))
LIBRARY:=dist/liq-credentials-db.js

#TEST_DATA_SRC:=src/test/data
#TEST_DATA_BUILT_SRC=$(TEST_STAGING)/data
#TEST_DATA_FILES:=$(shell find $(TEST_DATA_SRC) -type f)
#TEST_DATA_BUILT_FILES:=$(patsubst $(TEST_DATA_SRC)/%, $(TEST_DATA_BUILT_SRC)/%, $(TEST_DATA_FILES))

BUILD_TARGETS:=$(LIBRARY)

# build rules
build: $(BUILD_TARGETS)

all: build

$(LIBRARY): package.json $(LIB_FILES)
	JS_SRC=$(LIB_SRC) $(CATALYST_SCRIPTS) build

# test
#$(TEST_DATA_BUILT_FILES) &: $(TEST_DATA_FILES)
#	rm -rf $(TEST_DATA_BUILT_SRC)/*
#	mkdir -p $(TEST_DATA_BUILT_SRC)
#	cp -rf $(TEST_DATA_SRC)/* $(TEST_DATA_BUILT_SRC)
#	# we 'cp' so that when make compares the test-staging repos to the src repos, it doesn't see a lot of missing files
#	for DOT_GIT in $$(find $(TEST_DATA_BUILT_SRC) -name 'dot-git'); do cp -r $$DOT_GIT $$(dirname $$DOT_GIT)/.git; done

$(TEST_BUILT_FILES)&: $(ALL_SRC_FILES)
	JS_SRC=$(LIB_SRC) $(CATALYST_SCRIPTS) pretest

last-test.txt: $(TEST_BUILT_FILES) # $(TEST_DATA_BUILT_FILES)
	# JS_SRC=$(TEST_STAGING) $(CATALYST_SCRIPTS) test | tee last-test.txt
	( \
		set -e; \
		set -o pipefail; \
		JS_SRC=$(TEST_STAGING) $(CATALYST_SCRIPTS) test 2>&1 | tee last-test.txt; \
	)

test: last-test.txt

# lint rules
last-lint.txt: $(ALL_SRC_FILES)
	( \
		set -e; \
		set -o pipefail; \
		JS_LINT_TARGET=$(LIB_SRC) $(CATALYST_SCRIPTS) lint | tee last-lint.txt; \
	)

lint: last-lint.txt

lint-fix:
	JS_LINT_TARGET=$(LIB_SRC) $(CATALYST_SCRIPTS) lint-fix

qa: test lint

test-repos-live:
	for DG in $$(find src/test/data -name dot-git); do mv $$DG $$(dirname $$DG)/.git; done

test-repos-commitable:
	for DG in $$(find src/test/data -name .git); do mv $$DG $$(dirname $$DG)/dot-git; done