# backend/app/seed_data.py
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models.category import Category
from app.models.brand import Brand
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

# Brand data with translations
BRANDS = [
    {
        "name": "Cevital",
        "description": "Leading Algerian agro-food company",
        "name_translations": {
            "en": "Cevital",
            "fr": "Cevital",
            "ar": "سيفيتال"
        },
        "description_translations": {
            "en": "Leading Algerian agro-food company",
            "fr": "Entreprise agroalimentaire algérienne leader",
            "ar": "شركة جزائرية رائدة في الصناعات الغذائية"
        }
    },
    {
        "name": "Izdihar",
        "description": "Quality food products brand",
        "name_translations": {
            "en": "Izdihar",
            "fr": "Izdihar",
            "ar": "ازدهار"
        },
        "description_translations": {
            "en": "Quality food products brand",
            "fr": "Marque de produits alimentaires de qualité",
            "ar": "علامة تجارية لمنتجات غذائية عالية الجودة"
        }
    },
    {
        "name": "La Belle",
        "description": "Premium food products",
        "name_translations": {
            "en": "La Belle",
            "fr": "La Belle",
            "ar": "لابيل"
        },
        "description_translations": {
            "en": "Premium food products",
            "fr": "Produits alimentaires haut de gamme",
            "ar": "منتجات غذائية فاخرة"
        }
    },
    {
        "name": "Sim",
        "description": "Trusted food brand",
        "name_translations": {
            "en": "Sim",
            "fr": "Sim",
            "ar": "سيم"
        },
        "description_translations": {
            "en": "Trusted food brand",
            "fr": "Marque alimentaire de confiance",
            "ar": "علامة تجارية غذائية موثوقة"
        }
    }
]


PRODUCTS = []
#     # ==================== FRUITS ====================

#     # Apricots
#     {
#         "name": "Apricots",
#         "description": "Sweet, tender apricots. Great for snacking, desserts, or jams.",
#         "name_translations": {"en": "Apricots", "fr": "Abricots", "ar": "مشمش"},
#         "description_translations": {
#             "en": "Sweet, tender apricots. Great for snacking, desserts, or jams.",
#             "fr": "Abricots sucrés et tendres. Parfaits pour grignoter, les desserts ou les confitures.",
#             "ar": "مشمش حلو وطري. مثالي للوجبات الخفيفة أو الحلويات أو المربى."
#         },
#         "price": 200,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 1000,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/aprico.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Bananas
#     {
#         "name": "Bananas",
#         "description": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.",
#         "name_translations": {"en": "Bananas", "fr": "Bananes", "ar": "موز"},
#         "description_translations": {
#             "en": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.",
#             "fr": "Bananes sucrées et nutritives. Parfaites pour les smoothies ou une collation rapide.",
#             "ar": "موز حلو ومغذي. مثالي للعصائر أو وجبة خفيفة سريعة."
#         },
#         "price": 450,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 1000,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/banane.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "list", "quantities": [6, 12, 18, 24, 30, 50, 100], "pills": [12, 24, 50]}
#     },

#     # Clementines
#     {
#         "name": "Clementines",
#         "description": "Seedless clementines, sweet and juicy. Perfect for snacking.",
#         "name_translations": {"en": "Clementines", "fr": "Clémentines", "ar": "كليمنتين"},
#         "description_translations": {
#             "en": "Seedless clementines, sweet and juicy. Perfect for snacking.",
#             "fr": "Clémentines sans pépins, sucrées et juteuses. Parfaites pour les collations.",
#             "ar": "كليمنتين بدون بذور، حلو وعصير. مثالي للوجبات الخفيفة."
#         },
#         "price": 170,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 1000,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/climentine.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 10, "max": 1000, "step": 10, "pills": [20, 50, 100]}
#     },

