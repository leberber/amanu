# Refactoring Checklist for Amanu E-commerce

## Overview
This checklist should be used when refactoring components in the Amanu e-commerce application to ensure consistent, maintainable, and high-quality code.

## Core Principles

### 1. DRY (Don't Repeat Yourself)
- [ ] alwasy refer to the header component for styling and patterns. --> very very very important.
- [ ] only use custom css for a compente specific scss file when it is very necessary --> very importnat
- [ ] Use angular 20 and prime ng 20. --> very important
- [ ] dont not use complex imports just use 
- [ ] Identify and eliminate duplicate code
- [ ] Extract common logic into shared services or utilities
- [ ] Create reusable components for repeated UI patterns
- [ ] Consolidate similar functions into parameterized versions

### 2. Use PrimeFlex/PrimeNG Classes
- [ ] Replace custom CSS with PrimeFlex utility classes where possible
- [ ] Use PrimeNG component classes instead of custom styling
- [ ] Leverage PrimeFlex spacing classes (p-m-*, p-p-*, etc.)
- [ ] Use PrimeFlex flexbox and grid classes
- [ ] Apply PrimeFlex responsive classes for mobile/desktop

### 3. Template Structure Consistency
- [ ] Follow the header component pattern with ng-template definitions
- [ ] Separate templates into logical sections (desktop/mobile views)
- [ ] Use descriptive template names (#desktopView, #mobileView, etc.)
- [ ] Keep template logic minimal - move complex logic to component methods

### 4. Code Readability & Maintainability
- [ ] Use clear, descriptive variable and method names
- [ ] Keep methods small and focused (single responsibility)
- [ ] Add meaningful comments for complex logic only
- [ ] Group related properties and methods together
- [ ] Use TypeScript interfaces for better type safety
- [ ] Avoid deeply nested code - extract to methods

### 5. Centralize Styling & Consistency
- [ ] Move component-specific styles to a central styles file
- [ ] Create CSS variables for commonly used values
- [ ] Use theme variables from PrimeNG
- [ ] Avoid inline styles - use classes instead
- [ ] Create mixins for repeated style patterns
- [ ] Ensure consistent font families across all components
- [ ] Use consistent font sizes (use PrimeNG's text-xs, text-sm, text-base, text-lg, etc.)
- [ ] Apply consistent font weights (normal, medium, semibold, bold)
- [ ] Maintain consistent spacing patterns (use same padding/margin scales)
- [ ] Use consistent border radius values
- [ ] Ensure consistent color usage (primary, secondary, success, danger, warning)
- [ ] Apply consistent hover/focus states
- [ ] Use consistent shadow styles
- [ ] Maintain consistent button sizes and styles
- [ ] Ensure consistent form input styling

### 6. Performance Optimization
- [ ] Use OnPush change detection where possible
- [ ] Implement trackBy functions for *ngFor loops
- [ ] Lazy load heavy components
- [ ] Debounce user inputs (search, filters)
- [ ] Minimize API calls - cache when appropriate
- [ ] Use computed signals for derived state

### 7. Error Handling
- [ ] Implement proper error handling for all API calls
- [ ] Show user-friendly error messages
- [ ] Log errors appropriately
- [ ] Provide fallback UI for error states
- [ ] Handle edge cases gracefully

### 8. Component Structure
- [ ] Follow Angular style guide naming conventions
- [ ] Organize imports (Angular, PrimeNG, custom)
- [ ] Declare properties in logical order (inputs, outputs, services, state)
- [ ] Use lifecycle hooks appropriately
- [ ] Implement proper cleanup in ngOnDestroy

### 9. Language Support & Internationalization
- [ ] Ensure all user-facing text uses translation keys
- [ ] Handle RTL layout properly for Arabic
- [ ] Use translation service for dynamic content
- [ ] Format dates, numbers, and currency according to locale
- [ ] Test all components in all supported languages (English, French, Arabic)
- [ ] Use logical CSS properties (margin-inline-start vs margin-left)
- [ ] Ensure proper text direction for mixed content
- [ ] Handle language changes without page reload
- [ ] Cache translations appropriately
- [ ] Provide fallback text for missing translations

## How to Use This Checklist

### For Individual Component Refactoring:
```bash
# 1. Copy this checklist to your working area
# 2. Go through each section for the component
# 3. Check off completed items
# 4. Review with team before merging
```

### To trigger refactoring with Claude:
When working with Claude, you can reference this checklist by saying:
"Please refactor [component name] following the REFACTORING_CHECKLIST.md principles"

### Priority Order:
1. Start with code readability and DRY principle
2. Ensure language support and internationalization
3. Then move to PrimeFlex/PrimeNG classes
4. Standardize template structure
5. Centralize styling
6. Optimize performance
7. Enhance error handling

## Component-Specific Notes

### Cart Component
- Focus on simplifying the translation loading logic
- Consolidate desktop/mobile views
- Extract price calculations to computed properties

### Product List Component
- Simplify filter state management
- Consolidate search functionality
- Extract product card as a dumb component

### Product Card Component
- Make it a pure presentation component
- Move business logic to parent
- Simplify quantity selection

## Example Refactoring Pattern

### Before:
```typescript
// Inline styles, duplicate logic, unclear naming
<div style="margin: 10px; padding: 5px;">
  <span class="custom-text">{{item.price * item.quantity}}</span>
</div>
```

### After:
```typescript
// Using PrimeFlex, computed property, clear naming
<div class="p-m-2 p-p-1">
  <span class="text-primary">{{calculateTotalPrice(item)}}</span>
</div>
```

## Style Consistency Guidelines

### Typography
- **Font Family**: Use `var(--font-family)` everywhere
- **Font Sizes**: 
  - `text-xs`: 0.75rem (small labels, badges)
  - `text-sm`: 0.875rem (secondary text, descriptions)
  - `text-base`: 1rem (body text)
  - `text-lg`: 1.125rem (subtitles)
  - `text-xl`: 1.25rem (titles)
  - `text-2xl`: 1.5rem (page headers)
- **Font Weights**:
  - `font-normal`: 400 (body text)
  - `font-medium`: 500 (emphasis)
  - `font-semibold`: 600 (headings)
  - `font-bold`: 700 (strong emphasis)

### Spacing Scale
- Use PrimeFlex classes: p-1 (0.25rem), p-2 (0.5rem), p-3 (1rem), p-4 (1.5rem)
- Be consistent: if cards use p-3, all cards should use p-3

### Colors
- Primary actions: `text-primary`, `bg-primary`
- Errors: `text-red-500`, `bg-red-500`
- Success: `text-green-500`, `bg-green-500`
- Warning: `text-orange-500`, `bg-orange-500`
- Muted text: `text-500`, `text-600`

## Language-Specific Considerations

### Arabic (RTL) Support
- Use `me-*` and `ms-*` classes instead of `mr-*` and `ml-*`
- Test all layouts in RTL mode
- Ensure icons that indicate direction are flipped
- Use CSS logical properties where PrimeFlex doesn't provide them

### Translation Best Practices
- Keep translation keys hierarchical and logical
- Group related translations together
- Always provide context for translators
- Use interpolation for dynamic values: `{count}`, `{name}`

## Checklist Version
Version: 1.2
Last Updated: 2025-08-14
Changes: 
- Added Language Support & Internationalization section
- Expanded styling section to include font and style consistency
- Added Style Consistency Guidelines with specific values


 