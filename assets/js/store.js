// Stockage partagé via localStorage + BroadcastChannel + fallback polling
(function(){
  const CHANNEL_NAME = 'gestion-attente';
  const STORAGE_KEY = 'queue-state-v1';

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

  // API publique
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
})();


