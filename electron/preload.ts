import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    startFFmpegCapture: (options: any) => ipcRenderer.invoke('start-ffmpeg-capture', options),
    sendFrame: (data: Uint8Array) => ipcRenderer.invoke('ffmpeg-frame', data),
    stopFFmpegCapture: () => ipcRenderer.send('stop-ffmpeg-capture'),
});
