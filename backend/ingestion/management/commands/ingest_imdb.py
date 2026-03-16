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

from django.core.management.base import BaseCommand

from ingestion.imdb_scraper import scrape_imdb_top_works

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Scrape IMDB Top 250 and ingest movie metadata into Neo4j"

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

    def handle(self, *args, **options):
        max_works = options["max_works"]
        dry_run = options["dry_run"]

        self.stdout.write(
            f"Starting IMDB ingestion (max {max_works} works)..."
        )

        works = scrape_imdb_top_works(max_works=max_works)

        if not works:
            self.stdout.write(
                self.style.ERROR("No works scraped. Check logs for errors.")
            )
            return

        if dry_run:
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
            return

        # Write to Neo4j
        from graph.models import SourceNode, InstanceNode

        created_sources = 0
        created_instances = 0

        for work in works:
            # Create or get source node for this IMDB title
            try:
                source = SourceNode.nodes.get(url=work.url)
                self.stdout.write(
                    f"  Skipping {work.title} (source already exists)"
                )
                continue
            except SourceNode.DoesNotExist:
                source = SourceNode(
                    url=work.url,
                    name=f"IMDB: {work.title} ({work.year or '?'})",
                    source_type="imdb",
                    reliability_score=0.9,
                ).save()
                created_sources += 1

            # Create instance nodes for genre combinations
            # Genre combos are narrative-structural signals
            if len(work.genres) >= 2:
                genre_combo = " + ".join(sorted(work.genres))
                instance = InstanceNode(
                    description=(
                        f"{work.title} ({work.year or '?'}) is a "
                        f"{genre_combo} work. {work.plot_summary[:300]}"
                    ),
                    work=work.title,
                    verified=True,
                    verified_by=["system_imdb_import"],
                ).save()
                instance.sources.connect(source)
                created_instances += 1

            # Create instance nodes for narrative-relevant keywords
            # Keywords like "redemption", "twist-ending", "betrayal" map
            # directly to trope concepts
            for keyword in work.keywords[:15]:
                instance = InstanceNode(
                    description=(
                        f"'{keyword}' in {work.title} ({work.year or '?'}): "
                        f"{work.plot_summary[:200]}"
                    ),
                    work=work.title,
                    verified=True,
                    verified_by=["system_imdb_import"],
                ).save()
                instance.sources.connect(source)
                created_instances += 1

            self.stdout.write(
                f"  Created: {work.title} — {len(work.genres)} genres, "
                f"{len(work.keywords)} keywords"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {created_sources} source nodes and "
                f"{created_instances} instance nodes from "
                f"{len(works)} scraped works."
            )
        )
