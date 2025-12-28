// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBQAeyk9zQY3Ieso1ELAs37Hc1SWBwvPPY",
  authDomain: "habyss-production.firebaseapp.com",
  projectId: "habyss-production",
  storageBucket: "habyss-production.firebasestorage.app",
  messagingSenderId: "250850515250",
  appId: "1:250850515250:web:4409eafdf14e878da69f2b",
  measurementId: "G-21L0C836LX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});