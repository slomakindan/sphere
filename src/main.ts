import * as dat from 'dat.gui';
import { SceneManager } from './SceneManager';
import { AudioController } from './AudioController';
import { StateManager, SystemState } from './StateManager';
import { MotionController } from './MotionController';
import { TimelineController } from './TimelineController';

// Electron Context Bridge Type
declare const electronAPI: {
    startFfmpegCapture: (options: any) => Promise<any>;
    sendFrame: (data: Uint8Array) => Promise<void>;
    stopFfmpegCapture: () => void;
    saveAudioBlob: (buffer: ArrayBuffer) => Promise<string | null>;
};

const appContainer = document.getElementById('app') as HTMLElement;
const sceneManager = new SceneManager(appContainer);
const audioController = new AudioController(sceneManager.camera);
const motionController = new MotionController();
const sphere = sceneManager.getSphere();
const stateManager = new StateManager(sphere);

// Timeline Integration (v2.5)
const timelineContainer = document.getElementById('timeline-container')!;
const timeline = new TimelineController(timelineContainer, (time) => {
    // Scrubbing Callback
    audioController.seek(time);
    const frame = motionController.getInterpolatedFrame(time);
    if (frame) {
        sphere.setParams(frame.params);
        if (frame.camera) {
            sceneManager.camera.position.set(frame.camera.position.x, frame.camera.position.y, frame.camera.position.z);
            sceneManager.controls.target.set(frame.camera.target.x, frame.camera.target.y, frame.camera.target.z);
            sceneManager.controls.update();
        }
        sceneManager.animate(frame.audio); // Update visuals for the scrubbed frame
    }
});

timeline.renderWaveform(null);

// UI Elements
const statusEl = document.getElementById('status') as HTMLElement;
const loadAudioBtn = document.getElementById('loadAudioBtn') as HTMLButtonElement;
const audioInput = document.getElementById('audioInput') as HTMLInputElement;
const systemAudioBtn = document.getElementById('systemAudioBtn') as HTMLButtonElement;
const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
const stateSelector = document.getElementById('stateSelector') as HTMLSelectElement;
const exportPngBtn = document.getElementById('exportPngBtn') as HTMLButtonElement;
const recordMotionBtn = document.getElementById('recordMotionBtn') as HTMLButtonElement;
const loadMotionBtn = document.getElementById('loadMotionBtn') as HTMLButtonElement;
const motionInput = document.getElementById('motionInput') as HTMLInputElement;
const renderMotionBtn = document.getElementById('renderMotionBtn') as HTMLButtonElement;
const stopRenderBtn = document.getElementById('stopRenderBtn') as HTMLButtonElement;
const captureInfo = document.getElementById('captureInfo') as HTMLElement;
const imageInput = document.getElementById('imageInput') as HTMLInputElement;
const renderOverlay = document.getElementById('render-overlay') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const currentFrameEl = document.getElementById('currentFrame') as HTMLElement;
const totalFramesEl = document.getElementById('totalFrames') as HTMLElement;
const etaEl = document.getElementById('eta') as HTMLElement;

// Render cancel flag
let isRenderingCancelled = false;

const savePresetBtn = document.getElementById('savePresetBtn') as HTMLButtonElement;
const loadPresetBtn = document.getElementById('loadPresetBtn') as HTMLButtonElement;
const presetInput = document.getElementById('presetInput') as HTMLInputElement;

// Professional Timeline Transport Controls (v3.1)
const timecodeDisplay = document.getElementById('timecode-display') as HTMLElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;

// Timecode Formatter (HH:MM:SS:FF)
function formatTimecode(seconds: number, fps = 30): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}

