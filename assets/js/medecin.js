(function(){
  const nextBtn = document.getElementById('next-person');
  const lenEl = document.getElementById('queue-length');
  const lastEl = document.getElementById('last-called');
  const roomRadios = document.querySelectorAll('input[name="room"]');
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
  }

  render(window.QueueStore.getState());

  window.QueueStore.onChange((s)=>{
    render(s);
  });

  if(nextBtn){
    nextBtn.addEventListener('click', async ()=>{
      let selectedRoom = null;
      roomRadios.forEach((r)=>{ if(r.checked) selectedRoom = r.value; });
      const s = await window.QueueStore.callNext(selectedRoom);
      render(s);
      blip();
    });
  }
})();


