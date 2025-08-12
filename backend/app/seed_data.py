# backend/app/seed_data.py
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.category import Category
from app.models.product import Product, ProductUnit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample data with translations
CATEGORIES = [
    {
        "name": "Fresh Fruits",
        "description": "Fresh and seasonal fruits",
        "image_url": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80",
        "name_translations": {
            "en": "Fresh Fruits",
            "fr": "Fruits Frais", 
            "ar": "فواكه طازجة"
        },
        "description_translations": {
            "en": "Fresh and seasonal fruits",
            "fr": "Fruits frais et de saison",
            "ar": "فواكه طازجة وموسمية"
        }
    },
    {
        "name": "Fresh Vegetables",
        "description": "Fresh and seasonal vegetables",
        "image_url": "https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80",
        "name_translations": {
            "en": "Fresh Vegetables",
            "fr": "Légumes Frais",
            "ar": "خضروات طازجة"
        },
        "description_translations": {
            "en": "Fresh and seasonal vegetables",
            "fr": "Légumes frais et de saison",
            "ar": "خضروات طازجة وموسمية"
        }
    },
    {
        "name": "Organic Produce",
        "description": "Certified organic fruits and vegetables",
        "image_url": "https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80",
        "name_translations": {
            "en": "Organic Produce",
            "fr": "Produits Bio",
            "ar": "منتجات عضوية"
        },
        "description_translations": {
            "en": "Certified organic fruits and vegetables",
            "fr": "Fruits et légumes bio certifiés",
            "ar": "فواكه وخضروات عضوية معتمدة"
        }
    }
]

