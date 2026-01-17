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

    ipcMain.handle('start-ffmpeg-capture', async (event, options) => {
        let { width, height, fps, filename, format = 'mov', audioPath = null } = options;

        // EINVAL Fix: Ensure dimensions are even
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;


        const { filePath } = await dialog.showSaveDialog({
            title: format === 'webm' ? 'Save WebM Video' : 'Save ProRes Video',
            defaultPath: filename || (format === 'webm' ? `UNIT-Capture-${Date.now()}.webm` : `UNIT-Capture-${Date.now()}.mov`),
            filters: [
                format === 'webm'
                    ? { name: 'WebM Video', extensions: ['webm'] }
                    : { name: 'Movies', extensions: ['mov'] }
            ]
        });

        if (!filePath) return null;

        return new Promise((resolve, reject) => {
            // Use fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');

            // Set path if needed (though usually fluent-ffmpeg finds it if in PATH, 
            // but we're in electron, so we use the static binary)
            const binaryPath = typeof ffmpegPath === 'string' ? ffmpegPath : 'ffmpeg';
            ffmpeg.setFfmpegPath(binaryPath);

            const command = ffmpeg()
                .input('pipe:0')
                .inputFormat('rawvideo')
                .inputOptions([
                    '-vcodec rawvideo',
                    `-s ${width}x${height}`,
                    '-pix_fmt rgba',
                    `-r ${fps}`
                ]);

            // Audio Mixing Logic
            if (audioPath) {
                console.log('Attaching audio:', audioPath);
                command
                    .input(audioPath)
                    .outputOptions([
                        '-map 0:v',      // Map video from pipe
                        '-map 1:a',      // Map audio from file
                        '-c:a aac',      // Encode audio to AAC
                        '-b:a 192k',
                        '-shortest'      // Finish when shortest stream ends (usually video)
                    ]);
            }

            command.output(filePath);

            if (format === 'webm') {
                // WebM (VP9 + Alpha)
                command.outputOptions([
                    '-c:v libvpx-vp9',
                    '-pix_fmt yuva420p',
                    '-crf 20',      // Quality (15-25)
                    '-b:v 0',       // Ensure CRF usage
                    '-auto-alt-ref 0', // Alpha transparency support
                    '-b:v 0',       // Ensure CRF usage
                    '-auto-alt-ref 0', // Alpha transparency support
                    '-threads 4',    // Speed up VP9
                    '-row-mt 1',     // Row-based multithreading
                    '-deadline realtime', // Faster encoding (less CPU choke)
                    '-cpu-used 4'    // Speed vs Quality trigger (0-5 for realtime)
                ]);
            } else {
                // Default: ProRes 4444
                command.outputOptions([
                    '-c:v prores_ks',
                    '-profile:v 4',
                    '-pix_fmt yuva444p10le'
                ]);
            }

            command
                .on('start', (cmdLine: string) => {
                    console.log('FFmpeg started:', cmdLine);
                    ffmpegProcess = command.ffmpegProc; // Get the underlying process

                    // CRITICAL: Handle stdin errors to prevent "Error: write EINVAL" popup
                    if (ffmpegProcess && ffmpegProcess.stdin) {
                        ffmpegProcess.stdin.on('error', (err) => {
                            if ((err as any).code !== 'EPIPE') {
                                console.error('FFmpeg stdin error:', err);
                            }
                        });
                    }

                    resolve({ filePath });
                })
                .on('stderr', (stderrLine: string) => {
                    console.error('FFmpeg stderr:', stderrLine);
                })
                .on('error', (err: any) => {
                    console.error('FFmpeg error:', err);
                    if (ffmpegProcess) {
                        ffmpegProcess = null;
                    }
                })
                .on('end', () => {
                    console.log('FFmpeg finished');
                    ffmpegProcess = null;
                });

            // Start processing (it will wait for input on stdin)
            command.run();
        });
    });

    ipcMain.handle('ffmpeg-frame', async (event, buffer: Buffer) => {
        if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.killed && ffmpegProcess.stdin.writable) {
            try {
                const ok = ffmpegProcess.stdin.write(buffer);
                if (!ok) {
                    await new Promise<void>((resolve) => {
                        if (ffmpegProcess && ffmpegProcess.stdin) {
                            ffmpegProcess.stdin.once('drain', resolve);
                        } else {
                            resolve();
                        }
                    });
                }
                return true;
            } catch (e) {
                console.error('Error writing to ffmpeg stdin:', e);
                return false;
            }
        }
        return false;
    });

    ipcMain.on('stop-ffmpeg-capture', () => {
        if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.killed) {
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
