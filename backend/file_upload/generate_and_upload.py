#!/usr/bin/env python3
"""
Generate product data and upload images to S3.

Usage:
    python generate_and_upload.py --categories /path/to/categories --brands /path/to/brands --products /path/to/products --dry-run

Folder structure:
    /categories/
    ├── pates.png
    ├── riz.png
    └── farine.png

    /brands/
    ├── sim.png
    ├── mama.png
    └── labelle.png

    /products/
    ├── sim/
    │   ├── sim_pates_couscous-fin-sim-1kg.png
    │   └── sim_farine_farine-sim-1kg.png
    └── mama/
        └── mama_pates_spaghetti-mama-500g.png

Output:
    import_data.json - Contains all data ready for database import
"""

import os
import sys
import json
import re
import argparse
import boto3

# S3 Configuration
S3_BUCKET = "agroclik"
S3_REGION = "eu-west-3"

# Stock multiplier (stock_quantity = pieces_per_box * STOCK_MULTIPLIER)
STOCK_MULTIPLIER = 5

# Category translations (keys normalized to lowercase with spaces replaced by hyphens)
CATEGORY_TRANSLATIONS = {
    "pates": {"en": "Pasta", "fr": "Pâtes", "ar": "معكرونة"},
    "riz": {"en": "Rice", "fr": "Riz", "ar": "أرز"},
    "farine": {"en": "Flour", "fr": "Farine", "ar": "دقيق"},
    "sucre": {"en": "Sugar", "fr": "Sucre", "ar": "سكر"},
    "huile": {"en": "Oil", "fr": "Huile", "ar": "زيت"},
    "huiles": {"en": "Oils", "fr": "Huiles", "ar": "زيوت"},
    "cafe": {"en": "Coffee & Cocoa", "fr": "Café & Cacao", "ar": "قهوة وكاكاو"},
    "the": {"en": "Tea", "fr": "Thé", "ar": "شاي"},
    "lait": {"en": "Dairy", "fr": "Produits Laitiers", "ar": "منتجات الألبان"},
    "beurre": {"en": "Butter & Margarine", "fr": "Beurre & Margarine", "ar": "زبدة ومارغرين"},
    "confiture": {"en": "Jams & Spreads", "fr": "Confitures & Tartinables", "ar": "مربى ودهون"},
    "biscuits": {"en": "Biscuits & Cookies", "fr": "Biscuits & Gâteaux", "ar": "بسكويت وكعك"},
    "conserves": {"en": "Canned Goods", "fr": "Conserves", "ar": "معلبات"},
    "tomate": {"en": "Tomato Products", "fr": "Produits de Tomate", "ar": "منتجات الطماطم"},
    "harissa": {"en": "Harissa", "fr": "Harissa", "ar": "هريسة"},
    "legumes-secs": {"en": "Dried Legumes", "fr": "Légumes Secs", "ar": "بقوليات جافة"},
    "legumes secs": {"en": "Dried Legumes", "fr": "Légumes Secs", "ar": "بقوليات جافة"},
    "epices": {"en": "Spices & Seasonings", "fr": "Épices & Assaisonnements", "ar": "توابل وبهارات"},
    "sauces": {"en": "Sauces", "fr": "Sauces", "ar": "صلصات"},
    "boissons": {"en": "Beverages", "fr": "Boissons", "ar": "مشروبات"},
    "desserts": {"en": "Desserts", "fr": "Desserts", "ar": "حلويات"},
    "bouillon": {"en": "Broths & Stock", "fr": "Bouillons", "ar": "مرق"},
    "autres": {"en": "Others", "fr": "Autres", "ar": "أخرى"},
}

