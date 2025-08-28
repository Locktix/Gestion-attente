(function(){
  const nextBtn = document.getElementById('next-person');
  const lenEl = document.getElementById('queue-length');
  const lastEl = document.getElementById('last-called');

  function render(state){
    lenEl.textContent = String((state.queue||[]).length);
    lastEl.textContent = state.lastCalled ? String(state.lastCalled) : '—';
  }

  render(window.QueueStore.getState());

  window.QueueStore.onChange((s)=>{
    render(s);
  });

  if(nextBtn){
    nextBtn.addEventListener('click', ()=>{
      const s = window.QueueStore.callNext();
      render(s);
    });
  }
})();


