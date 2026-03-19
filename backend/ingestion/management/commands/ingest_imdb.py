"""
Management command to run the IMDB ingestion pipeline.

Usage:
    python manage.py ingest_imdb
    python manage.py ingest_imdb --max-works 10  # smaller run for testing
    python manage.py ingest_imdb --dry-run       # preview without writing

This scrapes IMDB's Top 250 movies and creates SourceNode and InstanceNode
entries in the Neo4j knowledge graph. Each work becomes a SourceNode, and
its genre/keyword associations become InstanceNode connections.
"""

import logging
import os

from django.core.management.base import BaseCommand

from ingestion.imdb_scraper import scrape_imdb_top_works
from ingestion.imdb_sources import load_from_imdb_datasets, load_from_omdb

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Ingest IMDB metadata via scraper, datasets, or OMDb into Neo4j"

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-works",
            type=int,
            default=50,
            help="Maximum number of works to scrape (default: 50)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Scrape and print results without writing to Neo4j",
        )
        parser.add_argument(
            "--source",
            choices=["scraper", "datasets", "omdb"],
            default="scraper",
            help="Data source to use (default: scraper)",
        )
        parser.add_argument(
            "--datasets-dir",
            default=os.environ.get("IMDB_DATASETS_DIR", "./data/imdb"),
            help="Directory containing IMDB title.basics/title.ratings TSV files",
        )
        parser.add_argument(
            "--imdb-ids",
            default="",
            help="Comma-separated IMDB IDs for OMDb source, e.g. tt0111161,tt0068646",
        )
        parser.add_argument(
            "--omdb-api-key",
            default=os.environ.get("OMDB_API_KEY", ""),
            help="OMDb API key (or set OMDB_API_KEY env var)",
        )

    def _load_works(self, options, max_works: int):
        source = options["source"]
        if source == "scraper":
            return scrape_imdb_top_works(max_works=max_works)

        if source == "datasets":
            return load_from_imdb_datasets(
                max_works=max_works,
                datasets_dir=options["datasets_dir"],
            )

        imdb_ids = [s.strip() for s in options["imdb_ids"].split(",") if s.strip()]
        omdb_api_key = options["omdb_api_key"].strip()
        if not imdb_ids:
            self.stdout.write(
                self.style.ERROR(
                    "--source omdb requires --imdb-ids (comma-separated IMDB IDs)."
                )
            )
            return None
        if not omdb_api_key:
            self.stdout.write(
                self.style.ERROR(
                    "--source omdb requires --omdb-api-key or OMDB_API_KEY env var."
                )
            )
            return None

        return load_from_omdb(
            imdb_ids=imdb_ids,
            api_key=omdb_api_key,
            max_works=max_works,
        )

    def _print_dry_run(self, works):
        self.stdout.write(
            self.style.WARNING(
                f"\nDRY RUN — {len(works)} works scraped:"
            )
        )
        for w in works:
            genres = ", ".join(w.genres[:3]) if w.genres else "no genres"
            rating = f"{w.rating:.1f}/10" if w.rating else "no rating"
            self.stdout.write(
                f"  [{w.imdb_id}] {w.title} ({w.year or '?'}) — "
                f"{genres} — {rating} — "
                f"{len(w.keywords)} keywords"
            )

    def _write_works_to_graph(self, works, source: str):
        from graph.models import InstanceNode, SourceNode

        created_sources = 0
        created_instances = 0

        for work in works:
            try:
                source_node = SourceNode.nodes.get(url=work.url)
                self.stdout.write(
                    f"  Skipping {work.title} (source already exists)"
                )
                continue
            except SourceNode.DoesNotExist:
                source_node = SourceNode(
                    url=work.url,
                    name=f"IMDB: {work.title} ({work.year or '?'})",
                    source_type=work.source_type,
                    reliability_score=0.9,
                ).save()
                created_sources += 1

            if len(work.genres) >= 2:
                genre_combo = " + ".join(sorted(work.genres))
                instance = InstanceNode(
                    description=(
                        f"{work.title} ({work.year or '?'}) is a "
                        f"{genre_combo} work. {(work.plot_summary or '')[:300]}"
                    ),
                    work=work.title,
                    verified=True,
                    verified_by=["system_imdb_import"],
                ).save()
                instance.sources.connect(source_node)
                created_instances += 1

            for keyword in work.keywords[:15]:
                instance = InstanceNode(
                    description=(
                        f"'{keyword}' in {work.title} ({work.year or '?'}): "
                        f"{(work.plot_summary or '')[:200]}"
                    ),
                    work=work.title,
                    verified=True,
                    verified_by=["system_imdb_import"],
                ).save()
                instance.sources.connect(source_node)
                created_instances += 1

            self.stdout.write(
                f"  Created: {work.title} — {len(work.genres)} genres, "
                f"{len(work.keywords)} keywords"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {created_sources} source nodes and "
                f"{created_instances} instance nodes from "
                f"{len(works)} works from source={source}."
            )
        )

    def handle(self, *args, **options):
        max_works = options["max_works"]
        dry_run = options["dry_run"]
        source = options["source"]

        self.stdout.write(
            f"Starting IMDB ingestion (source={source}, max {max_works} works)..."
        )

        works = self._load_works(options, max_works)
        if works is None:
            return

        if not works:
            self.stdout.write(
                self.style.ERROR("No works loaded. Check logs for errors.")
            )
            return

        if dry_run:
            self._print_dry_run(works)
            return
        self._write_works_to_graph(works, source)
