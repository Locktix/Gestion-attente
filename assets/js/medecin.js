(function(){
  const nextBtn = document.getElementById('next-person');
  const lenEl = document.getElementById('queue-length');
  const lastEl = document.getElementById('last-called');
  const doctorInput = document.getElementById('doctor-name');
  const saveDoctorBtn = document.getElementById('save-doctor');
  const resetBtn = document.getElementById('reset-queue');
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

  function render(state){
    lenEl.textContent = String((state.queue||[]).length);
    lastEl.textContent = state.lastCalled ? String(state.lastCalled) : '—';
    if(doctorInput && typeof state.currentDoctor==='string'){
      if(document.activeElement !== doctorInput){
        doctorInput.value = state.currentDoctor;
      }
    }
  }

  render(window.QueueStore.getState());

  window.QueueStore.onChange((s)=>{
    render(s);
  });

  if(nextBtn){
    nextBtn.addEventListener('click', async ()=>{
      const s = await window.QueueStore.callNext();
      render(s);
      blip();
    });
  }

  if(saveDoctorBtn){
    saveDoctorBtn.addEventListener('click', async ()=>{
      const name = (doctorInput?.value||'').trim();
      const s = await window.QueueStore.setDoctor(name);
      render(s);
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', async ()=>{
      if(!confirm('Réinitialiser la file et remettre les compteurs à zéro ?')) return;
      const s = await window.QueueStore.resetAll();
      render(s);
    });
  }
})();


