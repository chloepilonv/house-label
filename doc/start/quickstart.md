# QuickStart

Ten minutes. Needs [Bun](https://bun.sh) ≥ 1.1 and [Docker Desktop](https://docs.docker.com/desktop/) open.

```bash
git clone https://github.com/chloepilonv/house-label && cd house-label
./setup-label.sh      # language → provider → database → your profile → Google (Enter skips)
houselabel            # talk to your label manager
```

Then say what you are working on: *"I'm putting out a single in January, where do I start?"*
The label manager scopes it (one question at a time), dates every step, names the
department that owns each one, and offers to put it in your Drive and Calendar.

```bash
houselabel press              # any department by name · --staff lists them
houselabel recap              # what got done, what is due this week
houselabel recap --schedule   # the same, emailed to you every Monday at 08:00
houselabel connect google     # Drive, Calendar, Gmail — optional, ~8 min once
```

**See a real campaign before running yours.** When an example ships, one
command builds it in your Drive with the label's own template — the Plan sheet
with every step dated and ticked, the Budget, the useful links, the lyrics, the
credits — in its own folder, beside yours:

```bash
houselabel example            # lists the examples there are
houselabel example <name>     # builds one; needs Google connected
```

An example is one file, `agents/label-manager/skills/manager-plan-release/references/example-<name>.yaml`.
The label manager reads the same file before it plans yours.

**No install at all** 🟡 beta: open a Claude project, add the `agents/<department>/`
folder from the repo, connect your Google Drive, and talk. The knowledge is the
same; nothing is remembered between conversations except what lands in Drive.

Next: [How it works](./how-it-works).
