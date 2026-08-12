import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Fallback config from original code for immediate functionality
const firebaseConfig = {
    apiKey: "AIzaSyBsfvTms61f0jl1TjAFhNFgcdM6lc9q7zQ",
    authDomain: "pedidos-91d60.firebaseapp.com",
    projectId: "pedidos-91d60",
    storageBucket: "pedidos-91d60.appspot.com",
    messagingSenderId: "833973647910",
    appId: "1:833973647910:web:68235d2d6ca9b41af584e7",
    measurementId: "G-3HCRLLMEBN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Anonymous auth helper
export const ensureAuth = async () => {
    if (!auth.currentUser) {
        await signInAnonymously(auth);
    }
    return auth.currentUser;
};

// Data paths
export const APP_ID = "default-shopping-platform"; // Ideally projectId, but keeping compatibility
export const BASE_PATH = `artifacts/${APP_ID}/public/data`;