# Product type definitions with translations and pricing
PRODUCT_TYPES = {
    # === PATES (Pasta) ===
    "couscous": {"en": "Couscous", "fr": "Couscous", "ar": "كسكس", "category": "pates", "price_per_kg": 140},
    "couscous-fin": {"en": "Fine Couscous", "fr": "Couscous Fin", "ar": "كسكس ناعم", "category": "pates", "price_per_kg": 145},
    "couscous-moyen": {"en": "Medium Couscous", "fr": "Couscous Moyen", "ar": "كسكس متوسط", "category": "pates", "price_per_kg": 145},
    "couscous-gros": {"en": "Coarse Couscous", "fr": "Couscous Gros", "ar": "كسكس خشن", "category": "pates", "price_per_kg": 145},
    "couscous-orge": {"en": "Barley Couscous", "fr": "Couscous Orge", "ar": "كسكس الشعير", "category": "pates", "price_per_kg": 150},
    "couscous-complet": {"en": "Whole Wheat Couscous", "fr": "Couscous Complet", "ar": "كسكس كامل", "category": "pates", "price_per_kg": 150},
    "couscous-de-ble": {"en": "Wheat Couscous", "fr": "Couscous de Blé", "ar": "كسكس القمح", "category": "pates", "price_per_kg": 145},
    "semoule": {"en": "Semolina", "fr": "Semoule", "ar": "سميد", "category": "pates", "price_per_kg": 120},
    "semoule-fin": {"en": "Fine Semolina", "fr": "Semoule Fine", "ar": "سميد ناعم", "category": "pates", "price_per_kg": 120},
    "semoule-moyen": {"en": "Medium Semolina", "fr": "Semoule Moyenne", "ar": "سميد متوسط", "category": "pates", "price_per_kg": 120},
    "semoule-gros": {"en": "Coarse Semolina", "fr": "Semoule Grosse", "ar": "سميد خشن", "category": "pates", "price_per_kg": 120},
    "penne": {"en": "Penne", "fr": "Penne", "ar": "بيني", "category": "pates", "price_per_kg": 140},
    "coude": {"en": "Elbow Pasta", "fr": "Coude", "ar": "معكرونة كوع", "category": "pates", "price_per_kg": 140},
    "coude-moyen": {"en": "Medium Elbow", "fr": "Coude Moyen", "ar": "كوع متوسط", "category": "pates", "price_per_kg": 140},
    "coude-petit": {"en": "Small Elbow", "fr": "Coude Petit", "ar": "كوع صغير", "category": "pates", "price_per_kg": 140},
    "coude-gros": {"en": "Large Elbow", "fr": "Coude Gros", "ar": "كوع كبير", "category": "pates", "price_per_kg": 140},
    "spaghetti": {"en": "Spaghetti", "fr": "Spaghetti", "ar": "سباغيتي", "category": "pates", "price_per_kg": 140},
    "vermicelle": {"en": "Vermicelli", "fr": "Vermicelle", "ar": "شعيرية", "category": "pates", "price_per_kg": 140},
    "torsade": {"en": "Fusilli", "fr": "Torsade", "ar": "تورسادي", "category": "pates", "price_per_kg": 140},
    "escargot": {"en": "Shell Pasta", "fr": "Escargot", "ar": "معكرونة صدف", "category": "pates", "price_per_kg": 140},
    "coquilles": {"en": "Shell Pasta", "fr": "Coquilles", "ar": "صدف", "category": "pates", "price_per_kg": 140},
    "coquillettes": {"en": "Small Shells", "fr": "Coquillettes", "ar": "صدف صغير", "category": "pates", "price_per_kg": 140},
    "langues-oiseaux": {"en": "Orzo", "fr": "Langues d'Oiseaux", "ar": "لسان العصفور", "category": "pates", "price_per_kg": 140},
    "langue-oiseau": {"en": "Orzo", "fr": "Langue d'Oiseau", "ar": "لسان العصفور", "category": "pates", "price_per_kg": 140},
    "plomb": {"en": "Plomb Pasta", "fr": "Plomb", "ar": "بلومب", "category": "pates", "price_per_kg": 140},
    "plombs-gros": {"en": "Large Plomb", "fr": "Plombs Gros", "ar": "بلومب كبير", "category": "pates", "price_per_kg": 140},
    "tlitlit": {"en": "Tlitli", "fr": "Tlitli", "ar": "تليتلي", "category": "pates", "price_per_kg": 140},
    "nouilles": {"en": "Noodles", "fr": "Nouilles", "ar": "نودلز", "category": "pates", "price_per_kg": 140},
    "plume": {"en": "Penne", "fr": "Plume", "ar": "ريشة", "category": "pates", "price_per_kg": 140},
    "ressort": {"en": "Spiral Pasta", "fr": "Ressort", "ar": "سبيرال", "category": "pates", "price_per_kg": 140},

    # === RIZ (Rice) ===
    "riz": {"en": "Rice", "fr": "Riz", "ar": "أرز", "category": "riz", "price_per_kg": 150},
    "riz-blanc": {"en": "White Rice", "fr": "Riz Blanc", "ar": "أرز أبيض", "category": "riz", "price_per_kg": 150},
    "riz-basmati": {"en": "Basmati Rice", "fr": "Riz Basmati", "ar": "أرز بسمتي", "category": "riz", "price_per_kg": 200},
    "riz-etuve": {"en": "Parboiled Rice", "fr": "Riz Étuvé", "ar": "أرز مسلوق", "category": "riz", "price_per_kg": 160},
    "riz-basmati-golden": {"en": "Golden Basmati", "fr": "Riz Basmati Golden", "ar": "بسمتي ذهبي", "category": "riz", "price_per_kg": 220},
    "riz-basmati-gros": {"en": "Large Basmati", "fr": "Riz Basmati Gros", "ar": "بسمتي كبير", "category": "riz", "price_per_kg": 210},
    "riz-extra-long": {"en": "Extra Long Rice", "fr": "Riz Extra Long", "ar": "أرز طويل", "category": "riz", "price_per_kg": 180},

    # === FARINE (Flour) ===
    "farine": {"en": "Flour", "fr": "Farine", "ar": "دقيق", "category": "farine", "price_per_kg": 85},
    "farine-t45": {"en": "Pastry Flour T45", "fr": "Farine T45", "ar": "دقيق T45", "category": "farine", "price_per_kg": 90},
    "farine-t55": {"en": "All-Purpose Flour T55", "fr": "Farine T55", "ar": "دقيق T55", "category": "farine", "price_per_kg": 85},
    "farine-t150": {"en": "Whole Wheat Flour", "fr": "Farine T150", "ar": "دقيق كامل", "category": "farine", "price_per_kg": 95},
    "farine-de-campagne": {"en": "Country Flour", "fr": "Farine de Campagne", "ar": "دقيق ريفي", "category": "farine", "price_per_kg": 90},
    "farine-de-seigle": {"en": "Rye Flour", "fr": "Farine de Seigle", "ar": "دقيق الجاودار", "category": "farine", "price_per_kg": 100},
    "farine-multi-cereales": {"en": "Multi-Grain Flour", "fr": "Farine Multi-Céréales", "ar": "دقيق متعدد الحبوب", "category": "farine", "price_per_kg": 105},
    "farine-feuilletage": {"en": "Puff Pastry Flour", "fr": "Farine Feuilletage", "ar": "دقيق الفطائر", "category": "farine", "price_per_kg": 95},
    "farine-pizza": {"en": "Pizza Flour", "fr": "Farine Pizza", "ar": "دقيق البيتزا", "category": "farine", "price_per_kg": 95},
    "farine-preparation-maarek": {"en": "Maarek Flour", "fr": "Farine Préparation Maarek", "ar": "دقيق المعارك", "category": "farine", "price_per_kg": 100},
    "farine-preparation-sfendj": {"en": "Sfenj Flour", "fr": "Farine Préparation Sfendj", "ar": "دقيق السفنج", "category": "farine", "price_per_kg": 100},
    "farine-baghlia": {"en": "Baghlia Flour", "fr": "Farine Baghlia", "ar": "دقيق البغلة", "category": "farine", "price_per_kg": 90},
    "farine-de-mais": {"en": "Corn Flour", "fr": "Farine de Maïs", "ar": "دقيق الذرة", "category": "farine", "price_per_kg": 100},
    "maizena": {"en": "Corn Starch", "fr": "Maïzena", "ar": "نشاء الذرة", "category": "farine", "price_per_kg": 200},
    "melange-de-farine-de-mais": {"en": "Corn Flour Mix", "fr": "Mélange Farine de Maïs", "ar": "خليط دقيق الذرة", "category": "farine", "price_per_kg": 95},

    # === SUCRE (Sugar) ===
    "sucre": {"en": "Sugar", "fr": "Sucre", "ar": "سكر", "category": "sucre", "price_per_kg": 87},
    "sucre-glace": {"en": "Powdered Sugar", "fr": "Sucre Glace", "ar": "سكر ناعم", "category": "sucre", "price_per_kg": 95},
    "sucre-marron": {"en": "Brown Sugar", "fr": "Sucre Marron", "ar": "سكر بني", "category": "sucre", "price_per_kg": 100},
    "sucre-morceaux": {"en": "Sugar Cubes", "fr": "Sucre Morceaux", "ar": "سكر مكعبات", "category": "sucre", "price_per_kg": 95},
    "sucre-trimoline": {"en": "Trimoline", "fr": "Sucre Trimoline", "ar": "تريمولين", "category": "sucre", "price_per_kg": 150},
    "trimoline": {"en": "Trimoline", "fr": "Trimoline", "ar": "تريمولين", "category": "sucre", "price_per_kg": 150},

    # === HUILES (Oils) ===
    "huile": {"en": "Oil", "fr": "Huile", "ar": "زيت", "category": "huile", "price_per_kg": 200},
    "huile-olive": {"en": "Olive Oil", "fr": "Huile d'Olive", "ar": "زيت الزيتون", "category": "huile", "price_per_kg": 800},
    "huile-tournesol": {"en": "Sunflower Oil", "fr": "Huile de Tournesol", "ar": "زيت دوار الشمس", "category": "huile", "price_per_kg": 180},

    # === CAFE (Coffee/Cocoa) ===
    "cafe": {"en": "Coffee", "fr": "Café", "ar": "قهوة", "category": "cafe", "price_per_kg": 1200},
    "cafe-gold": {"en": "Gold Coffee", "fr": "Café Gold", "ar": "قهوة ذهبية", "category": "cafe", "price_per_kg": 1400},
    "cafe-bonal": {"en": "Bonal Coffee", "fr": "Café Bonal", "ar": "قهوة بونال", "category": "cafe", "price_per_kg": 1300},
    "cafe-expresso": {"en": "Espresso", "fr": "Café Expresso", "ar": "اسبريسو", "category": "cafe", "price_per_kg": 1500},
    "cafe-dicopa": {"en": "Dicopa Coffee", "fr": "Café Dicopa", "ar": "قهوة ديكوبا", "category": "cafe", "price_per_kg": 1200},
    "cafe-fegalo": {"en": "Fegalo Coffee", "fr": "Café Fegalo", "ar": "قهوة فيغالو", "category": "cafe", "price_per_kg": 1200},
    "cafe-siglo": {"en": "Siglo Coffee", "fr": "Café Siglo", "ar": "قهوة سيغلو", "category": "cafe", "price_per_kg": 1200},
    "cacao": {"en": "Cocoa", "fr": "Cacao", "ar": "كاكاو", "category": "cafe", "price_per_kg": 800},
    "chocolat-en-poudre": {"en": "Cocoa Powder", "fr": "Chocolat en Poudre", "ar": "شوكولاتة بودرة", "category": "cafe", "price_per_kg": 600},

    # === LAIT (Dairy) ===
    "lait": {"en": "Milk", "fr": "Lait", "ar": "حليب", "category": "lait", "price_per_kg": 400},
    "lait-poudre": {"en": "Milk Powder", "fr": "Lait en Poudre", "ar": "حليب بودرة", "category": "lait", "price_per_kg": 800},
    "lait-en-poudre": {"en": "Milk Powder", "fr": "Lait en Poudre", "ar": "حليب بودرة", "category": "lait", "price_per_kg": 800},

    # === BEURRE (Butter/Margarine) ===
    "margarine": {"en": "Margarine", "fr": "Margarine", "ar": "مارغرين", "category": "beurre", "price_per_kg": 350},
    "beurre": {"en": "Butter", "fr": "Beurre", "ar": "زبدة", "category": "beurre", "price_per_kg": 600},
    "smen": {"en": "Smen", "fr": "Smen", "ar": "سمن", "category": "beurre", "price_per_kg": 500},

    # === CONFITURE (Jams/Spreads) ===
    "confiture": {"en": "Jam", "fr": "Confiture", "ar": "مربى", "category": "confiture", "price_per_kg": 250},
    "confiture-abricots": {"en": "Apricot Jam", "fr": "Confiture d'Abricots", "ar": "مربى المشمش", "category": "confiture", "price_per_kg": 260},
    "confiture-figues": {"en": "Fig Jam", "fr": "Confiture de Figues", "ar": "مربى التين", "category": "confiture", "price_per_kg": 270},
    "confiture-fraise": {"en": "Strawberry Jam", "fr": "Confiture de Fraise", "ar": "مربى الفراولة", "category": "confiture", "price_per_kg": 260},
    "creme-noisettes": {"en": "Hazelnut Spread", "fr": "Crème de Noisettes", "ar": "كريمة البندق", "category": "confiture", "price_per_kg": 400},
    "pate-tartine": {"en": "Spread", "fr": "Pâte à Tartiner", "ar": "دهن", "category": "confiture", "price_per_kg": 350},

    # === BISCUITS ===
    "biscuit": {"en": "Biscuits", "fr": "Biscuits", "ar": "بسكويت", "category": "biscuits", "price_per_kg": 300},
    "gaufrette": {"en": "Wafers", "fr": "Gaufrette", "ar": "ويفر", "category": "biscuits", "price_per_kg": 350},
    "gaufrettes": {"en": "Wafers", "fr": "Gaufrettes", "ar": "ويفر", "category": "biscuits", "price_per_kg": 350},
    "cookies": {"en": "Cookies", "fr": "Cookies", "ar": "كوكيز", "category": "biscuits", "price_per_kg": 400},
    "galette": {"en": "Biscuits", "fr": "Galette", "ar": "غاليت", "category": "biscuits", "price_per_kg": 280},
    "galette-cacao": {"en": "Cocoa Biscuits", "fr": "Galette Cacao", "ar": "غاليت كاكاو", "category": "biscuits", "price_per_kg": 300},
    "wafer": {"en": "Wafer", "fr": "Wafer", "ar": "ويفر", "category": "biscuits", "price_per_kg": 350},
    "tango": {"en": "Tango", "fr": "Tango", "ar": "تانغو", "category": "biscuits", "price_per_kg": 350},
    "pesos": {"en": "Pesos", "fr": "Pesos", "ar": "بيسوس", "category": "biscuits", "price_per_kg": 350},
    "twist-nuevo": {"en": "Twist Nuevo", "fr": "Twist Nuevo", "ar": "تويست نويفو", "category": "biscuits", "price_per_kg": 350},
    "bennito": {"en": "Bennito", "fr": "Bennito", "ar": "بينيتو", "category": "biscuits", "price_per_kg": 300},
    "besto": {"en": "Besto", "fr": "Besto", "ar": "بيستو", "category": "biscuits", "price_per_kg": 300},
    "dadey": {"en": "Dadey", "fr": "Dadey", "ar": "داداي", "category": "biscuits", "price_per_kg": 300},
    "famelio": {"en": "Famelio", "fr": "Famelio", "ar": "فاميليو", "category": "biscuits", "price_per_kg": 300},
    "rigolo": {"en": "Rigolo", "fr": "Rigolo", "ar": "ريغولو", "category": "biscuits", "price_per_kg": 300},
    "filou": {"en": "Filou", "fr": "Filou", "ar": "فيلو", "category": "biscuits", "price_per_kg": 320},
    "big-filou": {"en": "Big Filou", "fr": "Big Filou", "ar": "بيغ فيلو", "category": "biscuits", "price_per_kg": 350},
    "gouter-matinal": {"en": "Morning Snack", "fr": "Goûter Matinal", "ar": "وجبة صباحية", "category": "biscuits", "price_per_kg": 280},
    "lomdja-matinal": {"en": "Morning Lomdja", "fr": "Lomdja Matinal", "ar": "لمجة صباحية", "category": "biscuits", "price_per_kg": 280},
    "mister-biscuit": {"en": "Mister Biscuit", "fr": "Mister Biscuit", "ar": "مستر بسكويت", "category": "biscuits", "price_per_kg": 300},
    "misti-amigos": {"en": "Misti Amigos", "fr": "Misti Amigos", "ar": "مستي أميغوس", "category": "biscuits", "price_per_kg": 300},
    "misti-cacao": {"en": "Misti Cacao", "fr": "Misti Cacao", "ar": "مستي كاكاو", "category": "biscuits", "price_per_kg": 300},
    "misti-cafe": {"en": "Misti Coffee", "fr": "Misti Café", "ar": "مستي قهوة", "category": "biscuits", "price_per_kg": 300},
    "misti-citron": {"en": "Misti Lemon", "fr": "Misti Citron", "ar": "مستي ليمون", "category": "biscuits", "price_per_kg": 300},
    "misti-vanille": {"en": "Misti Vanilla", "fr": "Misti Vanille", "ar": "مستي فانيلا", "category": "biscuits", "price_per_kg": 300},

    # === CONSERVES (Canned Goods) ===
    "thon": {"en": "Tuna", "fr": "Thon", "ar": "تونة", "category": "conserves", "price_per_kg": 800},
    "thon-huile": {"en": "Tuna in Oil", "fr": "Thon à l'Huile", "ar": "تونة بالزيت", "category": "conserves", "price_per_kg": 850},
    "thon-tomate": {"en": "Tuna in Tomato", "fr": "Thon à la Tomate", "ar": "تونة بالطماطم", "category": "conserves", "price_per_kg": 850},
    "mais": {"en": "Corn", "fr": "Maïs", "ar": "ذرة", "category": "conserves", "price_per_kg": 200},
    "champignons": {"en": "Mushrooms", "fr": "Champignons", "ar": "فطر", "category": "conserves", "price_per_kg": 300},
    "pois-chich": {"en": "Chickpeas", "fr": "Pois Chiches", "ar": "حمص", "category": "conserves", "price_per_kg": 180},

    # === TOMATE (Tomato Products) ===
    "tomate": {"en": "Tomato Paste", "fr": "Concentré de Tomate", "ar": "معجون طماطم", "category": "tomate", "price_per_kg": 150},
    "double-concentre": {"en": "Double Tomato Paste", "fr": "Double Concentré", "ar": "معجون مركز", "category": "tomate", "price_per_kg": 180},
    "sauce-tomate": {"en": "Tomato Sauce", "fr": "Sauce Tomate", "ar": "صلصة طماطم", "category": "tomate", "price_per_kg": 120},

    # === HARISSA ===
    "harissa": {"en": "Harissa", "fr": "Harissa", "ar": "هريسة", "category": "harissa", "price_per_kg": 200},

    # === LEGUMES-SECS (Dried Legumes) ===
    "lentilles": {"en": "Lentils", "fr": "Lentilles", "ar": "عدس", "category": "legumes secs", "price_per_kg": 180},
    "lentilles-corail": {"en": "Red Lentils", "fr": "Lentilles Corail", "ar": "عدس أحمر", "category": "legumes secs", "price_per_kg": 200},
    "lentilles-royales": {"en": "Royal Lentils", "fr": "Lentilles Royales", "ar": "عدس ملكي", "category": "legumes secs", "price_per_kg": 220},
    "lentille-rouge": {"en": "Red Lentils", "fr": "Lentille Rouge", "ar": "عدس أحمر", "category": "legumes secs", "price_per_kg": 200},
    "haricots": {"en": "Beans", "fr": "Haricots", "ar": "فاصوليا", "category": "legumes secs", "price_per_kg": 200},
    "haricots-blanc": {"en": "White Beans", "fr": "Haricots Blancs", "ar": "فاصوليا بيضاء", "category": "legumes secs", "price_per_kg": 200},
    "haricots-rouge": {"en": "Red Beans", "fr": "Haricots Rouges", "ar": "فاصوليا حمراء", "category": "legumes secs", "price_per_kg": 200},
    "haricots-oeil-noir": {"en": "Black-Eyed Beans", "fr": "Haricots Oeil Noir", "ar": "فاصوليا عين سوداء", "category": "legumes secs", "price_per_kg": 220},
    "pois-chiches": {"en": "Chickpeas", "fr": "Pois Chiches", "ar": "حمص", "category": "legumes secs", "price_per_kg": 180},
    "petitts-cassees": {"en": "Split Peas", "fr": "Pois Cassés", "ar": "بازلاء مجروشة", "category": "legumes secs", "price_per_kg": 160},
    "borghol-gros": {"en": "Bulgur", "fr": "Borghol Gros", "ar": "برغل", "category": "legumes secs", "price_per_kg": 150},
    "guisantes": {"en": "Peas", "fr": "Petits Pois", "ar": "بازلاء", "category": "legumes secs", "price_per_kg": 180},
    "popcorn": {"en": "Popcorn", "fr": "Pop-corn", "ar": "فشار", "category": "legumes secs", "price_per_kg": 120},

    # === EPICES (Spices/Seasonings) ===
    "sel": {"en": "Salt", "fr": "Sel", "ar": "ملح", "category": "epices", "price_per_kg": 30},
    "sel-cuisine": {"en": "Cooking Salt", "fr": "Sel de Cuisine", "ar": "ملح الطبخ", "category": "epices", "price_per_kg": 30},
    "sel-de-table": {"en": "Table Salt", "fr": "Sel de Table", "ar": "ملح المائدة", "category": "epices", "price_per_kg": 35},
    "sel-fin": {"en": "Fine Salt", "fr": "Sel Fin", "ar": "ملح ناعم", "category": "epices", "price_per_kg": 35},
    "sel-gros": {"en": "Coarse Salt", "fr": "Sel Gros", "ar": "ملح خشن", "category": "epices", "price_per_kg": 25},
    "levure": {"en": "Yeast", "fr": "Levure", "ar": "خميرة", "category": "epices", "price_per_kg": 400},
    "vanille": {"en": "Vanilla", "fr": "Vanille", "ar": "فانيليا", "category": "epices", "price_per_kg": 600},

    # === SAUCES ===
    "sauce-pizza": {"en": "Pizza Sauce", "fr": "Sauce Pizza", "ar": "صلصة بيتزا", "category": "sauces", "price_per_kg": 150},
    "ketchup": {"en": "Ketchup", "fr": "Ketchup", "ar": "كاتشب", "category": "sauces", "price_per_kg": 120},
    "sauce-mayonnaise": {"en": "Mayonnaise", "fr": "Mayonnaise", "ar": "مايونيز", "category": "sauces", "price_per_kg": 200},
    "sauce-moutarde": {"en": "Mustard", "fr": "Moutarde", "ar": "خردل", "category": "sauces", "price_per_kg": 180},

    # === BOISSONS (Beverages) ===
    "eau": {"en": "Water", "fr": "Eau", "ar": "ماء", "category": "boissons", "price_per_kg": 30},

    # === DESSERTS ===
    "flan": {"en": "Flan", "fr": "Flan", "ar": "فلان", "category": "desserts", "price_per_kg": 300},
    "chantilly": {"en": "Whipped Cream", "fr": "Chantilly", "ar": "شانتيي", "category": "desserts", "price_per_kg": 400},
    "glacage": {"en": "Icing", "fr": "Glaçage", "ar": "تزيين", "category": "desserts", "price_per_kg": 350},
    "pate-a-glacer": {"en": "Icing Paste", "fr": "Pâte à Glacer", "ar": "عجينة تزيين", "category": "desserts", "price_per_kg": 400},

    # === BOUILLON (Broths/Stock) ===
    "bouillon": {"en": "Broth", "fr": "Bouillon", "ar": "مرق", "category": "bouillon", "price_per_kg": 500},
    "bouillon-boeuf": {"en": "Beef Broth", "fr": "Bouillon Boeuf", "ar": "مرق لحم", "category": "bouillon", "price_per_kg": 500},
    "bouillon-poulet": {"en": "Chicken Broth", "fr": "Bouillon Poulet", "ar": "مرق دجاج", "category": "bouillon", "price_per_kg": 500},
    "bouillon-mouton": {"en": "Lamb Broth", "fr": "Bouillon Mouton", "ar": "مرق خروف", "category": "bouillon", "price_per_kg": 500},
}

