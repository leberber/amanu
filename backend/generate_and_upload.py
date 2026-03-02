#!/usr/bin/env python3
"""
Generate product data and upload images to S3.

Usage:
    python generate_and_upload.py /path/to/products/folder

Folder structure:
    /folder
    ├── brand1/
    │   ├── product-name-500g.png
    │   └── another-product-1kg.png
    └── brand2/
        └── some-product-900g.png

Output:
    /folder/import_data.json - Contains all data ready for database import
"""

import os
import sys
import json
import re
import boto3

# S3 Configuration
S3_BUCKET = "elsuq"
S3_PREFIX = "product-images/"
S3_REGION = "eu-west-3"

# Product type definitions
# Add new product types here as needed
PRODUCT_TYPES = {
    # === PASTA / COUSCOUS ===
    "couscous": {"en": "Couscous", "fr": "Couscous", "ar": "كسكس", "category": "Pasta", "price_per_kg": 140},
    "couscous-fin": {"en": "Fine Couscous", "fr": "Couscous Fin", "ar": "كسكس ناعم", "category": "Pasta", "price_per_kg": 145},
    "couscous-moyen": {"en": "Medium Couscous", "fr": "Couscous Moyen", "ar": "كسكس متوسط", "category": "Pasta", "price_per_kg": 145},
    "couscous-gros": {"en": "Coarse Couscous", "fr": "Couscous Gros", "ar": "كسكس خشن", "category": "Pasta", "price_per_kg": 145},
    "couscous-orge": {"en": "Barley Couscous", "fr": "Couscous Orge", "ar": "كسكس الشعير", "category": "Pasta", "price_per_kg": 150},
    "couscous-complet": {"en": "Whole Wheat Couscous", "fr": "Couscous Complet", "ar": "كسكس كامل", "category": "Pasta", "price_per_kg": 150},
    "couscous-de-ble": {"en": "Wheat Couscous", "fr": "Couscous de Ble", "ar": "كسكس القمح", "category": "Pasta", "price_per_kg": 145},

    # === SEMOLINA ===
    "semoule": {"en": "Semolina", "fr": "Semoule", "ar": "سميد", "category": "Pasta", "price_per_kg": 120},
    "semoule-fin": {"en": "Fine Semolina", "fr": "Semoule Fin", "ar": "سميد ناعم", "category": "Pasta", "price_per_kg": 120},
    "semoule-moyen": {"en": "Medium Semolina", "fr": "Semoule Moyen", "ar": "سميد متوسط", "category": "Pasta", "price_per_kg": 120},
    "semoule-gros": {"en": "Coarse Semolina", "fr": "Semoule Gros", "ar": "سميد خشن", "category": "Pasta", "price_per_kg": 120},

    # === PASTA SHAPES ===
    "penne": {"en": "Penne", "fr": "Penne", "ar": "بيني", "category": "Pasta", "price_per_kg": 140},
    "penne-moyen": {"en": "Medium Penne", "fr": "Penne Moyen", "ar": "بيني متوسط", "category": "Pasta", "price_per_kg": 140},
    "penne-petit": {"en": "Small Penne", "fr": "Penne Petit", "ar": "بيني صغير", "category": "Pasta", "price_per_kg": 140},
    "coude": {"en": "Elbow Pasta", "fr": "Coude", "ar": "معكرونة كوع", "category": "Pasta", "price_per_kg": 140},
    "coude-moyen": {"en": "Medium Elbow Pasta", "fr": "Coude Moyen", "ar": "معكرونة كوع متوسط", "category": "Pasta", "price_per_kg": 140},
    "coude-petit": {"en": "Small Elbow Pasta", "fr": "Coude Petit", "ar": "معكرونة كوع صغير", "category": "Pasta", "price_per_kg": 140},
    "spaghetti": {"en": "Spaghetti", "fr": "Spaghetti", "ar": "سباغيتي", "category": "Pasta", "price_per_kg": 140},
    "vermicelle": {"en": "Vermicelli", "fr": "Vermicelle", "ar": "شعيرية", "category": "Pasta", "price_per_kg": 140},
    "torsade": {"en": "Fusilli", "fr": "Torsade", "ar": "تورسادي", "category": "Pasta", "price_per_kg": 140},
    "escargots": {"en": "Shell Pasta", "fr": "Escargots", "ar": "معكرونة صدف", "category": "Pasta", "price_per_kg": 140},
    "langues-oiseau": {"en": "Orzo", "fr": "Langues d'Oiseau", "ar": "لسان العصفور", "category": "Pasta", "price_per_kg": 140},
    "plomb": {"en": "Plomb Pasta", "fr": "Plomb", "ar": "معكرونة بلومب", "category": "Pasta", "price_per_kg": 140},

    # === FLOUR ===
    "farine": {"en": "Flour", "fr": "Farine", "ar": "دقيق", "category": "Flour", "price_per_kg": 85},
    "farine-t45": {"en": "Pastry Flour T45", "fr": "Farine T45", "ar": "دقيق T45", "category": "Flour", "price_per_kg": 90},
    "farine-t55": {"en": "All-Purpose Flour T55", "fr": "Farine T55", "ar": "دقيق T55", "category": "Flour", "price_per_kg": 85},
    "farine-t150": {"en": "Whole Wheat Flour T150", "fr": "Farine T150", "ar": "دقيق T150", "category": "Flour", "price_per_kg": 95},
    "farine-de-campagne": {"en": "Country Flour", "fr": "Farine de Campagne", "ar": "دقيق ريفي", "category": "Flour", "price_per_kg": 90},
    "farine-de-seigle": {"en": "Rye Flour", "fr": "Farine de Seigle", "ar": "دقيق الجاودار", "category": "Flour", "price_per_kg": 100},
    "farine-multi-cereales": {"en": "Multi-Grain Flour", "fr": "Farine Multi-Cereales", "ar": "دقيق متعدد الحبوب", "category": "Flour", "price_per_kg": 105},

    # === SUGAR ===
    "sucre": {"en": "Sugar", "fr": "Sucre", "ar": "سكر", "category": "Sugar", "price_per_kg": 87},

    # === OIL ===
    "huile": {"en": "Oil", "fr": "Huile", "ar": "زيت", "category": "Oil", "price_per_kg": 200},
    "huile-olive": {"en": "Olive Oil", "fr": "Huile d'Olive", "ar": "زيت الزيتون", "category": "Oil", "price_per_kg": 800},
    "huile-tournesol": {"en": "Sunflower Oil", "fr": "Huile de Tournesol", "ar": "زيت دوار الشمس", "category": "Oil", "price_per_kg": 180},

    # === COFFEE ===
    "cafe": {"en": "Coffee", "fr": "Cafe", "ar": "قهوة", "category": "Coffee", "price_per_kg": 1200},

    # === TOMATO ===
    "tomate": {"en": "Tomato Paste", "fr": "Concentre de Tomate", "ar": "معجون الطماطم", "category": "Tomato Paste", "price_per_kg": 150},
    "double-concentre": {"en": "Double Tomato Paste", "fr": "Double Concentre", "ar": "معجون طماطم مركز", "category": "Tomato Paste", "price_per_kg": 180},

    # === BISCUITS ===
    "biscuit": {"en": "Biscuits", "fr": "Biscuits", "ar": "بسكويت", "category": "Biscuits", "price_per_kg": 300},
    "gaufrette": {"en": "Wafers", "fr": "Gaufrette", "ar": "ويفر", "category": "Biscuits", "price_per_kg": 350},

    # === HARISSA ===
    "harissa": {"en": "Harissa", "fr": "Harissa", "ar": "هريسة", "category": "Harissa", "price_per_kg": 200},

    # === JAMS ===
    "confiture": {"en": "Jam", "fr": "Confiture", "ar": "مربى", "category": "Jams", "price_per_kg": 250},
}

