import * as THREE from 'three';

export interface AudioData {
    level: number;
    bass: number;
    mid: number;
    treble: number;
}

export class AudioController {
    private listener: THREE.AudioListener;
    private sound: THREE.Audio;
    private buffer: AudioBuffer | null = null;
    private analyser: THREE.AudioAnalyser | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private audioContext: AudioContext;

    public sensitivity: number = 1.0;
    public smoothing: number = 0.8; // Smoothing factor for temporal stability

    private currentLevels: AudioData = { level: 0, bass: 0, mid: 0, treble: 0 };
    private targetLevels: AudioData = { level: 0, bass: 0, mid: 0, treble: 0 };

    constructor(camera: THREE.Camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);
        this.sound = new THREE.Audio(this.listener);
        this.audioContext = THREE.AudioContext.getContext();
    }

    public async loadFile(file: File): Promise<string> {
        const url = URL.createObjectURL(file);
        const loader = new THREE.AudioLoader();

        return new Promise((resolve, reject) => {
            loader.load(url, (buffer) => {
                this.buffer = buffer;
                this.sound.setBuffer(buffer);
                this.sound.setLoop(true);
                this.sound.setVolume(1.0);
                this.sound.play();

                this.analyser = new THREE.AudioAnalyser(this.sound, 1024);
                resolve(file.name);
            }, undefined, reject);
        });
    }

    public async useMicrophone(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

            // Create a custom analyser since THREE.Audio doesn't directly support MediaStreamSource easily in some setups
            const nativeAnalyser = this.audioContext.createAnalyser();
            nativeAnalyser.fftSize = 1024;
            this.mediaStreamSource.connect(nativeAnalyser);

            // Bridge native analyser to THREE.AudioAnalyser compatible format
            this.analyser = new THREE.AudioAnalyser(this.sound, 1024);
            (this.analyser as any).analyser = nativeAnalyser;

            console.log("Microphone connected and analyser ready.");
        } catch (err) {
            console.error('Error accessing microphone:', err);
            throw err;
        }
    }

    public update() {
        if (!this.analyser) return;

        const data = this.analyser.getFrequencyData();
        const length = data.length;

        // Band separation
        let bass = 0;
        let mid = 0;
        let treble = 0;

        // Roughly: Bass (0-150Hz), Mid (150-2000Hz), Treble (2000-20000Hz)
        // With 1024 FFT at 44.1kHz, each bin is ~43Hz
        const bassEnd = Math.floor(length * 0.1);
        const midEnd = Math.floor(length * 0.5);

        for (let i = 0; i < length; i++) {
            const val = data[i];
            if (i < bassEnd) bass += val;
            else if (i < midEnd) mid += val;
            else treble += val;
        }

        this.targetLevels.bass = (bass / bassEnd / 255.0) * this.sensitivity;
        this.targetLevels.mid = (mid / (midEnd - bassEnd) / 255.0) * this.sensitivity;
        this.targetLevels.treble = (treble / (length - midEnd) / 255.0) * this.sensitivity;
        this.targetLevels.level = (this.targetLevels.bass + this.targetLevels.mid + this.targetLevels.treble) / 3.0;

        // Apply smoothing (Linear Interpolation / Damping)
        const lerp = 1.0 - this.smoothing;
        this.currentLevels.bass += (this.targetLevels.bass - this.currentLevels.bass) * lerp;
        this.currentLevels.mid += (this.targetLevels.mid - this.currentLevels.mid) * lerp;
        this.currentLevels.treble += (this.targetLevels.treble - this.currentLevels.treble) * lerp;
        this.currentLevels.level += (this.targetLevels.level - this.currentLevels.level) * lerp;
    }

    public getAudioData(): AudioData {
        return { ...this.currentLevels };
    }

    public togglePlayPause(): boolean {
        if (this.sound.isPlaying) {
            this.sound.pause();
        } else {
            this.sound.play();
        }
        return this.sound.isPlaying;
    }

    public isPlaying(): boolean {
        return this.sound.isPlaying;
    }

    public getBuffer(): AudioBuffer | null {
        return this.buffer;
    }

    public getDuration(): number {
        return this.buffer ? this.buffer.duration : 0;
    }

    public seek(time: number) {
        if (!this.buffer) return;
        const playing = this.sound.isPlaying;
        this.sound.stop();
        this.sound.offset = time;
        if (playing) this.sound.play();
    }

    public getCurrentTime(): number {
        if (!this.sound.isPlaying && this.sound.offset) return this.sound.offset;
        // THREE.Audio doesn't have a direct currentTime in 0.160 easily accessible that accounts for offset
        // but we can use the source node's context time if we track start time.
        // For simplicity in scrubbing, we'll mostly use the timeline's state as source of truth.
        return (this.sound as any)._startTime !== undefined ?
            this.audioContext.currentTime - (this.sound as any)._startTime + (this.sound.offset || 0) :
            (this.sound.offset || 0);
    }

    // Recording Logic
    private recorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private destNode: MediaStreamAudioDestinationNode | null = null;

    public startRecording() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        try {
            // "What You Hear" Recording Implementation
            // Connect the Master Listener to a destination node
            if (!this.destNode) {
                this.destNode = this.audioContext.createMediaStreamDestination();
                this.listener.getInput().connect(this.destNode);
            }

            this.recorder = new MediaRecorder(this.destNode.stream);
            this.recordedChunks = [];
            this.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };
            this.recorder.start();
            console.log('Mixed Audio recording started');

        } catch (e) {
            console.error('Failed to start audio recording:', e);
        }
    }

    public async stopRecording(): Promise<Blob | null> {
        if (!this.recorder || this.recorder.state === 'inactive') return null;

        return new Promise((resolve) => {
            this.recorder!.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                this.recordedChunks = [];
                resolve(blob);
            };
            this.recorder!.stop();
            console.log('Audio recording stopped');
        });
    }


}
