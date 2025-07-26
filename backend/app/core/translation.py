# backend/app/core/translation.py
from typing import Dict, Any, Optional

class TranslationService:
    """Service for handling translations"""
    
    SUPPORTED_LANGUAGES = ['en', 'fr', 'ar']
    DEFAULT_LANGUAGE = 'en'
    
    @classmethod
    def get_translated_field(
        cls, 
        default_value: str, 
        translations: Optional[Dict[str, str]], 
        language: str
    ) -> str:
        """
        Get translated field value with fallback
        
        Args:
            default_value: The default/original value
            translations: Dictionary of translations {lang: value}
            language: Requested language code
            
        Returns:
            Translated value or fallback to default
        """
        if not language or language not in cls.SUPPORTED_LANGUAGES:
            language = cls.DEFAULT_LANGUAGE
            
        if translations and language in translations:
            translated = translations.get(language, '').strip()
            if translated:  # Only return if translation exists and is not empty
                return translated
                
        return default_value
    
    @classmethod
    def apply_translations_to_dict(
        cls, 
        item_dict: Dict[str, Any], 
        language: str,
        translatable_fields: list = None
    ) -> Dict[str, Any]:
        """
        Apply translations to a dictionary object
        
        Args:
            item_dict: Dictionary containing the item data
            language: Target language
            translatable_fields: List of fields that can be translated
            
        Returns:
            Dictionary with translated values
        """
        if translatable_fields is None:
            translatable_fields = ['name', 'description']
            
        result = item_dict.copy()
        
        for field in translatable_fields:
            if field in result:
                translation_field = f"{field}_translations"
                if translation_field in result:
                    result[field] = cls.get_translated_field(
                        default_value=result[field],
                        translations=result[translation_field],
                        language=language
                    )
                    # Optionally remove translation fields from response
                    # result.pop(translation_field, None)
        
        return result
    
    @classmethod
    def apply_translations_to_model(cls, model_instance, language: str):
        """
        Apply translations to a SQLModel instance
        
        Args:
            model_instance: SQLModel instance (Product or Category)
            language: Target language
        """
        # Update name if translations exist
        if hasattr(model_instance, 'get_translated_name'):
            model_instance.name = model_instance.get_translated_name(language)
            
        # Update description if translations exist
        if hasattr(model_instance, 'get_translated_description'):
            translated_desc = model_instance.get_translated_description(language)
            if translated_desc is not None:
                model_instance.description = translated_desc
        
        return model_instance