# What the agents never do

> They prepare. You press send. And when an answer looks wrong, there is a
> way to check it.

## Never

- **Send, submit, post or upload for you.** A pitch opens as a draft in your
  browser; a form is yours to fill; a release is yours to deliver. The press
  and promotion job descriptions say "drafts, never sends", and the code has no
  tool that could ([How it works](../start/how-it-works)).
- **Spend your money without saying the number first.** A pitching service, an
  ad, a contact lookup on your own key: the price is on screen before anything
  runs.
- **Give tax or legal advice.** No department is an accountant, and each
  says so. Contracts, splits disputes,
  licensing of a cover: it names the kind of person to call.
- **Change your profile.** Only you write it. A department that could edit it
  mid-conversation would change every other department's answers with no
  record of who decided.
- **Reach the web, your Google account or an outside service it did not
  declare.** Each department lists what it may touch; an undeclared tool does
  not exist for it. The platforms department, for one, fetches nothing — you
  read your dashboards and it records what you say.

## Hallucination, and how the label guards against it

A language model can "generate text that is factually incorrect or
inconsistent with the given context" — that is Anthropic's own definition of
hallucination ([Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)).
A model asked for a FACTOR deadline will write one, fluently, whether or not
it knows it. The guards here follow the same page's advice — ground in sources,
allow "I don't know", make claims auditable — but as code, not as a polite
request:

| Guard | What it means for you |
|---|---|
| **Numbers come from scripts.** | A deadline is a script reading a date. A distributor's real cut on your revenue, a budget total: computed, the same every run. The model reports the result; it does not do the arithmetic. |
| **Rules come with a source.** | Every line in a knowledge file carries the page it came from and the date it was last checked. Every catalog row carries its source link. Ask "where is that from?" and you get a link, not a shrug. |
| **The model never sees the whole library.** | It is sent the *titles* of the knowledge pages and opens the one your question needs. Less text in front of it means less to blur. |
| **`?` is not `✗`.** | A readiness check marks a thing *missing* (`✗`) only when it is tracked and absent. Something the label has never been told is *unknown* (`?`). Reporting one as the other sends you to fix work you may have already done — and the skills are told so. |
| **"Partial" means "not all".** | Every catalog dataset but one is marked a sample, and a department reading it may say "what I found", never "these are all". |
| **Unknown is shown, never hidden.** | A delivery checklist marks each item ready, missing or unknown — and an unknown ships with the link to where you can find out. |
| **Simulated artists test every department.** | Four invented artists hold full conversations with a department before a real one does. The one who has never released anything catches jargon; the US trio catches SOCAN offered to a band from Oregon. |

None of this makes a wrong answer impossible. Anthropic's page ends the same
way: these techniques "don't eliminate them entirely. Always validate critical
information."

## When an answer looks wrong

1. **Ask for the source.** "Where does that deadline come from?" A department
   answers with the page and the last-verified date. No source is itself the
   answer: treat the claim as unverified.
2. **Open the page.** The funder's, the society's, the distributor's. Thirty
   seconds, and it is the only thing that settles it.
3. **Tell the department.** "That closed in February, not March." It proposes
   to remember the correction for you; it cannot edit the catalog.
4. **Report it** if the catalog row is wrong, so it is fixed for everyone:
   [github.com/chloepilonv/house-label/issues](https://github.com/chloepilonv/house-label/issues).
   See [the catalog](./the-catalog#when-a-row-is-wrong).

Money, a signature, a submission with a deadline: check first, every time. The
label is built so the check is one link away.

Back to: [What runs your label](./).

## Sources

- Anthropic, [Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
- This repo: [How it works](../start/how-it-works) — "What the agents never do"; [Welcome](../start/welcome) — "What it is not"; the label manager's readiness skill (`?` versus `✗`), the distribution skills (unknown shown with a warning), the dataset manifest (partial versus complete), the evals personas
