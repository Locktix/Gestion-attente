(function(){
  const currentEl = document.getElementById('current-number');
  const prevEl = document.getElementById('previous-list');
  const clockEl = document.getElementById('clock');

  function render(state){
    currentEl.textContent = state.lastCalled ? String(state.lastCalled) : '—';
    prevEl.innerHTML = '';
    (state.history||[]).slice(1,7).forEach((n)=>{
      const div = document.createElement('div');
      div.className = 'badge';
      div.textContent = String(n);
      prevEl.appendChild(div);
    });
  }

  function tickClock(){
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }

  // init
  render(window.QueueStore.getState());
  tickClock();
  setInterval(tickClock, 1000);

  window.QueueStore.onChange((s)=>{
    render(s);
  });
})();


