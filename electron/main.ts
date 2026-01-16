import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

// Setup require for CJS external compatibility
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

// ESM path utilities
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure paths
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? (process.env.DIST || '') : path.join(process.env.DIST || '', '../public');

let win: BrowserWindow | null;
let ffmpegProcess: ChildProcess | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#050505',
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'));
    }

    // Handle FFmpeg recording bridge
    ipcMain.handle('start-ffmpeg-capture', async (event, options) => {
        if (ffmpegProcess) return { error: 'Capture already in progress' };

        const { width, height, fps, filename } = options;

        const { filePath } = await dialog.showSaveDialog({
            title: 'Save ProRes Video',
            defaultPath: filename || `UNIT-Capture-${Date.now()}.mov`,
            filters: [{ name: 'Movies', extensions: ['mov'] }]
        });

        if (!filePath) return null;

        const args = [
            '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', `${width}x${height}`,
            '-pix_fmt', 'rgba',
            '-r', `${fps}`,
            '-i', '-',
            '-c:v', 'prores_ks',
            '-profile:v', '4',
            '-pix_fmt', 'yuva444p10le',
            filePath
        ];

        // Use the path from require('ffmpeg-static')
        const cmd = typeof ffmpegPath === 'string' ? ffmpegPath : 'ffmpeg';
        ffmpegProcess = spawn(cmd, args);

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            ffmpegProcess = null;
        });

        return { filePath };
    });

    ipcMain.on('ffmpeg-frame', (event, buffer: Buffer) => {
        if (ffmpegProcess && ffmpegProcess.stdin) {
            ffmpegProcess.stdin.write(buffer);
        }
    });

    ipcMain.on('stop-ffmpeg-capture', () => {
        if (ffmpegProcess && ffmpegProcess.stdin) {
            ffmpegProcess.stdin.end();
            ffmpegProcess = null;
        }
    });
}

app.on('before-quit', () => {
    if (ffmpegProcess) {
        ffmpegProcess.kill();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(createWindow);
