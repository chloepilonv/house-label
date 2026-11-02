# Providers, keys and cost

> Three ways to run the label. One is tested, one is free, all three keep
> your data where [Your data](./your-data) says.

## Three ways

| | What it is | Cost | Tested here |
|---|---|---|---|
| **Your Claude subscription** | the label runs inside Claude Code, on the plan you already pay for | your subscription | yes |
| **Your own key** | the label calls a provider directly and the provider bills you per word | cents per conversation (below) | Anthropic only |
| **Ollama** | a smaller open model running on your own computer; nothing leaves it | free | wiring only |

Ollama is the floor: it proves the label works with no account and no bill.
It is not the quality the departments were tuned for, and it needs a machine
with enough memory (the pinned models were sized for 24 GB).

## What a key is

A key is a password-like string a provider gives you. The label sends it with
every request so the provider knows whom to bill. It is stored in a settings
file in your home folder, readable by you only, and is never printed back.
Treat it like a card number: anyone who has it can spend on your account.

Get one here (the setup prints the same link):

| Provider | Where to get the key |
|---|---|
| Anthropic — Claude | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| OpenAI — GPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Google — Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Mistral | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys) |
| Groq — fast, open models | [console.groq.com/keys](https://console.groq.com/keys) |
| DeepSeek | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| Moonshot — Kimi | [platform.moonshot.ai/console/api-keys](https://platform.moonshot.ai/console/api-keys) |
| OpenRouter — one key, most models | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Ollama — no key | [ollama.com/download](https://ollama.com/download) |

Most providers ask you to buy credit before the key works. OpenRouter resells
other providers' models at their own price — "there is no markup on inference
pricing" — with a fee when you buy credit ([OpenRouter FAQ](https://openrouter.ai/docs/faq)).

## What a conversation costs

Providers bill per million tokens, in and out. The label keeps the cost down
two ways: the big package it sends every turn is **cached** by the provider
after the first turn (Anthropic charges a cache read at a tenth of the input
price — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)),
and the expensive model is used only for the heavy phase, never for the
interview ([What runs your label](./)).

**Our estimate, not a quote:** a 20-turn conversation that ends in a plan sends
on the order of 200,000 input tokens (nine in ten of them cached) and gets back
about 10,000. At Anthropic's published prices for the pinned models that is
roughly **$0.15–0.40 USD** per conversation. Your bill is the only real number;
every provider shows usage in its console.

| Provider | Models the label pins | Price per million tokens, in / out (USD) | Source |
|---|---|---|---|
| Anthropic | Claude Haiku 4.5 · Sonnet 5 · Opus 5 | $1 / $5 · $2 / $10 · $5 / $25 | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| OpenAI | gpt-5-mini · gpt-5 | $0.25 / $2 · $1.25 / $10 — both pages now say **deprecated**; the setup will offer a fix | [gpt-5](https://developers.openai.com/api/docs/models/gpt-5), [gpt-5-mini](https://developers.openai.com/api/docs/models/gpt-5-mini) |
| Google | gemini-3.5-flash-lite · gemini-3.6-flash · the Pro rung | $0.30 / $2.50 · $0.75 / $3.75 (rising Jan 2027) · see the pricing page | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Mistral | mistral-small-latest · mistral-large-latest | Small: see the pricing page · Large: $0.5 / $1.5 | [Mistral pricing](https://mistral.ai/pricing) |
| Groq | openai/gpt-oss-20b · openai/gpt-oss-120b | $0.075 / $0.30 · $0.15 / $0.60 | [gpt-oss-20b](https://console.groq.com/docs/model/openai/gpt-oss-20b), [gpt-oss-120b](https://console.groq.com/docs/model/openai/gpt-oss-120b) |
| DeepSeek | deepseek-chat · deepseek-reasoner | see the pricing page — it now lists different names; the setup checks and offers a fix | [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| Moonshot | kimi-k2-turbo-preview · kimi-k2-0905-preview | see the pricing page — K2 models close to new users on 2026-10-31 and retire by end of 2026 | [Kimi pricing](https://platform.kimi.ai/docs/pricing/chat) |
| OpenRouter | Claude models through OpenRouter | the underlying provider's price, no markup | [OpenRouter FAQ](https://openrouter.ai/docs/faq) |
| Ollama | qwen3:8b · qwen3:14b | $0 — "running models on your own hardware is always unlimited" | [Ollama pricing](https://ollama.com/pricing) |

Providers rename models faster than a table can follow, which is why the setup
sends one tiny test message at the end and offers to fix a name that no longer
exists, rather than failing on your first real question.

## Free tiers

Two providers give some use for free, and neither is enough to run a
department:

- **Google Gemini** marks the Flash and Flash-Lite models "free of charge" on
  a free tier ([pricing](https://ai.google.dev/gemini-api/docs/pricing)); the
  exact daily cap is shown only inside your AI Studio account
  ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)). When we
  measured it, the free quota ran out mid-conversation, and on the free tier
  Google uses your prompts "to provide, improve, and develop" its products
  ([Gemini API terms](https://ai.google.dev/gemini-api/terms)); paid use is not.
- **Groq** caps the pinned models at 8,000 tokens per minute on its Developer plan's base limits
  ([rate limits](https://console.groq.com/docs/rate-limits)) — smaller than the
  package one turn sends.

Both are on the roadmap as "cannot run a department". Free and workable means
Ollama, or the subscription.

Next: [Your data: where it lives](./your-data).

## Sources

- Anthropic, [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- OpenAI, [gpt-5](https://developers.openai.com/api/docs/models/gpt-5) and [gpt-5-mini](https://developers.openai.com/api/docs/models/gpt-5-mini) model pages
- Google, [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [terms](https://ai.google.dev/gemini-api/terms)
- Mistral, [Pricing](https://mistral.ai/pricing)
- Groq, [gpt-oss-20b](https://console.groq.com/docs/model/openai/gpt-oss-20b), [gpt-oss-120b](https://console.groq.com/docs/model/openai/gpt-oss-120b), [rate limits](https://console.groq.com/docs/rate-limits)
- DeepSeek, [Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- Moonshot, [Kimi pricing](https://platform.kimi.ai/docs/pricing/chat)
- OpenRouter, [FAQ](https://openrouter.ai/docs/faq)
- Ollama, [Pricing](https://ollama.com/pricing)
- This repo: the provider and tier tables in the engine; [Development → Roadmap](../DEVELOPMENT#roadmap), "Free tiers"
