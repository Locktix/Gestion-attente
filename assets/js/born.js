(function(){
  const btn = document.getElementById('take-ticket');
  const COOLDOWN_MS = 3000;

  if(!btn){ return; }

  btn.addEventListener('click', ()=>{
    if(btn.disabled){ return; }

    // Déclencher la délivrance du ticket
    const state = window.QueueStore.issueTicket();
    const number = state.lastIssued;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});

    // Désactiver temporairement le bouton
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Veuillez patienter…';

    // Ouvrir la fenêtre d'impression
    openPrintWindow(number, dateStr, timeStr);

    // Réactiver après cooldown
    setTimeout(()=>{
      btn.disabled = false;
      btn.textContent = originalLabel;
    }, COOLDOWN_MS);
  });

  function openPrintWindow(number, dateStr, timeStr){
    const w = window.open('', 'PRINT', 'height=600,width=400');
    if(!w){ alert('Veuillez autoriser les popups pour imprimer le ticket.'); return; }
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket ${number}</title>`);
    w.document.write(`<style>
      @page{ size:80mm auto; margin:6mm }
      body{ font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .ticket-root{ width:250px; margin:0 auto; color:#000; }
      .ticket-header{ display:flex; justify-content:space-between; align-items:flex-start; }
      .ticket-title{ font-weight:800; font-size:14px; }
      .ticket-number{ font-size:64px; font-weight:900; text-align:center; margin:12px 0; }
      .ticket-meta{ font-size:12px; color:#333 }
      hr{ border:none; border-top:1px dashed #999; margin:12px 0 }
    </style></head><body>`);
    w.document.write(`<div class="ticket-root">
      <div class="ticket-header">
        <div class="ticket-title">Centre Médical Ghemning</div>
        <div class="ticket-meta">${dateStr} · ${timeStr}</div>
      </div>
      <hr />
      <div class="ticket-number">${number}</div>
      <div class="ticket-meta" style="text-align:center">Gardez ce ticket et suivez l'affichage.</div>
    </div>`);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(()=>{ w.print(); w.close(); }, 100);
  }
})();


