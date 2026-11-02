# Your data: where it lives

> Three places. Your machine, your Google Drive, and — only during a
> conversation — your provider. Nothing of yours goes anywhere else.

## The map

| | Where | What | Leaves your machine? |
|---|---|---|---|
| **The database** | on your computer | your profile, songs and splits, saved distributors, the release plan and its dates, your platform numbers, what each department has remembered about you | only the parts sent in a conversation (below) |
| **Your Drive** | your Google account | content: audio, artwork, photos, video, the presskit, the Budget sheet, the credits sheet | it is already in your Google account; a department reads a file only for the task at hand |
| **The provider** | Anthropic, OpenAI, … or your own machine with Ollama | the conversation package, for the length of the conversation | yes, by design — that is what a provider is |

The database ships **empty**. It fills one answer at a time, in conversation,
and every save is proposed first: "want me to save it?" Your profile is the
exception — only you write it, through the profile command, and no department
can change it, because every other answer is derived from it.

It is the half you take with you if you leave: it is a database on your
machine, with no link into ours ([How it works](../start/how-it-works)).

## What reaches the provider

Each turn sends: the department's job description and skill, the titles of its
knowledge pages, your artist file (profile plus what this department
remembered), the roster, today's date, and the conversation so far
([What runs your label](./)). The catalog rows a search returned go too. So
does a Drive file a department opens for the task — a press photo for the
presskit.

What never reaches the provider: your Google password or login tokens, your
key for another provider, other conversations, the parts of your Drive outside
the label's folder, and the whole catalog.

What the provider does with it depends on the provider:

- **Anthropic** — "Anthropic may not train models on Customer Content from
  Services", where Customer Content is your inputs and outputs
  ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)).
- **Google Gemini** — on the free tier, Google uses prompts and responses "to
  provide, improve, and develop" its products; on paid use it does not
  ([Gemini API terms](https://ai.google.dev/gemini-api/terms)).
- **Ollama** — the model runs on your machine; nothing is sent anywhere
  ([ollama.com](https://ollama.com/)).
- **Others** — read the provider's business terms before you paste a key.

## What Google is asked for, and why

Connecting Google is optional. The consent screen lists four permissions:

| Permission | Why |
|---|---|
| your email address | shown once at connect time, so you can see you linked the label account and not a personal one |
| Calendar | the release plan's dates, written as events |
| **Drive — all files** | the label's folder in your Drive is filled mostly **by you**: you drag a master, a cover, a photo in from your desktop. The narrower "files this app created" permission would make every one of those invisible to the label forever. So it asks for the broad one, on purpose |
| Sheets | the credits sheet has five tabs and the Budget sheet two; the plain Drive upload can only make a one-tab sheet |

The permission is what Google allows; the code allows less. Each department
declares which folders it may read and which it may write, and a department
with no Drive line gets no Drive tool at all. Nothing lists your Drive outside
the label's folder.

Google classes the broad Drive permission as **restricted**, which means a
hosted service must pass Google's verification and a yearly security
assessment before it can ask for it ([Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)).
Self-hosted, you create your own Google client once and grant it to yourself.

**Gmail is not in that list.** Pitches open as a prefilled compose window in
your browser — no permission, your finger on the send button. Two commands ask
for a Gmail permission on their own, the first time, with the reason on screen:

- *learn my voice* asks to **read** your sent mail once, to learn how you
  write. Read-only, and Google classes it restricted.
- *the Monday recap, emailed* asks to **send** one email, to your own
  address. Google classes that one sensitive, not restricted.

Both are listed on Google's own [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) page.
No department is ever handed a tool that uses either.

## How the Google login is stored

Google hands the label a *token* — a long string that stands in for your
password. It is encrypted on disk (AES-256-GCM) with a key the label generates
once into a file in your home folder, readable by you only. A hosted
deployment sets its own key instead.

Honest limit: this protects against a copied database — the realistic
accident, a dump pasted somewhere — not against someone sitting at your
unlocked machine. Disconnecting asks Google to revoke the token, then deletes
it. You can also revoke it yourself at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

Next: [Our data: the catalog](./the-catalog).

## Sources

- Anthropic, [Commercial Terms](https://www.anthropic.com/legal/commercial-terms), section B
- Google, [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- Google, [Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- Ollama, [ollama.com](https://ollama.com/) — "Your prompts are never stored or trained on"
- This repo: [How it works](../start/how-it-works); the artist database README, the Drive workspace spec, and the Google login and encryption code in the engine
