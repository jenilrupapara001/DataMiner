# 📦 Actions Module Integration Guide

This directory contains the self-contained **Actions Module** extracted from the main project, organized for seamless integration into another codebase.

---

## 📂 Directory Structure

```text
actions-module/
├── backend/
│   ├── models/
│   │   └── Action.js            # Mongoose Schema/Model for Action items
│   └── routes/
│       └── actionRoutes.js      # Express Routes and Controller logic
└── frontend/
    ├── pages/
    │   └── ActionsPage.jsx      # React page container for Actions
    └── components/
        └── actions/             # React components supporting Actions
            ├── ActionChat.jsx
            ├── ActionChatWhatsApp.css
            ├── ActionList.jsx
            ├── ActionListEnhanced.jsx
            ├── ActionModal.css
            ├── ActionModal.jsx
            ├── CompletionModal.jsx
            ├── ObjectiveManager.jsx
            └── ReviewModal.jsx
```

---

## 🛠️ Integration Steps

### 1. Backend Integration

1. **Model Registration**:
   Copy `backend/models/Action.js` into your new project's models directory. Ensure any references to `User` or `Seller` are aligned with your new project's schema.

2. **Routes & Middleware**:
   Copy `backend/routes/actionRoutes.js` into your routes directory.
   In your main server/app file (e.g., `server.js` or `app.js`), mount the router:
   ```javascript
   const actionRoutes = require('./routes/actionRoutes');
   app.use('/api/actions', actionRoutes);
   ```

3. **Dependencies**:
   Ensure you have standard backend dependencies installed (e.g., `mongoose`, `express`, `multer` if handles uploads).

---

### 2. Frontend Integration

1. **Pages & Components**:
   * Copy `frontend/pages/ActionsPage.jsx` into your pages directory.
   * Copy the `frontend/components/actions/` folder into your components directory.

2. **Route Registration**:
   In your React Router config (e.g., `App.jsx`), import the page and mount the route:
   ```javascript
   import ActionsPage from './pages/ActionsPage';
   
   // Inside your Routes block:
   <Route path="/actions" element={<ActionsPage />} />
   ```

3. **CSS Imports**:
   Make sure the component files correctly resolve their relative imports for `.css` files (like `ActionModal.css` and `ActionChatWhatsApp.css`).
