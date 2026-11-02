# Label manager

**Status:** 🧪 beta

> the desk that holds the calendar — what happens when, who does it, and what the release is still missing.

## In a real label

**Who.** At a major, the *Label General Manager*: "the central organizational hub, directly managing and synchronizing all core departments" — A&R, marketing, digital distribution, legal, streaming relations ([Berklee](https://www.berklee.edu/careers/roles/label-manager)). At an independent, it is the owner. For a self-releasing artist, the nearest hire is an *artist manager*, who "guide[s] every aspect of their clients' careers" ([Berklee](https://www.berklee.edu/careers/roles/artist-manager)).

**Week to week.** They "build master release schedules" and manage the budget (Berklee, above): fix the street date, count backward to every deadline, chase the department that is late, and sign off on what ships. They do not make the record, write the pitch or run the ads — they make sure each of those happens on the week it has to.

**What they produce.** A release schedule with an owner on every line, a budget, and the credits — the one document every department contributes to and none owns alone.

**What it costs.** A label's general manager is a salaried post; nobody publishes a freelance rate for release coordination — varies, ask for a quote. An artist manager is paid on commission: the trade body for managers, the UK Music Managers Forum, describes 20% of the artist's income as the long-standing default and questions whether it still fits ([Music Week](https://www.musicweek.com/management/read/mmf-report-reveals-earnings-breakdown-for-artist-managers/089956), reporting the MMF's *Managing Expectations* report); Billboard puts the usual range at 15–20% ([Billboard](https://www.billboard.com/pro/artist-managers-job-demands-changing-business-music-industry)). Whether that is on gross or net income changes what you keep — a question for a lawyer, not for this desk.

**Where the line is.** Marketing turns a milestone into tasks ("post the teaser Tuesday"); this desk only sets the milestone ("the campaign starts the 4th"). Rights owns every row that pays someone; this desk reads them. Nothing here is dispatched: the label manager hands you the brief, you open the department.

## Here

The Label Management Agent takes a project — "an EP in March" — and works backward from the street date to the step with the longest lead time: vinyl at 12 weeks, else the press advance at 8, else the upload at 4. Every date is derived, never chosen, and every step names the desk that owns it; the lead times come from published checklists (CD Baby, Spotify, CMRRA, CIPO, SoundExchange) and a step with no published number ships marked `≈`, never dropped. Open it with `houselabel` — it is the department you reach when you name none.

| Skill | What you get | Status |
|---|---|---|
| Scope a project | A fixed set of questions, one per turn, that decides which branches the release has — physical, markets, lead single, budget. Saved only when you say yes. | 🧪 beta |
| Plan the release | Every dated step on screen and as a page you tick, priced in three tiers (bare · decent · full) from vendors' own published numbers, with your budget read against them. | 🧪 beta |
| Check readiness | What blocks the next gate, earliest gate first. Presence only — it never grades your bio. Something it cannot see prints as `?`, not as missing; say it exists once and it stops asking. | 🧪 beta |
| Brief a department | One phase turned into the exact ask for the desk that owns it, deadlines as real dates, your share of the budget on one line. Handed to you, never sent. | 🧪 beta |
| Build the credits | The writers, performers, engineers, artwork and funder lines assembled into one CREDITS document in your release folder, every gap routed to the desk that closes it. | 🧪 beta |
| Learn your voice | Reads emails you sent (never your inbox), writes a guide with verbatim samples, and hands you the file to save — every department then drafts in your voice. | 🧪 beta |
| The Plan sheet and the Monday recap | A **Plan** sheet in the release folder (task · date · department · link · status) and the dates on your calendar; every Monday, what got done, what is due this week, what is late, how the numbers moved. `houselabel recap --schedule` mails it at 08:00. | 🧪 beta |

The **Plan** sheet is where you work: tick a task Done there and the Monday recap sees it; set one back to To do and it comes back. The recap only reads — it never changes a status, never mails anyone but you, and the schedule runs on your own machine, so a laptop asleep at 08:00 sends on wake.

**What it never does**

- Dispatches work. It names the department; you decide who to talk to.
- Schedules the art. Recording, mixing and mastering get a slot; it has no opinion on them.
- Moves your street date silently. A date that does not fit is reported as a gap in weeks, with the two options.
- Invents a lead time or a price. No source means a derived date marked `≈` or "no published price" on the line.
- Writes the money rows — splits and writer shares are the rights desk's.

**What it needs from you**

On file already: country, markets and language from your profile; any release you have entered; your songs. It asks for the rest once — the street date, what the project is, physical or not, when the masters land, the lead single, a budget ("not much" is an answer: it gets the three tiers and a question). An answer is never asked twice.

**Example**

> **Artist:** I'm putting out a four-song EP, folk guitar, end of April. Quebec and the rest of Canada.
> **Agent:** Four tracks, folk guitar — that's an EP. Question 3 of 11: any physical — vinyl, CD, or none?
> **Artist:** None. And I don't have a budget figure, honestly.
> **Agent:** No number is fine; the plan prices itself bare, decent and full and you pick. Last one: when do the masters land? Your first deadline is the lead single's upload, and that is 8 weeks before the EP.

## Sources

- Berklee role pages — [Label General Manager](https://www.berklee.edu/careers/roles/label-manager), [Artist Manager](https://www.berklee.edu/careers/roles/artist-manager), [Record industry careers](https://www.berklee.edu/careers/communities/record-industry); cited in the label manager's `label-fundamentals` knowledge file.
- Sub Pop's front doors ([subpop.com/contact](https://www.subpop.com/contact)) and A2IM's roster of "over 600 independently owned record labels" ([a2im.org](https://a2im.org/about/)) — how an independent divides the work; same knowledge file.
- Manager commission — the Music Managers Forum's *Managing Expectations* report, as reported by [Music Week](https://www.musicweek.com/management/read/mmf-report-reveals-earnings-breakdown-for-artist-managers/089956); [Billboard](https://www.billboard.com/pro/artist-managers-job-demands-changing-business-music-industry) on the 15–20% range. Reported, not read from the MMF's own page.
- Lead times — IFPI's Friday release day ([Music Week](https://www.musicweek.com/news/read/ifpi-confirms-friday-global-release-day/060991)), Spotify's 7-day pitch floor ([Spotify for Artists](https://support.spotify.com/us/artists/article/pitching-music-and-videos-to-playlist-editors/)), CD Baby's four-week upload ([CD Baby](https://diymusician.cdbaby.com/releasing-music/music-distribution-guide/)), vinyl's 8–12 weeks ([Microforum](https://www.microforum.ca/blog/how-to-get-an-album-pressed-on-vinyl)); from the `release-path` and `release-fundamentals` knowledge files.
- Credits — ℗ vs © ([17 U.S.C. §402](https://uscode.house.gov/view.xhtml?req=granuleid%3AUSC-prelim-title17-section402&num=0&edition=prelim)), DDEX roles ([DDEX](https://kb.ddex.net/)), FACTOR's acknowledgement penalty ([FACTOR guide](https://factorportalprod.blob.core.windows.net/portal/Documents/Updates/FACTOR_Logo_and_Acknowledgment_Guide.pdf)); same files.
