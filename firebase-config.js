// ============================================
// FIREBASE CONFIG (Firestore only, no Auth)
// ============================================
// Admin account syncs across devices via Firestore.
// No authentication — just direct Firestore reads/writes.
//
// SECURITY: Set Firestore rules to:
//   - Allow read on 'aerocade_admin' doc for everyone
//   - Allow write on 'aerocade_admin' doc for no one (writes via admin panel only during dev)
//   - Or restrict to your IP/domain
// ============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB-_mSV7193f0aWKFQo9Ck6ApxhhMHICSs",
    authDomain: "aerocade-5c9b3.firebaseapp.com",
    projectId: "aerocade-5c9b3",
    storageBucket: "aerocade-5c9b3.firebasestorage.app",
    messagingSenderId: "377096947401",
    appId: "1:377096947401:web:773981423327e93cbf6f18"
};

// Initialize Firebase (Firestore only)
if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY_HERE') {
    firebase.initializeApp(FIREBASE_CONFIG);
    window._fbDB = firebase.firestore();
    window._fbReady = true;
    console.log('Firebase Firestore initialized');
} else {
    window._fbDB = null;
    window._fbReady = false;
    console.warn('Firebase not configured. Using localStorage only.');
}
