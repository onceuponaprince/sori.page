"""
Project Gutenberg ingestion pipeline.

Project Gutenberg provides public domain literary works — the raw text
of novels and short stories that embody the narrative structures we're
cataloging. These texts serve as a ground-truth corpus: we can validate
that tropes and patterns exist in actual works, not just in wiki pages.

Strategy:
1. Use the Gutenberg catalog to find fiction works by subject
2. Download plain-text versions
3. Chunk texts into chapters/scenes for granular analysis
4. Create SourceNode entries linking to specific textual evidence

The Gutenberg catalog is available as a machine-readable feed, and texts
are served as plain UTF-8 files. We use 2-second rate limiting.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gutenberg.org"
RATE_LIMIT_SECONDS = 2  # Be respectful

# Regex patterns for detecting chapter boundaries in plain text.
# These cover the most common conventions in English-language literature.
CHAPTER_PATTERNS = [
    # "Chapter I", "CHAPTER 1", "Chapter One", "CHAPTER THE FIRST"
    re.compile(
        r"^\s*(CHAPTER|Chapter)\s+"
        r"([IVXLCDM]+|[0-9]+|[A-Z][a-z]+|THE\s+\w+)"
        r"[\.\:\s]*$",
        re.MULTILINE,
    ),
    # "BOOK I", "Book the First", "Part 1"
    re.compile(
        r"^\s*(BOOK|Book|PART|Part)\s+"
        r"([IVXLCDM]+|[0-9]+|[A-Z][a-z]+|THE\s+\w+)"
        r"[\.\:\s]*$",
        re.MULTILINE,
    ),
    # Roman numeral only on its own line: "I.", "II.", "XIV."
    re.compile(r"^\s*([IVXLCDM]{1,10})\.?\s*$", re.MULTILINE),
]


@dataclass
class TextChunk:
    """A chapter or scene extracted from a literary work."""

    heading: str
    text: str
    index: int  # Position in the work (0-based)
    char_offset: int  # Character offset from start of full text


@dataclass
class ScrapedText:
    """A literary work scraped from Project Gutenberg, ready for Neo4j ingestion."""

    gutenberg_id: int
    title: str
    author: str
    url: str
    subjects: list[str] = field(default_factory=list)
    bookshelves: list[str] = field(default_factory=list)
    text_content: str = ""
    chunks: list[TextChunk] = field(default_factory=list)
    language: str = "en"
    # Auto-assigned — Gutenberg texts are d=1 (concrete works, undisputed)
    depth_score: int = 1
    confidence: float = 0.99
    source_type: str = "gutenberg"


class GutenbergScraper:
    """Scrapes Project Gutenberg for public domain literary works.

    Focuses on fiction with narrative structure — novels and short stories
    that contain the patterns our knowledge graph catalogs.

    Usage:
        scraper = GutenbergScraper()
        works = scraper.search_by_subject("Adventure", max_results=20)
        text = scraper.download_text(84)  # Frankenstein
        chunks = scraper.chunk_into_chapters(text)
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "sori.page/0.1 (narrative knowledge engine; "
                "contact: hello@sori.page)",
            }
        )
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Ensure we don't overload Gutenberg servers."""
        elapsed = time.time() - self._last_request_time
        if elapsed < RATE_LIMIT_SECONDS:
            time.sleep(RATE_LIMIT_SECONDS - elapsed)
        self._last_request_time = time.time()

    def _fetch(self, url: str, as_text: bool = True) -> Optional[str]:
        """Fetch a URL and return the response text.

        Args:
            url: Full URL or path relative to BASE_URL.
            as_text: If True, return response text. If False, return raw content.

        Returns:
            Response text, or None on failure.
        """
        self._rate_limit()
        full_url = f"{BASE_URL}{url}" if url.startswith("/") else url
        try:
            resp = self.session.get(full_url, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            logger.warning("Failed to fetch %s: %s", full_url, e)
            return None

    def _fetch_soup(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a URL and parse as HTML."""
        text = self._fetch(url)
        if text:
            return BeautifulSoup(text, "html.parser")
        return None

    def search_by_subject(
        self, subject: str, max_results: int = 50
    ) -> list[dict]:
        """Search the Gutenberg catalog by subject.

        Uses Gutenberg's search/bookshelf pages to find works matching
        a subject like "Fiction", "Adventure", "Gothic Fiction", etc.

        Args:
            subject: Subject or bookshelf name to search for.
            max_results: Maximum number of results to return.

        Returns:
            List of dicts with keys: gutenberg_id, title, author, url.
        """
        # Gutenberg provides search via their website
        search_url = (
            f"{BASE_URL}/ebooks/search/?query={requests.utils.quote(subject)}"
            f"&submit_search=Go%21"
        )
        soup = self._fetch_soup(search_url)
        if not soup:
            return []

        results = []
        # Search results are in list items with links to /ebooks/NNNN
        for link in soup.find_all("a", href=re.compile(r"^/ebooks/\d+$")):
            href = link.get("href", "")
            match = re.search(r"/ebooks/(\d+)", href)
            if not match:
                continue

            gutenberg_id = int(match.group(1))

            # Avoid duplicates
            if any(r["gutenberg_id"] == gutenberg_id for r in results):
                continue

            title_text = link.get_text(strip=True)
            if not title_text or len(title_text) < 3:
                continue

            results.append(
                {
                    "gutenberg_id": gutenberg_id,
                    "title": title_text,
                    "url": f"{BASE_URL}/ebooks/{gutenberg_id}",
                }
            )

            if len(results) >= max_results:
                break

        logger.info(
            "Found %d results for subject '%s'", len(results), subject
        )
        return results

    def scrape_metadata(self, gutenberg_id: int) -> Optional[ScrapedText]:
        """Scrape metadata for a single Gutenberg work.

        Extracts title, author, subjects, and bookshelves from the
        work's catalog page.

        Args:
            gutenberg_id: The Project Gutenberg ebook number.

        Returns:
            A ScrapedText with metadata (no text content yet), or None.
        """
        soup = self._fetch_soup(f"/ebooks/{gutenberg_id}")
        if not soup:
            return None

        # Title
        title = ""
        title_tag = soup.find("td", itemprop="headline")
        if title_tag:
            title = title_tag.get_text(strip=True)
        if not title:
            # Fallback: og:title or page title
            og = soup.find("meta", property="og:title")
            if og:
                title = og.get("content", "").strip()
        if not title:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text(strip=True)

        # Author
        author = ""
        author_tag = soup.find("a", itemprop="creator")
        if author_tag:
            author = author_tag.get_text(strip=True)
        if not author:
            # Fallback: look for author table row
            for row in soup.find_all("tr"):
                header = row.find("th")
                if header and "Author" in header.get_text():
                    td = row.find("td")
                    if td:
                        author = td.get_text(strip=True)
                    break

        # Subjects
        subjects = []
        for row in soup.find_all("tr"):
            header = row.find("th")
            if header and "Subject" in header.get_text():
                for a_tag in row.find_all("a"):
                    subj = a_tag.get_text(strip=True)
                    if subj:
                        subjects.append(subj)

        # Bookshelves
        bookshelves = []
        for row in soup.find_all("tr"):
            header = row.find("th")
            if header and "Bookshelf" in header.get_text():
                for a_tag in row.find_all("a"):
                    shelf = a_tag.get_text(strip=True)
                    if shelf:
                        bookshelves.append(shelf)

        # Language
        language = "en"
        for row in soup.find_all("tr"):
            header = row.find("th")
            if header and "Language" in header.get_text():
                td = row.find("td")
                if td:
                    language = td.get_text(strip=True).lower()[:2]
                break

        if not title:
            logger.warning("Could not extract title for ebook %d", gutenberg_id)
            return None

        return ScrapedText(
            gutenberg_id=gutenberg_id,
            title=title,
            author=author,
            url=f"{BASE_URL}/ebooks/{gutenberg_id}",
            subjects=subjects,
            bookshelves=bookshelves,
            language=language,
        )

    def download_text(self, gutenberg_id: int) -> Optional[str]:
        """Download the plain-text version of a Gutenberg work.

        Tries the standard plain-text URL patterns. Gutenberg serves
        UTF-8 text files at predictable paths.

        Args:
            gutenberg_id: The Project Gutenberg ebook number.

        Returns:
            The full text of the work, or None on failure.
        """
        # Primary URL pattern for plain text
        text_urls = [
            f"https://www.gutenberg.org/cache/epub/{gutenberg_id}"
            f"/pg{gutenberg_id}.txt",
            f"https://www.gutenberg.org/files/{gutenberg_id}"
            f"/{gutenberg_id}-0.txt",
            f"https://www.gutenberg.org/files/{gutenberg_id}"
            f"/{gutenberg_id}.txt",
        ]

        for url in text_urls:
            text = self._fetch(url)
            if text and len(text) > 500:
                # Strip the Gutenberg header/footer boilerplate
                text = self._strip_gutenberg_boilerplate(text)
                return text

        logger.warning(
            "Could not download text for ebook %d from any URL pattern",
            gutenberg_id,
        )
        return None

    def _strip_gutenberg_boilerplate(self, text: str) -> str:
        """Remove Project Gutenberg's standard header and footer.

        Gutenberg adds license text before and after the actual work.
        We strip it to get the clean literary text.
        """
        # Start marker — text begins after this line
        start_markers = [
            "*** START OF THIS PROJECT GUTENBERG EBOOK",
            "*** START OF THE PROJECT GUTENBERG EBOOK",
            "***START OF THIS PROJECT GUTENBERG EBOOK",
        ]
        for marker in start_markers:
            idx = text.find(marker)
            if idx != -1:
                # Skip to the next line after the marker
                newline_idx = text.find("\n", idx)
                if newline_idx != -1:
                    text = text[newline_idx + 1 :]
                break

        # End marker — text ends before this line
        end_markers = [
            "*** END OF THIS PROJECT GUTENBERG EBOOK",
            "*** END OF THE PROJECT GUTENBERG EBOOK",
            "***END OF THIS PROJECT GUTENBERG EBOOK",
            "End of the Project Gutenberg EBook",
            "End of Project Gutenberg's",
        ]
        for marker in end_markers:
            idx = text.find(marker)
            if idx != -1:
                text = text[:idx]
                break

        return text.strip()

    def chunk_into_chapters(self, text: str) -> list[TextChunk]:
        """Split a text into chapters using regex pattern matching.

        Detects common chapter heading formats and splits the text
        accordingly. If no chapters are detected, returns the full text
        as a single chunk.

        Args:
            text: The full text of a literary work.

        Returns:
            List of TextChunk objects, one per detected chapter.
        """
        # Try each chapter pattern and use the one that finds the most splits
        best_splits = []
        best_pattern = None

        for pattern in CHAPTER_PATTERNS:
            matches = list(pattern.finditer(text))
            if len(matches) > len(best_splits):
                best_splits = matches
                best_pattern = pattern

        if len(best_splits) < 2:
            # No chapters detected — return the whole text as one chunk
            logger.info("No chapter breaks detected; returning as single chunk")
            return [
                TextChunk(
                    heading="Full Text",
                    text=text.strip(),
                    index=0,
                    char_offset=0,
                )
            ]

        logger.info(
            "Detected %d chapters using pattern: %s",
            len(best_splits),
            best_pattern.pattern[:50] if best_pattern else "?",
        )

        chunks = []
        for i, match in enumerate(best_splits):
            heading = match.group(0).strip()
            start = match.start()

            # Chapter text runs from this heading to the next heading
            if i + 1 < len(best_splits):
                end = best_splits[i + 1].start()
            else:
                end = len(text)

            chapter_text = text[start:end].strip()

            # Skip very short chunks (likely false positives)
            if len(chapter_text) < 100:
                continue

            chunks.append(
                TextChunk(
                    heading=heading,
                    text=chapter_text,
                    index=len(chunks),
                    char_offset=start,
                )
            )

        return chunks

    def scrape_work(self, gutenberg_id: int, include_text: bool = True) -> Optional[ScrapedText]:
        """Scrape a complete work: metadata, text, and chapter chunks.

        This is the main method for ingesting a single work. It fetches
        metadata, downloads the full text, and splits it into chapters.

        Args:
            gutenberg_id: The Project Gutenberg ebook number.
            include_text: Whether to download and chunk the full text.

        Returns:
            A fully populated ScrapedText, or None on failure.
        """
        work = self.scrape_metadata(gutenberg_id)
        if not work:
            return None

        if include_text:
            text = self.download_text(gutenberg_id)
            if text:
                work.text_content = text
                work.chunks = self.chunk_into_chapters(text)
                logger.info(
                    "Downloaded %s: %d chars, %d chapters",
                    work.title,
                    len(text),
                    len(work.chunks),
                )
            else:
                logger.warning(
                    "Could not download text for '%s' (ebook %d)",
                    work.title,
                    gutenberg_id,
                )

        return work

    def scrape_subject_corpus(
        self,
        subject: str = "Fiction",
        max_works: int = 25,
        include_text: bool = True,
    ) -> list[ScrapedText]:
        """Search by subject and scrape all matching works.

        Args:
            subject: Subject to search for (e.g., "Fiction", "Adventure").
            max_works: Maximum works to scrape.
            include_text: Whether to download full text for each work.

        Returns:
            List of ScrapedText objects with metadata and optionally text.
        """
        search_results = self.search_by_subject(subject, max_results=max_works)
        logger.info(
            "Searching for '%s' works — found %d candidates",
            subject,
            len(search_results),
        )

        works = []
        for i, result in enumerate(search_results):
            gid = result["gutenberg_id"]
            logger.info(
                "Scraping [%d/%d]: ebook %d — %s",
                i + 1,
                len(search_results),
                gid,
                result.get("title", "?"),
            )
            work = self.scrape_work(gid, include_text=include_text)
            if work:
                works.append(work)
                logger.info(
                    "  -> %s by %s (%d subjects, %d chunks)",
                    work.title,
                    work.author or "Unknown",
                    len(work.subjects),
                    len(work.chunks),
                )
            else:
                logger.warning("  -> Failed to scrape ebook %d", gid)

        logger.info(
            "Scraped %d/%d works for subject '%s'",
            len(works),
            len(search_results),
            subject,
        )
        return works


def scrape_gutenberg_fiction(
    subject: str = "Fiction", max_works: int = 25
) -> list[ScrapedText]:
    """Scrape Gutenberg fiction as a seeding corpus.

    Main entry point for the ingestion pipeline. Downloads fiction works
    and splits them into chapters for narrative analysis.

    Args:
        subject: Gutenberg subject to search (default: "Fiction").
        max_works: Maximum number of works to process.

    Returns:
        List of ScrapedText objects ready for Neo4j ingestion.
    """
    scraper = GutenbergScraper()
    return scraper.scrape_subject_corpus(
        subject=subject, max_works=max_works, include_text=True
    )
