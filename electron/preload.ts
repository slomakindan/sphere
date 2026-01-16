import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    startFFmpegCapture: (options: any) => ipcRenderer.invoke('start-ffmpeg-capture', options),
    sendFrame: (data: Uint8Array) => ipcRenderer.send('ffmpeg-frame', data),
    stopFFmpegCapture: () => ipcRenderer.send('stop-ffmpeg-capture'),
});
