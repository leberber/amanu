#!/usr/bin/env python3
"""
Resize and convert images for optimal web performance.

Usage:
    python resize_images.py --categories ~/Desktop/categories --brands ~/Desktop/brands --products ~/Desktop/products

Sizes:
    - Categories: 400x400px, WebP format
    - Brands: 400x400px, WebP format
    - Products: 800x800px, WebP format
"""

import os
import sys
import argparse
from PIL import Image


def resize_and_convert(filepath, target_size, quality=85):
    """Resize image and convert to WebP format."""
    try:
        with Image.open(filepath) as img:
            orig_w, orig_h = img.size
            orig_size_kb = os.path.getsize(filepath) / 1024

            # Convert RGBA to RGB with white background for smaller WebP
            if img.mode in ('RGBA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[3] if len(img.split()) == 4 else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Resize with high quality
            img_resized = img.resize((target_size, target_size), Image.Resampling.LANCZOS)

            # New filepath with .webp extension
            base, _ = os.path.splitext(filepath)
            new_filepath = base + '.webp'

            # Save as WebP
            img_resized.save(new_filepath, 'WEBP', quality=quality, method=6)

            new_size_kb = os.path.getsize(new_filepath) / 1024

            # Remove original PNG file
            if filepath != new_filepath and os.path.exists(filepath):
                os.remove(filepath)

            return True, f"{orig_w}x{orig_h} ({orig_size_kb:.0f}KB) -> {target_size}x{target_size} ({new_size_kb:.0f}KB)"

    except Exception as e:
        return False, f"Error: {e}"


def process_folder(folder_path, target_size, label, quality=85):
    """Process all images in a folder."""
    if not os.path.isdir(folder_path):
        print(f"  Folder not found: {folder_path}")
        return 0

    print(f"\n{'=' * 50}")
    print(f"{label} -> {target_size}x{target_size}px WebP")
    print('=' * 50)

    converted = 0
    skipped = 0

    for filename in sorted(os.listdir(folder_path)):
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            if filename.lower().endswith('.webp'):
                skipped += 1
            continue

        filepath = os.path.join(folder_path, filename)
        success, msg = resize_and_convert(filepath, target_size, quality)

        if success:
            print(f"  [OK] {filename} -> .webp: {msg}")
            converted += 1
        else:
            print(f"  [ERROR] {filename}: {msg}")
            skipped += 1

    print(f"\n  Total: {converted} converted, {skipped} skipped")
    return converted


def process_products_folder(folder_path, target_size, quality=80):
    """Process products folder with brand subfolders."""
    if not os.path.isdir(folder_path):
        print(f"  Folder not found: {folder_path}")
        return 0

    print(f"\n{'=' * 50}")
    print(f"PRODUCTS -> {target_size}x{target_size}px WebP")
    print('=' * 50)

    total_converted = 0
    total_skipped = 0

    for brand_folder in sorted(os.listdir(folder_path)):
        brand_path = os.path.join(folder_path, brand_folder)
        if not os.path.isdir(brand_path) or brand_folder.startswith('.'):
            continue

        converted = 0
        skipped = 0

        for filename in sorted(os.listdir(brand_path)):
            if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                if filename.lower().endswith('.webp'):
                    skipped += 1
                    total_skipped += 1
                continue

            filepath = os.path.join(brand_path, filename)
            success, msg = resize_and_convert(filepath, target_size, quality)

            if success:
                converted += 1
                total_converted += 1
            else:
                skipped += 1
                total_skipped += 1

        if converted > 0:
            print(f"  {brand_folder}/: {converted} converted")

    print(f"\n  Total products: {total_converted} converted, {total_skipped} skipped")
    return total_converted


def main():
    parser = argparse.ArgumentParser(description='Resize images for optimal web performance')
    parser.add_argument('--categories', required=True, help='Path to categories folder')
    parser.add_argument('--brands', required=True, help='Path to brands folder')
    parser.add_argument('--products', required=True, help='Path to products folder')

    args = parser.parse_args()

    # Expand paths
    categories_path = os.path.expanduser(args.categories)
    brands_path = os.path.expanduser(args.brands)
    products_path = os.path.expanduser(args.products)

    print("Image Resize Tool")
    print("=" * 50)
    print(f"Categories: {categories_path} -> 400x400px")
    print(f"Brands: {brands_path} -> 400x400px")
    print(f"Products: {products_path} -> 800x800px")

    # Process each folder (quality: 85 for categories/brands, 80 for products)
    cat_count = process_folder(categories_path, 400, "CATEGORIES", quality=85)
    brand_count = process_folder(brands_path, 400, "BRANDS", quality=85)
    prod_count = process_products_folder(products_path, 800, quality=80)

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"  Categories resized: {cat_count}")
    print(f"  Brands resized: {brand_count}")
    print(f"  Products resized: {prod_count}")
    print(f"  Total: {cat_count + brand_count + prod_count}")


if __name__ == "__main__":
    main()
