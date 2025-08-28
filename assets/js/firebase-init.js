// Initialise Firebase (Realtime Database) et expose une API minimale sur window.FirebaseDB
// Chargé en <script type="module"> pour pouvoir importer depuis le CDN Firebase v12

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, set, update, get, child } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwbWEYidxJsV26OEa7a_C4y9NS-ZLt6ko",
  authDomain: "smg-file-d-attente.firebaseapp.com",
  databaseURL: "https://smg-file-d-attente-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "smg-file-d-attente",
  storageBucket: "smg-file-d-attente.firebasestorage.app",
  messagingSenderId: "757201456603",
  appId: "1:757201456603:web:6f400839c7c4ee712c6bfe",
};

let db = null;
try{
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  window.FirebaseDB = { db, ref, onValue, runTransaction, set, update, get, child };
  const auth = getAuth(app);
  signInAnonymously(auth).catch((e)=>{
    console.warn('[Firebase] Auth anonyme échouée', e);
  });
  onAuthStateChanged(auth, (user)=>{
    if(user){
      window.dispatchEvent(new CustomEvent('firebase-ready'));
      console.debug('[Firebase] initialisé (auth anonyme OK)');
    }
  });
}catch(e){
  console.warn('Firebase non initialisé:', e);
  window.FirebaseDB = null;
}


