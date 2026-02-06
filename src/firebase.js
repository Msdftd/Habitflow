import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
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
const db = getFirestore(app);

export {
  db,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
};
