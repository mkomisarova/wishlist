#!/usr/bin/env python3
"""Sanity-check data/items.json before it reaches the live site.

Catches the mistakes that are easy to make when hand-editing JSON on
github.com: a stray comma, two items sharing an id (which would make them
share a claim tick), a price typed as text, or a photo path that doesn't
match a file actually committed to images/.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ITEMS_PATH = os.path.join(ROOT, "data", "items.json")

problems = []


def fail(msg):
    problems.append(msg)


try:
    with open(ITEMS_PATH, encoding="utf-8") as fh:
        items = json.load(fh)
except FileNotFoundError:
    sys.exit("data/items.json is missing.")
except json.JSONDecodeError as err:
    sys.exit(
        f"data/items.json isn't valid JSON: {err.msg} (line {err.lineno}, column {err.colno}).\n"
        "Most often this is a trailing comma after the last item, or a missing quote."
    )

if not isinstance(items, list):
    sys.exit("data/items.json must be a list, starting with [ and ending with ].")

seen_ids = set()

for idx, item in enumerate(items, start=1):
    where = f'Item {idx} ("{item.get("name", "no name")}")' if isinstance(item, dict) else f"Item {idx}"

    if not isinstance(item, dict):
        fail(f"{where}: should be an object wrapped in {{ }}.")
        continue

    item_id = item.get("id")
    if not item_id or not isinstance(item_id, str):
        fail(f"{where}: needs a non-empty text \"id\".")
    else:
        if item_id in seen_ids:
            fail(f'{where}: duplicate id "{item_id}" — two items would share the same claim tick.')
        seen_ids.add(item_id)
        if len(item_id) > 64:
            fail(f'{where}: id "{item_id}" is longer than 64 characters.')

    if not item.get("name"):
        fail(f"{where}: needs a \"name\".")

    # priceMin may be left out entirely for things that have no price
    # ("a book of your favourite recipes"); the card just shows no price.
    price_min = item.get("priceMin")
    if price_min is not None and (
        not isinstance(price_min, (int, float)) or isinstance(price_min, bool)
    ):
        fail(f'{where}: "priceMin" must be a number with no quotes around it.')

    price_max = item.get("priceMax")
    if price_max is not None:
        if not isinstance(price_max, (int, float)) or isinstance(price_max, bool):
            fail(f'{where}: "priceMax" must be a number with no quotes around it.')
        elif isinstance(price_min, (int, float)) and price_max < price_min:
            fail(f"{where}: priceMax ({price_max}) is lower than priceMin ({price_min}).")

    # "starred" is the star from the wishlist slides — it draws the gold frame.
    starred = item.get("starred", False)
    if not isinstance(starred, bool):
        fail(f'{where}: "starred" must be true or false, not "{starred}".')

    qty = item.get("quantityType", "single")
    if qty not in ("single", "multiple"):
        fail(f'{where}: "quantityType" must be "single" or "multiple", not "{qty}".')

    image = item.get("image", "")
    if image:
        if not os.path.exists(os.path.join(ROOT, image)):
            fail(f'{where}: photo "{image}" isn\'t in the repo — upload it to images/.')

if problems:
    print(f"Found {len(problems)} problem(s) in data/items.json:\n")
    for p in problems:
        print(f"  - {p}")
    sys.exit(1)

print(f"data/items.json looks good — {len(items)} item(s), all ids unique.")
