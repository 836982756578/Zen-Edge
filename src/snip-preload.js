const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snipAPI', {
  onInit: (callback) => {
    const listener = (_e, payload) => callback(payload);
    ipcRenderer.on('snip:init', listener);
    return () => ipcRenderer.removeListener('snip:init', listener);
  },
  complete: (result) => ipcRenderer.invoke('snip:complete', result),
  cancel: () => ipcRenderer.invoke('snip:cancel')
});
