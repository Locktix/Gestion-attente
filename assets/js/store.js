// Stockage partagé via localStorage + BroadcastChannel + fallback polling
(function(){
  const CHANNEL_NAME = 'gestion-attente';
  const STORAGE_KEY = 'queue-state-v1';
  const FIREBASE_PATH = 'queue/state';

  const initialState = {
    lastIssued: 0,      // dernier numéro délivré (valeur numérique)
    lastCalled: '',     // dernier ticket appelé, ex: "12A"
    history: [],        // derniers libellés appelés (ex: "12A")
    queue: []           // numéros en attente (FIFO) → nombres simples
  };

  function coerceQueue(q){
    if(!Array.isArray(q)) return [];
    return q.map((item)=> Number(item)||0);
  }

  function getState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
        return {...initialState};
      }
      const parsed = JSON.parse(raw);
      // sécuriser les champs
      return {
        lastIssued: Number(parsed.lastIssued)||0,
        lastCalled: typeof parsed.lastCalled==='string'? parsed.lastCalled:'',
        history: Array.isArray(parsed.history)? parsed.history.map(String).slice(0,20):[],
        queue: coerceQueue(parsed.queue)
      };
    }catch(err){
      console.error('Lecture état échouée', err);
      return {...initialState};
    }
  }

  function setState(next){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    broadcast(next);
  }

  function update(mutator){
    const current = getState();
    const next = mutator({...current});
    setState(next);
    return next;
  }

  // Broadcast
  let channel = null;
  try{
    channel = new BroadcastChannel(CHANNEL_NAME);
  }catch(_e){
    channel = null;
  }

  function broadcast(state){
    try{ channel && channel.postMessage({type:'state', state}); }catch(_e){}
  }

  function onChange(cb){
    // 1) BroadcastChannel
    if(channel){
      channel.addEventListener('message', (e)=>{
        if(e.data && e.data.type==='state') cb(e.data.state);
      });
    }
    // 2) localStorage events
    window.addEventListener('storage', (e)=>{
      if(e.key===STORAGE_KEY && e.newValue){
        try{ cb(JSON.parse(e.newValue)); }catch(_e){}
      }
    });
    // 3) Polling fallback
    let lastRaw = localStorage.getItem(STORAGE_KEY);
    setInterval(()=>{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw!==lastRaw){
        lastRaw = raw;
        try{ cb(JSON.parse(raw)); }catch(_e){}
      }
    }, 2000);
  }

  // Détection Firebase (peut être retardée)
  let hasFirebase = !!(window.FirebaseDB && window.FirebaseDB.db);

  function attachFirebase(){
    if(!(window.FirebaseDB && window.FirebaseDB.db)) return;
    hasFirebase = true;
    const { db, ref, onValue, runTransaction, get, set } = window.FirebaseDB;
    const stateRef = ref(db, FIREBASE_PATH);

    // Initialiser si n'existe pas
    get(stateRef).then((snap)=>{
      if(!snap.exists()){
        console.debug('[RTDB] init état', initialState);
        return set(stateRef, initialState);
      }
      return null;
    }).catch((e)=>{ console.warn('Firebase get/init échoué', e); });

    // Abonnement temps réel → met à jour le cache local + broadcast
    onValue(stateRef, (snapshot)=>{
      const val = snapshot.val();
      if(val){
        const safe = {
          lastIssued: Number(val.lastIssued)||0,
          lastCalled: typeof val.lastCalled==='string'? val.lastCalled:'',
          history: Array.isArray(val.history)? val.history.map(String).slice(0,20):[],
          queue: coerceQueue(val.queue)
        };
        console.debug('[RTDB] onValue → setState', safe);
        setState(safe);
      }
    });

    // API basée Firebase
    window.QueueStore = {
      getState,
      onChange,
      async issueTicket(){
        return window.FirebaseDB.runTransaction(stateRef, (current)=>{
          const s = current || {...initialState};
          s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue.push(nextNumber);
          return s;
        }).then((res)=>{
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          console.debug('[RTDB] issueTicket OK →', finalState);
          return finalState;
        }).catch((_e)=>{
          console.warn('[RTDB] issueTicket échec, fallback local');
          return update((s)=>{
            s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
            const nextNumber = (Number(s.lastIssued)||0)+1;
            s.lastIssued = nextNumber;
            s.queue.push(nextNumber);
            return s;
          });
        });
      },
      async callNext(room){
        return window.FirebaseDB.runTransaction(stateRef, (current)=>{
          const s = current || {...initialState};
          s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          const wanted = (room ? String(room).toUpperCase() : '');
          const label = wanted ? `${next}${wanted}` : String(next);
          s.lastCalled = label;
          s.history = Array.isArray(s.history)? s.history.map(String):[];
          s.history.unshift(label);
          s.history = s.history.slice(0,8);
          return s;
        }).then((res)=>{
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          console.debug('[RTDB] callNext OK →', finalState);
          return finalState;
        }).catch((_e)=>{
          console.warn('[RTDB] callNext échec, fallback local');
          return update((s)=>{
            s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
            if(!s.queue.length) return s;
            const next = s.queue.shift();
            const wanted = (room ? String(room).toUpperCase() : '');
            const label = wanted ? `${next}${wanted}` : String(next);
            s.lastCalled = label;
            s.history = Array.isArray(s.history)? s.history.map(String):[];
            s.history.unshift(label);
            s.history = s.history.slice(0,8);
            return s;
          });
        });
      }
    };
  }

  // Si Firebase est déjà prêt au chargement
  if(hasFirebase){
    attachFirebase();
  } else {
    // Fallback 100% local
    const Store = {
      getState,
      onChange,
      issueTicket(){
        const out = update((s)=>{
          s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue.push(nextNumber);
          return s;
        });
        console.debug('[LOCAL] issueTicket →', out);
        return out;
      },
      callNext(room){
        const out = update((s)=>{
          s.queue = Array.isArray(s.queue)? coerceQueue(s.queue):[];
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          const wanted = (room ? String(room).toUpperCase() : '');
          const label = wanted ? `${next}${wanted}` : String(next);
          s.lastCalled = label;
          s.history = Array.isArray(s.history)? s.history.map(String):[];
          s.history.unshift(label);
          s.history = s.history.slice(0,8);
          return s;
        });
        console.debug('[LOCAL] callNext →', out);
        return out;
      }
    };
    window.QueueStore = Store;
  }

  // Basculer automatiquement dès que Firebase est prêt
  window.addEventListener('firebase-ready', ()=>{
    if(!hasFirebase){
      console.debug('[RTDB] Firebase prêt → bascule du store');
      attachFirebase();
    }
  });

  // Indicateur de connexion (événement relayé par firebase-init)
  window.addEventListener('firebase-connection', (e)=>{
    const isOnline = !!(e && e.detail);
    try{
      document.documentElement.dataset.firebase = isOnline ? 'online' : 'offline';
      const badge = document.querySelector('.firebase-indicator');
      if(badge){
        badge.textContent = isOnline ? 'Synchro Firebase: En ligne' : 'Synchro Firebase: Hors ligne';
      }
    }catch(_e){}
  });
})();


