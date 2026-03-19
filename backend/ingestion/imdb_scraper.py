"""
IMDB ingestion pipeline.

IMDB provides rich metadata about movies and TV shows — genre combinations,
plot keywords, and user ratings all feed into the narrative knowledge graph.
Genre combinations reveal structural patterns (e.g., "Horror + Comedy" implies
specific trope usage), and plot keywords often map directly to named tropes.

Strategy:
1. Scrape the IMDB Top 250 as a high-quality starting corpus
2. For each work, extract: title, genres, plot summary, keywords, ratings
3. Map genre combos and keywords to ConceptNode candidates
4. Feed into the concept proposal pipeline

IMDB has no official public API (the paid one requires a key), so we scrape
the public HTML pages. We respect rate limits with 3-second delays and
identify ourselves via User-Agent.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.imdb.com"
RATE_LIMIT_SECONDS = 3  # Be respectful — IMDB is stricter than most


@dataclass
class ScrapedWork:
    """A movie or TV show scraped from IMDB, ready for Neo4j ingestion."""

    imdb_id: str
    title: str
    url: str
    year: Optional[str] = None
    genres: list[str] = field(default_factory=list)
    plot_summary: str = ""
    keywords: list[str] = field(default_factory=list)
    rating: Optional[float] = None
    num_votes: Optional[int] = None
    content_type: str = "movie"  # "movie" or "tv_series"
    # Auto-assigned — IMDB works are d=1 (concrete instances, undisputed)
    depth_score: int = 1
    confidence: float = 0.95
    source_type: str = "imdb"


class IMDBScraper:
    """Scrapes IMDB for movie and TV show metadata.

    Extracts narrative-relevant data: genres, plot keywords, and ratings.
    Genre combinations and keywords map to structural patterns in the
    knowledge graph.

    Usage:
        scraper = IMDBScraper()
        work = scraper.scrape_movie("tt0111161")  # The Shawshank Redemption
        top_250 = scraper.scrape_top_250()
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "sori.page/0.1 (narrative knowledge engine; "
                "contact: hello@sori.page)",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml",
            }
        )
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Ensure we don't hammer IMDB servers."""
        elapsed = time.time() - self._last_request_time
        if elapsed < RATE_LIMIT_SECONDS:
            time.sleep(RATE_LIMIT_SECONDS - elapsed)
        self._last_request_time = time.time()

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch and parse an IMDB page.

        Returns None on any request failure, logging the error for
        upstream callers to handle gracefully.
        """
        self._rate_limit()
        full_url = f"{BASE_URL}{url}" if url.startswith("/") else url
        try:
            resp = self.session.get(full_url, timeout=20)
            resp.raise_for_status()

            # IMDB uses AWS WAF which returns HTTP 202 with a JS challenge
            # page instead of actual content. requests can't solve it.
            if resp.status_code != 200:
                logger.error(
                    "Unexpected status %d from %s — IMDB may be rate-limiting "
                    "or blocking this request.",
                    resp.status_code,
                    full_url,
                )
                return None

            body = resp.text
            if "awswaf" in body or "challenge.js" in body or "AwsWafIntegration" in body:
                logger.error(
                    "IMDB returned an AWS WAF bot-challenge page for %s. "
                    "The plain-HTTP scraper cannot solve JavaScript challenges. "
                    "To fix this, either: (1) add a browser-like User-Agent and "
                    "cookies from a real session, or (2) switch to the IMDB "
                    "Non-Commercial Datasets at https://datasets.imdbws.com/",
                    full_url,
                )
                return None

            return BeautifulSoup(body, "html.parser")
        except requests.RequestException as e:
            logger.warning("Failed to fetch %s: %s", full_url, e)
            return None

    def scrape_movie(self, imdb_id: str) -> Optional[ScrapedWork]:
        """Scrape a single movie/show page and return structured data.

        Args:
            imdb_id: The IMDB title ID (e.g., "tt0111161").

        Returns:
            A ScrapedWork with extracted metadata, or None on failure.
        """
        url = f"/title/{imdb_id}/"
        soup = self._fetch_page(url)
        if not soup:
            return None

        # Extract title — IMDB puts it in the hero section or og:title meta
        title = self._extract_title(soup)
        if not title:
            logger.warning("Could not extract title for %s", imdb_id)
            return None

        year = self._extract_year(soup)
        genres = self._extract_genres(soup)
        plot_summary = self._extract_plot_summary(soup)
        rating, num_votes = self._extract_rating(soup)
        content_type = self._detect_content_type(soup)

        # Keywords require a separate page request
        keywords = self._scrape_keywords(imdb_id)

        return ScrapedWork(
            imdb_id=imdb_id,
            title=title,
            url=f"{BASE_URL}/title/{imdb_id}/",
            year=year,
            genres=genres,
            plot_summary=plot_summary,
            keywords=keywords,
            rating=rating,
            num_votes=num_votes,
            content_type=content_type,
        )

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the work's title from the page."""
        # Try og:title meta tag first (most reliable)
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            # og:title usually looks like "The Shawshank Redemption (1994)"
            raw = og_title["content"]
            # Strip trailing year in parens
            return re.sub(r"\s*\(\d{4}\)\s*$", "", raw).strip()

        # Fallback: page title
        title_tag = soup.find("title")
        if title_tag:
            raw = title_tag.get_text(strip=True)
            # Page title is usually "Title (Year) - IMDb"
            match = re.match(r"^(.+?)\s*\(\d{4}\)", raw)
            if match:
                return match.group(1).strip()

        return None

    def _extract_year(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the release year."""
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            match = re.search(r"\((\d{4})\)", og_title["content"])
            if match:
                return match.group(1)

        # Fallback: look in the title tag
        title_tag = soup.find("title")
        if title_tag:
            match = re.search(r"\((\d{4})\)", title_tag.get_text())
            if match:
                return match.group(1)

        return None

    def _extract_genres(self, soup: BeautifulSoup) -> list[str]:
        """Extract genre tags from the page.

        Genres are narrative-structural signals: a "Crime + Drama" film
        follows different structural patterns than a "Comedy + Romance".
        """
        genres = []

        # IMDB uses JSON-LD structured data which is the most reliable source
        for script_tag in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script_tag.string or "")
                if isinstance(data, dict) and "genre" in data:
                    raw = data["genre"]
                    if isinstance(raw, list):
                        genres = raw
                    elif isinstance(raw, str):
                        genres = [raw]
                    return genres[:10]
            except (json.JSONDecodeError, TypeError):
                continue

        # Fallback: look for genre chips/links in the page
        genre_links = soup.find_all("a", href=re.compile(r"/search/title\?genres="))
        for link in genre_links:
            genre_text = link.get_text(strip=True)
            if genre_text and genre_text not in genres:
                genres.append(genre_text)

        return genres[:10]

    def _extract_plot_summary(self, soup: BeautifulSoup) -> str:
        """Extract the plot summary or description."""
        # JSON-LD description
        for script_tag in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script_tag.string or "")
                if isinstance(data, dict) and "description" in data:
                    return data["description"][:2000]
            except (json.JSONDecodeError, TypeError):
                continue

        # og:description meta tag
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            return og_desc["content"][:2000]

        # Fallback: meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            return meta_desc["content"][:2000]

        return ""

    def _extract_rating(
        self, soup: BeautifulSoup
    ) -> tuple[Optional[float], Optional[int]]:
        """Extract user rating and vote count."""
        rating = None
        num_votes = None

        # JSON-LD aggregateRating
        for script_tag in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script_tag.string or "")
                if isinstance(data, dict) and "aggregateRating" in data:
                    agg = data["aggregateRating"]
                    if "ratingValue" in agg:
                        rating = float(agg["ratingValue"])
                    if "ratingCount" in agg:
                        num_votes = int(agg["ratingCount"])
                    return rating, num_votes
            except (json.JSONDecodeError, TypeError, ValueError):
                continue

        return rating, num_votes

    def _detect_content_type(self, soup: BeautifulSoup) -> str:
        """Detect whether this is a movie or TV series."""
        for script_tag in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script_tag.string or "")
                if isinstance(data, dict) and "@type" in data:
                    ld_type = data["@type"]
                    if ld_type in ("TVSeries", "TVMiniSeries"):
                        return "tv_series"
            except (json.JSONDecodeError, TypeError):
                continue

        return "movie"

    def _scrape_keywords(self, imdb_id: str, max_keywords: int = 30) -> list[str]:
        """Scrape plot keywords for a title.

        Plot keywords are narrative gold — they often map directly to
        tropes and structural patterns (e.g., "redemption", "betrayal",
        "twist-ending").
        """
        soup = self._fetch_page(f"/title/{imdb_id}/keywords/")
        if not soup:
            return []

        keywords = []

        # Keywords are typically in data-testid tagged elements or links
        keyword_links = soup.find_all(
            "a", href=re.compile(r"/search/keyword\?keywords=")
        )
        for link in keyword_links:
            keyword = link.get_text(strip=True).lower()
            if keyword and keyword not in keywords:
                keywords.append(keyword)

        # Fallback: look for keyword list items
        if not keywords:
            for li in soup.find_all("li"):
                text = li.get_text(strip=True).lower()
                # Keywords are typically short phrases
                if text and len(text) < 60 and not text.startswith("http"):
                    if text not in keywords:
                        keywords.append(text)

        return keywords[:max_keywords]

    def scrape_top_250(self, max_works: int = 250) -> list[ScrapedWork]:
        """Scrape IMDB's Top 250 movies list as a starting corpus.

        The Top 250 provides a high-quality seed set of culturally
        significant films that are heavily troped and well-analyzed.

        Args:
            max_works: Maximum number of works to scrape (default: all 250).

        Returns:
            List of ScrapedWork objects with full metadata.
        """
        soup = self._fetch_page("/chart/top/")
        if not soup:
            logger.error("Failed to fetch Top 250 page")
            return []

        # Extract IMDB IDs from the chart
        imdb_ids = []

        # Top 250 links point to /title/ttXXXXXXX/
        for link in soup.find_all("a", href=re.compile(r"/title/tt\d+")):
            href = link.get("href", "")
            match = re.search(r"(tt\d+)", href)
            if match:
                title_id = match.group(1)
                if title_id not in imdb_ids:
                    imdb_ids.append(title_id)

        imdb_ids = imdb_ids[:max_works]
        if not imdb_ids:
            logger.error(
                "No IMDB title IDs found in the Top 250 chart page. "
                "The page structure may have changed, or IMDB blocked the request. "
                "Check the log above for WAF/challenge errors."
            )
            return []

        logger.info("Found %d titles in Top 250 chart", len(imdb_ids))

        works = []
        for i, imdb_id in enumerate(imdb_ids):
            logger.info(
                "Scraping [%d/%d]: %s", i + 1, len(imdb_ids), imdb_id
            )
            work = self.scrape_movie(imdb_id)
            if work:
                works.append(work)
                logger.info(
                    "  -> %s (%s) — %s [%.1f/10]",
                    work.title,
                    work.year or "?",
                    ", ".join(work.genres[:3]),
                    work.rating or 0,
                )
            else:
                logger.warning("  -> Failed to scrape %s", imdb_id)

        logger.info("Scraped %d/%d works from Top 250", len(works), len(imdb_ids))
        return works


def scrape_imdb_top_works(max_works: int = 50) -> list[ScrapedWork]:
    """Scrape the IMDB Top 250 as a seeding corpus.

    This is the main entry point for the ingestion pipeline — run it
    once to populate the initial instance layer with well-known films.

    Args:
        max_works: How many works to scrape (default: 50 for initial run).

    Returns:
        List of ScrapedWork objects ready for Neo4j ingestion.
    """
    scraper = IMDBScraper()
    return scraper.scrape_top_250(max_works=max_works)