PRODUCTS = [
    # Fruits
    {
        "name": "Apples",
        "description": "Fresh, crisp red apples. Great for snacking, baking, or cooking.",
        "name_translations": {
            "en": "Apples",
            "fr": "Pommes",
            "ar": "تفاح"
        },
        "description_translations": {
            "en": "Fresh, crisp red apples. Great for snacking, baking, or cooking.",
            "fr": "Pommes rouges fraîches et croquantes. Parfaites pour les collations, la pâtisserie ou la cuisine.",
            "ar": "تفاح أحمر طازج ومقرمش. مثالي للوجبات الخفيفة أو الطبخ أو الخبز."
        },
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 0.5, "max": 10}
    },
    {
        "name": "Organic Apples",
        "description": "Organically grown apples. No pesticides or chemicals.",
        "name_translations": {
            "en": "Organic Apples",
            "fr": "Pommes Bio",
            "ar": "تفاح عضوي"
        },
        "description_translations": {
            "en": "Organically grown apples. No pesticides or chemicals.",
            "fr": "Pommes cultivées biologiquement. Sans pesticides ni produits chimiques.",
            "ar": "تفاح مزروع عضوياً. بدون مبيدات حشرية أو مواد كيميائية."
        },
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce",
        "quantity_config": {"type": "range", "min": 0.5, "max": 10}
    },
    {
        "name": "Bananas",
        "description": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.",
        "name_translations": {
            "en": "Bananas",
            "fr": "Bananes",
            "ar": "موز"
        },
        "description_translations": {
            "en": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.",
            "fr": "Bananes sucrées et nutritives. Parfaites pour les smoothies ou une collation rapide.",
            "ar": "موز حلو ومغذي. مثالي للعصائر أو الوجبات الخفيفة السريعة."
        },
        "price": 1.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 150,
        "image_url": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=1480&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "list", "quantities": [6, 12, 18, 24]}
    },
    {
        "name": "Organic Bananas",
        "description": "Organically grown bananas without any chemicals.",
        "name_translations": {
            "en": "Organic Bananas",
            "fr": "Bananes Bio",
            "ar": "موز عضوي"
        },
        "description_translations": {
            "en": "Organically grown bananas without any chemicals.",
            "fr": "Bananes cultivées biologiquement sans produits chimiques.",
            "ar": "موز مزروع عضوياً بدون أي مواد كيميائية."
        },
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 75,
        "image_url": "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=1480&q=80",
        "is_organic": True,
        "category_name": "Organic Produce",
        "quantity_config": {"type": "list", "quantities": [6, 12, 18, 24]}
    },
    {
        "name": "Oranges",
        "description": "Juicy oranges rich in vitamin C.",
        "name_translations": {
            "en": "Oranges",
            "fr": "Oranges",
            "ar": "برتقال"
        },
        "description_translations": {
            "en": "Juicy oranges rich in vitamin C.",
            "fr": "Oranges juteuses riches en vitamine C.",
            "ar": "برتقال عصير غني بفيتامين سي."
        },
        "price": 3.29,
        "unit": ProductUnit.KG,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 1, "max": 20}
    },
    {
        "name": "Strawberries",
        "description": "Sweet, juicy strawberries. Great for desserts or eating fresh.",
        "name_translations": {
            "en": "Strawberries",
            "fr": "Fraises",
            "ar": "فراولة"
        },
        "description_translations": {
            "en": "Sweet, juicy strawberries. Great for desserts or eating fresh.",
            "fr": "Fraises sucrées et juteuses. Parfaites pour les desserts ou à manger fraîches.",
            "ar": "فراولة حلوة وعصيرة. رائعة للحلويات أو تؤكل طازجة."
        },
        "price": 4.99,
        "unit": ProductUnit.POUND,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1587393855524-087f83d95bc9?auto=format&fit=crop&w=1460&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "list", "quantities": [250, 500, 1000]}
    },
    
    # Vegetables
    {
        "name": "Carrots",
        "description": "Fresh carrots rich in beta-carotene.",
        "name_translations": {
            "en": "Carrots",
            "fr": "Carottes",
            "ar": "جزر"
        },
        "description_translations": {
            "en": "Fresh carrots rich in beta-carotene.",
            "fr": "Carottes fraîches riches en bêta-carotène.",
            "ar": "جزر طازج غني بالبيتا كاروتين."
        },
        "price": 1.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 120,
        "image_url": "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 0.5, "max": 5}
    },
    {
        "name": "Organic Carrots",
        "description": "Organically grown carrots without pesticides.",
        "name_translations": {
            "en": "Organic Carrots",
            "fr": "Carottes Bio",
            "ar": "جزر عضوي"
        },
        "description_translations": {
            "en": "Organically grown carrots without pesticides.",
            "fr": "Carottes cultivées biologiquement sans pesticides.",
            "ar": "جزر مزروع عضوياً بدون مبيدات حشرية."
        },
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1590868309235-ea34bed7bd7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce",
        "quantity_config": {"type": "range", "min": 0.5, "max": 5}
    },
    {
        "name": "Tomatoes",
        "description": "Fresh, ripe tomatoes. Perfect for salads and cooking.",
        "name_translations": {
            "en": "Tomatoes",
            "fr": "Tomates",
            "ar": "طماطم"
        },
        "description_translations": {
            "en": "Fresh, ripe tomatoes. Perfect for salads and cooking.",
            "fr": "Tomates fraîches et mûres. Parfaites pour les salades et la cuisine.",
            "ar": "طماطم طازجة وناضجة. مثالية للسلطات والطبخ."
        },
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 0.5, "max": 10}
    },
    {
        "name": "Spinach",
        "description": "Fresh spinach leaves rich in iron and vitamins.",
        "name_translations": {
            "en": "Spinach",
            "fr": "Épinards",
            "ar": "سبانخ"
        },
        "description_translations": {
            "en": "Fresh spinach leaves rich in iron and vitamins.",
            "fr": "Feuilles d'épinards fraîches riches en fer et en vitamines.",
            "ar": "أوراق سبانخ طازجة غنية بالحديد والفيتامينات."
        },
        "price": 3.49,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=1442&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4]}
    },
    {
        "name": "Broccoli",
        "description": "Fresh broccoli, packed with nutrients and antioxidants.",
        "name_translations": {
            "en": "Broccoli",
            "fr": "Brocoli",
            "ar": "بروكلي"
        },
        "description_translations": {
            "en": "Fresh broccoli, packed with nutrients and antioxidants.",
            "fr": "Brocoli frais, riche en nutriments et antioxydants.",
            "ar": "بروكلي طازج، مليء بالعناصر الغذائية ومضادات الأكسدة."
        },
        "price": 2.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 65,
        "image_url": "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 0.5, "max": 3}
    },
    {
        "name": "Organic Kale",
        "description": "Organic kale, a superfood packed with vitamins and minerals.",
        "name_translations": {
            "en": "Organic Kale",
            "fr": "Chou Frisé Bio",
            "ar": "كيل عضوي"
        },
        "description_translations": {
            "en": "Organic kale, a superfood packed with vitamins and minerals.",
            "fr": "Chou frisé bio, un super-aliment riche en vitamines et minéraux.",
            "ar": "كيل عضوي، طعام فائق مليء بالفيتامينات والمعادن."
        },
        "price": 3.99,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 40,
        "image_url": "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80",
        "is_organic": True,
        "category_name": "Organic Produce",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3]}
    }
]

def seed_data():
    """Seed the database with initial data including translations"""
    logger.info("Starting database seeding with translations...")
    
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
    
    logger.info("Database seeding with translations completed!")

if __name__ == "__main__":
    seed_data()