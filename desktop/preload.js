const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voraDesktop', {
  isDesktop: true,
  platform: process.platform,
  printSilent: (options) => ipcRenderer.invoke('vora:print-silent', options),
  getPrinters: () => ipcRenderer.invoke('vora:get-printers'),
  getDisplaysInfo: () => ipcRenderer.invoke('vora:get-displays'),
  openCustomerDisplay: (url) => ipcRenderer.invoke('vora:open-customer-display', url),
  closeCustomerDisplay: () => ipcRenderer.invoke('vora:close-customer-display'),
  syncCustomerDisplay: (payload) => ipcRenderer.send('vora:customer-display-sync', payload),
  onCustomerDisplayState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('vora:customer-display-state', handler);
    return () => ipcRenderer.removeListener('vora:customer-display-state', handler);
  },
  retryLoad: () => ipcRenderer.invoke('vora:retry-load'),
});
