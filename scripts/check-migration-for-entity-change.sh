#!/usr/bin/env bash
#
# Closes the failure mode of apply-only migrations.
#
# Because the application never generates migrations, changing an entity and
# forgetting the migration still compiles, still passes tests, and only fails
# at runtime when a query hits a column that does not exist. This is the
# mechanical backstop: if a branch touches an entity, it must also add or
# change a migration.
#
# Usage:
#   scripts/check-migration-for-entity-change.sh [base-ref]
#
# In GitLab CI the base is CI_MERGE_REQUEST_DIFF_BASE_SHA. Locally it
# defaults to origin/main.
set -euo pipefail

BASE_REF="${1:-${CI_MERGE_REQUEST_DIFF_BASE_SHA:-origin/main}}"

if ! git rev-parse --verify --quiet "${BASE_REF}" >/dev/null; then
  echo "check-migration-for-entity-change: cannot resolve base ref '${BASE_REF}'." >&2
  exit 1
fi

CHANGED_FILES="$(git diff --name-only "${BASE_REF}...HEAD")"

CHANGED_ENTITIES="$(echo "${CHANGED_FILES}" | grep -E '^src/.*\.entity\.ts$' || true)"
CHANGED_MIGRATIONS="$(echo "${CHANGED_FILES}" | grep -E '^migrations/Migration.*\.ts$' || true)"

if [ -z "${CHANGED_ENTITIES}" ]; then
  echo "No entity changes since ${BASE_REF}. Nothing to check."
  exit 0
fi

if [ -n "${CHANGED_MIGRATIONS}" ]; then
  echo "Entity changes are accompanied by a migration:"
  echo "${CHANGED_MIGRATIONS}" | sed 's/^/  /'
  exit 0
fi

cat >&2 <<EOF
These entity files changed since ${BASE_REF}, but no migration was added:

$(echo "${CHANGED_ENTITIES}" | sed 's/^/  /')

This service never generates migrations at boot, so an entity change without
a migration reaches production as a runtime error against a column that does
not exist.

Run:

  npm run migration:create -- --name <what-it-does>

then READ the generated SQL before committing it. A rename generates
DROP COLUMN plus ADD COLUMN, which looks correct and destroys the column's
data — hand-edit it to ALTER ... RENAME, or split it into expand/contract
across two releases.

If this change genuinely needs no migration (a comment, a computed property,
a non-persisted field), say so in the merge request and set
ALLOW_ENTITY_CHANGE_WITHOUT_MIGRATION=1 for this job.
EOF

if [ "${ALLOW_ENTITY_CHANGE_WITHOUT_MIGRATION:-0}" = "1" ]; then
  echo "" >&2
  echo "ALLOW_ENTITY_CHANGE_WITHOUT_MIGRATION=1 is set — continuing anyway." >&2
  exit 0
fi

exit 1
