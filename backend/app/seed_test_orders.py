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
    # Zone A - Agouni Gueghrane (9 stores)
    "djafer.mekhtoub@test.com",
    "mesrouk.malik@test.com",
    "assam.moumouh@test.com",
    "amar.bota@test.com",
    "djafer.mekhtoub2@test.com",
    "melaz.nourdine@test.com",
    "menad@test.com",
    "bedrane.amirouche@test.com",
    "moukah@test.com",
    # Zone B - Ouadhia Centre (20 stores)
    "hopital@test.com",
    "client.ouadhia1@test.com",
    "ali.ouremdhane@test.com",
    "superette.juba@test.com",
    "client.ouadhia2@test.com",
    "client.ouadhia3@test.com",
    "client.ouadhia4@test.com",
    "client.ouadhia5@test.com",
    "client.ouadhia6@test.com",
    "metarfi@test.com",
    "superette.azem@test.com",
    "arret.tizi@test.com",
    "client.ouadhia7@test.com",
    "client.ouadhia8@test.com",
    "client.ouadhia9@test.com",
    "client.ouadhia10@test.com",
    "client.ouadhia11@test.com",
    "client.ouadhia12@test.com",
    "client.ouadhia13@test.com",
    "client.ouadhia14@test.com",
    # Zone C - Tizi N'Tlata (7 stores)
    "client.tizintlata1@test.com",
    "client.tizintlata2@test.com",
    "client.tizintlata3@test.com",
    "client.tizintlata4@test.com",
    "client.tizintlata5@test.com",
    "client.tizintlata6@test.com",
    "client.tizintlata7@test.com",
    # Zone D - Ait Bouadou (8 stores)
    "client.aitbouadou1@test.com",
    "client.aitbouadou2@test.com",
    "client.aitbouadou3@test.com",
    "client.aitbouadou4@test.com",
    "client.aitbouadou5@test.com",
    "client.aitbouadou6@test.com",
    "client.aitbouadou7@test.com",
    "client.aitbouadou8@test.com",
    # Zone E - Ait Malem (3 stores)
    "client.aitmalem1@test.com",
    "client.aitmalem2@test.com",
    "client.aitmalem3@test.com",
    # Zone F - Ait Khelfa (10 stores)
    "client.aitkhelfa1@test.com",
    "client.aitkhelfa2@test.com",
    "client.aitkhelfa3@test.com",
    "client.aitkhelfa4@test.com",
    "client.aitkhelfa5@test.com",
    "client.aitkhelfa6@test.com",
    "client.aitkhelfa7@test.com",
    "client.aitkhelfa8@test.com",
    "client.aitkhelfa9@test.com",
    "client.aitkhelfa10@test.com",
]

# Shipping costs by zone (in DZD)
SHIPPING_COSTS = {
    "Ouadhia": 300,
    "Agouni Gueghrane": 350,
    "Tizi N'Tlata": 400,
    "Ait Bouadou": 450,
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

        # Create 1 order per customer
        for customer in customers:
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
    print(f"Total orders: {created_count} (1 per customer)")
    print("-"*60)
    print("Orders distributed across 6 zones (57 stores):")
    print("  - Zone A (Agouni Gueghrane): 9 orders")
    print("  - Zone B (Ouadhia Centre): 20 orders")
    print("  - Zone C (Tizi N'Tlata): 7 orders")
    print("  - Zone D (Ait Bouadou): 8 orders")
    print("  - Zone E (Ait Malem): 3 orders")
    print("  - Zone F (Ait Khelfa): 10 orders")
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
