# Google Play Store Publishing Guide for Elsuq

## Overview
This document captures the steps taken to publish Elsuq as a PWA (Progressive Web App) to the Google Play Store using TWA (Trusted Web Activity).

---

## Completed Steps

### 1. PWA Manifest Configuration
**File:** `frontend/public/manifest.webmanifest`

Updated manifest with required fields:
- `name`: "Elsuq - Fresh Produce Delivery"
- `short_name`: "Elsuq"
- `description`: Added app description
- `id`, `lang`, `dir`: Added for app identification
- `orientation`: "portrait"
- `categories`: ["shopping", "food"]
- `shortcuts`: Added quick actions for Products and Cart

### 2. Fixed Icon Paths
- Corrected maskable icon paths (added `icons/` prefix)
- Icons located in `frontend/public/icons/`

### 3. Added Screenshots
**Location:** `frontend/public/screenshots/`
- `screenshot-wide.png` (1280x720) - Desktop view
- `screenshot-mobile.png` (750x1334) - Mobile view

Added to manifest with proper `form_factor` declarations.

### 4. Service Worker
Angular's service worker was already configured:
- **Config:** `frontend/ngsw-config.json`
- **Registration:** `frontend/src/app/app.config.ts`
- Enabled in production builds via `angular.json`

### 5. Generated Android Package via PWABuilder
**Tool:** https://pwabuilder.com

**Package settings:**
- Package ID: `org.elsuq.twa`
- App name: `Elsuq`
- Short name: `Elsuq`

**Generated files (keep these safe!):**
- `Elsuq.aab` - Android App Bundle (upload to Play Console)
- `Elsuq.apk` - APK for testing
- `assetlinks.json` - Domain verification
- `signing.keystore` - **IMPORTANT: Keep safe for future updates**
- `signing-key-info.txt` - Keystore passwords

### 6. Digital Asset Links Setup
**Purpose:** Proves domain ownership to Google Play

**Attempt 1 - Backend (not used):**
Added static file serving to `backend/main.py`:
```python
# Serve .well-known directory for Android App Links verification
well_known_path = os.path.join(os.path.dirname(__file__), ".well-known")
if os.path.exists(well_known_path):
    app.mount("/.well-known", StaticFiles(directory=well_known_path), name="well-known")
```
Also created `backend/.well-known/assetlinks.json`

*Note: This didn't work because Nginx intercepts requests before reaching FastAPI.*

**Attempt 2 - Frontend (working solution):**
**File created:** `frontend/public/.well-known/assetlinks.json`

**Contents:**
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "org.elsuq.twa",
    "sha256_cert_fingerprints": ["4F:48:6A:E0:3E:8B:BD:30:CB:23:BC:E0:0C:91:EB:30:CB:98:F9:FF:FF:FB:46:0E:B9:34:15:30:E0:C7:11:A3"]
  }
}]
```

Angular's `angular.json` already includes `"glob": "**/*", "input": "public"` which copies the `.well-known` folder to the build output.

**Verified working at:** https://elsuq.org/.well-known/assetlinks.json

### 7. Google Play Console Setup
- Created developer account (Account ID: 6287219035861423041)
- Paid $25 registration fee
- Created "Elsuq" app (currently in Draft)

---

## Remaining Steps

### 1. Complete Developer Verification
- [ ] Upload identity document (ID/passport)
- [ ] Install Play Console app on Android device
- [ ] Verify phone number (after identity approved)

*Note: Identity verification may take a few days*

### 2. Complete Store Listing
In Google Play Console, fill in:
- [ ] App description (short and full)
- [ ] Screenshots (upload the ones created)
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Category: Shopping or Food & Drink
- [ ] Contact email
- [ ] Privacy policy URL

### 3. Content Rating
- [ ] Complete content rating questionnaire
- [ ] Get IARC rating

### 4. Upload App Bundle
- [ ] Go to Release > Production
- [ ] Upload `Elsuq.aab`
- [ ] Create release

### 5. Submit for Review
- [ ] Review all sections are complete
- [ ] Submit app for Google review
- [ ] Wait for approval (typically 1-7 days)

---

## Important Files to Keep Safe

| File | Purpose |
|------|---------|
| `signing.keystore` | Required for all future app updates |
| `signing-key-info.txt` | Contains keystore passwords |
| `Elsuq.aab` | Android App Bundle |

**WARNING:** If you lose `signing.keystore`, you cannot update the app. Store it securely!

---

## Useful Commands

### Rebuild and Deploy
```bash
cd frontend && npm run build
./deploy.sh
```

### Test PWA locally
```bash
cd frontend && npm start
```

### Verify assetlinks.json
```bash
curl https://elsuq.org/.well-known/assetlinks.json
```

---

## Resources

- [PWABuilder](https://pwabuilder.com) - Generate Android packages
- [Google Play Console](https://play.google.com/console) - Manage app
- [Digital Asset Links Tester](https://developers.google.com/digital-asset-links/tools/generator) - Verify assetlinks.json
- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/) - Trusted Web Activity docs

---

## Timeline

| Date | Action |
|------|--------|
| 23/01/2026 | App created in Play Console (Draft) |
| 24/01/2026 | PWA configured, Android package generated, assetlinks.json deployed |

---

*Last updated: 24/01/2026*