#     # Dates
#     {
#         "name": "Dates",
#         "description": "Naturally sweet dates. Great for energy snacks and desserts.",
#         "name_translations": {"en": "Dates", "fr": "Dattes", "ar": "تمر"},
#         "description_translations": {
#             "en": "Naturally sweet dates. Great for energy snacks and desserts.",
#             "fr": "Dattes naturellement sucrées. Parfaites pour les collations énergétiques et les desserts.",
#             "ar": "تمر حلو طبيعي. رائع للوجبات الخفيفة والطاقة والحلويات."
#         },
#         "price": 35,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 400,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/date.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 400, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Yellow Lemons
#     {
#         "name": "Yellow Lemons",
#         "description": "Fresh yellow lemons with a tart flavor. Perfect for cooking and drinks.",
#         "name_translations": {"en": "Yellow Lemons", "fr": "Citrons jaunes", "ar": "ليمون أصفر"},
#         "description_translations": {
#             "en": "Fresh yellow lemons with a tart flavor. Perfect for cooking and drinks.",
#             "fr": "Citrons jaunes frais avec une saveur acidulée. Parfaits pour la cuisine et les boissons.",
#             "ar": "ليمون أصفر طازج بنكهة حامضة. مثالي للطبخ والمشروبات."
#         },
#         "price": 220,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/citron-jaune.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Nectarines
#     {
#         "name": "Nectarines",
#         "description": "Juicy nectarines with a smooth skin. Great fresh or in desserts.",
#         "name_translations": {"en": "Nectarines", "fr": "Nectarines", "ar": "نكتارين"},
#         "description_translations": {
#             "en": "Juicy nectarines with a smooth skin. Great fresh or in desserts.",
#             "fr": "Nectarines juteuses à peau lisse. Excellentes fraîches ou en dessert.",
#             "ar": "نكتارين عصير بقشرة ناعمة. ممتاز طازجاً أو في الحلويات."
#         },
#         "price": 600,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/nictarine.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Oranges
#     {
#         "name": "Oranges",
#         "description": "Juicy oranges rich in vitamin C. Great for fresh juice or snacking.",
#         "name_translations": {"en": "Oranges", "fr": "Oranges", "ar": "برتقال"},
#         "description_translations": {
#             "en": "Juicy oranges rich in vitamin C. Great for fresh juice or snacking.",
#             "fr": "Oranges juteuses riches en vitamine C. Parfaites en jus ou à grignoter.",
#             "ar": "برتقال عصير غني بفيتامين سي. رائع للعصير أو الوجبات الخفيفة."
#         },
#         "price": 100,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 600,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/orange.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 10, "max": 600, "step": 10, "pills": [30, 60, 100]}
#     },

#     # Peaches
#     {
#         "name": "Peaches",
#         "description": "Sweet, fragrant peaches. Delicious fresh or in desserts.",
#         "name_translations": {"en": "Peaches", "fr": "Pêches", "ar": "خوخ"},
#         "description_translations": {
#             "en": "Sweet, fragrant peaches. Delicious fresh or in desserts.",
#             "fr": "Pêches sucrées et parfumées. Délicieuses fraîches ou en dessert.",
#             "ar": "خوخ حلو ومعطر. لذيذ طازجاً أو في الحلويات."
#         },
#         "price": 350,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 5000,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/peche.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Pears
#     {
#         "name": "Pears",
#         "description": "Sweet and juicy pears with a delicate flavor. Great for snacking.",
#         "name_translations": {"en": "Pears", "fr": "Poires", "ar": "كمثرى"},
#         "description_translations": {
#             "en": "Sweet and juicy pears with a delicate flavor. Great for snacking.",
#             "fr": "Poires sucrées et juteuses au goût délicat. Parfaites pour grignoter.",
#             "ar": "كمثرى حلوة وعصيرية بنكهة لطيفة. مثالية للوجبات الخفيفة."
#         },
#         "price": 550,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 600,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/poire.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Yellow Apples
#     {
#         "name": "Yellow Apples",
#         "description": "Crisp yellow apples with a balanced sweet flavor. Great for snacking.",
#         "name_translations": {"en": "Yellow Apples", "fr": "Pommes jaunes", "ar": "تفاح أصفر"},
#         "description_translations": {
#             "en": "Crisp yellow apples with a balanced sweet flavor. Great for snacking.",
#             "fr": "Pommes jaunes croquantes au goût sucré équilibré. Parfaites pour grignoter.",
#             "ar": "تفاح أصفر مقرمش بنكهة حلوة متوازنة. مثالي للوجبات الخفيفة."
#         },
#         "price": 420,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pomme-jaune.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [20, 50, 100]}
#     },

#     # Red Apples
#     {
#         "name": "Red Apples",
#         "description": "Fresh, crisp red apples. Great for snacking, baking, or cooking.",
#         "name_translations": {"en": "Red Apples", "fr": "Pommes rouges", "ar": "تفاح أحمر"},
#         "description_translations": {
#             "en": "Fresh, crisp red apples. Great for snacking, baking, or cooking.",
#             "fr": "Pommes rouges fraîches et croquantes. Parfaites pour les collations, la pâtisserie ou la cuisine.",
#             "ar": "تفاح أحمر طازج ومقرمش. مثالي للوجبات الخفيفة أو الطبخ أو الخبز."
#         },
#         "price": 500,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pomme-rouge.png",
#         "is_organic": False,
#         "category_name": "Fresh Fruits",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [20, 50, 100]}
#     },

