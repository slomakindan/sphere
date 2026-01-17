import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    startFFmpegCapture: (options: any) => ipcRenderer.invoke('start-ffmpeg-capture', options),
    sendFrame: (frame: Uint8Array) => ipcRenderer.invoke('send-frame', frame),
    stopFFmpegCapture: () => ipcRenderer.invoke('stop-ffmpeg-capture'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    savePNGFrame: (data: any) => ipcRenderer.invoke('save-png-frame', data),
    saveAudioBlob: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-audio-blob', buffer)
});
