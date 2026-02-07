import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB4P1Yme4rca3TacA3eM8QWcPDCkVsQyZw",
  authDomain: "habitflow-1d99a.firebaseapp.com",
  projectId: "habitflow-1d99a",
  storageBucket: "habitflow-1d99a.firebasestorage.app",
  messagingSenderId: "948764177495",
  appId: "1:948764177495:web:344b47b889568ffb985f12",
  measurementId: "G-D4JDW0N1P4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
};
