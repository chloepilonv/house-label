#!/usr/bin/env python3
"""Read the shipped catalog — data/catalog/catalog.sqlite — with no server and no install.

    uv run data/catalog/query.py radio --country CA --region QC
    uv run data/catalog/query.py playlists --genre folk --route direct_email
    uv run data/catalog/query.py press --market quebec --q "devoir"
    uv run data/catalog/query.py distributors --where fee_model=subscription --json
    uv run data/catalog/query.py rights --country CA
    uv run data/catalog/query.py --datasets          # what is in the file, with row counts

This is the whole read path for an agent that has no database: Claude Cowork,
Claude Desktop, a Claude Project pointed at agents/<department>/. Standard
library only (sqlite3, argparse, json); `uv run` (pyproject.toml at the root)
supplies a Python when the machine has none. The file is rebuilt every Monday
by .github/workflows/crawl.yml from the build database; nothing here writes.

Author: Chloe Bibiane Pilon Vaillancourt
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "catalog.sqlite")

# dataset name → (table, default columns, the columns --q searches)
DATASETS: dict[str, tuple[str, list[str], list[str]]] = {
    "radio": ("promotion_radio_stations",
              ["name", "city", "region", "country", "station_type", "submission_route", "submission_url", "submission_email", "stated_rules"],
              ["name", "call_sign", "city", "notes", "stated_rules"]),
    "playlists": ("promotion_playlists",
                  ["name", "platform", "curator_type", "curator_name", "country", "language", "follower_count", "submission_route", "submission_url", "curator_contact"],
                  ["name", "curator_name", "notes"]),
    "press": ("press_outlets",
              ["outlet", "outlet_type", "market", "city", "language", "tier", "submission_url", "desk_email", "submission_method"],
              ["outlet", "city", "notes", "submission_method"]),
    "radio-services": ("promotion_radio_services", ["name", "kind", "country", "price_from", "price_unit", "free_tier", "url", "how_to_use"], ["name", "description", "notes"]),
    "pitch-services": ("promotion_pitch_services", ["name", "price_per_credit", "currency", "free_tier", "sells_placement", "url", "risk_notes"], ["name", "description", "notes"]),
    "distributors": ("distribution_services", ["name", "layer", "fee_model", "price_tiers", "cut_streaming_pct", "hq_country", "signup_url", "help_center_url"], ["name", "description", "notes"]),
    "stores": ("distribution_stores", ["name", "type", "direct_upload_possible", "pitch_channel", "regions", "url"], ["name", "notes"]),
    "rights": ("rights_orgs", ["acronym", "full_name", "type_label", "country", "for_whom", "cost", "signup_url"], ["acronym", "full_name", "notes"]),
    "tools": ("tools", ["name", "category", "description", "url"], ["name", "description", "description_fr"]),
}

# Short flags that map onto a column, per dataset. --where col=value covers the rest.
FLAGS = {
    "country": "country", "region": "region", "city": "city", "type": None, "route": "submission_route",
    "language": "language", "platform": "platform", "market": "market", "genre": "genre_fit",
}
TYPE_COLUMN = {"radio": "station_type", "playlists": "curator_type", "press": "outlet_type", "stores": "type", "rights": "type", "tools": "category", "radio-services": "kind", "distributors": "layer"}


def columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f'pragma table_info("{table}")')]


def build(ds: str, args: argparse.Namespace, cols: list[str]) -> tuple[str, list]:
    table = DATASETS[ds][0]
    where, params = [], []
    for flag, col in FLAGS.items():
        value = getattr(args, flag, None)
        if value is None:
            continue
        col = TYPE_COLUMN.get(ds) if flag == "type" else col
        if col not in cols:
            sys.exit(f"✗ {ds} has no column for --{flag}")
        if col == "genre_fit":
            # Arrays are stored as JSON text: ["folk","indie_pop"]. A genre matches as a whole word.
            where.append(f'("{col}" like ? or "{col}" like ?)')
            params += [f'%"{value}"%', '%"all"%']
        else:
            where.append(f'lower("{col}") = lower(?)')
            params.append(value)
    for clause in args.where or []:
        if "=" not in clause:
            sys.exit(f"✗ --where takes col=value, got {clause!r}")
        col, value = clause.split("=", 1)
        if col not in cols:
            sys.exit(f"✗ {ds} has no column {col!r}; columns: {', '.join(cols)}")
        where.append(f'lower("{col}") = lower(?)')
        params.append(value)
    if args.q:
        searchable = [c for c in DATASETS[ds][2] if c in cols]
        where.append("(" + " or ".join(f'lower(coalesce("{c}", \'\')) like ?' for c in searchable) + ")")
        params += [f"%{args.q.lower()}%"] * len(searchable)
    sql = f'select * from "{table}"'
    if where:
        sql += " where " + " and ".join(where)
    order = "name" if "name" in cols else ("outlet" if "outlet" in cols else ("acronym" if "acronym" in cols else cols[0]))
    sql += f' order by "{order}" limit ?'
    params.append(args.limit)
    return sql, params


def cell(v, full: bool) -> str:
    if v is None:
        return ""
    s = str(v)
    if s.startswith("[") or s.startswith("{"):
        try:
            j = json.loads(s)
            s = ", ".join(map(str, j)) if isinstance(j, list) else json.dumps(j, ensure_ascii=False)
        except ValueError:
            pass
    s = " ".join(s.split())
    return s if full or len(s) <= 120 else s[:117] + "…"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dataset", nargs="?", choices=sorted(DATASETS), help="which table to read")
    p.add_argument("--datasets", action="store_true", help="list the datasets in the file")
    for flag in FLAGS:
        p.add_argument(f"--{flag}")
    p.add_argument("--where", action="append", metavar="col=value", help="any column, exact match, repeatable")
    p.add_argument("--q", help="substring search in the name and notes columns")
    p.add_argument("--columns", help="comma-separated columns to show (default: the useful ones; 'all' for every column)")
    p.add_argument("--limit", type=int, default=100)
    p.add_argument("--json", action="store_true", help="JSON rows instead of a markdown table")
    p.add_argument("--full", action="store_true", help="never truncate a cell")
    args = p.parse_args()

    if not os.path.exists(DB):
        sys.exit(f"✗ {DB} is missing. It ships with the repo; pull it, or build it with `bun run catalog:build`.")
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    if args.datasets or not args.dataset:
        manifest = os.path.join(HERE, "catalog.sqlite.manifest.json")
        built = json.load(open(manifest))["built_at"][:10] if os.path.exists(manifest) else "unknown date"
        print(f"catalog.sqlite — built {built}\n")
        for ds, (table, _, _) in DATASETS.items():
            n = conn.execute(f'select count(*) from "{table}"').fetchone()[0]
            print(f"  {ds:16} {n:5} rows   ({table})")
        return

    cols = columns(conn, DATASETS[args.dataset][0])
    sql, params = build(args.dataset, args, cols)
    rows = conn.execute(sql, params).fetchall()
    show = cols if args.columns == "all" else (args.columns.split(",") if args.columns else [c for c in DATASETS[args.dataset][1] if c in cols])
    unknown = [c for c in show if c not in cols]
    if unknown:
        sys.exit(f"✗ unknown column(s) {', '.join(unknown)}; columns: {', '.join(cols)}")

    if args.json:
        print(json.dumps([{c: r[c] for c in show} for r in rows], ensure_ascii=False, indent=1))
        return
    if not rows:
        print(f"no {args.dataset} row matches")
        return
    print(f"{len(rows)} {args.dataset} row(s)\n")
    print("| " + " | ".join(show) + " |")
    print("|" + "---|" * len(show))
    for r in rows:
        print("| " + " | ".join(cell(r[c], args.full).replace("|", "\\|") for c in show) + " |")


if __name__ == "__main__":
    main()