# Pieces per box based on size
PIECES_PER_BOX = {
    "100g": 48,
    "200g": 24,
    "250g": 24,
    "400g": 24,
    "500g": 20,
    "750g": 12,
    "800g": 12,
    "900g": 12,
    "1kg": 12,
    "1l": 12,
    "2kg": 6,
    "2l": 6,
    "5kg": 4,
    "5l": 4,
}


def parse_filename(filename):
    """Parse filename to extract product type, brand, and size."""
    name = filename.lower()
    for ext in ['.png', '.jpg', '.jpeg', '.webp']:
        name = name.replace(ext, '')

    # Extract size (e.g., 500g, 1kg, 2l)
    size_match = re.search(r'(\d+(?:g|kg|l|ml))', name, re.IGNORECASE)
    size = size_match.group(1).lower() if size_match else "1kg"

    # Remove size from name
    name_without_size = re.sub(r'-?\d+(?:g|kg|l|ml)', '', name).strip('-')

    # Split by hyphen
    parts = [p for p in name_without_size.split('-') if p]

    # Last part is usually brand
    brand = parts[-1] if len(parts) > 1 else "unknown"

    # Everything before brand is product type
    product_parts = parts[:-1] if len(parts) > 1 else parts
    product_type = '-'.join(product_parts)

    return product_type, brand, size