// Parameters (Genetic Code)
const params = {
    baseColor: '#f2f4f7',
    accentColor: '#ff0000',
    spotScale: 2.0,
    spotThreshold: 0.6,
    minSize: 0.8,
    maxSize: 2.5,
    opacity: 0.6,
    speed: 0.2,
    density: 1.5,
    strength: 0.3,
    scale: 1.0,
    octaves: 3.0,
    radialBias: 0.5,
    audioStrength: 1.0,
    smoothing: 0.8,
    sensitivity: 1.0,
    bloomStrength: 1.5,
    exposure: 1.5,
    showCore: false,
    coreSize: 1.0,
    coreColor: '#0057FF',
    showStrips: false,
    stripsOpacity: 0.5,
    stripsColor: '#ffffff',
    // v2.5 Advanced Noise
    noiseScale: 1.0,
    noiseDetail: 3.0,
    evolutionSpeed: 0.2,
    // v2.5 Galaxy Swirl
    swirlEnabled: false,
    swirlSpeed: 0.4,
    twistAmount: 2.0,
    swirlDetail: 4.0,
    clusterIntensity: 3.0,
    // v2.5 Core HDR
    coreIntensity: 1.5,
    // v2.5 Export Settings
    exportFps: 30,
    exportFormat: 'mov',
    exportResolution: '4K', // 4K / 2K / 1080p / 720p / 512
    // v3.0 Shape Morphing
    morphTarget: 0,
    morphProgress: 0.0,
    // v3.0 Attractors
    attractorStrength: 0.0,
    attractorX: 0.0,
    attractorY: 0.0,
    attractorZ: 0.0,
    // v3.0 Glitch
    glitchActive: false,
    glitchIntensity: 0.5,
    // v3.0 Visual DNA
    imageEnabled: false,
    imageMorphFactor: 0.0,
    imageDisplacementFactor: 0.0,
    imageColorMix: 0.0,
    // v3.2 Loop
    loopActive: false,
    loopDuration: 10.0,
    // v3.3 Chaos
    chaosAmplitude: 0.0,
    chaosSpeed: 0.5
};

// UI: dat.GUI Setup
const gui = new dat.GUI({ autoPlace: false });
document.getElementById('gui-container')?.appendChild(gui.domElement);

// 1. Center Interface (Core) - at top, disabled by default
const centerFolder = gui.addFolder('▼ 1. Центр');
centerFolder.add(params, 'showCore').name('Ядро').onChange(v => sphere.setParams({ showCore: v }));
centerFolder.add(params, 'coreSize', 0.01, 0.5).name('Размер').onChange(v => sphere.setParams({ coreSize: v }));
centerFolder.addColor(params, 'coreColor').name('Цвет').onChange(v => sphere.setParams({ coreColor: v }));
centerFolder.add(params, 'coreIntensity', 0, 5.0).name('Интенсивность').onChange(v => sphere.setParams({ coreIntensity: v }));
centerFolder.add(params, 'showStrips').name('Полосы').onChange(v => sphere.setParams({ showStrips: v }));
centerFolder.add(params, 'stripsOpacity', 0, 1.0).name('Непрозрачность').onChange(v => sphere.setParams({ stripsOpacity: v }));
centerFolder.addColor(params, 'stripsColor').name('Цвет полос').onChange(v => sphere.setParams({ stripsColor: v }));



const logicFolder = gui.addFolder('▼ 1.1 Поведение (Logic)');
logicFolder.add(params, 'loopActive').name('Режим Лупа').onChange(v => sphere.setParams({ loopActive: v }));
// logicFolder.add(params, 'loopDuration', 1.0, 60.0).step(0.1).name('Длительность').onChange(v => sphere.setParams({ loopDuration: v })); // Moved to Export

const chaosFolder = gui.addFolder('▼ 1.2 Хаос (Life)');
chaosFolder.add(params, 'chaosAmplitude', 0.0, 2.0).name('Амплитуда/Искажение').onChange(v => sphere.setParams({ chaosAmplitude: v }));
chaosFolder.add(params, 'chaosSpeed', 0.1, 5.0).name('Скорость').onChange(v => sphere.setParams({ chaosSpeed: v }));

// ... (Other folders remain) ...

const exportFolder = gui.addFolder('▼ 5. Режим Рендера (Export)');
exportFolder.add(params, 'exportFormat', ['mov', 'webm']).name('Формат (Codec)').listen();
exportFolder.add(params, 'exportResolution', ['4K', '2K', '1080p', '720p', '512']).name('Разрешение');
exportFolder.add(params, 'exportFps', [24, 30, 60]).name('Кадры/сек (FPS)');
exportFolder.add(params, 'loopDuration', 1.0, 60.0).step(0.1).name('Длительность Лупа').onChange(v => sphere.setParams({ loopDuration: v }));


