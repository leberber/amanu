# backend/app/seed_test_users.py
"""
Seed script for test users: drivers, customers, and staff.
All locations are near the store center in Algiers.
"""
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.user import User, UserRole, AuthProvider
from app.models.driver import Driver, DriverVehicle, VehicleType, DriverStatus
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store center coordinates (Algiers)
STORE_CENTER_LAT = 36.7538
STORE_CENTER_LNG = 3.0588

# Default password for all test users
DEFAULT_PASSWORD = "test1234"

# Test users data
TEST_USERS = [
    # ==================== DRIVERS ====================
    {
        "email": "driver1@test.com",
        "full_name": "Karim Benali",
        "phone": "0555123401",
        "store_name": None,
        "role": UserRole.DRIVER,
        "h3_index": "8938748992bffff",
        "address": "12 Rue Didouche Mourad, Alger Centre",
        "wilaya": "Alger",
        "daira": "Sidi M'Hamed",
        "commune": "Alger Centre",
        "latitude": 36.7580,  # ~500m north of store
        "longitude": 3.0550,
        "driver_data": {
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 5,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.TRUCK,
            "capacity_kg": 2000.0,
            "capacity_volume": 15.0,
        }
    },
    {
        "email": "driver2@test.com",
        "full_name": "Youcef Mammeri",
        "phone": "0555123402",
        "store_name": None,
        "role": UserRole.DRIVER,
        "h3_index": "8938748992bffff",
        "address": "45 Boulevard Mohamed V, Hussein Dey",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Hussein Dey",
        "latitude": 36.7450,  # ~1km south of store
        "longitude": 3.0700,
        "driver_data": {
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 3,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.VAN,
            "capacity_kg": 800.0,
            "capacity_volume": 8.0,
        }
    },
    {
        "email": "driver3@test.com",
        "full_name": "Omar Hadj",
        "phone": "0555123403",
        "store_name": None,
        "role": UserRole.DRIVER,
        "address": "8 Rue Larbi Ben M'hidi, Bab El Oued",
        "wilaya": "Alger",
        "daira": "Bab El Oued",
        "commune": "Bab El Oued",
        "latitude": 36.7900,  # ~4km north of store
        "longitude": 3.0480,
        "driver_data": {
            "status": DriverStatus.OFFLINE,
            "is_available": False,
            "max_active_orders": 2,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.MINI_VAN,
            "capacity_kg": 400.0,
            "capacity_volume": 4.0,
        }
    },

    # ==================== CUSTOMERS ====================
    # --- Zone A: El Biar (h3_index: 893874c6143ffff) ---
    {
        "email": "client1@test.com",
        "full_name": "Amina Khelifa",
        "phone": "0555123411",
        "store_name": "Épicerie Amina",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "23 Rue Hassiba Ben Bouali, El Biar",
        "wilaya": "Alger",
        "daira": "Bir Mourad Rais",
        "commune": "El Biar",
        "latitude": 36.7650,
        "longitude": 3.0350,
    },
    {
        "email": "client3@test.com",
        "full_name": "Rachid Hamdi",
        "phone": "0555123413",
        "store_name": "Mini Market Hamdi",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",  # Same zone as client1
        "address": "45 Rue Ahmed Ouaked, El Biar",
        "wilaya": "Alger",
        "daira": "Bir Mourad Rais",
        "commune": "El Biar",
        "latitude": 36.7660,
        "longitude": 3.0340,
    },
    {
        "email": "client4@test.com",
        "full_name": "Salima Benzerga",
        "phone": "0555123414",
        "store_name": "Alimentation Salima",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",  # Same zone as client1
        "address": "12 Rue des Frères Bouadou, El Biar",
        "wilaya": "Alger",
        "daira": "Bir Mourad Rais",
        "commune": "El Biar",
        "latitude": 36.7640,
        "longitude": 3.0360,
    },
    {
        "email": "client5@test.com",
        "full_name": "Nadir Bensalem",
        "phone": "0555123415",
        "store_name": "Superette Bensalem",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",  # Same zone as client1
        "address": "78 Boulevard Krim Belkacem, El Biar",
        "wilaya": "Alger",
        "daira": "Bir Mourad Rais",
        "commune": "El Biar",
        "latitude": 36.7670,
        "longitude": 3.0330,
    },

    # --- Zone B: Kouba (h3_index: 8938748b137ffff) ---
    {
        "email": "client2@test.com",
        "full_name": "Mohamed Boudiaf",
        "phone": "0555123412",
        "store_name": "Superette Boudiaf",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "56 Avenue de l'ALN, Kouba",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Kouba",
        "latitude": 36.7200,
        "longitude": 3.0800,
    },
    {
        "email": "client6@test.com",
        "full_name": "Karima Ait Ahmed",
        "phone": "0555123416",
        "store_name": "Épicerie Ait Ahmed",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",  # Same zone as client2
        "address": "23 Rue Colonel Amirouche, Kouba",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Kouba",
        "latitude": 36.7210,
        "longitude": 3.0790,
    },
    {
        "email": "client7@test.com",
        "full_name": "Yassine Meziane",
        "phone": "0555123417",
        "store_name": "Alimentation Meziane",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",  # Same zone as client2
        "address": "89 Rue Didouche Mourad, Kouba",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Kouba",
        "latitude": 36.7190,
        "longitude": 3.0810,
    },

    # --- Zone C: Bab El Oued (different zone - h3_index: 8938749a8a7ffff) ---
    {
        "email": "client8@test.com",
        "full_name": "Sofiane Brahimi",
        "phone": "0555123418",
        "store_name": "Mini Market Brahimi",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",  # Different zone
        "address": "15 Rue de la Liberté, Bab El Oued",
        "wilaya": "Alger",
        "daira": "Bab El Oued",
        "commune": "Bab El Oued",
        "latitude": 36.7900,
        "longitude": 3.0500,
    },
    {
        "email": "client9@test.com",
        "full_name": "Djamila Haddad",
        "phone": "0555123419",
        "store_name": "Superette Haddad",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",  # Same as client8 (Bab El Oued zone)
        "address": "34 Boulevard Colonel Bougara, Bab El Oued",
        "wilaya": "Alger",
        "daira": "Bab El Oued",
        "commune": "Bab El Oued",
        "latitude": 36.7910,
        "longitude": 3.0490,
    },

    # ==================== STAFF ====================
    {
        "email": "staff@test.com",
        "full_name": "Fatima Zohra Benali",
        "phone": "0555123421",
        "store_name": None,
        "role": UserRole.STAFF,
        "h3_index": "89387417647ffff",
        "address": "Centre Commercial, Alger Centre",
        "wilaya": "Alger",
        "daira": "Sidi M'Hamed",
        "commune": "Alger Centre",
        "latitude": STORE_CENTER_LAT,  # At store location
        "longitude": STORE_CENTER_LNG,
    },
]


