// Stockage partagé via localStorage + BroadcastChannel + fallback polling
(function(){
  const CHANNEL_NAME = 'gestion-attente';
  const STORAGE_KEY = 'queue-state-v1';
  const FIREBASE_PATH = 'queue/state';

  const initialState = {
    lastIssued: 0,      // dernier numéro délivré à la borne
    lastCalled: 0,      // dernier numéro appelé par le médecin
    history: [],        // derniers numéros appelés (du plus récent au plus ancien)
    queue: [],          // numéros en attente (FIFO)
    currentDoctor: '',  // médecin actuellement en charge
    lastDoctor: '',     // médecin qui a appelé le dernier numéro
    lastResetDate: ''   // AAAA-MM-JJ de la dernière remise à zéro
  };

  function todayStr(){
    const d = new Date();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${day}`;
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
        lastCalled: Number(parsed.lastCalled)||0,
        history: Array.isArray(parsed.history)? parsed.history.slice(0,20):[],
        queue: Array.isArray(parsed.queue)? parsed.queue:[],
        currentDoctor: typeof parsed.currentDoctor==='string'? parsed.currentDoctor:'',
        lastDoctor: typeof parsed.lastDoctor==='string'? parsed.lastDoctor:'',
        lastResetDate: typeof parsed.lastResetDate==='string'? parsed.lastResetDate:''
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

  function applyDailyResetIfNeeded(state){
    const s = {...state};
    const today = todayStr();
    if(s.lastResetDate !== today){
      s.lastIssued = 0;
      s.lastCalled = 0;
      s.history = [];
      s.queue = [];
      s.lastResetDate = today;
    }
    return s;
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
        return set(stateRef, {...initialState, lastResetDate: todayStr()});
      }
      return null;
    }).catch((e)=>{ console.warn('Firebase get/init échoué', e); });

    // Abonnement temps réel → met à jour le cache local + broadcast
    let debounceTimer = null;
    onValue(stateRef, (snapshot)=>{
      const val = snapshot.val();
      if(val){
        const safe = {
          lastIssued: Number(val.lastIssued)||0,
          lastCalled: Number(val.lastCalled)||0,
          history: Array.isArray(val.history)? val.history.slice(0,20):[],
          queue: Array.isArray(val.queue)? val.queue:[],
          currentDoctor: typeof val.currentDoctor==='string'? val.currentDoctor:'',
          lastDoctor: typeof val.lastDoctor==='string'? val.lastDoctor:'',
          lastResetDate: typeof val.lastResetDate==='string'? val.lastResetDate:''
        };
        if(window.DEBUG_QUEUE){ console.debug('[RTDB] onValue → setState', safe); }
        // debounce pour limiter les rafraîchissements
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(()=>{ setState(applyDailyResetIfNeeded(safe)); }, 60);
      }
    });

    // API basée Firebase
    window.QueueStore = {
      getState,
      onChange,
      setDoctor(name){
        return window.FirebaseDB.runTransaction(stateRef, (current)=>{
          const s = current || {...initialState};
          s.currentDoctor = String(name||'');
          return s;
        }).then((res)=> res?.snapshot?.val() || getState());
      },
      resetAll(){
        return window.FirebaseDB.runTransaction(stateRef, (_current)=>{
          const s = {...initialState};
          s.lastResetDate = todayStr();
          return s;
        }).then((res)=> res?.snapshot?.val() || getState());
      },
      async issueTicket(){
        return window.FirebaseDB.runTransaction(stateRef, (current)=>{
          const s = current || {...initialState};
          const withReset = applyDailyResetIfNeeded(s);
          Object.assign(s, withReset);
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue = Array.isArray(s.queue)? s.queue:[];
          s.queue.push(nextNumber);
          return s;
        }).then((res)=>{
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          if(window.DEBUG_QUEUE){ console.debug('[RTDB] issueTicket OK →', finalState); }
          return finalState;
        }).catch((_e)=>{
          if(window.DEBUG_QUEUE){ console.warn('[RTDB] issueTicket échec, fallback local'); }
          return update((s)=>{
            const withReset = applyDailyResetIfNeeded(s);
            Object.assign(s, withReset);
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
          const withReset = applyDailyResetIfNeeded(s);
          Object.assign(s, withReset);
          s.queue = Array.isArray(s.queue)? s.queue:[];
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          s.lastCalled = next;
          s.history = Array.isArray(s.history)? s.history:[];
          s.history.unshift(next);
          s.history = s.history.slice(0,8);
          s.lastDoctor = String(s.currentDoctor||'');
          return s;
        }).then((res)=>{
          const finalState = res && res.snapshot && res.snapshot.val ? res.snapshot.val() : getState();
          if(window.DEBUG_QUEUE){ console.debug('[RTDB] callNext OK →', finalState); }
          return finalState;
        }).catch((_e)=>{
          if(window.DEBUG_QUEUE){ console.warn('[RTDB] callNext échec, fallback local'); }
          return update((s)=>{
            const withReset = applyDailyResetIfNeeded(s);
            Object.assign(s, withReset);
            if(!s.queue.length) return s;
            const next = s.queue.shift();
            s.lastCalled = next;
            s.history.unshift(next);
            s.history = s.history.slice(0,8);
            s.lastDoctor = String(s.currentDoctor||'');
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
      setDoctor(name){
        return update((s)=>{
          s.currentDoctor = String(name||'');
          return s;
        });
      },
      resetAll(){
        return update((_s)=>{
          const s = {...initialState};
          s.lastResetDate = todayStr();
          return s;
        });
      },
      issueTicket(){
        const out = update((s)=>{
          const withReset = applyDailyResetIfNeeded(s);
          Object.assign(s, withReset);
          const nextNumber = (Number(s.lastIssued)||0)+1;
          s.lastIssued = nextNumber;
          s.queue.push(nextNumber);
          return s;
        });
        console.debug('[LOCAL] issueTicket →', out);
        return out;
      },
      callNext(){
        const out = update((s)=>{
          const withReset = applyDailyResetIfNeeded(s);
          Object.assign(s, withReset);
          if(!s.queue.length) return s;
          const next = s.queue.shift();
          s.lastCalled = next;
          s.history.unshift(next);
          s.history = s.history.slice(0,8);
          s.lastDoctor = String(s.currentDoctor||'');
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


