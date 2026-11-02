#!/bin/sh
# One command from a fresh clone to a working label:
#   ./setup-label.sh
# Installs the dependencies, puts `houselabel` on your PATH, then runs
# `houselabel init` (language, provider, key, database) and
# `houselabel profile`. Safe to re-run: init asks before redoing anything.
set -e
cd "$(dirname "$0")"

bold=$(printf '\033[1m'); dim=$(printf '\033[2m'); red=$(printf '\033[31m')
green=$(printf '\033[32m'); reset=$(printf '\033[0m')

track() { printf '\n%s%s%s\n%s  %s%s\n' "$bold" "$2" "$reset" "$dim" "$3" "$reset"; }
fail() { printf '\n%s🔇 Session stopped: %s%s\n  %s\n' "$red" "$1" "$reset" "$2"; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed." "Install it, then run ./setup-label.sh again: $2"
}

printf '\n%s🎛  House Label — setting up the studio%s\n' "$bold" "$reset"
printf '%s   Five steps, about 10 minutes. You will answer questions in steps 3, 4 and 5.%s\n' "$dim" "$reset"

track 1 "♫⋆｡♪ ₊˚♬ ﾟ. Step 1: Making sure you have all the gear (git, Bun, uv, Docker) ♫⋆｡♪ ₊˚♬ ﾟ." "Checking that each one is installed."
need git https://git-scm.com/downloads
if ! command -v bun >/dev/null 2>&1; then
  printf '  Installing Bun (no password needed)…\n'
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1 || fail "Bun could not be installed." "Install it from https://bun.sh, then run ./setup-label.sh again."
  export PATH="$HOME/.bun/bin:$PATH"
fi
need uv https://docs.astral.sh/uv/getting-started/installation/   # runs data/catalog/query.py, the catalog reader
need docker "https://www.docker.com/products/docker-desktop/ (install it like any app, then open it once)"
printf '  %s🎵 All the gear is here.%s\n' "$green" "$reset"

track 2 "♫⋆｡♪ ₊˚♬ ﾟ. Step 2: Downloading the sheet music (the right libraries) ♫⋆｡♪ ₊˚♬ ﾟ." "Also puts the houselabel command on your PATH."
bun install || fail "bun install failed." "Read the error above, then run ./setup-label.sh again."
bun link >/dev/null || fail "bun link failed." "Read the error above, then run ./setup-label.sh again."
printf '  %s🎵 Sheet music on the stand.%s\n' "$green" "$reset"

track 3 "♫⋆｡♪ ₊˚♬ ﾟ. Step 3: Setting up the label with you ♫⋆｡♪ ₊˚♬ ﾟ." "Your language, your provider and its key, if it needs one. Then the database starts in Docker."
bun run engine/cli.ts init || fail "setup was not finished." "Run ./setup-label.sh again; nothing done so far is lost."

track 4 "♫⋆｡♪ ₊˚♬ ﾟ. Step 4: Completing your artist profile ♫⋆｡♪ ₊˚♬ ﾟ." "Fourteen questions about you. Every department reads the answers."
bun run engine/cli.ts profile || fail "the profile was not finished." "Run: houselabel profile"

track 5 "♫⋆｡♪ ₊˚♬ ﾟ. Step 5: Plugging in your tools (optional) ♫⋆｡♪ ₊˚♬ ﾟ." "All optional. Press Enter to skip; connect later with houselabel connect."

# ask "question" → true only on y/yes. Enter, or anything else, skips.
ask() { printf '  %s [y/N] ' "$1"; read -r answer || answer=; case $answer in [yY]*) return 0;; *) return 1;; esac; }

printf '\n  First, %sGoogle%s. We create one folder in your Drive for all your documents (presskits,\n' "$bold" "$reset"
printf '  plans, songs...) and put your release dates on your Google Calendar.\n'
printf '  %sIt needs a free Google Cloud project; the next screens walk you through it (about 15 minutes).%s\n' "$dim" "$reset"
if ask "Connect Google now?"; then
  bun run engine/cli.ts connect google || printf '  %sGoogle skipped. Try again any time: houselabel connect google%s\n' "$dim" "$reset"
else
  printf '  %s🎵 Skipped. Later: houselabel connect google%s\n' "$dim" "$reset"
fi

printf '\n  Then, %sBuffer%s. Buffer helps you prepare posts for all your social media accounts in one place.\n' "$bold" "$reset"
printf '  We only create drafts: you review each one in Buffer before anything is published.\n'
printf '  %sIt needs a Buffer API key (about 2 minutes).%s\n' "$dim" "$reset"
if ask "Connect Buffer now?"; then
  bun run engine/cli.ts connect buffer || printf '  %sBuffer skipped. Try again any time: houselabel connect buffer%s\n' "$dim" "$reset"
else
  printf '  %s🎵 Skipped. Later: houselabel connect buffer%s\n' "$dim" "$reset"
fi

printf '\n  Last, %sHunter%s. It finds the journalist or radio music director behind an info@ address.\n' "$bold" "$reset"
printf '  We always ask before using one of your credits (free plan: 50 a month).\n'
printf '  %sIt needs a Hunter API key (about 2 minutes).%s\n' "$dim" "$reset"
if ask "Connect Hunter now?"; then
  bun run engine/cli.ts connect hunter || printf '  %sHunter skipped. Try again any time: houselabel connect hunter%s\n' "$dim" "$reset"
else
  printf '  %s🎵 Skipped. Later: houselabel connect hunter%s\n' "$dim" "$reset"
fi

printf '\n%s🎤🎶 The label is open. Your label manager is waiting.%s\n' "$bold" "$reset"
if grep -q '"provider": "claude-code"' "$HOME/.houselabel/config.json" 2>/dev/null; then
  printf '   Your label runs in Claude Code. Type this in this folder and press Enter:\n\n'
  printf '      %sclaude%s\n\n' "$bold" "$reset"
elif command -v houselabel >/dev/null 2>&1; then
  printf '   Type this in your terminal and press Enter to talk to it:\n\n'
  printf '      %shouselabel%s\n\n' "$bold" "$reset"
else
  printf '   Your terminal does not know the houselabel command yet.\n'
  printf '   1. Copy this line into your terminal and press Enter:\n\n'
  printf '      %secho '\''export PATH="$HOME/.bun/bin:$PATH"'\'' >> ~/.zshrc && exec $SHELL%s\n\n' "$bold" "$reset"
  printf '   2. Then type this and press Enter to talk to your label manager:\n\n'
  printf '      %shouselabel%s\n\n' "$bold" "$reset"
fi
