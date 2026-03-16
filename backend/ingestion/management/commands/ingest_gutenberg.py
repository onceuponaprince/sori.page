"""
Management command to run the Project Gutenberg ingestion pipeline.

Usage:
    python manage.py ingest_gutenberg
    python manage.py ingest_gutenberg --subject "Adventure" --max-works 10
    python manage.py ingest_gutenberg --dry-run

This scrapes Project Gutenberg for public domain fiction and creates
SourceNode and InstanceNode entries in the Neo4j knowledge graph. Each work
becomes a SourceNode, and individual chapters become InstanceNodes that can
be linked to narrative concepts.
"""

import logging

from django.core.management.base import BaseCommand

from ingestion.gutenberg import scrape_gutenberg_fiction

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Scrape Project Gutenberg fiction and ingest into Neo4j"

    def add_arguments(self, parser):
        parser.add_argument(
            "--subject",
            type=str,
            default="Fiction",
            help="Gutenberg subject to search for (default: 'Fiction')",
        )
        parser.add_argument(
            "--max-works",
            type=int,
            default=25,
            help="Maximum number of works to scrape (default: 25)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Scrape and print results without writing to Neo4j",
        )

    def handle(self, *args, **options):
        subject = options["subject"]
        max_works = options["max_works"]
        dry_run = options["dry_run"]

        self.stdout.write(
            f"Starting Gutenberg ingestion "
            f"(subject='{subject}', max={max_works})..."
        )

        works = scrape_gutenberg_fiction(
            subject=subject, max_works=max_works
        )

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
                subjects = ", ".join(w.subjects[:3]) if w.subjects else "no subjects"
                text_len = len(w.text_content) if w.text_content else 0
                self.stdout.write(
                    f"  [ebook {w.gutenberg_id}] {w.title} by {w.author or 'Unknown'} — "
                    f"{subjects} — "
                    f"{text_len:,} chars, {len(w.chunks)} chapters"
                )
            return

        # Write to Neo4j
        from graph.models import SourceNode, InstanceNode

        created_sources = 0
        created_instances = 0

        for work in works:
            # Create or get source node for this Gutenberg work
            try:
                source = SourceNode.nodes.get(url=work.url)
                self.stdout.write(
                    f"  Skipping {work.title} (source already exists)"
                )
                continue
            except SourceNode.DoesNotExist:
                source = SourceNode(
                    url=work.url,
                    name=f"Gutenberg: {work.title} by {work.author or 'Unknown'}",
                    source_type="gutenberg",
                    reliability_score=0.95,
                ).save()
                created_sources += 1

            # Create instance nodes from chapters
            # Each chapter is a discrete narrative unit that can be linked
            # to concepts (tropes, structures, patterns)
            for chunk in work.chunks:
                # Store a preview of the chapter text — enough for
                # concept detection but not the full text
                preview = chunk.text[:1000] if chunk.text else ""
                if not preview:
                    continue

                instance = InstanceNode(
                    description=(
                        f"{chunk.heading} of '{work.title}' "
                        f"by {work.author or 'Unknown'}: "
                        f"{preview}"
                    ),
                    work=work.title,
                    verified=True,
                    verified_by=["system_gutenberg_import"],
                ).save()
                instance.sources.connect(source)
                created_instances += 1

            self.stdout.write(
                f"  Created: {work.title} by {work.author or 'Unknown'} — "
                f"{len(work.chunks)} chapter instances"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone! Created {created_sources} source nodes and "
                f"{created_instances} instance nodes from "
                f"{len(works)} scraped works."
            )
        )