const exportActions = {
    exportLoop: async () => {
        // Export Loop Logic
        const fps = parseInt(params.exportFps.toString());
        const duration = params.loopDuration;
        const totalFrames = Math.ceil(duration * fps);

        if (totalFrames <= 0) return;

        setAppState('RENDERING');
        isRenderingCancelled = false;
        stopRenderBtn.disabled = false;
        statusEl.innerText = `Рендер лупа ${duration.toFixed(1)}с @ ${fps}fps...`;
        renderOverlay.style.display = 'flex';
        totalFramesEl.innerText = totalFrames.toString();

        // Resolution Logic
        let size = 1080;
        switch (params.exportResolution) {
            case '4K': size = 4096; break;
            case '2K': size = 2048; break;
            case '1080p': size = 1080; break;
            case '720p': size = 720; break;
            case '512': size = 512; break;
        }

        // Start FFmpeg
        const format = params.exportFormat as 'mov' | 'webm';

        // Sticker Logic: 512px + WebM = 256KB Limit
        const maxSize = (size === 512 && format === 'webm') ? 256 : 0;

        // Pass audio path
        const started = await sceneManager.startProResExport(size, size, fps, format, currentAudioPath, duration, maxSize);
        if (!started) {
            renderOverlay.style.display = 'none';
            setAppState('IDLE');
            return;
        }

        const startTime = performance.now();

        // Capture state once
        const baseParams = JSON.parse(JSON.stringify(params));
        // Force loop active for this render
        baseParams.loopActive = true;
        baseParams.loopDuration = duration;

        // Use current camera
        const cameraState = {
            position: { x: sceneManager.camera.position.x, y: sceneManager.camera.position.y, z: sceneManager.camera.position.z },
            target: { x: sceneManager.controls.target.x, y: sceneManager.controls.target.y, z: sceneManager.controls.target.z }
        };

        /**
         * RENDER LOOP
         */
        for (let i = 0; i < totalFrames; i++) {
            const t = (i / fps);

            // Construct synthetic frame
            const frame = {
                time: t,
                audio: { level: 0, bass: 0, mid: 0, treble: 0 }, // Silence for loop visual check
                params: baseParams,
                camera: cameraState
            };



            // Render Frame at selected Size
            const pixels = await sceneManager.renderMotionFrame(frame, size);

            // Send to FFmpeg
            await sceneManager.sendFrame(pixels);

            // Update UI
            const progress = ((i + 1) / totalFrames) * 100;
            progressFill.style.width = `${progress}%`;
            currentFrameEl.innerText = (i + 1).toString();

            // ETA
            const elapsed = (performance.now() - startTime) / 1000;
            const perFrame = elapsed / (i + 1);
            const remaining = perFrame * (totalFrames - (i + 1));
            etaEl.innerText = `${Math.ceil(remaining)}s remaining`;

            // UI Break
            if (i % 5 === 0) await new Promise(r => requestAnimationFrame(r));

            if (isRenderingCancelled) {
                statusEl.innerText = 'Рендер отменен';
                break;
            }
        }

        sceneManager.stopProResExport();
        setAppState('IDLE');
        renderOverlay.style.display = 'none';
        stopRenderBtn.disabled = true;
        isRenderingCancelled = false;
        if (!isRenderingCancelled) statusEl.innerText = 'Экспорт лупа завершен';

    },
    renderMotion: () => {
        if (motionController.getBuffer().length === 0) {
            alert('Сначала запишите движение (Capture Motion)!');
            return;
        }
        renderMotionBtn.click();
    }
};

exportFolder.add(exportActions, 'renderMotion').name('🎬 РЕНДЕР ЗАПИСИ (Motion)');
exportFolder.add(exportActions, 'exportLoop').name('🔴 РЕНДЕР ЛУПА (Spectacle)');



const matFolder = gui.addFolder('▼ 2. Материал');
matFolder.addColor(params, 'baseColor').name('Базовый цвет').onChange(v => sphere.setParams({ baseColor: v }));
matFolder.addColor(params, 'accentColor').name('Акцент').onChange(v => sphere.setParams({ accentColor: v }));
matFolder.add(params, 'spotScale', 0.1, 10.0).name('Размер пятен').onChange(v => sphere.setParams({ spotScale: v }));
matFolder.add(params, 'spotThreshold', 0.0, 1.0).name('Кол-во пятен').onChange(v => sphere.setParams({ spotThreshold: v }));
matFolder.add(params, 'opacity', 0, 1.0).name('Прозрачность').onChange(v => sphere.setParams({ opacity: v }));
matFolder.open();

