// Module d'impression pour imprimante thermique
(function(){
  class ThermalPrinter {
    constructor() {
      this.printer = null;
      this.isConnected = false;
      this.init();
    }

    async init() {
      try {
        // Essayer de se connecter à l'imprimante via USB
        if (navigator.usb) {
          await this.connectUSB();
        } else {
          console.warn('WebUSB non supporté, utilisation du mode simulation');
          this.simulatePrinter();
        }
      } catch (error) {
        console.warn('Imprimante non détectée, mode simulation activé:', error);
        this.simulatePrinter();
      }
    }

    async connectUSB() {
      try {
        // Filtrer les imprimantes thermiques (ID de fabricant générique)
        const device = await navigator.usb.requestDevice({
          filters: [
            { vendorId: 0x0483 }, // STMicroelectronics (commun pour les imprimantes)
            { vendorId: 0x04b8 }, // Epson
            { vendorId: 0x0416 }, // Winbond
            { vendorId: 0x0483 }, // STMicroelectronics
          ]
        });

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);

        this.printer = device;
        this.isConnected = true;
        console.log('Imprimante thermique connectée:', device.productName);
        
        // Émettre un événement de connexion
        window.dispatchEvent(new CustomEvent('printer-connected', {
          detail: { connected: true, device: device.productName }
        }));
      } catch (error) {
        console.warn('Connexion USB échouée:', error);
        this.simulatePrinter();
      }
    }

    simulatePrinter() {
      this.isConnected = false;
      console.log('Mode simulation d\'imprimante activé');
      
      // Émettre un événement de simulation
      window.dispatchEvent(new CustomEvent('printer-connected', {
        detail: { connected: false, device: 'Simulation' }
      }));
    }

    async printTicket(ticketData) {
      const { number, timestamp, room } = ticketData;
      
      if (!this.isConnected) {
        // Mode simulation - afficher dans la console
        console.log('🎫 TICKET IMPRIMÉ (Simulation):', {
          number,
          timestamp,
          room: room || 'Général'
        });
        
        // Afficher une notification visuelle
        this.showPrintNotification(number);
        return;
      }

      try {
        // Commandes ESC/POS pour l'imprimante thermique
        const commands = this.generateESCCommands(ticketData);
        
        // Envoyer les données à l'imprimante
        await this.sendToPrinter(commands);
        
        console.log('Ticket imprimé:', number);
        this.showPrintNotification(number);
      } catch (error) {
        console.error('Erreur d\'impression:', error);
        // Fallback vers la simulation
        this.simulatePrint(ticketData);
      }
    }

    generateESCCommands(ticketData) {
      const { number, timestamp, room } = ticketData;
      
      // Commandes ESC/POS standard pour imprimante thermique 72mm
      const commands = [];
      
      // Initialisation
      commands.push(0x1B, 0x40); // ESC @ - Initialize printer
      
      // Alignement centré
      commands.push(0x1B, 0x61, 0x01); // ESC a 1 - Center alignment
      
      // Titre
      commands.push(0x1B, 0x21, 0x30); // ESC ! 48 - Double height & width
      commands.push(...this.stringToBytes('CENTRE MÉDICAL'));
      commands.push(0x0A); // Line feed
      commands.push(...this.stringToBytes('GHEMNING'));
      commands.push(0x0A, 0x0A); // Double line feed
      
      // Numéro de ticket
      commands.push(0x1B, 0x21, 0x70); // ESC ! 112 - Quadruple height & width
      commands.push(...this.stringToBytes(`TICKET N°${number}`));
      commands.push(0x0A, 0x0A);
      
      // Retour à la taille normale
      commands.push(0x1B, 0x21, 0x00); // ESC ! 0 - Normal size
      
      // Informations
      commands.push(...this.stringToBytes(`Date: ${timestamp}`));
      commands.push(0x0A);
      if (room) {
        commands.push(...this.stringToBytes(`Local: ${room}`));
        commands.push(0x0A);
      }
      
      // Séparateur
      commands.push(0x0A);
      commands.push(...this.stringToBytes('─'.repeat(32)));
      commands.push(0x0A);
      
      // Instructions
      commands.push(0x1B, 0x21, 0x10); // ESC ! 16 - Double height
      commands.push(...this.stringToBytes('Veuillez attendre'));
      commands.push(0x0A);
      commands.push(...this.stringToBytes('votre appel'));
      commands.push(0x0A, 0x0A);
      
      // Code-barres (si supporté)
      commands.push(0x1B, 0x62, 0x01); // ESC b 1 - Print barcode
      commands.push(...this.stringToBytes(number.toString()));
      commands.push(0x00); // Terminate barcode
      commands.push(0x0A, 0x0A);
      
      // Couper le papier
      commands.push(0x1B, 0x69); // ESC i - Full cut
      
      return new Uint8Array(commands);
    }

    stringToBytes(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
      }
      return bytes;
    }

    async sendToPrinter(commands) {
      if (!this.printer) {
        throw new Error('Imprimante non connectée');
      }

      // Envoyer les données par USB
      await this.printer.transferOut(1, commands);
      
      // Attendre que l'impression soit terminée
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    simulatePrint(ticketData) {
      console.log('🎫 SIMULATION D\'IMPRESSION:', ticketData);
      this.showPrintNotification(ticketData.number);
    }

    showPrintNotification(number) {
      // Créer une notification visuelle
      const notification = document.createElement('div');
      notification.className = 'print-notification';
      notification.innerHTML = `
        <div class="print-content">
          <i class="fas fa-print"></i>
          <div>
            <strong>Ticket ${number} imprimé</strong>
            <span>Vérifiez l'imprimante</span>
          </div>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Animation d'apparition
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);
      
      // Supprimer après 3 secondes
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    }

    async disconnect() {
      if (this.printer) {
        await this.printer.close();
        this.printer = null;
        this.isConnected = false;
        console.log('Imprimante déconnectée');
      }
    }

    getStatus() {
      return {
        connected: this.isConnected,
        device: this.printer ? this.printer.productName : 'Simulation'
      };
    }
  }

  // Créer l'instance globale
  window.ThermalPrinter = new ThermalPrinter();
  
  // Exposer les méthodes principales
  window.printTicket = (ticketData) => {
    return window.ThermalPrinter.printTicket(ticketData);
  };
  
  window.getPrinterStatus = () => {
    return window.ThermalPrinter.getStatus();
  };
})();