# Pieces per box based on size
PIECES_PER_BOX = {
    "50g": 100,
    "100g": 48,
    "125g": 48,
    "135g": 36,
    "150g": 36,
    "200g": 24,
    "250g": 24,
    "300g": 20,
    "340g": 20,
    "350g": 20,
    "380g": 20,
    "400g": 24,
    "450g": 20,
    "500g": 20,
    "600g": 12,
    "700g": 12,
    "750g": 12,
    "760g": 12,
    "780g": 12,
    "800g": 12,
    "900g": 12,
    "1kg": 12,
    "1l": 12,
    "1.5l": 6,
    "1.8kg": 6,
    "2kg": 6,
    "2l": 6,
    "2.4kg": 4,
    "2.5kg": 4,
    "3kg": 4,
    "4.1kg": 2,
    "5kg": 4,
    "5l": 4,
    "6kg": 2,
    "9kg": 2,
    "10kg": 2,
    "12kg": 1,
    "15kg": 1,
    "20kg": 1,
    "25kg": 1,
}


def upload_to_s3(local_path, s3_key):
    """Upload file to S3, return URL."""
    s3 = boto3.client('s3', region_name=S3_REGION)

    content_type = 'image/png'
    if local_path.endswith('.jpg') or local_path.endswith('.jpeg'):
        content_type = 'image/jpeg'
    elif local_path.endswith('.webp'):
        content_type = 'image/webp'

    # Cache for 1 hour (3600 seconds), then revalidate
    s3.upload_file(local_path, S3_BUCKET, s3_key, ExtraArgs={
        'ContentType': content_type,
        'CacheControl': 'public, max-age=3600'
    })
    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"


