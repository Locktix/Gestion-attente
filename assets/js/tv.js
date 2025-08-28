(function(){
  const currentEl = document.getElementById('current-number');
  const prevEl = document.getElementById('previous-list');
  const clockEl = document.getElementById('clock');
  let lastCalledSeen = '';

  function render(state){
    currentEl.textContent = state.lastCalled ? String(state.lastCalled) : '—';
    prevEl.innerHTML = '';
    (state.history||[]).slice(1,7).forEach((label)=>{
      const div = document.createElement('div');
      div.className = 'badge';
      div.textContent = String(label);
      prevEl.appendChild(div);
    });
  }

  function tickClock(){
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }

  // Son court (carillon)
  function playChime(){
    try{
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(audioCtx.destination);

      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.connect(gain);

      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now+0.08);
      osc2.connect(gain);

      // enveloppe
      gain.gain.exponentialRampToValueAtTime(0.2, now+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now+0.4);

      osc1.start(now);
      osc1.stop(now+0.25);
      osc2.start(now+0.08);
      osc2.stop(now+0.35);
    }catch(_e){}
  }

  // init
  const initState = window.QueueStore.getState();
  render(initState);
  lastCalledSeen = initState.lastCalled || '';
  tickClock();
  setInterval(tickClock, 1000);

  window.QueueStore.onChange((s)=>{
    render(s);
    if(s.lastCalled && s.lastCalled !== lastCalledSeen){
      lastCalledSeen = s.lastCalled;
      playChime();
    }
  });
})();


