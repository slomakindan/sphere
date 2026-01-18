// TypeScript global type definitions

interface ElectronAPI {
    startFfmpegCapture: (options: any) => Promise<any>;
    sendFrame: (data: Uint8Array) => Promise<void>;
    stopFfmpegCapture: () => void;
    saveAudioBlob: (buffer: ArrayBuffer) => Promise<string>;
    saveAudioFile: (buffer: ArrayBuffer, filename: string) => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    savePNGFrame: (data: { folderPath: string; filename: string; pixels: Uint8Array; width: number; height: number }) => Promise<{ success: boolean }>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

// Make sure this is treated as a module
export { };
