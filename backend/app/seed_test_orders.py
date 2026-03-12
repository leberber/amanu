# backend/app/seed_test_orders.py
"""
Seed script for test orders.
Creates pending orders for test customers in Ouadhia region.
"""
import logging
import random
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from app.database import engine
from app.models.user import User, UserRole
from app.models.product import Product
from app.models.order import Order, OrderItem, OrderStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test customer emails (from seed_test_users.py)
TEST_CUSTOMER_EMAILS = [
    # Original customers
    "client1@test.com",   # Amina Khelifa - Ouadhia
    "client2@test.com",   # Mohamed Boudiaf - Agouni Gueghrane
    "client3@test.com",   # Rachid Hamdi - Ouadhia
    "client4@test.com",   # Salima Benzerga - Ouadhia
    "client5@test.com",   # Nadir Bensalem - Agouni Gueghrane
    "client6@test.com",   # Karima Ait Ahmed - Agouni Gueghrane
    "client7@test.com",   # Yassine Meziane - Ait Bouadou
    "client8@test.com",   # Sofiane Brahimi - Ait Bouadou
    "client9@test.com",   # Djamila Haddad - Tizi N'Tlata
    "client10@test.com",  # Mourad Oukaci - Tizi N'Tlata
    "client11@test.com",  # Djafer Mekhtoub - Agouni Gueghrane
    # Additional customers - Ouadhia
    "client12@test.com",  # Karim Belkacem - Ouadhia
    "client13@test.com",  # Lynda Ould Ali - Ouadhia
    "client14@test.com",  # Hakim Bouzid - Ouadhia
    "client15@test.com",  # Samira Cherifi - Ouadhia
    "client16@test.com",  # Farid Ait Saadi - Ouadhia
    # Additional customers - Agouni Gueghrane
    "client17@test.com",  # Nassim Ouali - Agouni Gueghrane
    "client18@test.com",  # Malika Idir - Agouni Gueghrane
    "client19@test.com",  # Arezki Mohand - Agouni Gueghrane
    "client20@test.com",  # Zahia Belkadi - Agouni Gueghrane
    "client21@test.com",  # Toufik Hamrani - Agouni Gueghrane
    # Additional customers - Ait Bouadou
    "client22@test.com",  # Smail Kaci - Ait Bouadou
    "client23@test.com",  # Nadia Amrouche - Ait Bouadou
    "client24@test.com",  # Rabah Slimani - Ait Bouadou
    "client25@test.com",  # Farida Ait Ouali - Ait Bouadou
    "client26@test.com",  # Mouloud Ziane - Ait Bouadou
    # Additional customers - Tizi N'Tlata
    "client27@test.com",  # Lyes Boudjema - Tizi N'Tlata
    "client28@test.com",  # Sabrina Taleb - Tizi N'Tlata
    "client29@test.com",  # Ahmed Belhocine - Tizi N'Tlata
    "client30@test.com",  # Kahina Yahi - Tizi N'Tlata
    "client31@test.com",  # Djamel Saidani - Tizi N'Tlata
]

# Shipping costs by zone (in DZD)
SHIPPING_COSTS = {
    "Ouadhia": 300,
    "Agouni Gueghrane": 350,
    "Ait Bouadou": 400,
    "Tizi N'Tlata": 450,
}


def seed_test_orders():
    """Seed the database with test orders for development and testing."""
    logger.info("Starting test orders seeding...")

    with Session(engine) as session:
        # Get all test customers
        customers = []
        for email in TEST_CUSTOMER_EMAILS:
            customer = session.exec(
                select(User).where(User.email == email)
            ).first()
            if customer:
                customers.append(customer)
            else:
                logger.warning(f"Customer not found: {email}")

        if not customers:
            logger.error("No test customers found. Run seed_test_users.py first.")
            return

        # Get available products
        products = session.exec(
            select(Product).where(Product.is_active == True).limit(20)
        ).all()

        if not products:
            logger.error("No products found. Please add products first.")
            return

        logger.info(f"Found {len(customers)} customers and {len(products)} products")

        created_count = 0

        # Create 1-2 orders per customer
        for customer in customers:
            num_orders = random.randint(1, 2)

            for _ in range(num_orders):
                # Select 2-5 random products for the order
                num_items = random.randint(2, min(5, len(products)))
                order_products = random.sample(list(products), num_items)

                # Calculate order totals
                subtotal = 0
                order_items_data = []

                for product in order_products:
                    quantity = random.randint(1, 10)
                    item_total = product.price * quantity
                    subtotal += item_total

                    order_items_data.append({
                        "product": product,
                        "quantity": quantity,
                        "unit_price": product.price,
                    })

                # Get shipping cost based on commune
                shipping_cost = SHIPPING_COSTS.get(customer.commune, 350)
                total_amount = subtotal + shipping_cost

                # Create order with random created_at in the last 3 days
                hours_ago = random.randint(1, 72)
                created_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

                order = Order(
                    user_id=customer.id,
                    status=OrderStatus.CONFIRMED,
                    shipping_address=customer.address or f"{customer.commune}, Ouadhia",
                    contact_phone=customer.phone or "0555000000",
                    subtotal=subtotal,
                    total_amount=total_amount,
                    shipping_cost=shipping_cost,
                    created_at=created_at,
                )

                session.add(order)
                session.flush()  # Get order ID

                # Create order items
                for item_data in order_items_data:
                    product = item_data["product"]
                    order_item = OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        quantity=item_data["quantity"],
                        unit_price=item_data["unit_price"],
                        product_name=product.name,
                        product_unit=product.unit.value if hasattr(product.unit, 'value') else str(product.unit),
                        pieces_per_box=product.pieces_per_box,
                    )
                    session.add(order_item)

                created_count += 1
                logger.info(f"Created order #{order.id} for {customer.full_name} ({customer.commune}) - {len(order_items_data)} items, {total_amount} DZD")

        session.commit()

    logger.info(f"Test orders seeding completed! Created: {created_count} orders")

    # Print summary
    print("\n" + "="*60)
    print("TEST ORDERS CREATED")
    print("="*60)
    print(f"Total orders: {created_count}")
    print("-"*60)
    print("Orders distributed across communes (31 customers):")
    print("  - Ouadhia Centre: ~16-32 orders (8 customers)")
    print("  - Agouni Gueghrane: ~18-36 orders (9 customers)")
    print("  - Ait Bouadou: ~14-28 orders (7 customers)")
    print("  - Tizi N'Tlata: ~14-28 orders (7 customers)")
    print("\nAll orders are in CONFIRMED status for batching testing.")
    print("="*60 + "\n")


def delete_test_orders():
    """Delete all test orders (for cleanup)."""
    logger.info("Deleting test orders...")

    with Session(engine) as session:
        # Get test customer IDs
        customer_ids = []
        for email in TEST_CUSTOMER_EMAILS:
            customer = session.exec(
                select(User).where(User.email == email)
            ).first()
            if customer:
                customer_ids.append(customer.id)

        if not customer_ids:
            logger.warning("No test customers found.")
            return

        # Delete orders for test customers
        orders = session.exec(
            select(Order).where(Order.user_id.in_(customer_ids))
        ).all()

        for order in orders:
            session.delete(order)
            logger.info(f"Deleted order #{order.id}")

        session.commit()

    logger.info("Test orders deletion completed!")


if __name__ == "__main__":
    seed_test_orders()
