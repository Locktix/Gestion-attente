// Stockage partagé via localStorage + BroadcastChannel + fallback polling
(function(){
  const CHANNEL_NAME = 'gestion-attente';
  const STORAGE_KEY = 'queue-state-v1';
  const FIREBASE_PATH = 'queue/state';

  const initialState = {
    lastIssued: 0,      // dernier numéro délivré à la borne
    lastCalled: 0,      // dernier numéro appelé par le médecin
    history: [],        // derniers numéros appelés (du plus récent au plus ancien)
    queue: []           // numéros en attente (FIFO)
  };

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
        lastCalled: Number(parsed.lastCalled)||0,
        history: Array.isArray(parsed.history)? parsed.history.slice(0,20):[],
        queue: Array.isArray(parsed.queue)? parsed.queue:[]
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

  // Détection Firebase
  const hasFirebase = !!(window.FirebaseDB && window.FirebaseDB.db);

  // Si Firebase est dispo, abonnez-vous au noeud et synchronisez localStorage
  if(hasFirebase){
    const { db, ref, onValue, runTransaction, get, set } = window.FirebaseDB;
    const stateRef = ref(db, FIREBASE_PATH);

    // Initialiser si n'existe pas
    get(stateRef).then((snap)=>{
      if(!snap.exists()){
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
          lastCalled: Number(val.lastCalled)||0,
          history: Array.isArray(val.history)? val.history.slice(0,20):[],
          queue: Array.isArray(val.queue)? val.queue:[]
        };
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
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue = Array.isArray(s.queue)? s.queue:[];
          s.queue.push(nextNumber);
          return s;
        }).then((res)=>{
          // res.snapshot.val() contient l'état final
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          return finalState;
        }).catch((_e)=>{
          // fallback local si la transaction échoue
          return update((s)=>{
            const nextNumber = (Number(s.lastIssued)||0)+1;
            s.lastIssued = nextNumber;
            s.queue.push(nextNumber);
            return s;
          });
        });
      },
      async callNext(){
        return window.FirebaseDB.runTransaction(stateRef, (current)=>{
          const s = current || {...initialState};
          s.queue = Array.isArray(s.queue)? s.queue:[];
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          s.lastCalled = next;
          s.history = Array.isArray(s.history)? s.history:[];
          s.history.unshift(next);
          s.history = s.history.slice(0,8);
          return s;
        }).then((res)=>{
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          return finalState;
        }).catch((_e)=>{
          // fallback local si la transaction échoue
          return update((s)=>{
            if(!s.queue.length) return s;
            const next = s.queue.shift();
            s.lastCalled = next;
            s.history.unshift(next);
            s.history = s.history.slice(0,8);
            return s;
          });
        });
      }
    };
  } else {
    // Fallback 100% local
    const Store = {
      getState,
      onChange,
      issueTicket(){
        return update((s)=>{
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue.push(nextNumber);
          return s;
        });
      },
      callNext(){
        return update((s)=>{
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          s.lastCalled = next;
          s.history.unshift(next);
          s.history = s.history.slice(0,8);
          return s;
        });
      }
    };
    window.QueueStore = Store;
  }
})();


