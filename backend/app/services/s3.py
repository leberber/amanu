"""
S3 Service - Reusable S3 upload functionality
"""
import io
import re
from typing import Optional, Tuple
import boto3
from botocore.exceptions import ClientError
from PIL import Image

from app.core.config import settings


class S3Service:
    """Service for S3 operations"""

    _client = None

    @classmethod
    def get_client(cls):
        """Get or create S3 client (singleton pattern)"""
        if cls._client is None:
            cls._client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION
            )
        return cls._client

    @staticmethod
    def slugify(text: str) -> str:
        """Convert text to URL-safe slug"""
        import unicodedata
        # Normalize unicode characters
        text = unicodedata.normalize('NFD', text)
        # Remove diacritics
        text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
        # Convert to lowercase and replace non-alphanumeric with hyphens
        text = re.sub(r'[^a-zA-Z0-9]+', '-', text.lower())
        # Remove leading/trailing hyphens
        return text.strip('-')

    @classmethod
    def generate_product_key(cls, brand: str, product: str) -> str:
        """Generate S3 key for product image"""
        brand_slug = cls.slugify(brand)
        product_slug = cls.slugify(product)
        return f"products/{brand_slug}/{product_slug}.webp"

    @classmethod
    def get_public_url(cls, key: str) -> str:
        """Get public URL for S3 object"""
        return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/{key}"

    @classmethod
    def process_image(cls, image_data: bytes, max_size: int = 800) -> bytes:
        """Process and convert image to WebP format"""
        img = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'P'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Resize if larger than max_size
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # Convert to WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=85, optimize=True)
        output.seek(0)
        return output.read()

    @classmethod
    def upload_image(
        cls,
        image_data: bytes,
        brand: str,
        product: str,
        process: bool = True
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Upload image to S3

        Args:
            image_data: Raw image bytes
            brand: Product brand name
            product: Product name
            process: Whether to process/convert image to WebP

        Returns:
            Tuple of (success, url_or_error, key)
        """
        try:
            # Process image if requested
            if process:
                image_data = cls.process_image(image_data)

            # Generate key
            key = cls.generate_product_key(brand, product)

            # Upload to S3
            client = cls.get_client()
            client.put_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
                Body=image_data,
                ContentType='image/webp',
                CacheControl='max-age=31536000'  # 1 year cache
            )

            url = cls.get_public_url(key)
            return True, url, key

        except ClientError as e:
            error_msg = str(e)
            return False, f"S3 upload failed: {error_msg}", None
        except Exception as e:
            return False, f"Image processing failed: {str(e)}", None

    @classmethod
    def delete_image(cls, key: str) -> Tuple[bool, str]:
        """Delete image from S3"""
        try:
            client = cls.get_client()
            client.delete_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key
            )
            return True, "Deleted successfully"
        except ClientError as e:
            return False, str(e)

    @classmethod
    def object_exists(cls, key: str) -> bool:
        """Check if an S3 object exists"""
        try:
            client = cls.get_client()
            client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
            return True
        except ClientError:
            return False

    @classmethod
    def rename_image(
        cls,
        old_brand: str,
        old_name: str,
        new_brand: str,
        new_name: str
    ) -> Tuple[bool, Optional[str], str]:
        """
        Rename/move an image in S3 by copying to new key and deleting old.

        Args:
            old_brand: Original brand name
            old_name: Original product name
            new_brand: New brand name
            new_name: New product name

        Returns:
            Tuple of (success, new_url_or_none, message)
        """
        old_key = cls.generate_product_key(old_brand, old_name)
        new_key = cls.generate_product_key(new_brand, new_name)

        # Same key, no rename needed
        if old_key == new_key:
            return True, cls.get_public_url(new_key), "No rename needed"

        # Check if old object exists
        if not cls.object_exists(old_key):
            return False, None, f"Source image not found: {old_key}"

        try:
            client = cls.get_client()

            # Copy to new location
            client.copy_object(
                Bucket=settings.AWS_S3_BUCKET,
                CopySource={'Bucket': settings.AWS_S3_BUCKET, 'Key': old_key},
                Key=new_key,
                ContentType='image/webp',
                CacheControl='max-age=31536000',
                MetadataDirective='REPLACE'
            )

            # Delete old object
            client.delete_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=old_key
            )

            new_url = cls.get_public_url(new_key)
            return True, new_url, "Image renamed successfully"

        except ClientError as e:
            return False, None, f"S3 rename failed: {str(e)}"

    @classmethod
    def extract_brand_name_from_url(cls, url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Extract brand and product name from S3 URL.

        Expected format: .../products/{brand}/{name}.webp

        Returns:
            Tuple of (brand, name) or (None, None) if parsing fails
        """
        if not url:
            return None, None

        try:
            # Remove query params
            url = url.split('?')[0]

            # Extract path after /products/
            if '/products/' not in url:
                return None, None

            path = url.split('/products/')[-1]
            parts = path.split('/')

            if len(parts) != 2:
                return None, None

            brand = parts[0]
            name = parts[1].replace('.webp', '')

            return brand, name
        except Exception:
            return None, None