def normalize_name(name):
    """Normalize name by removing extensions and cleaning up."""
    name = name.lower()
    # Remove all image extensions (handle double extensions like .webp.png)
    while True:
        changed = False
        for ext in ['.png', '.jpg', '.jpeg', '.webp']:
            if name.endswith(ext):
                name = name[:-len(ext)]
                changed = True
        if not changed:
            break
    return name


def parse_product_filename(filename, brand):
    """Parse product filename to extract category and product info."""
    # Expected format: brand_category_product-name-size.png
    # Example: sim_pates_couscous-fin-sim-1kg.png

    name = normalize_name(filename)

    # Split by underscore
    parts = name.split('_')
    if len(parts) >= 3:
        file_brand = parts[0]
        category = parts[1]
        product_name = '_'.join(parts[2:])
    else:
        # Fallback for old format
        category = "autres"
        product_name = name

    # Extract size
    size_match = re.search(r'(\d+(?:\.\d+)?(?:g|kg|l|ml))', product_name, re.IGNORECASE)
    size = size_match.group(1).lower() if size_match else "1kg"

    # Get product type from name
    name_clean = re.sub(r'-?\d+(?:\.\d+)?(?:g|kg|l|ml|pcs|x)', '', product_name)
    name_clean = re.sub(r'-?' + brand + r'-?', '-', name_clean)
    name_clean = name_clean.strip('-')

    # Find product type info
    product_info = None
    parts_list = [p for p in name_clean.split('-') if p]
    for i in range(len(parts_list), 0, -1):
        key = '-'.join(parts_list[:i])
        if key in PRODUCT_TYPES:
            product_info = PRODUCT_TYPES[key]
            break

    if not product_info:
        # Use first part as generic product
        product_info = {
            "en": name_clean.replace('-', ' ').title(),
            "fr": name_clean.replace('-', ' ').title(),
            "ar": name_clean,
            "category": category,
            "price_per_kg": 100
        }

    return {
        "category": category,
        "product_name": product_name,
        "size": size,
        "product_info": product_info
    }