#     # ==================== VEGETABLES & HERBS ====================

#     # Artichokes
#     {
#         "name": "Artichokes",
#         "description": "Fresh artichokes with tender hearts. A Mediterranean delicacy.",
#         "name_translations": {"en": "Artichokes", "fr": "Artichauts", "ar": "خرشوف"},
#         "description_translations": {
#             "en": "Fresh artichokes with tender hearts. A Mediterranean delicacy.",
#             "fr": "Artichauts frais avec des cœurs tendres. Une délicatesse méditerranéenne.",
#             "ar": "خرشوف طازج بقلوب طرية. من ألذّ أطباق البحر المتوسط."
#         },
#         "price":220,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 60,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/artichaut.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}
#     },

#     # Eggplants
#     {
#         "name": "Eggplants",
#         "description": "Fresh eggplants with a mild flavor. Perfect for grilling, roasting, and stews.",
#         "name_translations": {"en": "Eggplants", "fr": "Aubergines", "ar": "باذنجان"},
#         "description_translations": {
#             "en": "Fresh eggplants with a mild flavor. Perfect for grilling, roasting, and stews.",
#             "fr": "Aubergines fraîches au goût doux. Parfaites pour griller, rôtir et mijoter.",
#             "ar": "باذنجان طازج بنكهة خفيفة. مثالي للشواء والتحمير واليخنات."
#         },
#         "price": 180,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 90,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/aubergine.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 330, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Beets
#     {
#         "name": "Beets",
#         "description": "Fresh beets, perfect for salads and roasting. Rich in nutrients.",
#         "name_translations": {"en": "Beets", "fr": "Betteraves", "ar": "شمندر"},
#         "description_translations": {
#             "en": "Fresh beets, perfect for salads and roasting. Rich in nutrients.",
#             "fr": "Betteraves fraîches, parfaites pour les salades et au four. Riches en nutriments.",
#             "ar": "شمندر طازج، مثالي للسلطات والشواء. غني بالعناصر الغذائية."
#         },
#         "price": 70,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 80,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/betrave.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Broccoli
#     {
#         "name": "Broccoli",
#         "description": "Fresh broccoli, packed with nutrients and antioxidants.",
#         "name_translations": {"en": "Broccoli", "fr": "Brocoli", "ar": "بروكلي"},
#         "description_translations": {
#             "en": "Fresh broccoli, packed with nutrients and antioxidants.",
#             "fr": "Brocoli frais, riche en nutriments et antioxydants.",
#             "ar": "بروكلي طازج غني بالعناصر الغذائية ومضادات الأكسدة."
#         },
#         "price": 90,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/brocoli.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 250, "step": 5, "pills": [15, 30, 60]}
#     },

#     # Swiss Chard (Carde)
#     {
#         "name": "Swiss Chard",
#         "description": "Fresh swiss chard with tender leaves and stems. Great sautéed or in soups.",
#         "name_translations": {"en": "Swiss Chard", "fr": "Carde", "ar": "سلق"},
#         "description_translations": {
#             "en": "Fresh swiss chard with tender leaves and stems. Great sautéed or in soups.",
#             "fr": "Carde fraîche avec feuilles et tiges tendres. Délicieuse sautée ou en soupe.",
#             "ar": "سلق طازج بأوراق وسيقان طرية. ممتاز مقلياً أو في الشوربات."
#         },
#         "price": 110,
#         "unit": ProductUnit.BUNCH,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/carde.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "list", "quantities": [5, 10, 20, 30, 50, 100]}
#     },

#     # Carrots
#     {
#         "name": "Carrots",
#         "description": "Fresh carrots rich in beta-carotene. Great for salads, stews, and juices.",
#         "name_translations": {"en": "Carrots", "fr": "Carottes", "ar": "جزر"},
#         "description_translations": {
#             "en": "Fresh carrots rich in beta-carotene. Great for salads, stews, and juices.",
#             "fr": "Carottes fraîches riches en bêta-carotène. Parfaites pour salades, plats mijotés et jus.",
#             "ar": "جزر طازج غني بالبيتا كاروتين. رائع للسلطات واليخنات والعصائر."
#         },
#         "price": 80,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 300,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/carrote.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [5, 10, 20, 40, 80, 100]}
#     },

