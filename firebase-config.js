// ============================================
// FIREBASE CONFIG - Replace with your own config
// ============================================
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Click the web icon (</>) to add a web app
// 4. Copy the config object below
// 5. Enable Email/Password auth in Authentication > Sign-in method
// 6. Create a Firestore database in Firestore > Create database
// 7. Set Firestore rules to allow read/write for all (or authenticated users)
// ============================================

const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY_HERE') {
    firebase.initializeApp(FIREBASE_CONFIG);
    window._fbAuth = firebase.auth();
    window._fbDB = firebase.firestore();
    window._fbReady = true;
    console.log('Firebase initialized successfully');
} else {
    window._fbAuth = null;
    window._fbDB = null;
    window._fbReady = false;
    console.warn('Firebase not configured. Using localStorage fallback. See firebase-config.js for setup instructions.');
}
