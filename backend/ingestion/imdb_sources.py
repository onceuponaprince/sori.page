"""Alternative IMDB ingestion sources.

Supports two non-scraping paths:
1. IMDB Non-Commercial Datasets (TSV/TSV.GZ)
2. OMDb API (key required)
"""

from __future__ import annotations

import csv
import gzip
import heapq
import logging
import re
from pathlib import Path

import requests

from ingestion.imdb_scraper import BASE_URL, ScrapedWork

logger = logging.getLogger(__name__)


def _open_tsv(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", newline="")
    return path.open("r", encoding="utf-8", newline="")


def _pick_existing(base_dir: Path, names: list[str]) -> Path | None:
    for name in names:
        candidate = base_dir / name
        if candidate.exists():
            return candidate
    return None


def _find_dataset_files(datasets_dir: str) -> tuple[Path | None, Path | None, Path]:
    base_dir = Path(datasets_dir).expanduser().resolve()
    basics_path = _pick_existing(base_dir, ["title.basics.tsv.gz", "title.basics.tsv"])
    ratings_path = _pick_existing(base_dir, ["title.ratings.tsv.gz", "title.ratings.tsv"])
    return basics_path, ratings_path, base_dir


def _collect_top_ratings(ratings_path: Path, max_works: int) -> dict[str, tuple[float, int]]:
    candidate_count = max(1000, max_works * 20)
    top_ratings: list[tuple[int, float, str]] = []

    with _open_tsv(ratings_path) as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            tconst = (row.get("tconst") or "").strip()
            avg = row.get("averageRating")
            votes = row.get("numVotes")
            if not tconst or avg in (None, "\\N") or votes in (None, "\\N"):
                continue
            try:
                rating = float(avg)
                num_votes = int(votes)
            except ValueError:
                continue

            item = (num_votes, rating, tconst)
            if len(top_ratings) < candidate_count:
                heapq.heappush(top_ratings, item)
            elif item > top_ratings[0]:
                heapq.heapreplace(top_ratings, item)

    return {tconst: (rating, votes) for votes, rating, tconst in top_ratings}


def _collect_basics_rows(basics_path: Path, wanted_ids: set[str]) -> dict[str, dict[str, str]]:
    allowed_types = {"movie", "tvSeries", "tvMiniSeries"}
    basics_map: dict[str, dict[str, str]] = {}
    with _open_tsv(basics_path) as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            tconst = (row.get("tconst") or "").strip()
            if tconst not in wanted_ids:
                continue
            if row.get("titleType") not in allowed_types:
                continue
            basics_map[tconst] = row
    return basics_map


def _build_dataset_work(
    imdb_id: str,
    row: dict[str, str],
    rating_map: dict[str, tuple[float, int]],
) -> ScrapedWork | None:
    title = (row.get("primaryTitle") or "").strip()
    if not title:
        return None

    year = row.get("startYear")
    if year in (None, "", "\\N"):
        year = None

    raw_genres = row.get("genres")
    genres = [] if raw_genres in (None, "", "\\N") else raw_genres.split(",")
    rating, num_votes = rating_map[imdb_id]
    return ScrapedWork(
        imdb_id=imdb_id,
        title=title,
        url=f"{BASE_URL}/title/{imdb_id}/",
        year=year,
        genres=genres,
        plot_summary="",
        keywords=[],
        rating=rating,
        num_votes=num_votes,
        content_type="tv_series" if row.get("titleType") != "movie" else "movie",
    )


def load_from_imdb_datasets(max_works: int, datasets_dir: str) -> list[ScrapedWork]:
    """Load top works from local IMDB datasets.

    Expected files in datasets_dir:
    - title.basics.tsv.gz (or .tsv)
    - title.ratings.tsv.gz (or .tsv)
    """
    basics_path, ratings_path, base_dir = _find_dataset_files(datasets_dir)

    if not basics_path or not ratings_path:
        logger.error(
            "Missing IMDB dataset files in %s. Expected title.basics.tsv(.gz) "
            "and title.ratings.tsv(.gz)",
            base_dir,
        )
        return []

    logger.info("Reading ratings from %s", ratings_path)
    rating_map = _collect_top_ratings(ratings_path, max_works)

    if not rating_map:
        logger.error("No usable rows found in %s", ratings_path)
        return []

    wanted_ids = set(rating_map.keys())

    logger.info("Reading title metadata from %s", basics_path)
    basics_map = _collect_basics_rows(basics_path, wanted_ids)

    ranked_ids = sorted(
        wanted_ids,
        key=lambda tid: (rating_map[tid][1], rating_map[tid][0]),
        reverse=True,
    )

    works: list[ScrapedWork] = []
    for imdb_id in ranked_ids:
        row = basics_map.get(imdb_id)
        if not row:
            continue
        work = _build_dataset_work(imdb_id, row, rating_map)
        if not work:
            continue
        works.append(work)

        if len(works) >= max_works:
            break

    logger.info("Prepared %d works from IMDB datasets", len(works))
    return works


def _parse_year(raw_year: str | None) -> str | None:
    if not raw_year:
        return None
    m = re.search(r"(\d{4})", raw_year)
    return m.group(1) if m else None


def _parse_omdb_payload(payload: dict, imdb_id: str) -> ScrapedWork | None:
    title = (payload.get("Title") or "").strip()
    if not title:
        return None

    rating = None
    raw_rating = payload.get("imdbRating")
    if raw_rating not in (None, "N/A", ""):
        try:
            rating = float(raw_rating)
        except ValueError:
            rating = None

    num_votes = None
    raw_votes = payload.get("imdbVotes")
    if raw_votes not in (None, "N/A", ""):
        try:
            num_votes = int(str(raw_votes).replace(",", ""))
        except ValueError:
            num_votes = None

    genres_raw = payload.get("Genre")
    genres = [] if genres_raw in (None, "N/A", "") else [g.strip() for g in genres_raw.split(",")]

    return ScrapedWork(
        imdb_id=imdb_id,
        title=title,
        url=f"{BASE_URL}/title/{imdb_id}/",
        year=_parse_year(payload.get("Year")),
        genres=genres,
        plot_summary=(payload.get("Plot") or "")[:2000],
        keywords=[],
        rating=rating,
        num_votes=num_votes,
        content_type="tv_series" if payload.get("Type") == "series" else "movie",
        source_type="omdb",
    )


def _fetch_omdb_payload(session: requests.Session, api_key: str, imdb_id: str) -> dict | None:
    try:
        resp = session.get(
            "https://www.omdbapi.com/",
            params={"apikey": api_key, "i": imdb_id, "plot": "short", "r": "json"},
            timeout=20,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as exc:
        logger.warning("OMDb request failed for %s: %s", imdb_id, exc)
        return None
    except ValueError as exc:
        logger.warning("OMDb returned invalid JSON for %s: %s", imdb_id, exc)
        return None

    if str(payload.get("Response", "")).lower() != "true":
        logger.warning("OMDb has no data for %s: %s", imdb_id, payload.get("Error"))
        return None

    return payload


def load_from_omdb(imdb_ids: list[str], api_key: str, max_works: int) -> list[ScrapedWork]:
    """Fetch works from OMDb using explicit IMDB IDs."""
    works: list[ScrapedWork] = []
    session = requests.Session()

    for imdb_id in imdb_ids[:max_works]:
        payload = _fetch_omdb_payload(session, api_key, imdb_id)
        if not payload:
            continue
        work = _parse_omdb_payload(payload, imdb_id)
        if work:
            works.append(work)

    logger.info("Prepared %d works from OMDb", len(works))
    return works