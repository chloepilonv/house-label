# The artist's Drive workspace

One folder tree in the artist's own Google Drive, holding **content**: audio,
artwork, photos, video. Collaborators who will never install this app (a
manager, a publicist, a mixing engineer) reach the work by link. Plans,
checklists and pitches stay rows in `data/artist`; a Drive copy would drift.

```
<Artist name> — House Label/
├── Artist/
│   ├── Presskit/                    the deck (Slides + PDF)
│   ├── Photos/                      2026-03_OdileRay_by-Jane-Doe_press-01.jpg
│   ├── Brand/                       logo, fonts, colour codes
│   └── Admin/                       society confirmations, tax forms, distributor agreement
├── Budget/
│   └── Budget                       EXPECTED (what each plan priced) + SPENT (what was paid)
└── Releases/
    └── 2026-05_Nightdrive (EP)/
        ├── Nightdrive — Release-Credits   the ONE sheet: every fact a rights platform asks for
        ├── Useful links — Nightdrive      smart link, release links, platforms, codes (add-only)
        ├── Plan — Nightdrive              Date · Action · Agent · Status · Source (weekly recap)
        ├── Songs/
        │   ├── Audio/               the advance listening link
        │   └── Lyrics/              one "<song> — lyrics" Doc per song (artist.songs.lyrics)
        ├── Artwork/                 cover 3000×3000 + crops
        ├── Video/                   clips, live footage, BTS
        └── Digital-Contents/
            └── 2026-04-09_Lyric-video-15s (short)/
```

## Naming rules

- **`Title-Case`, hyphen for multiword names.** The names are constants in
  `workspace.ts`, because `ensurePath` is find-or-create *by name*: a second
  spelling is a second folder, and the link already sent points at the empty one.
- **Release folders:** `YYYY-MM_<title> (<type>)`, from the `artist.releases`
  row, never free text, so they sort by date.
- **`Digital-Contents/`:** one folder per `artist.marketing_tasks` row with
  `task_type = 'create'`, named `<due_date>_<title> (<format>)`. Sorted by date,
  it is the shooting schedule. Each folder's link goes back into `content_url`.
- **`Audio/` and `Video/` stay flat.** The artist removed the sub-folders; a
  test fails if they come back.

## Who creates what

| Creator | Folders | When |
| --- | --- | --- |
| `houselabel profile` (a script, not an agent) | root + `Artist/*` | first profile save after Google is connected |
| label-manager `manager-scope-project` | the whole `Releases/<release>/` template, `Digital-Contents/` empty | when the artist validates the project scope |
| digital-marketing `digital-marketing-plan` | `Digital-Contents/<task>` | when the plan is approved |
| `houselabel drive setup`, label-manager `plan.ts --save` | `Budget/`, the `Budget` sheet | whichever comes first |

Most leaf folders are filled by the **artist** dragging files in, which is why
the app needs the full `drive` scope ([README](./README.md#adding-a-scope)).

## The `drive:` contract

A department declares its folders in its `AGENT.md` frontmatter, beside
`google:`; `bun run agents:check` enforces it. `write` creates and uploads,
`read` never writes, and a folder not listed cannot be touched. Example:

```yaml
drive:
  write: [Artist/Presskit]
  read:  [Artist/Photos, Artist/Brand]
```

| Token | Path | write | read |
| --- | --- | --- | --- |
| `artist/presskit` | `Artist/Presskit` | presskit | press |
| `artist/photos` | `Artist/Photos` | — (artist) | presskit, press, digital-marketing |
| `artist/brand` | `Artist/Brand` | — (artist) | presskit, digital-marketing |
| `artist/admin` | `Artist/Admin` | — (artist) | rights |
| `releases` | `Releases/<r>` (skeleton) | label-manager | label-manager |
| `releases/songs` | `Releases/*/Songs` | — (artist) | rights, label-manager |
| `releases/audio` | `Releases/*/Songs/Audio` | — (artist) | distribution, press |
| `releases/lyrics` | `Releases/*/Songs/Lyrics` | — (artist) | rights |
| `releases/artwork` | `Releases/*/Artwork` | — (artist) | distribution, presskit, digital-marketing |
| `releases/video` | `Releases/*/Video` | — (artist) | press, digital-marketing |
| `releases/digital-contents` | `Releases/*/Digital-Contents` | digital-marketing | digital-marketing, platforms |
| `budget` | `Budget/` + the `Budget` sheet | label-manager (EXPECTED), the artist (SPENT) | label-manager |

Only `workspace.ts` maps a token to a path, so folders move without `AGENT.md` edits.

## Rules every writer follows

- **Nothing overwrites.** `ensureSpreadsheet` returns an existing file
  untouched; seeding only appends rows not already there. The artist's typing
  is not ours to erase.
- **A file's presence proposes, never confirms.** A file in `Audio/` lets
  `manager-check-readiness` *propose* "master files"; the artist confirms.
- **`Budget/` is never shared by link:** it holds what the artist spent.
- **`Budget` sheet:** `EXPECTED` is rewritten per release on each plan save;
  `SPENT` is append-only and doubles as the expense report funders ask for.
  Spec: `budget-sheet.ts`.
- **`Release-Credits` sheet** (spec: `credits-sheet.ts`): five tabs —
  `RELEASE_CREDITS`, `SONG_CREDITS`, `SONG_SPLITS`, `PEOPLE_INFO`, `GLOSSARY`.
  Older sheets are brought to the current tabs on every run (`reconcileTabs`);
  a tab with typed rows is never deleted. It is intake only; the generated
  credits are a separate Doc from `manager-build-credits`.
- **`PEOPLE_INFO` holds a SIN.** A Sheet has no per-cell permissions, so the
  tab's note tells the artist to share the file only with people who may read
  every row.