def seed_test_users():
    """Seed the database with test users for development and testing."""
    logger.info("Starting test users seeding...")

    with Session(engine) as session:
        created_count = 0
        skipped_count = 0

        for user_data in TEST_USERS:
            # Check if user already exists
            existing_user = session.exec(
                select(User).where(User.email == user_data["email"])
            ).first()

            if existing_user:
                logger.info(f"User already exists: {user_data['email']} - skipping")
                skipped_count += 1
                continue

            # Extract driver and vehicle data if present
            driver_data = user_data.pop("driver_data", None)
            vehicle_data = user_data.pop("vehicle_data", None)

            # Create user
            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                store_name=user_data.get("store_name"),
                role=user_data["role"],
                is_active=True,
                h3_index=user_data.get("h3_index"),
                address=user_data.get("address"),
                wilaya=user_data.get("wilaya"),
                daira=user_data.get("daira"),
                commune=user_data.get("commune"),
                latitude=user_data.get("latitude"),
                longitude=user_data.get("longitude"),
                auth_provider=AuthProvider.EMAIL,
                hashed_password=get_password_hash(DEFAULT_PASSWORD),
            )

            session.add(user)
            session.flush()  # Get user ID

            # Create driver and vehicle if this is a driver
            if driver_data and vehicle_data and user_data["role"] == UserRole.DRIVER:
                # Create driver
                driver = Driver(
                    user_id=user.id,
                    status=driver_data["status"],
                    is_available=driver_data["is_available"],
                    max_active_orders=driver_data["max_active_orders"],
                )
                session.add(driver)
                session.flush()  # Get driver ID

                # Create vehicle
                vehicle = DriverVehicle(
                    driver_id=driver.id,
                    vehicle_type=vehicle_data["vehicle_type"],
                    capacity_kg=vehicle_data["capacity_kg"],
                    capacity_volume=vehicle_data["capacity_volume"],
                    is_primary=True,
                )
                session.add(vehicle)
                logger.info(f"Created driver with {vehicle_data['vehicle_type'].value} vehicle: {user.full_name}")
            else:
                logger.info(f"Created {user_data['role'].value}: {user.full_name}")

            created_count += 1

        session.commit()

    logger.info(f"Test users seeding completed! Created: {created_count}, Skipped: {skipped_count}")
    logger.info(f"Default password for all test users: {DEFAULT_PASSWORD}")

    # Print summary
    print("\n" + "="*60)
    print("TEST USERS CREATED")
    print("="*60)
    print(f"Password for all: {DEFAULT_PASSWORD}")
    print("-"*60)
    print("\nDRIVERS:")
    print("  - driver1@test.com (Truck, 2000kg)")
    print("  - driver2@test.com (Van, 800kg)")
    print("  - driver3@test.com (Mini Van, 400kg - Offline)")
    print("\nCUSTOMERS - Zone A (El Biar - 893874c6143ffff):")
    print("  - client1@test.com (Épicerie Amina)")
    print("  - client3@test.com (Mini Market Hamdi)")
    print("  - client4@test.com (Alimentation Salima)")
    print("  - client5@test.com (Superette Bensalem)")
    print("\nCUSTOMERS - Zone B (Kouba - 8938748b137ffff):")
    print("  - client2@test.com (Superette Boudiaf)")
    print("  - client6@test.com (Épicerie Ait Ahmed)")
    print("  - client7@test.com (Alimentation Meziane)")
    print("\nCUSTOMERS - Zone C (Bab El Oued - 8938749a8a7ffff):")
    print("  - client8@test.com (Mini Market Brahimi)")
    print("  - client9@test.com (Superette Haddad)")
    print("\nSTAFF:")
    print("  - staff@test.com")
    print("="*60 + "\n")


def delete_test_users():
    """Delete all test users (for cleanup)."""
    logger.info("Deleting test users...")

    with Session(engine) as session:
        for user_data in TEST_USERS:
            user = session.exec(
                select(User).where(User.email == user_data.get("email"))
            ).first()

            if user:
                # Driver and vehicles will be deleted via cascade
                session.delete(user)
                logger.info(f"Deleted user: {user_data.get('email')}")

        session.commit()

    logger.info("Test users deletion completed!")


if __name__ == "__main__":
    seed_test_users()
