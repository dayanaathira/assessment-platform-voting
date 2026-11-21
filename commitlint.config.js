module.exports = {
  rules: {
    // No `body-case` rule on purpose. Enforcing lower-case bodies makes it
    // impossible to name the things a commit actually changed — env vars
    // (CORS_ORIGINS, DB_MIGRATION_LOCK_TIMEOUT_MS), SQL keywords (DROP
    // COLUMN), or types — which defeats the point of writing a body.
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'ci',
        'chore',
        'revert',
        'WIP',
      ],
    ],
    'subject-full-stop': [2, 'never'],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 1000],
  },
};
