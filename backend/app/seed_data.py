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
    # ==================== FRUITS ====================
    
    # Apples
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
        "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [20, 50, 100]}
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
        "quantity_config": {"type": "range", "min": 5, "max": 150, "step": 5, "pills": [15, 40, 75]}
    },
    
    # Bananas
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
        "quantity_config": {"type": "list", "quantities": [6, 12, 18, 24, 30, 50, 100], "pills": [12, 24, 50]}
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
        "quantity_config": {"type": "list", "quantities": [6, 12, 18, 24, 30, 50, 100], "pills": [12, 24, 50]}
    },
    
    # Oranges
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
        "quantity_config": {"type": "range", "min": 10, "max": 200, "step": 10, "pills": [30, 60, 100]}
    },
    {
        "name": "Maltaise Oranges",
        "description": "Premium Maltaise oranges, sweet and seedless. A premium Algerian variety.",
        "name_translations": {
            "en": "Maltaise Oranges",
            "fr": "Oranges Maltaises",
            "ar": "برتقال مالطي"
        },
        "description_translations": {
            "en": "Premium Maltaise oranges, sweet and seedless. A premium Algerian variety.",
            "fr": "Oranges maltaises premium, douces et sans pépins. Une variété algérienne premium.",
            "ar": "برتقال مالطي ممتاز، حلو وبدون بذور. صنف جزائري ممتاز."
        },
        "price": 4.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [20, 50, 80]}
    },
    {
        "name": "Thomson Oranges",
        "description": "Thomson oranges with excellent flavor and juice content.",
        "name_translations": {
            "en": "Thomson Oranges",
            "fr": "Oranges Thomson",
            "ar": "برتقال تومسون"
        },
        "description_translations": {
            "en": "Thomson oranges with excellent flavor and juice content.",
            "fr": "Oranges Thomson avec une excellente saveur et teneur en jus.",
            "ar": "برتقال تومسون بنكهة ممتازة ومحتوى عصير عالي."
        },
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 70,
        "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomson-oranges.webp",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [25, 50, 100]}
    },
    {
        "name": "Washington Navel Oranges",
        "description": "Washington Navel oranges, easy to peel and perfect for fresh eating.",
        "name_translations": {
            "en": "Washington Navel Oranges",
            "fr": "Oranges Washington Navel",
            "ar": "برتقال واشنطن نافيل"
        },
        "description_translations": {
            "en": "Washington Navel oranges, easy to peel and perfect for fresh eating.",
            "fr": "Oranges Washington Navel, faciles à éplucher et parfaites pour manger fraîches.",
            "ar": "برتقال واشنطن نافيل، سهل التقشير ومثالي للأكل الطازج."
        },
        "price": 4.29,
        "unit": ProductUnit.KG,
        "stock_quantity": 65,
        "image_url": "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [20, 40, 80]}
    },
    
    # Mandarins and Clementines
    {
        "name": "Mandarins",
        "description": "Sweet and easy-to-peel mandarins. Perfect for snacking.",
        "name_translations": {
            "en": "Mandarins",
            "fr": "Mandarines",
            "ar": "مندرين"
        },
        "description_translations": {
            "en": "Sweet and easy-to-peel mandarins. Perfect for snacking.",
            "fr": "Mandarines sucrées et faciles à éplucher. Parfaites pour les collations.",
            "ar": "مندرين حلو وسهل التقشير. مثالي للوجبات الخفيفة."
        },
        "price": 3.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 90,
        "image_url": "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [20, 50, 80]}
    },
    {
        "name": "Clementines",
        "description": "Seedless clementines, sweet and juicy. A favorite citrus fruit.",
        "name_translations": {
            "en": "Clementines",
            "fr": "Clémentines",
            "ar": "كليمنتين"
        },
        "description_translations": {
            "en": "Seedless clementines, sweet and juicy. A favorite citrus fruit.",
            "fr": "Clémentines sans pépins, sucrées et juteuses. Un agrume favori.",
            "ar": "كليمنتين بدون بذور، حلو وعصير. فاكهة حمضيات مفضلة."
        },
        "price": 3.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 85,
        "image_url": "https://images.unsplash.com/photo-1603569283847-aa295f0d016a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [20, 50, 80]}
    },
    
    # Lemons
    {
        "name": "Lemons",
        "description": "Fresh lemons with a tart flavor. Perfect for cooking and drinks.",
        "name_translations": {
            "en": "Lemons",
            "fr": "Citrons",
            "ar": "ليمون"
        },
        "description_translations": {
            "en": "Fresh lemons with a tart flavor. Perfect for cooking and drinks.",
            "fr": "Citrons frais avec une saveur acidulée. Parfaits pour la cuisine et les boissons.",
            "ar": "ليمون طازج بنكهة حامضة. مثالي للطبخ والمشروبات."
        },
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Grapefruits
    {
        "name": "Grapefruits",
        "description": "Tangy and refreshing grapefruits. Rich in vitamin C and antioxidants.",
        "name_translations": {
            "en": "Grapefruits",
            "fr": "Pamplemousses",
            "ar": "جريب فروت"
        },
        "description_translations": {
            "en": "Tangy and refreshing grapefruits. Rich in vitamin C and antioxidants.",
            "fr": "Pamplemousses acidulés et rafraîchissants. Riches en vitamine C et antioxydants.",
            "ar": "جريب فروت منعش وحامض. غني بفيتامين سي ومضادات الأكسدة."
        },
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 55,
        "image_url": "https://images.unsplash.com/photo-1570716991108-c0881f10f704?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 10, "max": 100, "step": 10, "pills": [20, 40, 60]}
    },
    
    # Strawberries
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
    
    # Figs
    {
        "name": "Fresh Figs",
        "description": "Sweet fresh figs with a unique texture. Perfect for desserts or salads.",
        "name_translations": {
            "en": "Fresh Figs",
            "fr": "Figues Fraîches",
            "ar": "تين طازج"
        },
        "description_translations": {
            "en": "Sweet fresh figs with a unique texture. Perfect for desserts or salads.",
            "fr": "Figues fraîches sucrées avec une texture unique. Parfaites pour les desserts ou les salades.",
            "ar": "تين طازج حلو بقوام فريد. مثالي للحلويات أو السلطات."
        },
        "price": 6.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 40,
        "image_url": "https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?auto=format&fit=crop&w=1469&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 5, "max": 50, "step": 5, "pills": [10, 20, 30]}
    },
    {
        "name": "Dried Figs",
        "description": "Premium dried figs, naturally sweet and nutritious.",
        "name_translations": {
            "en": "Dried Figs",
            "fr": "Figues Sèches",
            "ar": "تين مجفف"
        },
        "description_translations": {
            "en": "Premium dried figs, naturally sweet and nutritious.",
            "fr": "Figues sèches premium, naturellement sucrées et nutritives.",
            "ar": "تين مجفف ممتاز، حلو طبيعياً ومغذي."
        },
        "price": 8.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 5, "max": 50, "step": 5, "pills": [10, 20, 30]}
    },
    
    # Grapes
    {
        "name": "Grapes",
        "description": "Sweet and seedless grapes. Perfect for snacking or making juice.",
        "name_translations": {
            "en": "Grapes",
            "fr": "Raisins",
            "ar": "عنب"
        },
        "description_translations": {
            "en": "Sweet and seedless grapes. Perfect for snacking or making juice.",
            "fr": "Raisins sucrés et sans pépins. Parfaits pour les collations ou faire du jus.",
            "ar": "عنب حلو وبدون بذور. مثالي للوجبات الخفيفة أو صنع العصير."
        },
        "price": 4.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 75,
        "image_url": "https://images.unsplash.com/photo-1599819177726-f8d33de0baaf?auto=format&fit=crop&w=1471&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [15, 30, 50]}
    },
    
    # Watermelons
    {
        "name": "Watermelons",
        "description": "Sweet and refreshing watermelons. Perfect for hot summer days.",
        "name_translations": {
            "en": "Watermelons",
            "fr": "Pastèques",
            "ar": "بطيخ"
        },
        "description_translations": {
            "en": "Sweet and refreshing watermelons. Perfect for hot summer days.",
            "fr": "Pastèques sucrées et rafraîchissantes. Parfaites pour les chaudes journées d'été.",
            "ar": "بطيخ حلو ومنعش. مثالي لأيام الصيف الحارة."
        },
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 100,
        "image_url": "https://images.unsplash.com/photo-1587049352846-4a222e784169?auto=format&fit=crop&w=1480&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 50, "max": 500, "step": 50, "pills": [100, 200, 300]}
    },
    {
        "name": "Dellah Watermelons",
        "description": "Traditional Algerian Dellah watermelons, exceptionally sweet and crisp.",
        "name_translations": {
            "en": "Dellah Watermelons",
            "fr": "Pastèques Dellah",
            "ar": "بطيخ دلاح"
        },
        "description_translations": {
            "en": "Traditional Algerian Dellah watermelons, exceptionally sweet and crisp.",
            "fr": "Pastèques Dellah algériennes traditionnelles, exceptionnellement sucrées et croquantes.",
            "ar": "بطيخ دلاح جزائري تقليدي، حلو جداً ومقرمش."
        },
        "price": 2.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1587049352846-4a222e784169?auto=format&fit=crop&w=1480&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 50, "max": 500, "step": 50, "pills": [100, 200, 300]}
    },
    
    # Melons
    {
        "name": "Melons",
        "description": "Sweet and aromatic melons. A refreshing summer fruit.",
        "name_translations": {
            "en": "Melons",
            "fr": "Melons",
            "ar": "شمام"
        },
        "description_translations": {
            "en": "Sweet and aromatic melons. A refreshing summer fruit.",
            "fr": "Melons sucrés et aromatiques. Un fruit d'été rafraîchissant.",
            "ar": "شمام حلو وعطري. فاكهة صيفية منعشة."
        },
        "price": 3.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 70,
        "image_url": "https://images.unsplash.com/photo-1571575173700-afb9492e6a50?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Fruits",
        "quantity_config": {"type": "range", "min": 20, "max": 200, "step": 20, "pills": [40, 80, 120]}
    },
    
    # ==================== VEGETABLES ====================
    
    # Carrots
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
        "quantity_config": {"type": "range", "min": 0.5, "max": 5, "step": 0.5, "pills": [1, 2, 3]}
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
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Turnips
    {
        "name": "Turnips",
        "description": "Fresh turnips with a mild, slightly sweet flavor. Great for stews and soups.",
        "name_translations": {
            "en": "Turnips",
            "fr": "Navets",
            "ar": "لفت"
        },
        "description_translations": {
            "en": "Fresh turnips with a mild, slightly sweet flavor. Great for stews and soups.",
            "fr": "Navets frais avec une saveur douce et légèrement sucrée. Parfaits pour les ragoûts et les soupes.",
            "ar": "لفت طازج بنكهة خفيفة وحلوة قليلاً. رائع لليخنات والشوربات."
        },
        "price": 1.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1594806929908-e0a56d5e7c6c?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Beets
    {
        "name": "Beets",
        "description": "Fresh beets, perfect for salads and roasting. Rich in nutrients.",
        "name_translations": {
            "en": "Beets",
            "fr": "Betteraves",
            "ar": "شمندر"
        },
        "description_translations": {
            "en": "Fresh beets, perfect for salads and roasting. Rich in nutrients.",
            "fr": "Betteraves fraîches, parfaites pour les salades et la cuisson au four. Riches en nutriments.",
            "ar": "شمندر طازج، مثالي للسلطات والشواء. غني بالعناصر الغذائية."
        },
        "price": 2.29,
        "unit": ProductUnit.KG,
        "stock_quantity": 70,
        "image_url": "https://images.unsplash.com/photo-1590682680476-4eb5c2c6f75d?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Potatoes
    {
        "name": "Potatoes",
        "description": "Versatile potatoes perfect for any cooking method. A kitchen staple.",
        "name_translations": {
            "en": "Potatoes",
            "fr": "Pommes de terre",
            "ar": "بطاطا"
        },
        "description_translations": {
            "en": "Versatile potatoes perfect for any cooking method. A kitchen staple.",
            "fr": "Pommes de terre polyvalentes parfaites pour toute méthode de cuisson. Un incontournable de la cuisine.",
            "ar": "بطاطا متعددة الاستخدامات مثالية لأي طريقة طبخ. أساسية في المطبخ."
        },
        "price": 1.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 200,
        "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 10, "max": 300, "step": 10, "pills": [50, 100, 150]}
    },
    
    # Sweet Potatoes
    {
        "name": "Sweet Potatoes",
        "description": "Sweet potatoes rich in vitamins. Great for baking and roasting.",
        "name_translations": {
            "en": "Sweet Potatoes",
            "fr": "Patates douces",
            "ar": "بطاطا حلوة"
        },
        "description_translations": {
            "en": "Sweet potatoes rich in vitamins. Great for baking and roasting.",
            "fr": "Patates douces riches en vitamines. Parfaites pour la cuisson au four et le rôtissage.",
            "ar": "بطاطا حلوة غنية بالفيتامينات. رائعة للخبز والشواء."
        },
        "price": 2.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 90,
        "image_url": "https://images.unsplash.com/photo-1596097635159-c0e7c09ac1e0?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 10, "max": 150, "step": 10, "pills": [30, 60, 100]}
    },
    
    # Tomatoes
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
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 30, 50]}
    },
    
    # Bell Peppers
    {
        "name": "Bell Peppers",
        "description": "Colorful bell peppers, sweet and crunchy. Perfect for salads and cooking.",
        "name_translations": {
            "en": "Bell Peppers",
            "fr": "Poivrons",
            "ar": "فلفل حلو"
        },
        "description_translations": {
            "en": "Colorful bell peppers, sweet and crunchy. Perfect for salads and cooking.",
            "fr": "Poivrons colorés, sucrés et croquants. Parfaits pour les salades et la cuisine.",
            "ar": "فلفل حلو ملون، حلو ومقرمش. مثالي للسلطات والطبخ."
        },
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 75,
        "image_url": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 80, "step": 5, "pills": [10, 20, 40]}
    },
    
    # Eggplants
    {
        "name": "Eggplants",
        "description": "Fresh eggplants with a mild flavor. Perfect for Mediterranean dishes.",
        "name_translations": {
            "en": "Eggplants",
            "fr": "Aubergines",
            "ar": "باذنجان"
        },
        "description_translations": {
            "en": "Fresh eggplants with a mild flavor. Perfect for Mediterranean dishes.",
            "fr": "Aubergines fraîches avec une saveur douce. Parfaites pour les plats méditerranéens.",
            "ar": "باذنجان طازج بنكهة خفيفة. مثالي للأطباق المتوسطية."
        },
        "price": 2.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 65,
        "image_url": "https://images.unsplash.com/photo-1617360547704-3da8b5363369?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Zucchini
    {
        "name": "Zucchini",
        "description": "Fresh zucchini, versatile and healthy. Great for grilling and sautéing.",
        "name_translations": {
            "en": "Zucchini",
            "fr": "Courgettes",
            "ar": "كوسة"
        },
        "description_translations": {
            "en": "Fresh zucchini, versatile and healthy. Great for grilling and sautéing.",
            "fr": "Courgettes fraîches, polyvalentes et saines. Parfaites pour griller et sauter.",
            "ar": "كوسة طازجة، متعددة الاستخدامات وصحية. رائعة للشواء والقلي."
        },
        "price": 2.29,
        "unit": ProductUnit.KG,
        "stock_quantity": 85,
        "image_url": "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 30, 50]}
    },
    
    # Cucumbers
    {
        "name": "Cucumbers",
        "description": "Crisp and refreshing cucumbers. Perfect for salads and snacking.",
        "name_translations": {
            "en": "Cucumbers",
            "fr": "Concombres",
            "ar": "خيار"
        },
        "description_translations": {
            "en": "Crisp and refreshing cucumbers. Perfect for salads and snacking.",
            "fr": "Concombres croquants et rafraîchissants. Parfaits pour les salades et les collations.",
            "ar": "خيار مقرمش ومنعش. مثالي للسلطات والوجبات الخفيفة."
        },
        "price": 1.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 95,
        "image_url": "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Hot Peppers
    {
        "name": "Hot Peppers",
        "description": "Spicy hot peppers to add heat to your dishes. Use with caution!",
        "name_translations": {
            "en": "Hot Peppers",
            "fr": "Piments",
            "ar": "فلفل حار"
        },
        "description_translations": {
            "en": "Spicy hot peppers to add heat to your dishes. Use with caution!",
            "fr": "Piments épicés pour ajouter du piquant à vos plats. À utiliser avec précaution!",
            "ar": "فلفل حار لإضافة الحرارة لأطباقك. استخدم بحذر!"
        },
        "price": 4.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 45,
        "image_url": "https://images.unsplash.com/photo-1583119912267-a3a5e0abb97b?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 1, "max": 20, "step": 1, "pills": [3, 5, 10]}
    },
    
    # Spinach
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
    
    # Swiss Chard
    {
        "name": "Swiss Chard",
        "description": "Fresh Swiss chard with colorful stems. Nutritious and delicious.",
        "name_translations": {
            "en": "Swiss Chard",
            "fr": "Blettes",
            "ar": "سلق"
        },
        "description_translations": {
            "en": "Fresh Swiss chard with colorful stems. Nutritious and delicious.",
            "fr": "Blettes fraîches avec des tiges colorées. Nutritives et délicieuses.",
            "ar": "سلق طازج بسيقان ملونة. مغذي ولذيذ."
        },
        "price": 2.99,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 55,
        "image_url": "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4, 5]}
    },
    
    # Parsley
    {
        "name": "Parsley",
        "description": "Fresh parsley, a versatile herb for garnishing and cooking.",
        "name_translations": {
            "en": "Parsley",
            "fr": "Persil",
            "ar": "بقدونس"
        },
        "description_translations": {
            "en": "Fresh parsley, a versatile herb for garnishing and cooking.",
            "fr": "Persil frais, une herbe polyvalente pour garnir et cuisiner.",
            "ar": "بقدونس طازج، عشب متعدد الاستخدامات للتزيين والطبخ."
        },
        "price": 1.99,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1614883485120-c272ee2a0a97?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4, 5, 10]}
    },
    
    # Cilantro
    {
        "name": "Cilantro",
        "description": "Fresh cilantro with a distinctive flavor. Essential for many cuisines.",
        "name_translations": {
            "en": "Cilantro",
            "fr": "Coriandre",
            "ar": "كزبرة"
        },
        "description_translations": {
            "en": "Fresh cilantro with a distinctive flavor. Essential for many cuisines.",
            "fr": "Coriandre fraîche avec une saveur distinctive. Essentielle pour de nombreuses cuisines.",
            "ar": "كزبرة طازجة بنكهة مميزة. أساسية للعديد من المطابخ."
        },
        "price": 1.99,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 70,
        "image_url": "https://images.unsplash.com/photo-1599419226477-cd0d72d1ac89?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4, 5, 10]}
    },
    
    # Mint
    {
        "name": "Mint",
        "description": "Fresh mint leaves, aromatic and refreshing. Perfect for tea and cooking.",
        "name_translations": {
            "en": "Mint",
            "fr": "Menthe",
            "ar": "نعناع"
        },
        "description_translations": {
            "en": "Fresh mint leaves, aromatic and refreshing. Perfect for tea and cooking.",
            "fr": "Feuilles de menthe fraîches, aromatiques et rafraîchissantes. Parfaites pour le thé et la cuisine.",
            "ar": "أوراق نعناع طازجة، عطرية ومنعشة. مثالية للشاي والطبخ."
        },
        "price": 2.49,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4, 5]}
    },
    
    # Green Beans
    {
        "name": "Green Beans",
        "description": "Fresh green beans, crisp and tender. Great for steaming or stir-frying.",
        "name_translations": {
            "en": "Green Beans",
            "fr": "Haricots verts",
            "ar": "فاصوليا خضراء"
        },
        "description_translations": {
            "en": "Fresh green beans, crisp and tender. Great for steaming or stir-frying.",
            "fr": "Haricots verts frais, croquants et tendres. Parfaits pour la cuisson à la vapeur ou le sauté.",
            "ar": "فاصوليا خضراء طازجة، مقرمشة وطرية. رائعة للطهي بالبخار أو القلي."
        },
        "price": 3.49,
        "unit": ProductUnit.KG,
        "stock_quantity": 70,
        "image_url": "https://images.unsplash.com/photo-1568584711271-81b0ac2c63a1?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Fava Beans
    {
        "name": "Fava Beans",
        "description": "Fresh fava beans, nutritious and versatile. Great for traditional dishes.",
        "name_translations": {
            "en": "Fava Beans",
            "fr": "Fèves",
            "ar": "فول"
        },
        "description_translations": {
            "en": "Fresh fava beans, nutritious and versatile. Great for traditional dishes.",
            "fr": "Fèves fraîches, nutritives et polyvalentes. Parfaites pour les plats traditionnels.",
            "ar": "فول طازج، مغذي ومتعدد الاستخدامات. رائع للأطباق التقليدية."
        },
        "price": 3.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 60,
        "image_url": "https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
    },
    
    # Onions
    {
        "name": "Onions",
        "description": "Fresh onions, a kitchen essential. Perfect for any savory dish.",
        "name_translations": {
            "en": "Onions",
            "fr": "Oignons",
            "ar": "بصل"
        },
        "description_translations": {
            "en": "Fresh onions, a kitchen essential. Perfect for any savory dish.",
            "fr": "Oignons frais, un incontournable de la cuisine. Parfaits pour tout plat salé.",
            "ar": "بصل طازج، أساسي في المطبخ. مثالي لأي طبق مالح."
        },
        "price": 1.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 150,
        "image_url": "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 10, "max": 200, "step": 10, "pills": [30, 60, 100]}
    },
    
    # Garlic
    {
        "name": "Garlic",
        "description": "Fresh garlic bulbs with a strong flavor. Essential for cooking.",
        "name_translations": {
            "en": "Garlic",
            "fr": "Ail",
            "ar": "ثوم"
        },
        "description_translations": {
            "en": "Fresh garlic bulbs with a strong flavor. Essential for cooking.",
            "fr": "Bulbes d'ail frais avec une saveur forte. Essentiel pour la cuisine.",
            "ar": "فصوص ثوم طازجة بنكهة قوية. أساسي للطبخ."
        },
        "price": 4.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 80,
        "image_url": "https://images.unsplash.com/photo-1588518308106-0f08879333c5?auto=format&fit=crop&w=1374&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 2, "max": 50, "step": 2, "pills": [5, 10, 20]}
    },
    
    # Artichokes
    {
        "name": "Artichokes",
        "description": "Fresh artichokes with tender hearts. A Mediterranean delicacy.",
        "name_translations": {
            "en": "Artichokes",
            "fr": "Artichauts",
            "ar": "خرشوف"
        },
        "description_translations": {
            "en": "Fresh artichokes with tender hearts. A Mediterranean delicacy.",
            "fr": "Artichauts frais avec des cœurs tendres. Une délicatesse méditerranéenne.",
            "ar": "خرشوف طازج بقلوب طرية. طعام شهي متوسطي."
        },
        "price": 5.99,
        "unit": ProductUnit.KG,
        "stock_quantity": 40,
        "image_url": "https://images.unsplash.com/photo-1559737623-a5f6c6c0b6a4?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 50, "step": 5, "pills": [10, 20, 30]}
    },
    
    # Fennel
    {
        "name": "Fennel",
        "description": "Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.",
        "name_translations": {
            "en": "Fennel",
            "fr": "Fenouil",
            "ar": "شمر"
        },
        "description_translations": {
            "en": "Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.",
            "fr": "Bulbes de fenouil frais avec une douce saveur d'anis. Parfaits crus ou cuits.",
            "ar": "بصيلات شمر طازجة بنكهة يانسون خفيفة. رائع نيئ أو مطبوخ."
        },
        "price": 3.79,
        "unit": ProductUnit.KG,
        "stock_quantity": 50,
        "image_url": "https://images.unsplash.com/photo-1588182728923-19d73b5a4194?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "range", "min": 5, "max": 80, "step": 5, "pills": [10, 20, 40]}
    },
    
    # Celery
    {
        "name": "Celery",
        "description": "Fresh celery stalks, crisp and refreshing. Perfect for snacking or cooking.",
        "name_translations": {
            "en": "Celery",
            "fr": "Céleri",
            "ar": "كرفس"
        },
        "description_translations": {
            "en": "Fresh celery stalks, crisp and refreshing. Perfect for snacking or cooking.",
            "fr": "Branches de céleri fraîches, croquantes et rafraîchissantes. Parfaites pour les collations ou la cuisine.",
            "ar": "سيقان كرفس طازجة، مقرمشة ومنعشة. مثالية للوجبات الخفيفة أو الطبخ."
        },
        "price": 2.49,
        "unit": ProductUnit.BUNCH,
        "stock_quantity": 65,
        "image_url": "https://images.unsplash.com/photo-1572528628938-c4d80b6e7e0a?auto=format&fit=crop&w=1470&q=80",
        "is_organic": False,
        "category_name": "Fresh Vegetables",
        "quantity_config": {"type": "list", "quantities": [1, 2, 3, 4, 5]}
    },
    
    # Broccoli
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
        "quantity_config": {"type": "range", "min": 5, "max": 150, "step": 5, "pills": [15, 30, 60]}
    },
    
    # Organic Kale
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
        "quantity_config": {"type": "list", "quantities": [5, 10, 15, 20, 30, 50, 100], "pills": [10, 30, 50]}
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