#     # Celery
#     {
#         "name": "Celery",
#         "description": "Crisp celery stalks. Perfect for soups, salads, and healthy snacking.",
#         "name_translations": {"en": "Celery", "fr": "Céleri", "ar": "كرفس"},
#         "description_translations": {
#             "en": "Crisp celery stalks. Perfect for soups, salads, and healthy snacking.",
#             "fr": "Branches de céleri croquantes. Parfaites pour soupes, salades et collations saines.",
#             "ar": "سيقان كرفس مقرمشة. مثالية للشوربات والسلطات والوجبات الخفيفة الصحية."
#         },
#         "price": 80,
#         "unit": ProductUnit.BUNCH,
#         "stock_quantity": 65,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/celery.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "list", "quantities": [5, 10, 20, 40, 80, 100]}
#     },

#     # Cauliflower
#     {
#         "name": "Cauliflower",
#         "description": "Fresh cauliflower, mild and versatile. Great roasted, steamed, or in gratins.",
#         "name_translations": {"en": "Cauliflower", "fr": "Chou-fleur", "ar": "قرنبيط"},
#         "description_translations": {
#             "en": "Fresh cauliflower, mild and versatile. Great roasted, steamed, or in gratins.",
#             "fr": "Chou-fleur frais, doux et polyvalent. Délicieux rôti, vapeur ou en gratin.",
#             "ar": "قرنبيط طازج بطعم خفيف ومتعدد الاستخدامات. رائع مشوياً أو مطهواً على البخار."
#         },
#         "price": 60,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/chou-fleur.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Cucumbers
#     {
#         "name": "Cucumbers",
#         "description": "Crisp and refreshing cucumbers. Perfect for salads and snacking.",
#         "name_translations": {"en": "Cucumbers", "fr": "Concombres", "ar": "خيار"},
#         "description_translations": {
#             "en": "Crisp and refreshing cucumbers. Perfect for salads and snacking.",
#             "fr": "Concombres croquants et rafraîchissants. Parfaits pour les salades et les collations.",
#             "ar": "خيار مقرمش ومنعش. مثالي للسلطات والوجبات الخفيفة."
#         },
#         "price": 90,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/concombre.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Coriander (Cilantro)
#     {
#         "name": "Coriander",
#         "description": "Fresh coriander with a bright, citrusy aroma. Perfect for garnishing and cooking.",
#         "name_translations": {"en": "Coriander", "fr": "Coriandre", "ar": "كزبرة"},
#         "description_translations": {
#             "en": "Fresh coriander with a bright, citrusy aroma. Perfect for garnishing and cooking.",
#             "fr": "Coriandre fraîche au parfum citronné. Parfaite pour garnir et cuisiner.",
#             "ar": "كزبرة طازجة برائحة منعشة. مثالية للتزيين والطبخ."
#         },
#         "price": 100,
#         "unit": ProductUnit.BUNCH,
#         "stock_quantity": 1000,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/coriandre.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "list", "quantities": [ 5, 10, 15, 20, 50, 100]}
#     },

#     # Zucchini
#     {
#         "name": "Zucchini",
#         "description": "Fresh zucchini, versatile and healthy. Great for grilling and sautéing.",
#         "name_translations": {"en": "Zucchini", "fr": "Courgettes", "ar": "كوسة"},
#         "description_translations": {
#             "en": "Fresh zucchini, versatile and healthy. Great for grilling and sautéing.",
#             "fr": "Courgettes fraîches, polyvalentes et saines. Parfaites pour griller et sauter.",
#             "ar": "كوسة طازجة متعددة الاستخدامات وصحية. رائعة للشواء والقلي."
#         },
#         "price":140,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/courgette.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Fennel
#     {
#         "name": "Fennel",
#         "description": "Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.",
#         "name_translations": {"en": "Fennel", "fr": "Fenouil", "ar": "شمر"},
#         "description_translations": {
#             "en": "Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.",
#             "fr": "Bulbes de fenouil frais avec une douce saveur d'anis. Parfaits crus ou cuits.",
#             "ar": "شمر طازج بنكهة يانسون خفيفة. رائع نيئاً أو مطبوخاً."
#         },
#         "price": 120,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 60,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/fenouille.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}
#     },

