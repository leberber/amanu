# backend/app/seed_test_users.py
"""
Seed script for test users: drivers, customers, and staff.
All locations are near the store center in Algiers.
"""
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.user import User, UserRole, AuthProvider
from app.models.driver import DriverProfile, VehicleType, DriverStatus
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
        "address": "12 Rue Didouche Mourad, Alger Centre",
        "wilaya": "Alger",
        "daira": "Sidi M'Hamed",
        "commune": "Alger Centre",
        "latitude": 36.7580,  # ~500m north of store
        "longitude": 3.0550,
        "driver_profile": {
            "vehicle_type": VehicleType.TRUCK,
            "capacity_kg": 2000.0,
            "capacity_volume": 15.0,
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 5,
        }
    },
    {
        "email": "driver2@test.com",
        "full_name": "Youcef Mammeri",
        "phone": "0555123402",
        "store_name": None,
        "role": UserRole.DRIVER,
        "address": "45 Boulevard Mohamed V, Hussein Dey",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Hussein Dey",
        "latitude": 36.7450,  # ~1km south of store
        "longitude": 3.0700,
        "driver_profile": {
            "vehicle_type": VehicleType.VAN,
            "capacity_kg": 800.0,
            "capacity_volume": 8.0,
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 3,
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
        "driver_profile": {
            "vehicle_type": VehicleType.MINI_VAN,
            "capacity_kg": 400.0,
            "capacity_volume": 4.0,
            "status": DriverStatus.OFFLINE,
            "is_available": False,
            "max_active_orders": 2,
        }
    },

    # ==================== CUSTOMERS ====================
    {
        "email": "client1@test.com",
        "full_name": "Amina Khelifa",
        "phone": "0555123411",
        "store_name": "Épicerie Amina",
        "role": UserRole.CUSTOMER,
        "address": "23 Rue Hassiba Ben Bouali, El Biar",
        "wilaya": "Alger",
        "daira": "Bir Mourad Rais",
        "commune": "El Biar",
        "latitude": 36.7650,  # ~1.5km northwest of store
        "longitude": 3.0350,
        "driver_profile": None
    },
    {
        "email": "client2@test.com",
        "full_name": "Mohamed Boudiaf",
        "phone": "0555123412",
        "store_name": "Superette Boudiaf",
        "role": UserRole.CUSTOMER,
        "address": "56 Avenue de l'ALN, Kouba",
        "wilaya": "Alger",
        "daira": "Hussein Dey",
        "commune": "Kouba",
        "latitude": 36.7200,  # ~3km south of store
        "longitude": 3.0800,
        "driver_profile": None
    },

    # ==================== STAFF ====================
    {
        "email": "staff@test.com",
        "full_name": "Fatima Zohra Benali",
        "phone": "0555123421",
        "store_name": None,
        "role": UserRole.STAFF,
        "address": "Centre Commercial, Alger Centre",
        "wilaya": "Alger",
        "daira": "Sidi M'Hamed",
        "commune": "Alger Centre",
        "latitude": STORE_CENTER_LAT,  # At store location
        "longitude": STORE_CENTER_LNG,
        "driver_profile": None
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

            # Extract driver profile data if present
            driver_profile_data = user_data.pop("driver_profile", None)

            # Create user
            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                phone=user_data["phone"],
                store_name=user_data["store_name"],
                role=user_data["role"],
                is_active=True,
                address=user_data["address"],
                wilaya=user_data["wilaya"],
                daira=user_data["daira"],
                commune=user_data["commune"],
                latitude=user_data["latitude"],
                longitude=user_data["longitude"],
                auth_provider=AuthProvider.EMAIL,
                hashed_password=get_password_hash(DEFAULT_PASSWORD),
            )

            session.add(user)
            session.flush()  # Get user ID

            # Create driver profile if this is a driver
            if driver_profile_data and user_data["role"] == UserRole.DRIVER:
                driver_profile = DriverProfile(
                    user_id=user.id,
                    vehicle_type=driver_profile_data["vehicle_type"],
                    capacity_kg=driver_profile_data["capacity_kg"],
                    capacity_volume=driver_profile_data["capacity_volume"],
                    status=driver_profile_data["status"],
                    is_available=driver_profile_data["is_available"],
                    max_active_orders=driver_profile_data["max_active_orders"],
                )
                session.add(driver_profile)
                logger.info(f"Created driver with {driver_profile_data['vehicle_type'].value} vehicle: {user.full_name}")
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
    print("\nCUSTOMERS:")
    print("  - client1@test.com (Épicerie Amina)")
    print("  - client2@test.com (Superette Boudiaf)")
    print("\nSTAFF:")
    print("  - staff@test.com")
    print("="*60 + "\n")


def delete_test_users():
    """Delete all test users (for cleanup)."""
    logger.info("Deleting test users...")

    with Session(engine) as session:
        for user_data in TEST_USERS:
            user = session.exec(
                select(User).where(User.email == user_data["email"])
            ).first()

            if user:
                # Driver profile will be deleted via cascade
                session.delete(user)
                logger.info(f"Deleted user: {user_data['email']}")

        session.commit()

    logger.info("Test users deletion completed!")


if __name__ == "__main__":
    seed_test_users()
