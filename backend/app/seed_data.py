import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.category import Category
from app.models.product import Product, ProductUnit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample data
CATEGORIES = [
    {
        "name": "Fresh Fruits",
        "description": "Fresh and seasonal fruits",
        "image_url": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80"
    },
    {
        "name": "Fresh Vegetables",
        "description": "Fresh and seasonal vegetables",
        "image_url": "https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80"
    },
    {
        "name": "Organic Produce",
        "description": "Certified organic fruits and vegetables",
        "image_url": "https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80"
    }
]

PRODUCTS = [
    # Fruits
    {
        "name": "Apples",
        "description": "Fresh, crisp red apples. Great for snacking, baking, or cooking.",
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits"
    },
    {
        "name": "Organic Apples",
        "description": "Organically grown apples. No pesticides or chemicals.",
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce"
    },
    {
        "name": "Bananas",
        "description": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.",
        "price": 1.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 150,
        "image_url": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=1480&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits"
    },
    {
        "name": "Organic Bananas",
        "description": "Organically grown bananas without any chemicals.",
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 75,
        "image_url": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=1480&q=80",
        "is_organic": True,
        "category_name": "Organic Produce"
    },
    {
        "name": "Oranges",
        "description": "Juicy oranges rich in vitamin C.",
        "price": 3.29,
        "unit": ProductUnit.KG,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits"
    },
    {
        "name": "Strawberries",
        "description": "Sweet, juicy strawberries. Great for desserts or eating fresh.",
        "price": 4.99,
        "unit": ProductUnit.POUND,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1587393855524-087f83d95bc9?auto=format&fit=crop&w=1460&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits"
    },
    
    # Vegetables
    {
        "name": "Carrots",
        "description": "Fresh carrots rich in beta-carotene.",
        "price": 1.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 120,
        "image_url": "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables"
    },
    {
        "name": "Organic Carrots",
        "description": "Organically grown carrots without pesticides.",
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce"
    },
    {
        "name": "Tomatoes",
        "description": "Fresh, ripe tomatoes. Perfect for salads and cooking.",
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables"
    },
    {
        "name": "Spinach",
        "description": "Fresh spinach leaves rich in iron and vitamins.",
        "price": 3.49,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1442&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables"
    },
    {
        "name": "Broccoli",
        "description": "Fresh broccoli, packed with nutrients and antioxidants.",
        "price": 2.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 65,
        "image_url": "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables"
    },
    {
        "name": "Organic Kale",
        "description": "Organic kale, a superfood packed with vitamins and minerals.",
        "price": 3.99,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 40,
        "image_url": "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce"
    }
]

def seed_data():
    """Seed the database with initial data"""
    logger.info("Starting database seeding...")
    
    with Session(engine) as session:
        # Seed categories
        for category_data in CATEGORIES:
            # Check if category already exists
            category = session.exec(
                select(Category).where(Category.name == category_data["name"])
            ).first()
            
            if not category:
                category = Category(**category_data)
                session.add(category)
                logger.info(f"Added category: {category_data['name']}")
        
        # Commit categories first to ensure they exist before adding products
        session.commit()
        
        # Seed products
        for product_data in PRODUCTS:
            # Get category ID
            category_name = product_data.pop("category_name")
            category = session.exec(
                select(Category).where(Category.name == category_name)
            ).first()
            
            if not category:
                logger.warning(f"Category '{category_name}' not found, skipping product: {product_data['name']}")
                continue
            
            # Check if product already exists
            product = session.exec(
                select(Product).where(Product.name == product_data["name"])
            ).first()
            
            if not product:
                product = Product(**product_data, category_id=category.id)
                session.add(product)
                logger.info(f"Added product: {product_data['name']}")
        
        session.commit()
    
    logger.info("Database seeding completed!")

if __name__ == "__main__":
    seed_data()