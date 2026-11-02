# What runs your label

> A model answers you. Everything around it — the job descriptions, the
> knowledge, the counting — is ours, and you can read it.

## A language model, in one paragraph

A language model is a program that predicts the next piece of text, given the
text before it. Google's own introduction puts it plainly: it "estimates the
probability of a token or sequence of tokens occurring within a longer sequence
of tokens" ([Introduction to Large Language Models](https://developers.google.com/machine-learning/resources/intro-llms)).
A *token* is a word or a piece of one. Trained on an enormous amount of text,
that prediction gets good enough to answer questions, follow instructions and
write a draft. Claude, GPT and Gemini are language models sold by Anthropic,
OpenAI and Google ([Intro to Claude](https://platform.claude.com/docs/en/intro)).

Two things follow. The model has no memory of you between conversations unless
we send it something. And it is good at *writing*, not at *counting* or
*knowing*: it will write a convincing deadline that is wrong. Both shape how
the label is built.

## An agent is a model plus a folder

Each department is one folder. The model reads it at the start of every
conversation ([How it works](../start/how-it-works)):

| Part | What it is | Who wrote it |
|---|---|---|
| The job description | the role, what it owns, what it never does, how it talks to you | us |
| The skills | one task each — "rank the radio stations", "draft the pitch" — as steps | us |
| The scripts | the counting, dating and ranking, as code that gives the same answer every run | us |
| The knowledge | what the department knows about the industry, each rule with its source and a last-checked date | us, from the primary pages |
| The tests | simulated artists hold whole conversations with the department before a real one does | us |

The model supplies the language: it reads your message, follows the skill,
calls a script when a number is needed, opens a knowledge page when a rule is
needed, and writes the reply. It does not invent the rule or the number — see
[What the agents never do](./limits).

## Which model

You choose a **provider** once, at setup. You never choose a model: the label
picks one per phase, from three tiers.

| Tier | Used for | With an Anthropic key |
|---|---|---|
| quick back-and-forth | the interview questions, routing | Claude Haiku 4.5 |
| everyday work | a department doing its normal job | Claude Sonnet 5 |
| the heavy thinking | the release plan, the presskit, the pitch | Claude Opus 5 |

Those are the models the label pins today for Anthropic. Anthropic's current
line-up also includes Claude Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5
([Intro to Claude](https://platform.claude.com/docs/en/intro)); a monthly check
flags when a pinned model has a newer sibling, and an upgrade goes through the
tests first. The other providers have their own three models each — see
[Providers, keys and cost](./providers).

Anthropic is the only provider the departments have been tested on. The
instructions were tuned on Claude; a model that follows them loosely gives a
worse interview, not an error. The setup says so when you pick another one.

**On a Claude subscription** the label runs inside Claude Code, and the model is
whichever one your Claude Code session uses.

## What one conversation sends to the provider

Every turn, the label sends the model one package. It contains:

- the department's job description and the skill it is running;
- the **titles** of that department's knowledge pages — a page is sent only
  when the model opens it for your question;
- your artist file: your profile, and what this department has remembered
  about you;
- the roster, so a department can point you to another one;
- today's date, and everything said so far in this conversation.

It does **not** contain the whole catalog (only the rows a search returned),
your Google Drive (only a file a department reads for the task), or any other
conversation. The package is a few thousand words and is identical from one
turn to the next, so the provider caches it instead of re-reading it — which is
what keeps a conversation cheap. Where each piece lives, and what never leaves
your machine, is on [Your data](./your-data).

Next: [Providers, keys and cost](./providers).

## Sources

- Google, [Introduction to Large Language Models](https://developers.google.com/machine-learning/resources/intro-llms)
- Anthropic, [Intro to Claude](https://platform.claude.com/docs/en/intro) — the current model line-up
- This repo: [How it works](../start/how-it-works); the tier table and the prompt assembly in the engine
