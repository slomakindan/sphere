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

        // DEBUG: Log all incoming parameters
        console.log('═══════════════════════════════════════════════');
        console.log('FFmpeg Capture Started');
        console.log('Format:', format);
        console.log('Resolution:', `${width}x${height}`);
        console.log('FPS:', fps);
        console.log('Audio Path:', audioPath);
        console.log('Max Size:', options.maxSize);
        console.log('Duration:', options.duration);
        console.log('═══════════════════════════════════════════════');

        // EINVAL Fix: Ensure dimensions are even
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;

        // Dialog title and filters based on format
        let title = 'Save Video';
        let filters: any[] = [];

        if (format === 'apng') {
            title = 'Save APNG Animation';
            filters = [{ name: 'APNG', extensions: ['png'] }];
        } else if (format === 'webm') {
            title = 'Save WebM Video';
            filters = [{ name: 'WebM Video', extensions: ['webm'] }];
        } else {
            title = 'Save ProRes Video';
            filters = [{ name: 'Movies', extensions: ['mov'] }];
        }

        const { filePath } = await dialog.showSaveDialog({
            title,
            defaultPath: filename,
            filters
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
            // Audio Mixing Logic
            // If WebM + maxSize is set (Sticker Mode), we DISABLE audio entirely to save size
            const isStickerMode = (format === 'webm' && options.maxSize);

            if (audioPath && !isStickerMode) {
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

            if (format === 'apng') {
                // APNG (Animated PNG with transparency)
                const opts = [
                    '-f', 'apng',
                    '-plays', '0'
                ];

                if (options.maxSize) {
                    // APNG compression for 250KB target
                    const targetKB = 250;
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[STICKER MODE - APNG]`);
                    console.log(`Target: ${targetKB}KB`);
                    console.log(`Format: APNG (native transparency)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    // Compression level (0-9, higher = smaller but slower)
                    opts.push('-compression_level', '9');
                    opts.push('-pred', 'mixed'); // Best prediction for animation
                } else {
                    opts.push('-compression_level', '6');
                }

                command.outputOptions(opts);
            } else if (format === 'webm') {
                // WebM (VP9 + Alpha)
                const opts = [
                    '-c:v libvpx-vp9',
                    '-pix_fmt yuva420p',
                    '-auto-alt-ref 0', // Alpha transparency support
                    '-threads 4',
                    '-row-mt 1'
                ];

                if (options.maxSize) {
                    // ABSURDLY LOW: Account for 200-300% WebM overhead
                    // Target: 80KB raw video → 240-250KB with overhead
                    const safeDuration = options.duration || 10.0;
                    const rawTargetKB = 80;
                    const bitrate = Math.floor((rawTargetKB * 8192) / safeDuration);
                    const safeBitrate = Math.max(bitrate, 30000);

                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[STICKER MODE - FINAL ATTEMPT]`);
                    console.log(`Target: 80KB raw (250KB with 200% overhead)`);
                    console.log(`Duration: ${safeDuration}s`);
                    console.log(`Ultra-low Bitrate: ${safeBitrate} bps (~${Math.floor(safeBitrate / 1000)}kbps)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    // Ultra-low settings
                    opts.push('-deadline good');
                    opts.push('-cpu-used 4');
                    opts.push(`-b:v ${safeBitrate}`);
                    opts.push(`-maxrate ${safeBitrate}`);
                    opts.push(`-minrate ${Math.floor(safeBitrate * 0.5)}`);
                    opts.push(`-bufsize ${Math.floor(safeBitrate * 2)}`);
                    opts.push('-g 300'); // Very large GOP to reduce overhead
                    opts.push('-crf 50'); // Very low quality to stay under bitrate
                } else {
                    // High Quality / Default
                    opts.push('-deadline realtime');
                    opts.push('-cpu-used 4');
                    opts.push('-crf 20');
                }

                command.outputOptions(opts);
            } else if (format === 'mov') { // Explicitly handle ProRes for 'mov' format
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