const noiseFolder = gui.addFolder('▼ 3. Шум');
noiseFolder.add(params, 'noiseScale', 0.1, 10.0).name('Масштаб').onChange(v => sphere.setParams({ scale: v }));
noiseFolder.add(params, 'noiseDetail', 1, 8).step(1).name('Детализация').onChange(v => sphere.setParams({ octaves: v }));
noiseFolder.add(params, 'strength', 0, 2.0).name('Сила').onChange(v => sphere.setParams({ strength: v }));
noiseFolder.add(params, 'evolutionSpeed', 0, 2.0).name('Скорость').onChange(v => sphere.setParams({ speed: v }));
noiseFolder.add(params, 'density', 0.1, 10.0).name('Сложность').onChange(v => sphere.setParams({ density: v }));
noiseFolder.add(params, 'radialBias', -1.0, 1.0).name('Радиальное смещ.').onChange(v => sphere.setParams({ radialBias: v }));

const audioFolder = gui.addFolder('▼ 4. Аудио');
audioFolder.add(params, 'audioStrength', 0, 5.0).name('Влияние').onChange(v => sphere.setParams({ audioStrength: v }));
audioFolder.add(params, 'smoothing', 0, 0.99).name('Сглаживание').onChange(v => audioController.smoothing = v);
audioFolder.add(params, 'sensitivity', 0.1, 5.0).name('Чувствительность').onChange(v => audioController.sensitivity = v);

const swirlFolder = gui.addFolder('▼ 5. Галактика');
swirlFolder.add(params, 'swirlEnabled').name('Включить').onChange(v => sphere.setParams({ swirlEnabled: v }));
swirlFolder.add(params, 'swirlSpeed', 0, 2.0).name('Скорость').onChange(v => sphere.setParams({ swirlSpeed: v }));
swirlFolder.add(params, 'twistAmount', -5.0, 5.0).name('Закручивание').onChange(v => sphere.setParams({ twistAmount: v }));
swirlFolder.add(params, 'swirlDetail', 1, 8).step(1).name('Детализация').onChange(v => sphere.setParams({ swirlDetail: v }));
swirlFolder.add(params, 'clusterIntensity', 1.0, 10.0).name('Свечение').onChange(v => sphere.setParams({ clusterIntensity: v }));



const morphFolder = gui.addFolder('▼ 7. Морфинг');
morphFolder.add(params, 'morphTarget', { Сфера: 0, Куб: 1, Тор: 2 }).name('Цель').onChange(v => sphere.setParams({ morphTarget: parseInt(v) }));
morphFolder.add(params, 'morphProgress', 0, 1.0).name('Прогресс').onChange(v => sphere.setParams({ morphProgress: v }));

const attractorFolder = gui.addFolder('▼ 8. Аттракторы');
attractorFolder.add(params, 'attractorStrength', 0, 2.0).name('Сила').onChange(v => sphere.setParams({ attractorStrength: v }));
attractorFolder.add(params, 'attractorX', -2.0, 2.0).name('X').onChange(v => sphere.setParams({ attractorX: v }));
attractorFolder.add(params, 'attractorY', -2.0, 2.0).name('Y').onChange(v => sphere.setParams({ attractorY: v }));
attractorFolder.add(params, 'attractorZ', -2.0, 2.0).name('Z').onChange(v => sphere.setParams({ attractorZ: v }));

const glitchFolder = gui.addFolder('▼ 9. Глитч');
glitchFolder.add(params, 'glitchActive').name('Включить').onChange(v => sphere.setParams({ glitchActive: v }));
glitchFolder.add(params, 'glitchIntensity', 0, 2.0).name('Интенсивность').onChange(v => sphere.setParams({ glitchIntensity: v }));

