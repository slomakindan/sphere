export class TimelineController {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private playhead: HTMLElement;

    private duration: number = 0;
    private currentTime: number = 0;
    private inPoint: number = 0;
    private outPoint: number = 0;

    private isScrubbing: boolean = false;
    private onSeek: (time: number) => void;
    private keyframes: number[] = [];

    constructor(container: HTMLElement, onSeek: (time: number) => void) {
        this.container = container;
        this.onSeek = onSeek;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'timeline-waveform';
        this.ctx = this.canvas.getContext('2d')!;

        this.playhead = document.createElement('div');
        this.playhead.className = 'timeline-playhead';

        this.container.appendChild(this.canvas);
        this.container.appendChild(this.playhead);

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private initEvents() {
        this.container.addEventListener('mousedown', (e) => {
            this.isScrubbing = true;
            this.handleTimelineInteraction(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isScrubbing) this.handleTimelineInteraction(e);
        });

        window.addEventListener('mouseup', () => {
            this.isScrubbing = false;
        });

        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'i') {
                this.inPoint = this.currentTime;
                this.renderWaveform();
            }
            if (e.key.toLowerCase() === 'o') {
                this.outPoint = this.currentTime;
                this.renderWaveform();
            }
        });
    }

    private handleTimelineInteraction(e: MouseEvent) {
        const rect = this.container.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * this.duration;
        this.onSeek(time);
    }

    public setDuration(duration: number) {
        this.duration = duration;
        this.outPoint = duration;
        this.updatePlayhead();
    }

    public updateTime(time: number) {
        this.currentTime = time;
        this.updatePlayhead();
    }

    public setKeyframes(times: number[]) {
        this.keyframes = times;
        if (this.lastPeaks) this.renderWaveform();
    }

    private updatePlayhead() {
        const percentage = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        this.playhead.style.left = `${percentage}%`;
    }

    private resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.renderWaveform();
    }

    private lastPeaks: Float32Array | null = null;

    public renderWaveform(buffer?: AudioBuffer | null) {
        if (buffer && this.duration > 0) {
            const rawData = buffer.getChannelData(0);
            const sampleRate = buffer.sampleRate;

            // Calculate how many samples to take based on duration
            const totalSamplesToRender = Math.floor(this.duration * sampleRate);
            const dataToRender = rawData.slice(0, totalSamplesToRender);

            const samples = this.canvas.width;
            const blockSize = Math.floor(dataToRender.length / samples);
            const peaks = new Float32Array(samples);

            for (let i = 0; i < samples; i++) {
                let max = 0;
                for (let j = 0; j < blockSize; j++) {
                    const abs = Math.abs(dataToRender[i * blockSize + j]);
                    if (abs > max) max = abs;
                }
                peaks[i] = max;
            }
            this.lastPeaks = peaks;
            this.drawWaveform(peaks);
        } else {
            this.drawWaveform(this.lastPeaks);
        }
    }

    private drawWaveform(peaks: Float32Array | null) {
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;

        this.ctx.clearRect(0, 0, w, h);

        // Draw In-Out Range Background
        if (this.duration > 0) {
            const inX = (this.inPoint / this.duration) * w;
            const outX = (this.outPoint / this.duration) * w;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.fillRect(inX, 0, outX - inX, h);

            if (peaks) {
                this.ctx.fillStyle = 'rgba(0, 87, 255, 0.4)'; // UNIT Theme Blue

                const barWidth = w / peaks.length;
                for (let i = 0; i < peaks.length; i++) {
                    const barHeight = peaks[i] * h;
                    this.ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
                }
            }

            // Draw In/Out Markers
            this.ctx.fillStyle = '#0057FF';
            this.ctx.fillRect(inX, 0, 2, h);
            this.ctx.fillRect(outX - 2, 1, 2, h);

            this.ctx.font = 'bold 9px Inter';
            this.ctx.fillText('IN', inX + 5, 12);
            this.ctx.fillText('OUT', outX - 25, 12);

            // Draw Keyframes (recorded points)
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.keyframes.forEach(kTime => {
                const kX = (kTime / this.duration) * w;
                this.ctx.beginPath();
                this.ctx.arc(kX, h - 5, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }

    public getRange() {
        return { in: this.inPoint, out: this.outPoint };
    }
}
