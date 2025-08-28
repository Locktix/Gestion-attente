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

  // Notifier que Firebase est prêt côté RTDB (permet au store de s'attacher)
  try{ window.dispatchEvent(new CustomEvent('firebase-ready')); }catch(_e){}

  // Suivi de l'état de connexion à la RTDB
  try{
    const connRef = ref(db, '.info/connected');
    onValue(connRef, (snap)=>{
      const isConnected = !!snap.val();
      try{ window.dispatchEvent(new CustomEvent('firebase-connection', { detail: isConnected })); }catch(_e){}
    });
  }catch(_e){}

  // Auth anonyme (nécessaire si les règles exigent auth != null)
  const auth = getAuth(app);
  signInAnonymously(auth).catch((e)=>{
    console.warn('[Firebase] Auth anonyme échouée', e);
  });
  onAuthStateChanged(auth, (user)=>{
    if(user){
      console.debug('[Firebase] initialisé (auth anonyme OK)');
    }
  });

}catch(e){
  console.warn('Firebase non initialisé:', e);
  window.FirebaseDB = null;
}

// Sécurité: si aucun signal de connexion reçu, marquer hors ligne après 2.5s
setTimeout(()=>{
  try{
    if(!document.documentElement.dataset.firebase){
      document.documentElement.dataset.firebase = 'offline';
      const badge = document.querySelector('.firebase-indicator');
      if(badge){ badge.textContent = 'Synchro Firebase: Hors ligne'; }
    }
  }catch(_e){}
}, 2500);


