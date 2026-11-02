# Ubuntu devcontainer base: git, curl, and a non-root `vscode` user built in.
# Pinned to the LTS: the floating :ubuntu tag moves to releases the
# docker-in-docker feature doesn't support yet (no moby packages).
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# unzip: the Bun installer needs it.
# BUN_INSTALL=/usr/local puts bun on everyone's PATH with no profile edits.
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash
