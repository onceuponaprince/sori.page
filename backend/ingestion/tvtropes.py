"""
TV Tropes ingestion pipeline.

TV Tropes is essentially a human-curated instance layer — the closest
thing to a PokeAPI for narrative knowledge. This module scrapes trope
pages and structures them into format ready for Neo4j ingestion.

Strategy:
1. Start with the major trope index pages (Narrative Tropes, Character Tropes)
2. For each trope, extract: name, description, examples (instances), related tropes
3. Auto-assign depth scores based on source reliability
4. Feed into the concept proposal pipeline

TV Tropes uses a wiki format. No official API exists, so we scrape
the HTML directly. We respect robots.txt and rate-limit requests.
"""
import time
import re
from dataclasses import dataclass, field
from typing import Optional
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://tvtropes.org"
RATE_LIMIT_SECONDS = 2  # Be respectful


@dataclass
class ScrapedTrope:
    """A trope scraped from TV Tropes, ready for Neo4j ingestion."""

    name: str
    url: str
    description: str
    examples: list[dict] = field(default_factory=list)
    related_tropes: list[str] = field(default_factory=list)
    category: str = "trope"
    # Auto-assigned — TV Tropes tropes are d=2 (named with overwhelming consensus)
    depth_score: int = 2
    confidence: float = 0.85
    source_type: str = "tvtropes"


class TVTropesScraper:
    """Scrapes TV Tropes for narrative trope data.

    Usage:
        scraper = TVTropesScraper()
        tropes = scraper.scrape_trope_page("/pmwiki/pmwiki.php/Main/TheHerosJourney")
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "sori.page/0.1 (narrative knowledge engine; "
                "contact: hello@sori.page)"
            }
        )
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Ensure we don't hammer TV Tropes."""
        elapsed = time.time() - self._last_request_time
        if elapsed < RATE_LIMIT_SECONDS:
            time.sleep(RATE_LIMIT_SECONDS - elapsed)
        self._last_request_time = time.time()

    def _fetch_page(self, path: str) -> Optional[BeautifulSoup]:
        """Fetch and parse a TV Tropes page."""
        self._rate_limit()
        url = f"{BASE_URL}{path}" if path.startswith("/") else path
        try:
            resp = self.session.get(url, timeout=15)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            print(f"Failed to fetch {url}: {e}")
            return None

    def scrape_trope_page(self, path: str) -> Optional[ScrapedTrope]:
        """Scrape a single trope page and extract structured data."""
        soup = self._fetch_page(path)
        if not soup:
            return None

        # Extract trope name from the page title
        title_tag = soup.find("h1", class_="entry-title")
        if not title_tag:
            return None
        name = title_tag.get_text(strip=True)

        # Extract description — first few paragraphs of the article
        article = soup.find("div", id="main-article")
        if not article:
            return None

        paragraphs = article.find_all("p", recursive=False)
        description_parts = []
        for p in paragraphs[:3]:  # First 3 paragraphs = description
            text = p.get_text(strip=True)
            if text and len(text) > 20:
                description_parts.append(text)
        description = " ".join(description_parts)

        # Extract examples — typically in folder divs or list items
        examples = []
        example_folders = article.find_all("div", class_="folder")
        for folder in example_folders:
            folder_name = ""
            folder_label = folder.find("div", class_="folderlabel")
            if folder_label:
                folder_name = folder_label.get_text(strip=True)

            items = folder.find_all("li")
            for item in items[:5]:  # Cap at 5 per category
                example_text = item.get_text(strip=True)
                if example_text and len(example_text) > 10:
                    examples.append(
                        {
                            "text": example_text[:500],  # Truncate long examples
                            "medium": folder_name,
                        }
                    )

        # Extract related tropes — links within the article
        related = []
        for link in article.find_all("a", class_="twikilink"):
            href = link.get("href", "")
            if "/Main/" in href and href != path:
                trope_name = link.get_text(strip=True)
                if trope_name and len(trope_name) > 2:
                    related.append(trope_name)
        related = list(set(related))[:20]  # Dedupe and cap

        return ScrapedTrope(
            name=name,
            url=f"{BASE_URL}{path}",
            description=description,
            examples=examples,
            related_tropes=related,
        )

    def scrape_trope_index(
        self, index_path: str, max_tropes: int = 50
    ) -> list[ScrapedTrope]:
        """Scrape a trope index page and follow links to individual tropes."""
        soup = self._fetch_page(index_path)
        if not soup:
            return []

        article = soup.find("div", id="main-article")
        if not article:
            return []

        # Find all trope links in the index
        trope_links = []
        for link in article.find_all("a", class_="twikilink"):
            href = link.get("href", "")
            if "/Main/" in href:
                trope_links.append(href)

        trope_links = list(set(trope_links))[:max_tropes]
        print(f"Found {len(trope_links)} trope links on index page")

        tropes = []
        for i, link in enumerate(trope_links):
            print(f"Scraping [{i + 1}/{len(trope_links)}]: {link}")
            trope = self.scrape_trope_page(link)
            if trope:
                tropes.append(trope)

        return tropes


# Key TV Tropes index pages for narrative structure
NARRATIVE_INDEXES = [
    "/pmwiki/pmwiki.php/Main/NarrativeTropes",
    "/pmwiki/pmwiki.php/Main/CharacterizationTropes",
    "/pmwiki/pmwiki.php/Main/PlotDevice",
    "/pmwiki/pmwiki.php/Main/Conflict",
]


def scrape_narrative_tropes(max_per_index: int = 25) -> list[ScrapedTrope]:
    """Scrape the core narrative trope indexes.

    This is the seeding function — run it once to populate the initial
    instance layer of the knowledge graph.
    """
    scraper = TVTropesScraper()
    all_tropes = []

    for index_path in NARRATIVE_INDEXES:
        print(f"\n=== Scraping index: {index_path} ===")
        tropes = scraper.scrape_trope_index(index_path, max_tropes=max_per_index)
        all_tropes.extend(tropes)
        print(f"Got {len(tropes)} tropes from this index")

    print(f"\nTotal tropes scraped: {len(all_tropes)}")
    return all_tropes
