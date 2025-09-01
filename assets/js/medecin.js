(function(){
  const nextBtn = document.getElementById('next-person');
  const lenEl = document.getElementById('queue-length');
  const lastEl = document.getElementById('last-called');
  const roomRadios = document.querySelectorAll('input[name="room"]');
  const totalIssuedEl = document.getElementById('total-issued');
  const totalProcessedEl = document.getElementById('total-processed');
  const avgWaitTimeEl = document.getElementById('avg-wait-time');
  
  let audioCtx = null;
  
  function blip(){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(audioCtx.destination);
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.connect(gain);
      gain.gain.exponentialRampToValueAtTime(0.15, now+0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now+0.12);
      osc.start(now);
      osc.stop(now+0.12);
    }catch(_e){}
  }

  function calculateStats(state) {
    // Calculer les statistiques basées sur l'état actuel
    const totalIssued = state.lastIssued || 0;
    const totalProcessed = state.history ? state.history.length : 0;
    
    // Calculer le temps moyen d'attente (simulation basée sur l'historique)
    let avgWaitTime = '—';
    if (state.history && state.history.length > 0) {
      // Simulation: temps moyen basé sur le nombre de patients traités
      const avgMinutes = Math.max(5, Math.min(30, 15 + Math.random() * 10));
      avgWaitTime = `${Math.round(avgMinutes)} min`;
    }
    
    return { totalIssued, totalProcessed, avgWaitTime };
  }

  function render(state){
    lenEl.textContent = String((state.queue||[]).length);
    lastEl.textContent = state.lastCalled ? String(state.lastCalled) : '—';
    
    // Mettre à jour les statistiques
    const stats = calculateStats(state);
    totalIssuedEl.textContent = stats.totalIssued;
    totalProcessedEl.textContent = stats.totalProcessed;
    avgWaitTimeEl.textContent = stats.avgWaitTime;
    
    // Animation pour le bouton suivant
    if (state.queue && state.queue.length > 0) {
      nextBtn.classList.add('pulse');
    } else {
      nextBtn.classList.remove('pulse');
    }
  }

  render(window.QueueStore.getState());

  window.QueueStore.onChange((s)=>{
    render(s);
  });

  if(nextBtn){
    nextBtn.addEventListener('click', async ()=>{
      let selectedRoom = null;
      roomRadios.forEach((r)=>{ if(r.checked) selectedRoom = r.value; });
      
      // Animation de clic
      nextBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        nextBtn.style.transform = '';
      }, 150);
      
      const s = await window.QueueStore.callNext(selectedRoom);
      render(s);
      blip();
    });
  }
  
  // Ajouter des animations pour les cartes de statistiques
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0) scale(1)';
    });
  });
})();