def calculate_price(price_per_kg, size):
    """Calculate price based on size."""
    size_lower = size.lower()
    if 'ml' in size_lower:
        kg = float(re.sub(r'[^\d.]', '', size_lower)) / 1000
    elif 'l' in size_lower and 'ml' not in size_lower:
        kg = float(re.sub(r'[^\d.]', '', size_lower))
    elif 'g' in size_lower and 'kg' not in size_lower:
        kg = float(re.sub(r'[^\d.]', '', size_lower)) / 1000
    elif 'kg' in size_lower:
        kg = float(re.sub(r'[^\d.]', '', size_lower))
    else:
        kg = 1

    return int(price_per_kg * kg)


def main():
    parser = argparse.ArgumentParser(description='Generate product data and upload to S3')
    parser.add_argument('--categories', required=True, help='Path to categories folder')
    parser.add_argument('--brands', required=True, help='Path to brands folder')
    parser.add_argument('--products', required=True, help='Path to products folder')
    parser.add_argument('--output', default='import_data.json', help='Output JSON file')
    parser.add_argument('--dry-run', action='store_true', help='Do not upload to S3')

    args = parser.parse_args()

    categories_path = os.path.expanduser(args.categories)
    brands_path = os.path.expanduser(args.brands)
    products_path = os.path.expanduser(args.products)

    # Validate paths
    for path, name in [(categories_path, 'categories'), (brands_path, 'brands'), (products_path, 'products')]:
        if not os.path.isdir(path):
            print(f"Error: {name} path '{path}' is not a directory")
            sys.exit(1)

    print("=" * 60)
    print(f"S3 Bucket: {S3_BUCKET}")
    print(f"Dry run: {args.dry_run}")
    print("=" * 60)

    # Process categories
    print("\n[1/3] Processing categories...")
    categories_data = []
    seen_categories = set()
    for img_file in sorted(os.listdir(categories_path)):
        if not img_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue

        # Get category name from filename (remove extension only, keep original case)
        cat_name = os.path.splitext(img_file)[0]
        # Handle double extensions like .webp.png
        while cat_name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            cat_name = os.path.splitext(cat_name)[0]

        cat_key = cat_name.lower()

        # Skip duplicates
        if cat_key in seen_categories:
            print(f"  Skipping duplicate category: {cat_name}")
            continue
        seen_categories.add(cat_key)

        img_path = os.path.join(categories_path, img_file)
        s3_key = f"categories/{img_file}"

        if args.dry_run:
            image_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        else:
            print(f"  Uploading {img_file}...")
            image_url = upload_to_s3(img_path, s3_key)

        # Use original name as-is for display (title case)
        display_name = cat_name.replace('-', ' ').title()

        categories_data.append({
            "name": cat_key,
            "name_translations": {"en": display_name, "fr": display_name, "ar": display_name},
            "image_url": image_url,
            "is_active": True
        })

    print(f"  Found {len(categories_data)} categories")

    # Process brands
    print("\n[2/3] Processing brands...")
    brands_data = []
    seen_brands = set()
    for img_file in sorted(os.listdir(brands_path)):
        if not img_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue

        # Get brand name from filename (remove extension only)
        brand_name = os.path.splitext(img_file)[0]
        # Handle double extensions like .webp.png
        while brand_name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            brand_name = os.path.splitext(brand_name)[0]

        brand_key = brand_name.lower()

        # Skip duplicates
        if brand_key in seen_brands:
            print(f"  Skipping duplicate brand: {brand_name}")
            continue
        seen_brands.add(brand_key)

        img_path = os.path.join(brands_path, img_file)
        s3_key = f"brands/{img_file}"

        if args.dry_run:
            image_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        else:
            print(f"  Uploading {img_file}...")
            image_url = upload_to_s3(img_path, s3_key)

        # Use original name as-is for display (title case)
        display_name = brand_name.replace('-', ' ').title()
        brands_data.append({
            "name": display_name,
            "name_translations": {"en": display_name, "fr": display_name, "ar": display_name},
            "image_url": image_url,
            "is_active": True
        })

    print(f"  Found {len(brands_data)} brands")

    # Build lookup maps
    category_names = {c['name'] for c in categories_data}
    brand_names = {b['name'].lower(): b['name'] for b in brands_data}
    # Also map with hyphens for lookup
    for b in brands_data:
        brand_names[b['name'].lower().replace(' ', '-')] = b['name']

    # Process products
    print("\n[3/3] Processing products...")
    products_data = []
    seen_products = set()

    for brand_folder in sorted(os.listdir(products_path)):
        brand_path = os.path.join(products_path, brand_folder)
        if not os.path.isdir(brand_path) or brand_folder.startswith('.'):
            continue

        brand = brand_folder.lower()
        brand_display = brand_names.get(brand, brand_names.get(brand.replace(' ', '-'), brand.replace('-', ' ').title()))

        print(f"\n  Brand: {brand_display}")

        for img_file in sorted(os.listdir(brand_path)):
            if not img_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                continue

            # Check for duplicate products based on normalized filename
            normalized_file = normalize_name(img_file)
            product_key = f"{brand}_{normalized_file}"
            if product_key in seen_products:
                print(f"    Skipping duplicate: {img_file}")
                continue
            seen_products.add(product_key)

            img_path = os.path.join(brand_path, img_file)
            # Normalize s3 key (replace spaces with hyphens)
            s3_key = f"products/{brand.replace(' ', '-')}/{img_file.replace(' ', '-')}"

            # Parse filename
            parsed = parse_product_filename(img_file, brand.replace(' ', '-'))
            category = parsed['category']
            size = parsed['size']
            info = parsed['product_info']

            # Validate category (handle spaces in category names)
            if category not in category_names and category.replace(' ', '-') not in category_names:
                print(f"    WARNING: Unknown category '{category}' for {img_file}")
                category = "autres"

            # Upload
            if args.dry_run:
                image_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
            else:
                print(f"    Uploading {img_file}...")
                image_url = upload_to_s3(img_path, s3_key)

            # Calculate values
            size_display = size.upper().replace('G', 'g').replace('K', 'k').replace('L', 'L')
            name_en = f"{info['en']} {brand_display} {size_display}"
            name_fr = f"{info['fr']} {brand_display} {size_display}"
            name_ar = f"{info['ar']} {brand_display} {size_display}"

            price = calculate_price(info['price_per_kg'], size)
            pieces = PIECES_PER_BOX.get(size, 12)
            stock = pieces * STOCK_MULTIPLIER  # Divisible by pieces_per_box

            products_data.append({
                "name": name_fr,
                "name_translations": {"en": name_en, "fr": name_fr, "ar": name_ar},
                "description": f"{pieces} unités par carton",
                "description_translations": {
                    "en": f"{pieces} units per box",
                    "fr": f"{pieces} unités par carton",
                    "ar": f"{pieces} وحدة في الصندوق"
                },
                "price": price,
                "unit": "PIECE",
                "stock_quantity": stock,
                "image_url": image_url,
                "is_organic": False,
                "is_active": True,
                "category": category,
                "brand": brand_display,
                "pieces_per_box": pieces,
                "packaging_type": "CARTON"
            })

    print(f"\n  Total products: {len(products_data)}")

    # Build output
    output = {
        "categories": categories_data,
        "brands": brands_data,
        "products": products_data
    }

    # Write output
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"Generated: {args.output}")
    print(f"  - {len(categories_data)} categories")
    print(f"  - {len(brands_data)} brands")
    print(f"  - {len(products_data)} products")

    if args.dry_run:
        print("\n[DRY RUN] No files were uploaded to S3")
    else:
        print(f"\nImages uploaded to S3 bucket: {S3_BUCKET}")

    print(f"\nNext: Run import_to_db.py {args.output}")


if __name__ == "__main__":
    main()