const visualDnaFolder = gui.addFolder('▼ 10. Текстура');
visualDnaFolder.add(params, 'imageEnabled').name('Включить').onChange(v => sphere.setParams({ imageEnabled: v }));
visualDnaFolder.add(params, 'imageColorMix', 0, 1.0).name('Микс цвета').onChange(v => sphere.setParams({ imageColorMix: v }));
visualDnaFolder.add(params, 'imageMorphFactor', 0, 1.0).name('Морфинг').onChange(v => sphere.setParams({ imageMorphFactor: v }));
visualDnaFolder.add(params, 'imageDisplacementFactor', 0, 2.0).name('Смещение').onChange(v => sphere.setParams({ imageDisplacementFactor: v }));
visualDnaFolder.add({ loadImage: () => imageInput.click() }, 'loadImage').name('Загрузить...');

// v3.0 Image Loader
import * as THREE from 'three';
const textureLoader = new THREE.TextureLoader();
imageInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        textureLoader.load(url, (texture) => {
            sphere.setParams({ imageTexture: texture, imageEnabled: true });
            params.imageEnabled = true;
            statusEl.innerText = 'Image Loaded';
        });
    }
});

// App State Machine (v3.1)
type AppState = 'IDLE' | 'RECORDING' | 'RENDERING';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let appState: AppState = 'IDLE';

function setAppState(state: AppState) {
    appState = state;
    const isLocked = state === 'RENDERING';

    // Lock/Unlock UI controls
    recordMotionBtn.disabled = isLocked;
    loadMotionBtn.disabled = isLocked;
    loadAudioBtn.disabled = isLocked;
    savePresetBtn.disabled = isLocked;
    loadPresetBtn.disabled = isLocked;
    exportPngBtn.disabled = isLocked;
    stateSelector.disabled = isLocked;

    // Lock dat.GUI sliders
    const guiContainer = document.getElementById('gui-container');
    if (guiContainer) {
        guiContainer.style.pointerEvents = isLocked ? 'none' : 'auto';
        guiContainer.style.opacity = isLocked ? '0.5' : '1';
    }

    // Update status
    if (state === 'RECORDING') {
        btnRecord.classList.add('recording');
        statusEl.innerText = 'Recording...';
    } else if (state === 'RENDERING') {
        statusEl.innerText = 'Rendering (Master Quality)...';
    } else {
        btnRecord.classList.remove('recording');
    }
}

// Expose appState for debugging
(window as any).getAppState = () => appState;

// Initialize to IDLE state on startup
setAppState('IDLE');

// Motion Logic
let isRecordingMotion = false;

recordMotionBtn.addEventListener('click', async () => {
    if (!isRecordingMotion) {
        setAppState('RECORDING');
        motionController.startRecording();
        audioController.startRecording(); // Start Audio Recording
        recordMotionBtn.innerText = '⏹ Finish Capture';
        recordMotionBtn.classList.add('recording');
    } else {
        setAppState('IDLE');
        const buffer = motionController.stopRecording();
        const audioBlob = await audioController.stopRecording(); // Stop Audio

        recordMotionBtn.innerText = '🔴 Capture Motion';
        recordMotionBtn.classList.remove('recording');
        captureInfo.innerText = `Buffer: ${buffer.length} frames`;
        renderMotionBtn.disabled = buffer.length === 0;
        statusEl.innerText = 'Motion Cached';
        motionController.saveToFile();

        // Handle Recorded Audio
        if (audioBlob && typeof electronAPI !== 'undefined') {
            statusEl.innerText = 'Saving Audio...';
            const arrayBuffer = await audioBlob.arrayBuffer();
            const savedPath = await electronAPI.saveAudioBlob(arrayBuffer);
            if (savedPath) {
                currentAudioPath = savedPath; // Set for Export
                statusEl.innerText = 'Audio Recorded & Linked';
                console.log('Audio saved to:', savedPath);
            }
        }


        // Sync Timeline (v2.5) - Focused on the just-captured clip
        if (buffer.length > 0) {
            const lastFrame = buffer[buffer.length - 1];

            timeline.setDuration(lastFrame.time); // Set end time
            timeline.setKeyframes(buffer.map(f => f.time));

            // Trigger UI update
            // Note: If we just recorded mic, the buffer in audioController 
            // refers to the LOADED file. We don't have visual waveform for mic stream easily yet.
            // But if we recorded, we *could* load that blob back into audioController to show waveform?
            // For now, let's just keep it simple.
        }
    }
    isRecordingMotion = !isRecordingMotion;
});

