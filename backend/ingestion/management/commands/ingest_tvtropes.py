"""
Management command to run the TV Tropes ingestion pipeline.

Usage:
    python manage.py ingest_tvtropes
    python manage.py ingest_tvtropes --max-per-index 10  # smaller run for testing

This scrapes TV Tropes narrative indexes and creates ConceptNode entries
in the Neo4j knowledge graph with depth_score=2 (named tropes with
overwhelming community consensus).
"""
from django.core.management.base import BaseCommand
from ingestion.tvtropes import scrape_narrative_tropes


class Command(BaseCommand):
    help = "Scrape TV Tropes narrative indexes and ingest into Neo4j"

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-per-index",
            type=int,
            default=25,
            help="Maximum tropes to scrape per index page (default: 25)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Scrape and print results without writing to Neo4j",
        )

    def handle(self, *args, **options):
        max_per = options["max_per_index"]
        dry_run = options["dry_run"]

        self.stdout.write(f"Starting TV Tropes ingestion (max {max_per} per index)...")

        tropes = scrape_narrative_tropes(max_per_index=max_per)

        if dry_run:
            self.stdout.write(self.style.WARNING(f"\nDRY RUN — {len(tropes)} tropes scraped:"))
            for t in tropes:
                self.stdout.write(
                    f"  [{t.depth_score}] {t.name}: {t.description[:80]}... "
                    f"({len(t.examples)} examples, {len(t.related_tropes)} related)"
                )
            return

        # Write to Neo4j
        from graph.models import ConceptNode, SourceNode, InstanceNode

        created = 0
        for trope in tropes:
            # Create or get source node
            try:
                source = SourceNode.nodes.get(url=trope.url)
            except SourceNode.DoesNotExist:
                source = SourceNode(
                    url=trope.url,
                    name=f"TV Tropes: {trope.name}",
                    source_type="tvtropes",
                    reliability_score=0.8,
                ).save()

            # Create concept node (skip if exists)
            try:
                ConceptNode.nodes.get(name=trope.name)
                self.stdout.write(f"  Skipping {trope.name} (already exists)")
                continue
            except ConceptNode.DoesNotExist:
                pass

            concept = ConceptNode(
                name=trope.name,
                description=trope.description[:1000],
                depth_score=trope.depth_score,
                confidence=trope.confidence,
                status="canonized",  # TV Tropes tropes auto-canonize at d=2
            ).save()
            concept.sources.connect(source)

            # Create instance nodes from examples
            for example in trope.examples[:10]:
                instance = InstanceNode(
                    description=example["text"][:500],
                    work=example.get("medium", ""),
                    verified=True,
                    verified_by=["system_tvtropes_import"],
                ).save()
                instance.concept.connect(concept)
                instance.sources.connect(source)

            created += 1
            self.stdout.write(f"  Created: {trope.name} ({len(trope.examples)} instances)")

        self.stdout.write(
            self.style.SUCCESS(f"\nDone! Created {created} concept nodes from {len(tropes)} scraped tropes.")
        )
