# Chrome Web Store Submission Checklist

## ✅ Pre-Submission Requirements

### 1. Extension Package
- [x] **Manifest V3** compliant
- [x] **Version number** set (1.0.0)
- [x] **Name** matches branding ("Promptr")
- [x] **Description** under 132 characters
- [x] **Icons** included (16x16, 48x48, 128x128)
- [x] **Permissions** justified and minimal
- [x] **Build** production version without console logs

### 2. Required Assets
- [ ] **Screenshots** (1-5 required)
  - [ ] 1280x800 or 640x400 pixels
  - [ ] PNG or JPG format
  - [ ] Show key features
  - [ ] No personal information visible
- [ ] **Promotional Images** (optional but recommended)
  - [ ] Small tile: 440x280
  - [ ] Large tile: 920x680
  - [ ] Marquee: 1400x560

### 3. Store Listing Information
- [ ] **Detailed Description** (up to 16,000 characters)
- [ ] **Category** selection (Productivity recommended)
- [ ] **Language** (English)
- [ ] **Primary Category** (Productivity Tools)
- [ ] **Privacy Policy URL** (host on promptr.one/privacy)
- [ ] **Support Email** (e.g., support@promptr.one)
- [ ] **Website URL** (https://promptr.one)

### 4. Privacy & Security
- [x] **Privacy Policy** created
- [ ] **Privacy Policy** hosted online
- [x] **OAuth** properly configured
- [x] **Data handling** documented
- [x] **No hardcoded secrets** in code
- [x] **Secure storage** for tokens

### 5. Code Quality
- [x] **ESLint** configured
- [x] **No console logs** in production
- [x] **Error handling** implemented
- [x] **innerHTML** usage reviewed
- [x] **Production build** tested
- [ ] **All features** working correctly

### 6. Testing Checklist
- [ ] **Chrome** latest version tested
- [ ] **All supported sites** tested:
  - [ ] Claude.ai
  - [ ] ChatGPT
  - [ ] Gemini
  - [ ] Perplexity
  - [ ] Others
- [ ] **Keyboard shortcuts** working
- [ ] **Context menu** functioning
- [ ] **Authentication flow** smooth
- [ ] **Template loading** successful
- [ ] **Text formatting** accurate
- [ ] **History tracking** working

### 7. Documentation
- [x] **README** comprehensive
- [x] **Installation instructions** clear
- [x] **Usage guide** included
- [x] **Troubleshooting** section added
- [ ] **CHANGELOG** created
- [ ] **LICENSE** file added

## 📋 Submission Steps

### Step 1: Final Build
```bash
npm run clean
npm run build:production
```

### Step 2: Create ZIP Package
```bash
cd dist
zip -r ../promptr-extension.zip ./*
cd ..
```

### Step 3: Developer Account
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer fee (if not already done)
3. Complete account verification

### Step 4: Create New Item
1. Click "New Item"
2. Upload the ZIP file
3. Fill in all required fields
4. Add screenshots
5. Set privacy practices disclosures

### Step 5: Privacy Practices
Declare the following:
- ✅ Personally identifiable information (email for auth)
- ✅ Authentication information (OAuth tokens)
- ✅ User-generated content (templates)
- ❌ Financial information
- ❌ Health information
- ✅ Website content (selected text for formatting)
- ❌ Personal communications

### Step 6: Submit for Review
1. Review all information
2. Click "Submit for Review"
3. Wait 1-3 business days for approval

## ⚠️ Common Rejection Reasons

- **Missing screenshots** - Always include at least 1
- **Excessive permissions** - Justify each permission
- **Console logs in production** - Remove all debugging code
- **Missing privacy policy** - Must be hosted and accessible
- **Misleading description** - Be accurate about features
- **Trademark violations** - Don't use other company names
- **Poor user experience** - Test thoroughly

## 📝 Post-Submission

### After Approval:
- [ ] Update website with Chrome Web Store link
- [ ] Announce on social media
- [ ] Monitor user reviews
- [ ] Track installation metrics
- [ ] Prepare for user support

### Maintenance:
- [ ] Regular updates for bug fixes
- [ ] Respond to user reviews
- [ ] Keep privacy policy updated
- [ ] Monitor Chrome API changes
- [ ] Update for new AI platforms

## 🚀 Quick Commands

```bash
# Clean build for submission
npm run clean && npm run build:production

# Create submission package
cd dist && zip -r ../promptr-v1.0.0.zip ./* && cd ..

# Test the package
# 1. Go to chrome://extensions
# 2. Remove existing extension
# 3. Drag and drop the ZIP file
# 4. Test all features

# Verify no console logs
grep -r "console\." dist/ --exclude="*.map"
```

## 📌 Important Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Store Listing Best Practices](https://developer.chrome.com/docs/webstore/best-practices/)

---

**Final Check**: Before submitting, ask yourself:
1. Would I install this extension?
2. Is the user experience smooth?
3. Are all features working as advertised?
4. Is the privacy policy clear and accurate?
5. Have I tested on a clean Chrome profile?

If all answers are YES, you're ready to submit! 🎉