#     # Fava Beans
#     {
#         "name": "Fava Beans",
#         "description": "Fresh fava beans, nutritious and hearty. Great for stews and traditional dishes.",
#         "name_translations": {"en": "Fava Beans", "fr": "Fèves", "ar": "فول"},
#         "description_translations": {
#             "en": "Fresh fava beans, nutritious and hearty. Great for stews and traditional dishes.",
#             "fr": "Fèves fraîches, nutritives et consistantes. Parfaites pour les plats traditionnels.",
#             "ar": "فول طازج مغذي ومشبع. رائع للأطباق التقليدية واليخنات."
#         },
#         "price":110,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 70,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/feve.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Green Beans
#     {
#         "name": "Green Beans",
#         "description": "Fresh green beans, crisp and tender. Great for steaming or stir-frying.",
#         "name_translations": {"en": "Green Beans", "fr": "Haricots verts", "ar": "فاصوليا خضراء"},
#         "description_translations": {
#             "en": "Fresh green beans, crisp and tender. Great for steaming or stir-frying.",
#             "fr": "Haricots verts frais, croquants et tendres. Parfaits à la vapeur ou sautés.",
#             "ar": "فاصوليا خضراء طازجة مقرمشة وطرية. رائعة بالبخار أو التشويح."
#         },
#         "price": 240,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 70,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/haricot-vert.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Turnips
#     {
#         "name": "Turnips",
#         "description": "Fresh turnips with a mild, slightly sweet flavor. Great for soups and stews.",
#         "name_translations": {"en": "Turnips", "fr": "Navets", "ar": "لفت"},
#         "description_translations": {
#             "en": "Fresh turnips with a mild, slightly sweet flavor. Great for soups and stews.",
#             "fr": "Navets frais au goût doux et légèrement sucré. Parfaits pour soupes et ragoûts.",
#             "ar": "لفت طازج بنكهة خفيفة وحلوة قليلاً. رائع للشوربات واليخنات."
#         },
#         "price": 70,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/navet.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}
#     },

#     # Onions
#     {
#         "name": "Onions",
#         "description": "Fresh onions, a kitchen essential. Perfect for any savory dish.",
#         "name_translations": {"en": "Onions", "fr": "Oignons", "ar": "بصل"},
#         "description_translations": {
#             "en": "Fresh onions, a kitchen essential. Perfect for any savory dish.",
#             "fr": "Oignons frais, un incontournable de la cuisine. Parfaits pour tout plat salé.",
#             "ar": "بصل طازج، أساسي في المطبخ. مثالي لأي طبق مالح."
#         },
#         "price": 80,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/oignion.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 10, "max": 200, "step": 10, "pills": [30, 60, 100]}
#     },

#     # Potatoes
#     {
#         "name": "Potatoes",
#         "description": "Versatile potatoes perfect for any cooking method. A kitchen staple.",
#         "name_translations": {"en": "Potatoes", "fr": "Pommes de terre", "ar": "بطاطا"},
#         "description_translations": {
#             "en": "Versatile potatoes perfect for any cooking method. A kitchen staple.",
#             "fr": "Pommes de terre polyvalentes parfaites pour toute méthode de cuisson. Un incontournable de la cuisine.",
#             "ar": "بطاطا متعددة الاستخدامات مثالية لأي طريقة طبخ. أساسية في المطبخ."
#         },
#         "price": 55,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 200,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/potato.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 10, "max": 300, "step": 10, "pills": [50, 100, 150]}
#     },

#     # Radishes
#     {
#         "name": "Radishes",
#         "description": "Fresh radishes, crunchy and peppery. Great in salads and sandwiches.",
#         "name_translations": {"en": "Radishes", "fr": "Radis", "ar": "فجل"},
#         "description_translations": {
#             "en": "Fresh radishes, crunchy and peppery. Great in salads and sandwiches.",
#             "fr": "Radis frais, croquants et légèrement piquants. Parfaits en salade ou sandwich.",
#             "ar": "فجل طازج مقرمش وحار قليلاً. رائع في السلطات والسندويشات."
#         },
#         "price": 85,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 400,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/radis.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}
#     },

#     # Lettuce (Salad)
#     {
#         "name": "Lettuce",
#         "description": "Fresh lettuce, crisp and light. Perfect for salads and wraps.",
#         "name_translations": {"en": "Lettuce", "fr": "Salade", "ar": "خس"},
#         "description_translations": {
#             "en": "Fresh lettuce, crisp and light. Perfect for salads and wraps.",
#             "fr": "Salade fraîche, croquante et légère. Parfaite pour salades et wraps.",
#             "ar": "خس طازج ومقرمش وخفيف. مثالي للسلطات واللفائف."
#         },
#         "price": 120,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 300,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/salade.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}
#     },

