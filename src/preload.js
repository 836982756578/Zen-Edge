const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('sidebarAPI', {
  getInitData: () => ipcRenderer.invoke('sidebar:get-init-data'),
  updateSettings: (partial) => ipcRenderer.invoke('sidebar:update-settings', partial),
  updateSites: (sites) => ipcRenderer.invoke('sidebar:update-sites', sites),
  updateWidgets: (partial) => ipcRenderer.invoke('sidebar:update-widgets', partial),
  setWindowState: (state) => ipcRenderer.invoke('sidebar:set-window-state', state),
  setUnreadSummary: (summary) => ipcRenderer.invoke('sidebar:set-unread-summary', summary),
  pickCustomIcon: () => ipcRenderer.invoke('sidebar:pick-custom-icon'),
  openExternal: (url, preferEdge = true) => ipcRenderer.invoke('sidebar:open-external', { url, preferEdge }),
  clearPartitionData: (partition) => ipcRenderer.invoke('sidebar:clear-partition', partition),
  exportConfig: () => ipcRenderer.invoke('sidebar:export-config'),
  importConfig: () => ipcRenderer.invoke('sidebar:import-config'),
  showSiteContextMenu: (siteInfo) => ipcRenderer.invoke('sidebar:site-context-menu', siteInfo),
  showRailContextMenu: () => ipcRenderer.invoke('sidebar:rail-context-menu'),
  showWorkspaceMenu: () => ipcRenderer.invoke('sidebar:workspace-menu'),
  startQuickSnip: () => ipcRenderer.invoke('sidebar:start-quick-snip'),
  getClipboardHistory: () => ipcRenderer.invoke('sidebar:get-clipboard-history'),
  clearClipboardHistory: () => ipcRenderer.invoke('sidebar:clear-clipboard-history'),
  setClipboardPaused: (paused) => ipcRenderer.invoke('sidebar:set-clipboard-paused', paused),
  writeClipboardText: (text) => ipcRenderer.invoke('sidebar:write-clipboard-text', text),
  copyImageDataUrl: (dataUrl) => ipcRenderer.invoke('sidebar:copy-image-dataurl', dataUrl),
  copyImageFile: (filePath) => ipcRenderer.invoke('sidebar:copy-image-file', filePath),

  // Klasör Sabitleme & Yerleşik Klasör/Dosya Gezgini API'leri
  getSpecialFolders: () => ipcRenderer.invoke('sidebar:get-special-folders'),
  pickFolder: () => ipcRenderer.invoke('sidebar:pick-folder'),
  statPath: (targetPath) => ipcRenderer.invoke('sidebar:stat-path', targetPath),
  readDirectory: (opts) => ipcRenderer.invoke('sidebar:read-directory', opts),
  openPath: (targetPath) => ipcRenderer.invoke('sidebar:open-path', targetPath),
  revealInExplorer: (targetPath) => ipcRenderer.invoke('sidebar:reveal-in-explorer', targetPath),
  createSubfolder: (opts) => ipcRenderer.invoke('sidebar:create-subfolder', opts),
  renameFsItem: (opts) => ipcRenderer.invoke('sidebar:rename-fs-item', opts),
  trashFsItem: (targetPath) => ipcRenderer.invoke('sidebar:trash-fs-item', targetPath),
  copyFilesIntoFolder: (opts) => ipcRenderer.invoke('sidebar:copy-files-into-folder', opts),
  previewFile: (targetPath) => ipcRenderer.invoke('sidebar:preview-file', targetPath),
  showFolderItemContextMenu: (info) => ipcRenderer.invoke('sidebar:folder-item-context-menu', info),
  startNativeFileDrag: (targetPath) => ipcRenderer.send('sidebar:start-native-drag', targetPath),

  getFilePath: (file) => {
    try {
      return webUtils && typeof webUtils.getPathForFile === 'function'
        ? webUtils.getPathForFile(file)
        : (file?.path || '');
    } catch {
      return file?.path || '';
    }
  },
  quitApp: () => ipcRenderer.invoke('sidebar:quit'),

  onMainEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('sidebar:event', listener);
    return () => ipcRenderer.removeListener('sidebar:event', listener);
  }
});
