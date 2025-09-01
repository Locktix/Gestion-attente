(function(){
  // Éléments DOM
  const resetHistoryBtn = document.getElementById('reset-history');
  const clearQueueBtn = document.getElementById('clear-queue');
  const resetAllBtn = document.getElementById('reset-all');
  const addTicketBtn = document.getElementById('add-ticket');
  const removeLastBtn = document.getElementById('remove-last');
  const skipNextBtn = document.getElementById('skip-next');
  const exportHistoryBtn = document.getElementById('export-history');
  const clearLogsBtn = document.getElementById('clear-logs');
  
  // Configuration
  const startNumberInput = document.getElementById('start-number');
  const soundToggle = document.getElementById('sound-toggle');
  const debugMode = document.getElementById('debug-mode');
  
  // Statistiques
  const statsIssued = document.getElementById('stats-issued');
  const statsProcessed = document.getElementById('stats-processed');
  const statsWaiting = document.getElementById('stats-waiting');
  const statsAvgTime = document.getElementById('stats-avg-time');
  
  // Historique et logs
  const historyList = document.getElementById('history-list');
  const logsContainer = document.getElementById('logs-container');
  
  // Modal
  const confirmModal = document.getElementById('confirm-modal');
  const modalMessage = document.getElementById('modal-message');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');
  
  let pendingAction = null;
  let logs = [];
  
  // Initialisation
  function init() {
    loadConfig();
    render(window.QueueStore.getState());
    addLog('Interface d\'administration initialisée');
    
    // Écouter les changements d'état
    window.QueueStore.onChange((state) => {
      render(state);
    });
    
    // Écouter les changements de configuration
    startNumberInput.addEventListener('change', saveConfig);
    soundToggle.addEventListener('change', saveConfig);
    debugMode.addEventListener('change', saveConfig);
    
    // Événements des boutons
    setupEventListeners();
  }
  
  // Configuration
  function loadConfig() {
    const config = JSON.parse(localStorage.getItem('admin-config') || '{}');
    startNumberInput.value = config.startNumber || 1;
    soundToggle.value = config.sound || 'on';
    debugMode.value = config.debug || 'off';
  }
  
  function saveConfig() {
    const config = {
      startNumber: parseInt(startNumberInput.value),
      sound: soundToggle.value,
      debug: debugMode.value
    };
    localStorage.setItem('admin-config', JSON.stringify(config));
    addLog('Configuration mise à jour');
  }
  
  // Rendu de l'interface
  function render(state) {
    // Statistiques
    statsIssued.textContent = state.lastIssued || 0;
    statsProcessed.textContent = state.history ? state.history.length : 0;
    statsWaiting.textContent = state.queue ? state.queue.length : 0;
    
    // Temps moyen d'attente (simulation)
    if (state.history && state.history.length > 0) {
      const avgMinutes = Math.max(5, Math.min(30, 15 + Math.random() * 10));
      statsAvgTime.textContent = `${Math.round(avgMinutes)} min`;
    } else {
      statsAvgTime.textContent = '—';
    }
    
    // Historique détaillé
    renderHistory(state.history || []);
  }
  
  function renderHistory(history) {
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-item empty">Aucun historique disponible</div>';
      return;
    }
    
    history.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const time = new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const number = item;
      const room = item.match(/[A-Z]$/)?.[0] || '—';
      
      historyItem.innerHTML = `
        <span class="history-time">${time}</span>
        <span class="history-number">${number}</span>
        <span class="history-room">Local ${room}</span>
      `;
      
      historyList.appendChild(historyItem);
    });
  }
  
  // Logs système
  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const logEntry = {
      time: timestamp,
      message: message,
      type: type
    };
    
    logs.unshift(logEntry);
    logs = logs.slice(0, 50); // Garder seulement les 50 derniers logs
    
    renderLogs();
  }
  
  function renderLogs() {
    logsContainer.innerHTML = '';
    
    logs.forEach(log => {
      const logElement = document.createElement('div');
      logElement.className = `log-entry log-${log.type}`;
      
      logElement.innerHTML = `
        <span class="log-time">${log.time}</span>
        <span class="log-message">${log.message}</span>
      `;
      
      logsContainer.appendChild(logElement);
    });
  }
  
  // Modal de confirmation
  function showConfirmModal(message, action) {
    modalMessage.textContent = message;
    pendingAction = action;
    confirmModal.style.display = 'flex';
  }
  
  function hideConfirmModal() {
    confirmModal.style.display = 'none';
    pendingAction = null;
  }
  
  // Actions administratives
  async function resetHistory() {
    try {
      const state = window.QueueStore.getState();
      const newState = { ...state, history: [] };
      
      if (window.FirebaseDB && window.FirebaseDB.db) {
        const { ref, set } = window.FirebaseDB;
        const stateRef = ref(window.FirebaseDB.db, 'queue/state');
        await set(stateRef, newState);
      } else {
        localStorage.setItem('queue-state-v1', JSON.stringify(newState));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'queue-state-v1',
          newValue: JSON.stringify(newState)
        }));
      }
      
      addLog('Historique réinitialisé', 'warning');
    } catch (error) {
      addLog(`Erreur lors de la réinitialisation: ${error.message}`, 'error');
    }
  }
  
  async function clearQueue() {
    try {
      const state = window.QueueStore.getState();
      const newState = { ...state, queue: [] };
      
      if (window.FirebaseDB && window.FirebaseDB.db) {
        const { ref, set } = window.FirebaseDB;
        const stateRef = ref(window.FirebaseDB.db, 'queue/state');
        await set(stateRef, newState);
      } else {
        localStorage.setItem('queue-state-v1', JSON.stringify(newState));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'queue-state-v1',
          newValue: JSON.stringify(newState)
        }));
      }
      
      addLog('File d\'attente vidée', 'warning');
    } catch (error) {
      addLog(`Erreur lors du vidage: ${error.message}`, 'error');
    }
  }
  
  async function resetAll() {
    try {
      const initialState = {
        lastIssued: 0,
        lastCalled: '',
        history: [],
        queue: []
      };
      
      if (window.FirebaseDB && window.FirebaseDB.db) {
        const { ref, set } = window.FirebaseDB;
        const stateRef = ref(window.FirebaseDB.db, 'queue/state');
        await set(stateRef, initialState);
      } else {
        localStorage.setItem('queue-state-v1', JSON.stringify(initialState));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'queue-state-v1',
          newValue: JSON.stringify(initialState)
        }));
      }
      
      addLog('Système complètement réinitialisé', 'warning');
    } catch (error) {
      addLog(`Erreur lors de la réinitialisation complète: ${error.message}`, 'error');
    }
  }
  
  async function addTicket() {
    try {
      await window.QueueStore.issueTicket();
      addLog('Ticket ajouté manuellement');
    } catch (error) {
      addLog(`Erreur lors de l'ajout du ticket: ${error.message}`, 'error');
    }
  }
  
  async function removeLastTicket() {
    try {
      const state = window.QueueStore.getState();
      if (state.queue && state.queue.length > 0) {
        const newQueue = state.queue.slice(0, -1);
        const newState = { ...state, queue: newQueue };
        
        if (window.FirebaseDB && window.FirebaseDB.db) {
          const { ref, set } = window.FirebaseDB;
          const stateRef = ref(window.FirebaseDB.db, 'queue/state');
          await set(stateRef, newState);
        } else {
          localStorage.setItem('queue-state-v1', JSON.stringify(newState));
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'queue-state-v1',
            newValue: JSON.stringify(newState)
          }));
        }
        
        addLog('Dernier ticket retiré de la file');
      }
    } catch (error) {
      addLog(`Erreur lors du retrait: ${error.message}`, 'error');
    }
  }
  
  async function skipNext() {
    try {
      await window.QueueStore.callNext();
      addLog('Patient suivant appelé (skip)');
    } catch (error) {
      addLog(`Erreur lors du skip: ${error.message}`, 'error');
    }
  }
  
  function exportHistory() {
    const state = window.QueueStore.getState();
    const data = {
      exportDate: new Date().toISOString(),
      history: state.history || [],
      totalIssued: state.lastIssued || 0,
      totalProcessed: state.history ? state.history.length : 0
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('Historique exporté');
  }
  
  function clearLogs() {
    logs = [];
    renderLogs();
    addLog('Logs système vidés');
  }
  
  // Configuration des événements
  function setupEventListeners() {
    // Actions critiques
    resetHistoryBtn.addEventListener('click', () => {
      showConfirmModal('Êtes-vous sûr de vouloir réinitialiser l\'historique ? Cette action ne peut pas être annulée.', resetHistory);
    });
    
    clearQueueBtn.addEventListener('click', () => {
      showConfirmModal('Êtes-vous sûr de vouloir vider la file d\'attente ? Tous les patients en attente seront supprimés.', clearQueue);
    });
    
    resetAllBtn.addEventListener('click', () => {
      showConfirmModal('ATTENTION: Cette action va réinitialiser complètement le système. Toutes les données seront perdues. Êtes-vous absolument sûr ?', resetAll);
    });
    
    // Gestion des tickets
    addTicketBtn.addEventListener('click', addTicket);
    removeLastBtn.addEventListener('click', removeLastTicket);
    skipNextBtn.addEventListener('click', skipNext);
    
    // Export et logs
    exportHistoryBtn.addEventListener('click', exportHistory);
    clearLogsBtn.addEventListener('click', clearLogs);
    
    // Modal
    modalCancel.addEventListener('click', hideConfirmModal);
    modalConfirm.addEventListener('click', async () => {
      if (pendingAction) {
        await pendingAction();
        hideConfirmModal();
      }
    });
    
    // Fermer modal en cliquant à l'extérieur
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        hideConfirmModal();
      }
    });
  }
  
  // Initialiser quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
