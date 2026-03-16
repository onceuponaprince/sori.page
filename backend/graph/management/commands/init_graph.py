import os

from django.conf import settings
from django.core.management.base import BaseCommand
from neo4j import GraphDatabase
from neo4j.exceptions import ClientError


class Command(BaseCommand):
    help = "Initialize the Neo4j schema by running init.cypher"

    def handle(self, *args, **options):
        cypher_path = os.path.join(
            settings.BASE_DIR, "..", "docker", "neo4j", "init", "init.cypher"
        )

        if not os.path.exists(cypher_path):
            self.stderr.write(self.style.ERROR(f"Cypher file not found: {cypher_path}"))
            return

        with open(cypher_path, "r") as f:
            cypher_content = f.read()

        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )

        try:
            with driver.session() as session:
                for statement in cypher_content.split(";"):
                    statement = statement.strip()
                    if not statement:
                        continue
                    try:
                        session.run(statement)
                        self.stdout.write(self.style.SUCCESS(f"Executed: {statement[:80]}..."))
                    except ClientError as e:
                        if "already exists" in str(e).lower() or "equivalent" in str(e).lower():
                            self.stdout.write(self.style.WARNING(
                                f"Skipped (already exists): {statement[:80]}..."
                            ))
                        else:
                            raise
            self.stdout.write(self.style.SUCCESS("Neo4j schema initialized successfully."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to initialize Neo4j schema: {e}"))
        finally:
            driver.close()