def find_product_type(product_type):
    """Find matching product type definition."""
    # Exact match
    if product_type in PRODUCT_TYPES:
        return PRODUCT_TYPES[product_type]

    # Try longest prefix match
    for key in sorted(PRODUCT_TYPES.keys(), key=len, reverse=True):
        if product_type.startswith(key):
            return PRODUCT_TYPES[key]

    # Fallback - create generic entry
    return {
        "en": product_type.replace('-', ' ').title(),
        "fr": product_type.replace('-', ' ').title(),
        "ar": product_type,
        "category": "Others",
        "price_per_kg": 100
    }


def calculate_price(price_per_kg, size):
    """Calculate price based on size."""
    # Parse size to kg
    if 'ml' in size:
        kg = int(size.replace('ml', '')) / 1000
    elif 'l' in size and 'ml' not in size:
        kg = int(size.replace('l', ''))
    elif 'g' in size and 'kg' not in size:
        kg = int(size.replace('g', '')) / 1000
    elif 'kg' in size:
        kg = int(size.replace('kg', ''))
    else:
        kg = 1

    return int(price_per_kg * kg)


def upload_to_s3(local_path, filename):
    """Upload file to S3, return URL."""
    s3 = boto3.client('s3', region_name=S3_REGION)
    s3_key = f"{S3_PREFIX}{filename}"

    content_type = 'image/png'
    if filename.endswith('.jpg') or filename.endswith('.jpeg'):
        content_type = 'image/jpeg'
    elif filename.endswith('.webp'):
        content_type = 'image/webp'

    s3.upload_file(local_path, S3_BUCKET, s3_key, ExtraArgs={'ContentType': content_type})
    return f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    folder_path = os.path.expanduser(sys.argv[1])

    if not os.path.isdir(folder_path):
        print(f"Error: {folder_path} is not a directory")
        sys.exit(1)

    # Collect data
    products = []
    brands = set()
    categories = set()

    print(f"Scanning {folder_path}...")
    print("=" * 50)

    # Process each brand folder
    for brand_folder in sorted(os.listdir(folder_path)):
        brand_path = os.path.join(folder_path, brand_folder)
        if not os.path.isdir(brand_path) or brand_folder.startswith('.'):
            continue

        brand_name = brand_folder.capitalize()
        brands.add(brand_name)

        print(f"\nBrand: {brand_name}")

        # Process each image
        for image_file in sorted(os.listdir(brand_path)):
            if not image_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                continue

            image_path = os.path.join(brand_path, image_file)

            # Parse filename
            product_type, _, size = parse_filename(image_file)
            info = find_product_type(product_type)

            # Track category
            categories.add(info['category'])

            # Build names
            size_display = size.upper().replace('G', 'g').replace('K', 'k').replace('L', 'L')
            name_en = f"{info['en']} {brand_name} {size_display}"
            name_fr = f"{info['fr']} {brand_name} {size_display}"
            name_ar = f"{info['ar']} {brand_name} {size_display}"

            # Calculate values
            price = calculate_price(info['price_per_kg'], size)
            pieces = PIECES_PER_BOX.get(size, 12)

            # Upload to S3
            print(f"  Uploading {image_file}...")
            image_url = upload_to_s3(image_path, image_file)

            # Create product entry
            product = {
                "name": name_fr,
                "name_translations": {"en": name_en, "fr": name_fr, "ar": name_ar},
                "description": f"{pieces} units per box",
                "description_translations": {
                    "en": f"{pieces} units per box",
                    "fr": f"{pieces} unites par carton",
                    "ar": f"{pieces} وحدة في الصندوق"
                },
                "price": price,
                "unit": "PIECE",
                "stock_quantity": 100,
                "image_url": image_url,
                "is_organic": False,
                "is_active": True,
                "category": info['category'],
                "brand": brand_name,
                "pieces_per_box": pieces,
                "packaging_type": "CARTON"
            }
            products.append(product)

    # Build output data
    output = {
        "brands": [
            {
                "name": b,
                "name_translations": {"en": b, "fr": b, "ar": b},
                "is_active": True
            }
            for b in sorted(brands)
        ],
        "categories": [
            {
                "name": c,
                "name_translations": {"en": c, "fr": c, "ar": c},
                "is_active": True
            }
            for c in sorted(categories)
        ],
        "products": products
    }

    # Write output
    output_file = os.path.join(folder_path, 'import_data.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 50)
    print(f"Generated: {output_file}")
    print(f"  - {len(brands)} brands")
    print(f"  - {len(categories)} categories")
    print(f"  - {len(products)} products")
    print(f"\nImages uploaded to S3")
    print(f"\nNext: Review the JSON file, then run:")
    print(f"  python import_to_db.py {output_file}")


if __name__ == "__main__":
    main()
