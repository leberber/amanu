# backend/app/seed_test_users.py
"""
Seed script for test users: drivers, customers, and staff.
All locations are in Ouadhia daira, Tizi Ouzou wilaya.
Communes: Ouadhia, Agouni Gueghrane, Ait Bouadou, Tizi N'Tlata
"""
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.user import User, UserRole, AuthProvider
from app.models.driver import Driver, DriverVehicle, VehicleType, DriverStatus
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store center coordinates (Ouadhia, Tizi Ouzou)
STORE_CENTER_LAT = 36.5550
STORE_CENTER_LNG = 4.0850

# Default password for all test users
DEFAULT_PASSWORD = "test1234"

# Test users data
TEST_USERS = [
    # ==================== DRIVERS ====================
    {
        "email": "driver1@test.com",
        "full_name": "Chabane Melab",
        "phone": "0555123401",
        "store_name": None,
        "role": UserRole.DRIVER,
        "h3_index": "893874c6143ffff",
        "address": "12 Rue Principale, Ouadhia Centre",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5560,
        "longitude": 4.0860,
        "driver_data": {
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 5,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.TRUCK,
            "capacity_kg": 30000.0,
            "capacity_volume": 50.0,
        }
    },
    {
        "email": "driver2@test.com",
        "full_name": "Youcef Mammeri",
        "phone": "0555123402",
        "store_name": None,
        "role": UserRole.DRIVER,
        "h3_index": "893874c6143ffff",
        "address": "45 Route de Tizi N'Tlata, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5245,
        "longitude": 4.1217,
        "driver_data": {
            "status": DriverStatus.AVAILABLE,
            "is_available": True,
            "max_active_orders": 3,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.VAN,
            "capacity_kg": 18000.0,
            "capacity_volume": 30.0,
        }
    },
    {
        "email": "driver3@test.com",
        "full_name": "Omar Hadj",
        "phone": "0555123403",
        "store_name": None,
        "role": UserRole.DRIVER,
        "h3_index": "8938748b137ffff",
        "address": "8 Rue des Oliviers, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5380,
        "longitude": 4.0620,
        "driver_data": {
            "status": DriverStatus.OFFLINE,
            "is_available": False,
            "max_active_orders": 2,
        },
        "vehicle_data": {
            "vehicle_type": VehicleType.MINI_VAN,
            "capacity_kg": 7000.0,
            "capacity_volume": 12.0,
        }
    },

    # ==================== CUSTOMERS ====================
    # --- Zone A: Ouadhia Centre ---
    {
        "email": "client1@test.com",
        "full_name": "Amina Khelifa",
        "phone": "0555123411",
        "store_name": "Epicerie Amina",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "23 Rue du Marche, Ouadhia Centre",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5545,
        "longitude": 4.0835,
    },
    {
        "email": "client3@test.com",
        "full_name": "Rachid Hamdi",
        "phone": "0555123413",
        "store_name": "Mini Market Hamdi",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "45 Rue de la Mosquee, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5558,
        "longitude": 4.0870,
    },
    {
        "email": "client4@test.com",
        "full_name": "Salima Benzerga",
        "phone": "0555123414",
        "store_name": "Alimentation Salima",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "12 Place de l'Independance, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5535,
        "longitude": 4.0855,
    },

    # --- Zone B: Agouni Gueghrane ---
    {
        "email": "client11@test.com",
        "full_name": "Djafer Mekhtoub",
        "phone": "0555123422",
        "store_name": "Alimentation 4 Chemins",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "4 Chemins, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5242,
        "longitude": 4.1210,
    },
    {
        "email": "client5@test.com",
        "full_name": "Nadir Bensalem",
        "phone": "0555123415",
        "store_name": "Superette Bensalem",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "78 Rue Principale, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5250,
        "longitude": 4.1200,
    },
    {
        "email": "client2@test.com",
        "full_name": "Mohamed Boudiaf",
        "phone": "0555123412",
        "store_name": "Superette Boudiaf",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "56 Route de Ouadhia, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5238,
        "longitude": 4.1230,
    },
    {
        "email": "client6@test.com",
        "full_name": "Karima Ait Ahmed",
        "phone": "0555123416",
        "store_name": "Epicerie Ait Ahmed",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "23 Rue des Figues, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5260,
        "longitude": 4.1185,
    },

    # --- Zone C: Ait Bouadou ---
    {
        "email": "client7@test.com",
        "full_name": "Yassine Meziane",
        "phone": "0555123417",
        "store_name": "Alimentation Meziane",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "89 Chemin des Cerisiers, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5395,
        "longitude": 4.0600,
    },
    {
        "email": "client8@test.com",
        "full_name": "Sofiane Brahimi",
        "phone": "0555123418",
        "store_name": "Mini Market Brahimi",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "15 Rue du Village, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5370,
        "longitude": 4.0635,
    },

    # --- Zone D: Tizi N'Tlata ---
    {
        "email": "client9@test.com",
        "full_name": "Djamila Haddad",
        "phone": "0555123419",
        "store_name": "Superette Haddad",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "34 Route Nationale, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5680,
        "longitude": 4.1050,
    },
    {
        "email": "client10@test.com",
        "full_name": "Mourad Oukaci",
        "phone": "0555123420",
        "store_name": "Epicerie Oukaci",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "12 Place du Marche, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5695,
        "longitude": 4.1035,
    },

    # ==================== ADDITIONAL CUSTOMERS ====================
    # --- More in Ouadhia Centre ---
    {
        "email": "client12@test.com",
        "full_name": "Karim Belkacem",
        "phone": "0555123430",
        "store_name": "Superette Belkacem",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "67 Rue des Martyrs, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5542,
        "longitude": 4.0865,
    },
    {
        "email": "client13@test.com",
        "full_name": "Lynda Ould Ali",
        "phone": "0555123431",
        "store_name": "Mini Market Ould Ali",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "15 Avenue de la Liberte, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5565,
        "longitude": 4.0828,
    },
    {
        "email": "client14@test.com",
        "full_name": "Hakim Bouzid",
        "phone": "0555123432",
        "store_name": "Alimentation Bouzid",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "22 Rue du Stade, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5530,
        "longitude": 4.0880,
    },
    {
        "email": "client15@test.com",
        "full_name": "Samira Cherifi",
        "phone": "0555123433",
        "store_name": "Epicerie Cherifi",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "8 Cite des Oliviers, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5572,
        "longitude": 4.0842,
    },
    {
        "email": "client16@test.com",
        "full_name": "Farid Aït Saadi",
        "phone": "0555123434",
        "store_name": "Supermarche Aït Saadi",
        "role": UserRole.CUSTOMER,
        "h3_index": "893874c6143ffff",
        "address": "45 Boulevard Principal, Ouadhia",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": 36.5555,
        "longitude": 4.0815,
    },

    # --- More in Agouni Gueghrane ---
    {
        "email": "client17@test.com",
        "full_name": "Nassim Ouali",
        "phone": "0555123435",
        "store_name": "Alimentation Ouali",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "12 Rue de la Source, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5255,
        "longitude": 4.1195,
    },
    {
        "email": "client18@test.com",
        "full_name": "Malika Idir",
        "phone": "0555123436",
        "store_name": "Mini Market Idir",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "34 Chemin de la Montagne, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5232,
        "longitude": 4.1245,
    },
    {
        "email": "client19@test.com",
        "full_name": "Arezki Mohand",
        "phone": "0555123437",
        "store_name": "Superette Mohand",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "56 Place du Village, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5268,
        "longitude": 4.1178,
    },
    {
        "email": "client20@test.com",
        "full_name": "Zahia Belkadi",
        "phone": "0555123438",
        "store_name": "Epicerie Belkadi",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "9 Rue des Amandiers, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5248,
        "longitude": 4.1222,
    },
    {
        "email": "client21@test.com",
        "full_name": "Toufik Hamrani",
        "phone": "0555123439",
        "store_name": "Alimentation Hamrani",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938748b137ffff",
        "address": "78 Route de Tizi Ouzou, Agouni Gueghrane",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Agouni Gueghrane",
        "latitude": 36.5275,
        "longitude": 4.1160,
    },

    # --- More in Ait Bouadou ---
    {
        "email": "client22@test.com",
        "full_name": "Smail Kaci",
        "phone": "0555123440",
        "store_name": "Superette Kaci",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "23 Rue Principale, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5385,
        "longitude": 4.0615,
    },
    {
        "email": "client23@test.com",
        "full_name": "Nadia Amrouche",
        "phone": "0555123441",
        "store_name": "Mini Market Amrouche",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "45 Chemin des Vergers, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5362,
        "longitude": 4.0648,
    },
    {
        "email": "client24@test.com",
        "full_name": "Rabah Slimani",
        "phone": "0555123442",
        "store_name": "Epicerie Slimani",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "67 Rue de l'Ecole, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5398,
        "longitude": 4.0588,
    },
    {
        "email": "client25@test.com",
        "full_name": "Farida Ait Ouali",
        "phone": "0555123443",
        "store_name": "Alimentation Ait Ouali",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "11 Place de la Fontaine, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5375,
        "longitude": 4.0625,
    },
    {
        "email": "client26@test.com",
        "full_name": "Mouloud Ziane",
        "phone": "0555123444",
        "store_name": "Supermarche Ziane",
        "role": UserRole.CUSTOMER,
        "h3_index": "8938749a8a7ffff",
        "address": "89 Rue du Commerce, Ait Bouadou",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ait Bouadou",
        "latitude": 36.5355,
        "longitude": 4.0660,
    },

    # --- More in Tizi N'Tlata ---
    {
        "email": "client27@test.com",
        "full_name": "Lyes Boudjema",
        "phone": "0555123445",
        "store_name": "Epicerie Boudjema",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "18 Avenue Principale, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5688,
        "longitude": 4.1065,
    },
    {
        "email": "client28@test.com",
        "full_name": "Sabrina Taleb",
        "phone": "0555123446",
        "store_name": "Mini Market Taleb",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "42 Rue des Ecoles, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5672,
        "longitude": 4.1078,
    },
    {
        "email": "client29@test.com",
        "full_name": "Ahmed Belhocine",
        "phone": "0555123447",
        "store_name": "Superette Belhocine",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "5 Cite des Jardins, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5702,
        "longitude": 4.1028,
    },
    {
        "email": "client30@test.com",
        "full_name": "Kahina Yahi",
        "phone": "0555123448",
        "store_name": "Alimentation Yahi",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "31 Chemin de la Colline, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5665,
        "longitude": 4.1088,
    },
    {
        "email": "client31@test.com",
        "full_name": "Djamel Saidani",
        "phone": "0555123449",
        "store_name": "Supermarche Saidani",
        "role": UserRole.CUSTOMER,
        "h3_index": "89387417647ffff",
        "address": "73 Route de Boghni, Tizi N'Tlata",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Tizi N'Tlata",
        "latitude": 36.5710,
        "longitude": 4.1015,
    },

    # ==================== STAFF ====================
    {
        "email": "staff@test.com",
        "full_name": "Fatima Zohra Benali",
        "phone": "0555123421",
        "store_name": None,
        "role": UserRole.STAFF,
        "h3_index": "893874c6143ffff",
        "address": "Entrepot Elsuq, Ouadhia Centre",
        "wilaya": "Tizi Ouzou",
        "daira": "Ouadhia",
        "commune": "Ouadhia",
        "latitude": STORE_CENTER_LAT,
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
    print("TEST USERS CREATED - OUADHIA DAIRA, TIZI OUZOU")
    print("="*60)
    print(f"Password for all: {DEFAULT_PASSWORD}")
    print("-"*60)
    print("\nDRIVERS:")
    print("  - driver1@test.com - Chabane Melab (Truck, 30000kg) - Ouadhia")
    print("  - driver2@test.com - Youcef Mammeri (Van, 18000kg) - Agouni Gueghrane")
    print("  - driver3@test.com - Omar Hadj (Mini Van, 7000kg - Offline) - Ait Bouadou")
    print("\nCUSTOMERS - Zone A (Ouadhia Centre):")
    print("  - client1@test.com (Epicerie Amina)")
    print("  - client3@test.com (Mini Market Hamdi)")
    print("  - client4@test.com (Alimentation Salima)")
    print("\nCUSTOMERS - Zone B (Agouni Gueghrane):")
    print("  - client11@test.com (Alimentation 4 Chemins) - Djafer Mekhtoub")
    print("  - client5@test.com (Superette Bensalem)")
    print("  - client2@test.com (Superette Boudiaf)")
    print("  - client6@test.com (Epicerie Ait Ahmed)")
    print("\nCUSTOMERS - Zone C (Ait Bouadou):")
    print("  - client7@test.com (Alimentation Meziane)")
    print("  - client8@test.com (Mini Market Brahimi)")
    print("\nCUSTOMERS - Zone D (Tizi N'Tlata):")
    print("  - client9@test.com (Superette Haddad)")
    print("  - client10@test.com (Epicerie Oukaci)")
    print("\nSTAFF:")
    print("  - staff@test.com (Entrepot Ouadhia)")
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
