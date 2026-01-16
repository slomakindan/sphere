export interface MotionFrame {
    time: number;
    audio: {
        level: number;
        bass: number;
        mid: number;
        treble: number;
    };
    params: any;
    camera: {
        position: { x: number, y: number, z: number },
        target: { x: number, y: number, z: number }
    };
}

export class MotionController {
    private buffer: MotionFrame[] = [];
    private isRecording: boolean = false;

    constructor() { }

    public startRecording() {
        this.buffer = [];
        this.isRecording = true;
        console.log("Motion Recording Started...");
    }

    public stopRecording(): MotionFrame[] {
        this.isRecording = false;
        console.log(`Motion Recording Stopped. Captured ${this.buffer.length} frames.`);
        return this.buffer;
    }

    public recordFrame(time: number, audio: any, params: any, camera: any) {
        if (!this.isRecording) return;

        // Deep copy params to avoid reference issues
        this.buffer.push({
            time,
            audio: { ...audio },
            params: JSON.parse(JSON.stringify(params)),
            camera: {
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                target: { x: camera.target.x, y: camera.target.y, z: camera.target.z }
            }
        });
    }

    public getBuffer(): MotionFrame[] {
        return this.buffer;
    }

    public setBuffer(buffer: MotionFrame[]) {
        this.buffer = buffer;
    }

    public getFrame(index: number): MotionFrame | null {
        if (index < 0 || index >= this.buffer.length) return null;
        return this.buffer[index];
    }

    public getInterpolatedFrame(time: number): MotionFrame | null {
        if (this.buffer.length === 0) return null;

        // Find the index of the first frame with time >= target time
        let index = this.buffer.findIndex(f => f.time >= time);

        // If time is before first frame
        if (index === 0) return JSON.parse(JSON.stringify(this.buffer[0]));

        // If time is after last frame
        if (index === -1) return JSON.parse(JSON.stringify(this.buffer[this.buffer.length - 1]));

        const f1 = this.buffer[index - 1];
        const f2 = this.buffer[index];

        const alpha = (time - f1.time) / (f2.time - f1.time);

        const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;
        const lerpColor = (c1: string, c2: string, t: number) => {
            // Very basic HEX lerp for simplicity, better would be THREE.Color.lerp
            // but we don't want to import THREE here if possible. 
            // Since we know they are HEX strings from dat.gui:
            if (c1.startsWith('#') && c2.startsWith('#')) {
                const r1 = parseInt(c1.substring(1, 3), 16);
                const g1 = parseInt(c1.substring(3, 5), 16);
                const b1 = parseInt(c1.substring(5, 7), 16);
                const r2 = parseInt(c2.substring(1, 3), 16);
                const g2 = parseInt(c2.substring(3, 5), 16);
                const b2 = parseInt(c2.substring(5, 7), 16);
                const rb = Math.round(lerpNum(r1, r2, t)).toString(16).padStart(2, '0');
                const gb = Math.round(lerpNum(g1, g2, t)).toString(16).padStart(2, '0');
                const bb = Math.round(lerpNum(b1, b2, t)).toString(16).padStart(2, '0');
                return `#${rb}${gb}${bb}`;
            }
            return c1; // Fallback
        };

        const interpolated: MotionFrame = {
            time: time,
            audio: {
                level: lerpNum(f1.audio.level, f2.audio.level, alpha),
                bass: lerpNum(f1.audio.bass, f2.audio.bass, alpha),
                mid: lerpNum(f1.audio.mid, f2.audio.mid, alpha),
                treble: lerpNum(f1.audio.treble, f2.audio.treble, alpha)
            },
            params: { ...f1.params },
            camera: {
                position: {
                    x: lerpNum(f1.camera.position.x, f2.camera.position.x, alpha),
                    y: lerpNum(f1.camera.position.y, f2.camera.position.y, alpha),
                    z: lerpNum(f1.camera.position.z, f2.camera.position.z, alpha)
                },
                target: {
                    x: lerpNum(f1.camera.target.x, f2.camera.target.x, alpha),
                    y: lerpNum(f1.camera.target.y, f2.camera.target.y, alpha),
                    z: lerpNum(f1.camera.target.z, f2.camera.target.z, alpha)
                }
            }
        };

        // Interpolate all numeric params
        for (const key in f1.params) {
            const v1 = f1.params[key];
            const v2 = f2.params[key];
            if (typeof v1 === 'number' && typeof v2 === 'number') {
                interpolated.params[key] = lerpNum(v1, v2, alpha);
            } else if (typeof v1 === 'string' && v1.startsWith('#') && typeof v2 === 'string' && v2.startsWith('#')) {
                interpolated.params[key] = lerpColor(v1, v2, alpha);
            }
        }

        return interpolated;
    }

    public getLength(): number {
        return this.buffer.length;
    }

    public clear() {
        this.buffer = [];
    }

    public saveToFile() {
        if (this.buffer.length === 0) return;
        const data = JSON.stringify(this.buffer);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UNIT-Motion-${Date.now()}.motion.json`;
        a.click();
    }
}
