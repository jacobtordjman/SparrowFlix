# SparrowFlix Cleanup Plan - Component Redundancies & GitHub Pages Setup

## 🎯 **Current GitHub Pages Status:**
- **Root File**: `docs/index.html` 
- **Base Path**: `/SparrowFlix/` (configured in vite.config.js)
- **Build Directory**: `docs/assets/` (contains compiled JS/CSS)

## 🔄 **Redundant Components Found:**

### **1. Headers (3 versions):**
- ❌ `Header.jsx` - Basic header (OLD)
- ❌ `EnhancedHeader.jsx` - Enhanced header (DEPRECATED) 
- ✅ `NetflixStyleHeader.jsx` - **CURRENT** (Netflix-style with search/notifications)

### **2. Home Pages (3 versions):**
- ❌ `Home.jsx` - Basic home (OLD)
- ❌ `EnhancedHome.jsx` - Enhanced home (DEPRECATED)
- ✅ `NetflixHomepage.jsx` - **CURRENT** (Complete Netflix experience)

### **3. Content Rows (2 versions):**
- ❌ `ContentRow.jsx` - Basic content row (OLD)
- ✅ `EnhancedContentRow.jsx` - **CURRENT** (Netflix-style with hover effects)

## ✅ **Components to Keep (Current/Active):**
- ✅ `NetflixStyleHeader.jsx` + `netflix-header.css`
- ✅ `NetflixHomepage.jsx` + `netflix-homepage.css` 
- ✅ `HeroCarousel.jsx`
- ✅ `EnhancedContentRow.jsx`
- ✅ `VideoPlayer.jsx`
- ✅ `ReviewsAndRatings.jsx`
- ✅ `ShareableWatchlists.jsx`
- ✅ `SocialFeatures.jsx`
- ✅ `WatchHistory.jsx`

## 🗑️ **Components to Remove (Redundant):**
- ❌ `Header.jsx` 
- ❌ `EnhancedHeader.jsx`
- ❌ `Home.jsx` (in pages/)
- ❌ `EnhancedHome.jsx` (in pages/)
- ❌ `ContentRow.jsx`
- ❌ `MobileNav.jsx` (integrated into NetflixStyleHeader)

## 📋 **Cleanup Actions Needed:**

1. **Remove Redundant Files**
2. **Update App.jsx** ✅ (COMPLETED)
3. **Build & Deploy Updated Version**
4. **Update GitHub Pages Settings**

## 🚀 **Final GitHub Pages Structure:**
```
docs/
├── index.html (entry point)
├── assets/ (compiled files)
├── src/
│   ├── App.jsx ✅ (updated to use NetflixHomepage)
│   ├── components/
│   │   ├── NetflixStyleHeader.jsx ✅
│   │   ├── NetflixHomepage.jsx ✅
│   │   ├── HeroCarousel.jsx ✅
│   │   ├── EnhancedContentRow.jsx ✅
│   │   └── VideoPlayer.jsx ✅
│   └── pages/
│       ├── Movies.jsx
│       └── Player.jsx
```

## ⚙️ **GitHub Pages Configuration:**
- **Source**: Deploy from `/docs` folder
- **Custom Domain**: (optional)
- **Base URL**: `https://username.github.io/SparrowFlix/`
- **Build Command**: `npm run build` (outputs to docs/assets/)