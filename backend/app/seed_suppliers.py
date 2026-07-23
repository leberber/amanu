# backend/app/seed_suppliers.py
"""
Seed script to populate the suppliers table with initial data.
Run with: python -m app.seed_suppliers
"""
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.supplier import Supplier

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supplier data from the stock component mock data
SUPPLIERS = [
    {
        "name": "1001",
        "contact_person": "1001",
        "address": "Ben Talha",
        "phone": "0540 207824",
        "email": "",
        "city": "Ben Talha",
        "is_active": True
    },
    {
        "name": "SIM",
        "contact_person": "Ben Ferah Farid",
        "address": "Anar Amalal Tizi Ouzou",
        "phone": "",
        "email": "",
        "city": "Tizi Ouzou",
        "is_active": True
    },
    {
        "name": "IZDIHAR",
        "contact_person": "SARL SOMAF",
        "address": "Khemis El Khechna",
        "phone": "0550 83 79 56",
        "email": "",
        "city": "Alger",
        "is_active": True
    },
    {
        "name": "AGRODIV",
        "contact_person": "Nordine Atti",
        "address": "Tamda",
        "phone": "000 00 00 00",
        "email": "",
        "city": "Tizi Ouzou",
        "is_active": True
    },
    {
        "name": "Ifri",
        "contact_person": "SARL Ibrahim & Fils (IFRI)",
        "address": "Ighzer Amokrane, Ifri Ouzellaguen",
        "phone": "034 35 10 10",
        "email": "",
        "city": "Bejaia",
        "is_active": True
    },
    {
        "name": "Hamoud Boualem",
        "contact_person": "Hamoud Boualem SPA",
        "address": "Route Nationale N°5, Hussein Dey",
        "phone": "021 77 20 20",
        "email": "",
        "city": "Alger",
        "is_active": True
    },
    {
        "name": "La Belle",
        "contact_person": "La Belle SPA",
        "address": "Zone Industrielle, Rouiba",
        "phone": "021 85 30 30",
        "email": "",
        "city": "Alger",
        "is_active": True
    },
    {
        "name": "Amor Benamor",
        "contact_person": "Groupe Amor Benamor",
        "address": "Route de Constantine, Guelma",
        "phone": "037 20 10 10",
        "email": "",
        "city": "Guelma",
        "is_active": True
    }
]


def seed_suppliers():
    """Seed the database with supplier data"""
    logger.info("Starting supplier seeding...")

    with Session(engine) as session:
        added_count = 0
        skipped_count = 0

        for supplier_data in SUPPLIERS:
            # Check if supplier already exists by name
            existing = session.exec(
                select(Supplier).where(Supplier.name == supplier_data["name"])
            ).first()

            if existing:
                logger.info(f"Supplier already exists: {supplier_data['name']}")
                skipped_count += 1
                continue

            supplier = Supplier(**supplier_data)
            session.add(supplier)
            logger.info(f"Added supplier: {supplier_data['name']}")
            added_count += 1

        session.commit()

    logger.info(f"Supplier seeding completed! Added: {added_count}, Skipped: {skipped_count}")


# if __name__ == "__main__":
#     seed_suppliers()