#     # Tomatoes
#     {
#         "name": "Tomatoes",
#         "description": "Fresh, ripe tomatoes. Perfect for salads, sauces, and cooking.",
#         "name_translations": {"en": "Tomatoes", "fr": "Tomates", "ar": "طماطم"},
#         "description_translations": {
#             "en": "Fresh, ripe tomatoes. Perfect for salads, sauces, and cooking.",
#             "fr": "Tomates fraîches et mûres. Parfaites pour salades, sauces et cuisine.",
#             "ar": "طماطم طازجة وناضجة. مثالية للسلطات والصلصات والطبخ."
#         },
#         "price": 65,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 500,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 30, 50]}
#     },

#     # Bell Peppers
#     {
#         "name": "Bell Peppers",
#         "description": "Sweet and crunchy bell peppers. Great for salads, roasting, and cooking.",
#         "name_translations": {"en": "Bell Peppers", "fr": "Poivrons", "ar": "فلفل حلو"},
#         "description_translations": {
#             "en": "Sweet and crunchy bell peppers. Great for salads, roasting, and cooking.",
#             "fr": "Poivrons sucrés et croquants. Parfaits pour salades, rôtis et cuisine.",
#             "ar": "فلفل حلو مقرمش. رائع للسلطات والتحمير والطبخ."
#         },
#         "price": 120,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 400,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/poivron.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 20, 40]}
#     },

#     # Hot Peppers
#     {
#         "name": "Hot Peppers",
#         "description": "Spicy hot peppers to add heat to your dishes. Use a little for big flavor!",
#         "name_translations": {"en": "Hot Peppers", "fr": "Piments", "ar": "فلفل حار"},
#         "description_translations": {
#             "en": "Spicy hot peppers to add heat to your dishes. Use a little for big flavor!",
#             "fr": "Piments épicés pour relever vos plats. Une petite quantité suffit!",
#             "ar": "فلفل حار لإضافة نكهة قوية. كمية صغيرة تكفي!"
#         },
#         "price": 120,
#         "unit": ProductUnit.KG,
#         "stock_quantity": 600,
#         "image_url": "https://elsuq.s3.eu-west-3.amazonaws.com/product-images/piment.png",
#         "is_organic": False,
#         "category_name": "Fresh Vegetables",
#         "quantity_config": {"type": "range", "min": 5, "max": 20, "step": 5, "pills": [5, 10, 20, 50, 100]}
#     }

    # NOTE: The following items are in your list but were not included above yet:
    # petit-pois.png
    # poire.png (already included)
    # peche.png (already included)
    # citron-jaune.png (already included)
    # concombre.png (already included)
    # coriandre.png (already included)
    # courgette.png (already included)
    # fenouille.png (already included)
    # feve.png (already included)
    # haricot-vert.png (already included)
    # navet.png (already included)
    # oignion.png (already included)
    # potato.png (already included)
    # radis.png (already included)
    # salade.png (already included)
    # tomate.png (already included)

    # TODO (remaining from your filenames list, not generated in this output yet):
    # artichaut.png (included)
    # aubergine.png (included)
    # banane.png (included)
    # betrave.png (included)
    # brocoli.png (included)
    # carde.png (included)
    # carrote.png (included)
    # celery.png (included)
    # chou-fleur.png (included)
    # climentine.png (included)
    # date.png (included)
    # aprico.png (included)
    # citron-jaune.png (included)
    # concombre.png (included)
    # coriandre.png (included)
    # courgette.png (included)
    # fenouille.png (included)
    # feve.png (included)
    # haricot-vert.png (included)
    # navet.png (included)
    # nictarine.png (included)
    # oignion.png (included)
    # orange.png (included)
    # peche.png (included)
    # petit-pois.png (NOT YET)
    # piment.png (included)
    # poire.png (included)
    # poivron.png (included)
    # pomme-jaune.png (included)
    # pomme-rouge.png (included)
    # potato.png (included)
    # radis.png (included)
    # salade.png (included)
    # tomate.png (included)
# ]



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

        # Seed brands
        for brand_data in BRANDS:
            # Check if brand already exists
            brand = session.exec(
                select(Brand).where(Brand.name == brand_data["name"])
            ).first()

            if not brand:
                brand = Brand(**brand_data)
                session.add(brand)
                logger.info(f"Added brand: {brand_data['name']}")

        # Commit brands before adding products
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