// Transport Controls (v3.1)
btnRecord.addEventListener('click', () => recordMotionBtn.click());
btnPlay.addEventListener('click', () => playPauseBtn.click());
btnStop.addEventListener('click', () => {
    if (audioController.isPlaying()) {
        audioController.togglePlayPause();
        playPauseBtn.innerText = '▶ Play';
    }
    timeline.updateTime(0);
    timecodeDisplay.innerText = formatTimecode(0);
});

loadMotionBtn.addEventListener('click', () => motionInput.click());
motionInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const text = await file.text();
        const buffer = JSON.parse(text);
        motionController.setBuffer(buffer);
        captureInfo.innerText = `Buffer: ${buffer.length} frames`;
        renderMotionBtn.disabled = buffer.length === 0;
        statusEl.innerText = 'Motion Clip Loaded';

        // Sync Timeline with Motion Buffer duration
        if (buffer.length > 0) {
            const lastFrame = buffer[buffer.length - 1];
            timeline.setDuration(lastFrame.time);

            // Pass keyframe times for visualization
            timeline.setKeyframes(buffer.map((f: any) => f.time));
        }
    }
});

renderMotionBtn.addEventListener('click', async () => {
    const buffer = motionController.getBuffer();
    if (buffer.length === 0) return;

    // Calculate actual duration from buffer
    const firstFrame = buffer[0];
    const lastFrame = buffer[buffer.length - 1];
    const actualDuration = lastFrame.time - firstFrame.time;

    if (actualDuration <= 0) {
        statusEl.innerText = 'No motion recorded';
        return;
    }

    const fps = parseInt(params.exportFps.toString());
    const totalFrames = Math.ceil(actualDuration * fps);

    setAppState('RENDERING');
    isRenderingCancelled = false;
    stopRenderBtn.disabled = false;
    statusEl.innerText = `Рендер ${actualDuration.toFixed(1)}с @ ${fps}fps...`;
    renderOverlay.style.display = 'flex';
    totalFramesEl.innerText = totalFrames.toString();


    // Start FFmpeg in Electron
    const format = params.exportFormat as 'mov' | 'webm';

    // Resolution Logic
    let size = 1080;
    switch (params.exportResolution) {
        case '4K': size = 4096; break;
        case '2K': size = 2048; break;
        case '1080p': size = 1080; break;
        case '720p': size = 720; break;
        case '512': size = 512; break;
    }

    // Sticker Logic: 512px + WebM = 256KB Limit
    const maxSize = (size === 512 && format === 'webm') ? 256 : 0;

    const started = await sceneManager.startProResExport(size, size, fps, format, currentAudioPath, actualDuration, maxSize); // Dynamic Size + Audio
    if (!started) {
        renderOverlay.style.display = 'none';
        return;
    }

    const startTime = performance.now();
    for (let i = 0; i < totalFrames; i++) {
        const currentTime = firstFrame.time + (i / fps);
        const frame = motionController.getInterpolatedFrame(currentTime);

        if (!frame) continue;

        // Render Frame at selected resolution
        const pixels = await sceneManager.renderMotionFrame(frame, size);

        // Send to FFmpeg
        await sceneManager.sendFrame(pixels);

        // Update UI
        const progress = ((i + 1) / totalFrames) * 100;
        progressFill.style.width = `${progress}%`;
        currentFrameEl.innerText = (i + 1).toString();

        // ETA Calculation
        const elapsed = (performance.now() - startTime) / 1000;
        const perFrame = elapsed / (i + 1);
        const remaining = perFrame * (totalFrames - (i + 1));
        etaEl.innerText = `${Math.ceil(remaining)}s remaining`;

        // Small break for browser UI responsiveness
        if (i % 5 === 0) await new Promise(r => requestAnimationFrame(r));

        // Check if cancelled
        if (isRenderingCancelled) {
            statusEl.innerText = 'Рендер отменен';
            break;
        }
    }

    sceneManager.stopProResExport();
    setAppState('IDLE');
    renderOverlay.style.display = 'none';
    stopRenderBtn.disabled = true;
    isRenderingCancelled = false;
    if (!isRenderingCancelled) statusEl.innerText = 'Экспорт завершен';
});

