#!/usr/bin/env python3
"""
Rename product images to format: brand_category_originalname.png

Usage:
    python rename_products.py /path/to/products/folder
"""

import os
import sys
import re

# Product type to category mapping (French category names)
# Categories: pates, riz, farine, sucre, huiles, cafe, the, lait, beurre,
#             confiture, biscuits, conserves, tomate, harissa, legumes-secs,
#             epices, sauces, boissons, desserts, bouillon
PRODUCT_TYPES = {
    # === PATES (Pasta) ===
    "couscous": "pates",
    "couscous-fin": "pates",
    "couscous-moyen": "pates",
    "couscous-gros": "pates",
    "couscous-orge": "pates",
    "couscous-complet": "pates",
    "couscous-de-ble": "pates",
    "semoule": "pates",
    "semoule-fin": "pates",
    "semoule-moyen": "pates",
    "semoule-gros": "pates",
    "penne": "pates",
    "penne-moyen": "pates",
    "penne-petit": "pates",
    "coude": "pates",
    "coude-moyen": "pates",
    "coude-petit": "pates",
    "coude-gros": "pates",
    "spaghetti": "pates",
    "vermicelle": "pates",
    "torsade": "pates",
    "escargots": "pates",
    "escargot": "pates",
    "coquilles": "pates",
    "coquillettes": "pates",
    "langues-oiseau": "pates",
    "langues-oiseaux": "pates",
    "langue-oiseau": "pates",
    "plomb": "pates",
    "plombs": "pates",
    "plombs-gros": "pates",
    "cheveux-ange": "pates",
    "tlitli": "pates",
    "tlitlit": "pates",
    "rechta": "pates",
    "berkoukes": "pates",
    "nouilles": "pates",
    "plume": "pates",
    "ressort": "pates",

    # === RIZ (Rice) ===
    "riz": "riz",
    "riz-blanc": "riz",
    "riz-basmati": "riz",
    "riz-etuve": "riz",
    "riz-extra-long": "riz",
    "riz-basmati-golden": "riz",
    "riz-basmati-gros": "riz",

    # === FARINE (Flour) ===
    "farine": "farine",
    "farine-t45": "farine",
    "farine-t55": "farine",
    "farine-t150": "farine",
    "farine-de-campagne": "farine",
    "farine-de-seigle": "farine",
    "farine-multi-cereales": "farine",
    "farine-feuilletage": "farine",
    "farine-pizza": "farine",
    "farine-pain": "farine",
    "farine-complete": "farine",
    "farine-preparation-maarek": "farine",
    "farine-preparation-sfendj": "farine",
    "farine-baghlia": "farine",
    "farine-de-mais": "farine",
    "farine-de-mais-jaune": "farine",
    "maizena": "farine",

    # === SUCRE (Sugar) ===
    "sucre": "sucre",
    "sucre-glace": "sucre",
    "sucre-vanille": "sucre",
    "sucre-marron": "sucre",
    "sucre-morceaux": "sucre",
    "sucre-trimoline": "sucre",
    "trimoline": "sucre",

    # === HUILES (Oils) ===
    "huile": "huiles",
    "huile-olive": "huiles",
    "huile-tournesol": "huiles",
    "huile-vegetale": "huiles",

    # === CAFE (Coffee/Cocoa) ===
    "cafe": "cafe",
    "cafe-gold": "cafe",
    "cafe-bonal": "cafe",
    "cafe-expresso": "cafe",
    "cafe-dicopa": "cafe",
    "cafe-fegalo": "cafe",
    "cafe-siglo": "cafe",
    "cacao": "cafe",
    "chocolat-en-poudre": "cafe",
    "chocolat": "cafe",

    # === THE (Tea) ===
    "the": "the",
    "the-vert": "the",
    "the-noir": "the",
    "infusion": "the",

    # === LAIT (Dairy) ===
    "lait": "lait",
    "lait-poudre": "lait",
    "lait-en-poudre": "lait",

    # === BEURRE (Butter/Margarine) ===
    "margarine": "beurre",
    "beurre": "beurre",
    "smen": "beurre",

    # === CONFITURE (Jams/Spreads) ===
    "confiture": "confiture",
    "confiture-abricots": "confiture",
    "confiture-figues": "confiture",
    "confiture-fraise": "confiture",
    "confiture-orange": "confiture",
    "miel": "confiture",
    "creme-noisettes": "confiture",
    "creme-noisettes-rocher": "confiture",
    "pate-tartiner": "confiture",
    "pate-tartine": "confiture",
    "pate-tartine-rocher": "confiture",

    # === BISCUITS ===
    "biscuit": "biscuits",
    "biscuits": "biscuits",
    "gaufrette": "biscuits",
    "gaufrettes": "biscuits",
    "cookies": "biscuits",
    "galette": "biscuits",
    "gouter-matinal": "biscuits",
    "lomdja-matinal": "biscuits",
    "mister-biscuit": "biscuits",
    "wafer": "biscuits",

    # === CONSERVES (Canned Goods) ===
    "thon": "conserves",
    "thon-huile": "conserves",
    "thon-tomate": "conserves",
    "sardine": "conserves",
    "mais": "conserves",
    "champignons": "conserves",
    "champignons-eminces": "conserves",
    "pois-chich": "conserves",
    "olives": "conserves",
    "cornichons": "conserves",

    # === TOMATE (Tomato Products) ===
    "tomate": "tomate",
    "double-concentre": "tomate",
    "concentre": "tomate",
    "sauce-tomate": "tomate",
    "sauce-tomate-ail-basilic": "tomate",
    "sauce-tomate-basilic": "tomate",

    # === HARISSA ===
    "harissa": "harissa",

    # === LEGUMES-SECS (Dried Legumes) ===
    "lentilles": "legumes-secs",
    "lentilles-corail": "legumes-secs",
    "lentilles-royales": "legumes-secs",
    "lentille-rouge": "legumes-secs",
    "haricots": "legumes-secs",
    "haricots-blanc": "legumes-secs",
    "haricots-rouge": "legumes-secs",
    "haricots-oeil-noir": "legumes-secs",
    "pois-chiches": "legumes-secs",
    "pois-cassees": "legumes-secs",
    "petitts-cassees": "legumes-secs",
    "feves": "legumes-secs",
    "borghol": "legumes-secs",
    "borghol-gros": "legumes-secs",
    "guisantes": "legumes-secs",
    "popcorn": "legumes-secs",

    # === EPICES (Spices/Seasonings) ===
    "sel": "epices",
    "sel-cuisine": "epices",
    "sel-de-table": "epices",
    "sel-fin": "epices",
    "sel-gros": "epices",
    "sel-raffine": "epices",
    "sel-chemsi": "epices",
    "sel-special-boulangerie": "epices",
    "sel-cuisine-iode": "epices",
    "poivre": "epices",
    "epices": "epices",
    "levure": "epices",
    "vanille": "epices",

    # === SAUCES ===
    "sauce-pizza": "sauces",
    "ketchup": "sauces",
    "mayonnaise": "sauces",
    "sauce-mayonnaise": "sauces",
    "moutarde": "sauces",
    "sauce-moutarde": "sauces",
    "vinaigrette": "sauces",

    # === BOISSONS (Beverages) ===
    "eau": "boissons",
    "jus": "boissons",
    "soda": "boissons",

    # === DESSERTS ===
    "flan": "desserts",
    "flan-nouara-caramel": "desserts",
    "flan-nouara-chocolat": "desserts",
    "flan-nouara-citron": "desserts",
    "flan-nouara-fraise": "desserts",
    "flan-nouara-vanille": "desserts",
    "chantilly": "desserts",
    "glacage": "desserts",
    "glacage-rocher": "desserts",
    "glacage-rocher-au-lait": "desserts",
    "glacage-rocher-blanc": "desserts",
    "glacage-rocher-noir-et-noisettes": "desserts",
    "pate-a-glacer": "desserts",
    "pate-a-glacer-au-lait": "desserts",
    "pate-a-glacer-noisettes": "desserts",
    "pate-a-glacer-rocher-blanc": "desserts",
    "pate-a-glacer-rocher-noir": "desserts",
    "gelatine": "desserts",

    # === BOUILLON (Broths/Stock) ===
    "bouillon": "bouillon",
    "bouillon-boeuf": "bouillon",
    "bouillon-mouton": "bouillon",
    "bouillon-poulet": "bouillon",
}

