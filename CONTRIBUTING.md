# Contributing

Thanks for helping House Label. Every contribution counts: a bug report, a fix,
a better source for a department's knowledge.

## Ways to help

- **Report a bug** or **suggest an idea**: [open an issue](https://github.com/chloepilonv/house-label/issues/new/choose) with the templates.
- **Fix something**: look for issues labelled `good first issue`.
- **Improve a department**: sources, knowledge, skills. Read [agents/README.md](./agents/README.md) first.

For anything big, open an issue before writing code, so we agree on the approach.

## Set up

```bash
git clone https://github.com/<you>/house-label.git && cd house-label
./setup-label.sh
```

Project conventions: [AGENTS.md](./AGENTS.md). Commands: [doc/DEVELOPMENT.md](./doc/DEVELOPMENT.md).

## Make a change

1. Fork the repo and create a branch: `<type>/<short-desc>`, e.g. `fix/null-token-crash`.
2. Keep one purpose per PR.
3. Run the checks below.
4. Open a PR against `main`. It is squash-merged into one commit.

## Commit and PR format

[Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>): <summary>`

- Types: `feat` · `fix` · `docs` · `refactor` · `test` · `chore`
- Imperative, 72 characters max, no period: `feat(press): add magazine outlets`
- Breaking change: add `!`, e.g. `feat(api)!: drop v1 endpoints`

The PR title uses the same format. The PR description (the template fills it in):

```
**Why:** the problem, 1-3 lines
**What:** one bullet per key change
**Test:** command run or steps to verify
**Risk:** optional, what could break
Closes #<issue>
```

## Checks

```bash
bun run test            # unit tests
bun run agents:check    # the department format contract
bun run agents:sync     # after editing agents/: commit what it regenerates
bun run docs:build      # after editing doc/
```

A PR is sent back if it contains a secret, a real person's private contact, dead
code, or a rename left half-done.

## Security

Found a vulnerability? Don't open a public issue. Email chloe.pilonv@gmail.com.

## License

By contributing, you agree your work is licensed under the [GNU AGPL-3.0](./LICENSE).