// Stop Render Button
stopRenderBtn.addEventListener('click', () => {
    isRenderingCancelled = true;
    statusEl.innerText = 'Остановка...';
});

// Audio Logic
let currentAudioPath: string | null = null;

// Controls & Audio
loadAudioBtn.addEventListener('click', () => audioInput.click());
audioInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        // Capture path for export (Electron specific)
        currentAudioPath = (file as any).path || null;

        statusEl.innerText = 'Scanning frequency...';
        const name = await audioController.loadFile(file);
        statusEl.innerText = `Track: ${name}`;
        playPauseBtn.disabled = false;

        // Sync Timeline with Audio
        timeline.setDuration(audioController.getDuration());
        const buffer = audioController.getBuffer();
        if (buffer) timeline.renderWaveform(buffer);
    }
});

systemAudioBtn.addEventListener('click', async () => {
    await audioController.useMicrophone();
    statusEl.innerText = 'System Link Active';
    systemAudioBtn.classList.add('active');
});

playPauseBtn.addEventListener('click', () => {
    const isPlaying = audioController.togglePlayPause();
    playPauseBtn.innerText = isPlaying ? '❚❚ Pause' : '▶ Play';
});

stateSelector.addEventListener('change', (e) => {
    stateManager.transitionTo((e.target as HTMLSelectElement).value as SystemState);
});

exportPngBtn.addEventListener('click', () => sceneManager.export4K());

savePresetBtn.addEventListener('click', () => {
    const data = JSON.stringify(params, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UNIT-Preset-${Date.now()}.json`;
    a.click();
});

// Load Preset Button (v3.1)
loadPresetBtn.addEventListener('click', () => presetInput.click());
presetInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const text = await file.text();
        try {
            const preset = JSON.parse(text);
            Object.assign(params, preset);
            sphere.setParams(params);
            for (let i in gui.__folders) {
                for (let j in gui.__folders[i].__controllers) {
                    gui.__folders[i].__controllers[j].updateDisplay();
                }
            }
            statusEl.innerText = 'Code Loaded';
        } catch (err) {
            console.error('Failed to load preset', err);
        }
    }
});

// Load Preset Logic (Genetic Code - Drag & Drop)
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.name.endsWith('.json')) {
        const text = await file.text();
        try {
            const preset = JSON.parse(text);
            Object.assign(params, preset);
            sphere.setParams(params);

            // Sync dat.GUI
            for (let i in gui.__folders) {
                for (let j in gui.__folders[i].__controllers) {
                    gui.__folders[i].__controllers[j].updateDisplay();
                }
            }
            statusEl.innerText = 'Preset Applied';
        } catch (err) {
            console.error('Failed to load preset', err);
        }
    }
});

// Main Loop
function animate() {
    requestAnimationFrame(animate);
    audioController.update();
    const audioData = audioController.getAudioData();

    // If recording, pipe to motion controller
    if (isRecordingMotion) {
        motionController.recordFrame(
            performance.now() / 1000,
            audioData,
            params,
            {
                position: sceneManager.camera.position,
                target: sceneManager.controls.target
            }
        );
    }

    sceneManager.animate(audioData);

    // Update Timeline Playhead and Timecode
    let currentTime = 0;
    if (isRecordingMotion) {
        // During recording, use the elapsed time from recording start
        const buffer = motionController.getBuffer();
        currentTime = buffer.length > 0 ? buffer[buffer.length - 1].time : 0;
        timeline.updateTime(currentTime);
        timecodeDisplay.innerText = formatTimecode(currentTime, parseInt(params.exportFps.toString()));
    } else if (audioController.isPlaying()) {
        // During playback, use audio time
        currentTime = audioController.getCurrentTime();
        timeline.updateTime(currentTime);
        timecodeDisplay.innerText = formatTimecode(currentTime, parseInt(params.exportFps.toString()));
    }
}

// Global Shortcuts
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        const playing = audioController.togglePlayPause();
        playPauseBtn.innerText = playing ? '|| Pause' : '▶ Play';
    }
});
sphere.setParams(params);

animate();

console.log("%cUNIT CORE v3.1 - Motion Matrix Active", "color: #0057FF; font-weight: bold; font-size: 14px;");