# Products that need special handling (brand-specific naming)
BRAND_SPECIFIC = {
    "bennito": "biscuits",
    "besto": "biscuits",
    "dadey": "biscuits",
    "famelio": "biscuits",
    "rigolo": "biscuits",
    "pesos": "biscuits",
    "tango": "biscuits",
    "twist-nuevo": "biscuits",
    "filou": "biscuits",
    "big-filou": "biscuits",
    "misti": "biscuits",
    "misti-amigos": "biscuits",
    "misti-cacao": "biscuits",
    "misti-cafe": "biscuits",
    "misti-citron": "biscuits",
    "misti-vanille": "biscuits",
}


def get_category(filename):
    """Determine category from filename."""
    name = filename.lower()
    for ext in ['.png', '.jpg', '.jpeg', '.webp']:
        name = name.replace(ext, '')

    # Remove size patterns
    name_clean = re.sub(r'-?\d+(?:\.?\d+)?(?:g|kg|l|ml|pcs|x)', '', name)
    name_clean = re.sub(r'-?pot-?', '-', name_clean)
    name_clean = re.sub(r'-?boite-?', '-', name_clean)
    name_clean = re.sub(r'-?nouveau-?', '-', name_clean)
    name_clean = name_clean.strip('-')

    # Split and try to match
    parts = [p for p in name_clean.split('-') if p]

    # Try longest prefix match first
    for i in range(len(parts), 0, -1):
        key = '-'.join(parts[:i])
        if key in PRODUCT_TYPES:
            return PRODUCT_TYPES[key]
        if key in BRAND_SPECIFIC:
            return BRAND_SPECIFIC[key]

    # Try each part individually
    for part in parts:
        if part in PRODUCT_TYPES:
            return PRODUCT_TYPES[part]
        if part in BRAND_SPECIFIC:
            return BRAND_SPECIFIC[part]

    return "autres"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    products_folder = os.path.expanduser(sys.argv[1])

    if not os.path.isdir(products_folder):
        print(f"Error: {products_folder} is not a directory")
        sys.exit(1)

    print(f"Scanning {products_folder}...")
    print("=" * 60)

    renamed_count = 0
    skipped_count = 0
    errors = []

    # Process each brand folder
    for brand_folder in sorted(os.listdir(products_folder)):
        brand_path = os.path.join(products_folder, brand_folder)
        if not os.path.isdir(brand_path) or brand_folder.startswith('.'):
            continue

        brand = brand_folder.lower()
        print(f"\nBrand: {brand}")

        # Process each image
        for image_file in sorted(os.listdir(brand_path)):
            if not image_file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                continue

            # Check if already in new format (brand_category_...)
            if image_file.lower().startswith(f"{brand}_"):
                # Extract the part after brand_ to check category
                rest = image_file[len(brand)+1:]
                parts = rest.split('_', 1)
                if len(parts) >= 2:
                    old_category = parts[0]
                    original_name = parts[1]

                    # Get correct category
                    new_category = get_category(original_name)

                    if old_category == new_category:
                        skipped_count += 1
                        continue

                    # Need to rename with new category
                    new_filename = f"{brand}_{new_category}_{original_name}"
                    old_path = os.path.join(brand_path, image_file)
                    new_path = os.path.join(brand_path, new_filename)

                    if os.path.exists(new_path):
                        print(f"  [ERROR] {image_file} -> target exists: {new_filename}")
                        errors.append((image_file, "target exists"))
                        continue

                    try:
                        os.rename(old_path, new_path)
                        print(f"  [FIX] {image_file} -> {new_filename}")
                        renamed_count += 1
                    except Exception as e:
                        print(f"  [ERROR] {image_file}: {e}")
                        errors.append((image_file, str(e)))
                    continue

            # Get category for new file
            category = get_category(image_file)

            # Build new filename
            new_filename = f"{brand}_{category}_{image_file}"

            old_path = os.path.join(brand_path, image_file)
            new_path = os.path.join(brand_path, new_filename)

            # Check if target exists
            if os.path.exists(new_path):
                print(f"  [ERROR] {image_file} -> target exists: {new_filename}")
                errors.append((image_file, "target exists"))
                continue

            # Rename
            try:
                os.rename(old_path, new_path)
                print(f"  [OK] {image_file} -> {new_filename}")
                renamed_count += 1
            except Exception as e:
                print(f"  [ERROR] {image_file}: {e}")
                errors.append((image_file, str(e)))

    print("\n" + "=" * 60)
    print(f"Renamed: {renamed_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Errors:  {len(errors)}")

    if errors:
        print("\nErrors:")
        for filename, error in errors:
            print(f"  - {filename}: {error}")


if __name__ == "__main__":
    main()
