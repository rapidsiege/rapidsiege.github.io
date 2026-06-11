# rapidsiege.github.io

GitHub Pages site serving the Tribal Wars browser tools ("production").

## Live tools

- [tw-scripts/attack-planner.html](https://rapidsiege.github.io/tw-scripts/attack-planner.html)
- [tw-scripts/farm-calculator.html](https://rapidsiege.github.io/tw-scripts/farm-calculator.html)
- [tw-scripts/tribe-calculator.html](https://rapidsiege.github.io/tw-scripts/tribe-calculator.html)

## Production vs development

The same HTML files run in two environments, detected at runtime (`TW_ENV` in each file, based on `location.protocol`):

- **Production** — served over http(s) from this GitHub Pages site. The village/player database auto-loads from the web mirror under `tw-scripts/data/es100/`; the manual "Connect DB Folder / Load Files" controls are hidden. Only tribe troop data still needs manual loading.
- **Development** — the copies in the local `Personal Projects/Tribalwars/` folder, opened directly from disk (`file://`). The database is loaded from local files via the folder-connect flow, unchanged.

Because the environment is detected at runtime, **dev and prod are the same file** — deploying is just copying the changed HTML from `Personal Projects/Tribalwars/` into `tw-scripts/` and pushing this repo.

## Data mirror

`.github/workflows/update-map-data.yml` runs every ~2 hours and mirrors the es100 world data (`es100.guerrastribales.es`) into `tw-scripts/data/es100/`: village/player/ally/conquer files, kill rankings, the `get_config`/`get_unit_info`/`get_building_info` XMLs, a `conquer_recent.txt` (last-23h conquers), and a `last-updated.txt` timestamp. It only commits when the data actually changed.

GitHub Pages serves everything with `Access-Control-Allow-Origin: *`, so the mirrored data is also fetchable from pages hosted elsewhere or opened locally. Fetching the Tribal Wars endpoints directly from a browser is not possible — they send no CORS headers.
