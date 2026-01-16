import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { UnitSphere } from './UnitSphere';

declare const electronAPI: any;

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    public bloomPass: UnrealBloomPass;
    public controls: OrbitControls;
    private sphere: UnitSphere;
    private clock: THREE.Clock;

    // v3.0 Desktop Export State
    private isCapturingProRes: boolean = false;
    private isRenderingMotion: boolean = false;
    private currentTime: number = 0;
    private timeStep: number = 1 / 60;
    private exportSize: number = 2048;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.z = 3.5;

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });

        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.setPixelRatio(1);
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);


        // Create alpha-preserving render target for EffectComposer
        const renderTarget = new THREE.WebGLRenderTarget(1024, 1024, {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            colorSpace: THREE.SRGBColorSpace
        });

        this.composer = new EffectComposer(this.renderer, renderTarget);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(1024, 1024),
            1.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);


        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.4;

        this.sphere = new UnitSphere();
        this.scene.add(this.sphere.group);

        this.clock = new THREE.Clock();
        this.onWindowResize();
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private onWindowResize() {
        if (this.isCapturingProRes || this.isRenderingMotion) return;

        const container = this.renderer.domElement.parentElement;
        if (!container) return;

        const size = Math.min(container.clientWidth, container.clientHeight);
        this.renderer.setSize(size, size);
        this.composer.setSize(size, size);
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();

        // Update resolution uniform
        if (this.sphere) {
            this.sphere.setResolution(size, size);
        }
    }

    public updatePostParams(params: any) {
        if (params.strength !== undefined) this.bloomPass.strength = params.strength;
        if (params.radius !== undefined) this.bloomPass.radius = params.radius;
        if (params.threshold !== undefined) this.bloomPass.threshold = params.threshold;
        if (params.exposure !== undefined) this.renderer.toneMappingExposure = params.exposure;
    }

    public animate(audio: { level: number, bass: number, mid: number, treble: number }) {
        if (this.isCapturingProRes) {
            this.currentTime += this.timeStep;
        } else if (!this.isRenderingMotion) {
            this.clock.getDelta();
            this.currentTime = this.clock.getElapsedTime();
        }

        if (!this.isRenderingMotion) {
            this.sphere.update(this.currentTime, audio);
            this.controls.update();

            if (this.isCapturingProRes) {
                this.renderForExport();
            } else {
                this.composer.render();
            }
        }
    }

    private async renderForExport() {
        // Render at high resolution regardless of window size
        const originalSize = new THREE.Vector2();
        this.renderer.getSize(originalSize);

        // Calculate scale factor for fidelity
        const scaleFactor = this.exportSize / originalSize.height;

        this.renderer.setSize(this.exportSize, this.exportSize, false);
        this.composer.setSize(this.exportSize, this.exportSize);

        // Scale visuals for export
        this.sphere.setResolution(this.exportSize, this.exportSize);
        const originalBloomRadius = this.bloomPass.radius;
        this.bloomPass.radius *= scaleFactor;

        // Force last pass to render to screen so we can read pixels
        const lastPass = this.composer.passes[this.composer.passes.length - 1];
        const wasRenderToScreen = lastPass.renderToScreen;
        lastPass.renderToScreen = true;

        this.composer.render();

        lastPass.renderToScreen = wasRenderToScreen;

        // Read pixels from WebGL framebuffer
        const gl = this.renderer.getContext();
        const pixels = new Uint8Array(this.exportSize * this.exportSize * 4);
        gl.readPixels(0, 0, this.exportSize, this.exportSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Send to Electron Main
        if (typeof electronAPI !== 'undefined') {
            electronAPI.sendFrame(pixels);
        }

        // Restore preview size and visuals
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.composer.setSize(originalSize.x, originalSize.y);
        this.sphere.setResolution(originalSize.x, originalSize.y);
        this.bloomPass.radius = originalBloomRadius;
    }


    public async renderMotionFrame(frameData: any, size: number = 2048): Promise<Uint8Array> {
        this.isRenderingMotion = true;
        this.exportSize = size;

        // Apply pre-recorded state
        this.sphere.setParams(frameData.params);
        this.sphere.update(frameData.time, frameData.audio);

        if (frameData.camera) {
            this.camera.position.set(frameData.camera.position.x, frameData.camera.position.y, frameData.camera.position.z);
            this.controls.target.set(frameData.camera.target.x, frameData.camera.target.y, frameData.camera.target.z);
        }
        this.controls.update();

        // Render high-res frame with composer (includes bloom and tone mapping)
        const originalSize = new THREE.Vector2();
        this.renderer.getSize(originalSize);

        // Calculate scale factor for fidelity
        const scaleFactor = this.exportSize / originalSize.height;

        this.renderer.setSize(this.exportSize, this.exportSize, false);
        this.composer.setSize(this.exportSize, this.exportSize);

        // Scale visuals for export
        this.sphere.setResolution(this.exportSize, this.exportSize);
        const originalBloomRadius = this.bloomPass.radius;
        this.bloomPass.radius *= scaleFactor;

        // Force last pass to render to screen so we can read pixels
        const lastPass = this.composer.passes[this.composer.passes.length - 1];
        const wasRenderToScreen = lastPass.renderToScreen;
        lastPass.renderToScreen = true;

        this.composer.render();

        lastPass.renderToScreen = wasRenderToScreen;

        // Read pixels from WebGL framebuffer
        const gl = this.renderer.getContext();
        const pixels = new Uint8Array(this.exportSize * this.exportSize * 4);
        gl.readPixels(0, 0, this.exportSize, this.exportSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Restore visuals
        this.sphere.setResolution(originalSize.x, originalSize.y);
        this.bloomPass.radius = originalBloomRadius;

        // Mirror: In motion render mode, we want the user to see the progress.
        // We'll restore the mirror preview immediately.
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.composer.setSize(originalSize.x, originalSize.y);
        this.composer.render(); // Draw mirror

        return pixels;

    }


    public getSphere() {
        return this.sphere;
    }

    // Pro Export Logic
    public async startProResExport(width: number = 2048, height: number = 2048) {
        if (typeof electronAPI === 'undefined') {
            alert('Desktop API not found. Are you running in Electron?');
            return false;
        }

        const options = {
            width,
            height,
            fps: 60,
            filename: `UNIT-ProRes-${Date.now()}.mov`
        };

        const result = await electronAPI.startFFmpegCapture(options);
        if (result && !result.error) {
            this.isCapturingProRes = true;
            this.exportSize = width;
            this.currentTime = 0;
            return true;
        }
        return false;
    }

    public stopProResExport() {
        this.isCapturingProRes = false;
        this.isRenderingMotion = false;
        if (typeof electronAPI !== 'undefined') {
            electronAPI.stopFFmpegCapture();
        }
        this.onWindowResize();
    }

    public async export4K() {
        const size = 4096;
        const originalSize = new THREE.Vector2();
        this.renderer.getSize(originalSize);

        // Calculate scale factor for fidelity
        const scaleFactor = size / originalSize.height;

        // Render at 4K with composer (includes bloom and tone mapping)
        this.renderer.setSize(size, size, false);
        this.composer.setSize(size, size);

        // Scale visuals for export
        this.sphere.setResolution(size, size);
        const originalBloomRadius = this.bloomPass.radius;
        this.bloomPass.radius *= scaleFactor;

        // Force last pass to render to screen so we can read pixels
        const lastPass = this.composer.passes[this.composer.passes.length - 1];
        const wasRenderToScreen = lastPass.renderToScreen;
        lastPass.renderToScreen = true;

        this.composer.render();

        lastPass.renderToScreen = wasRenderToScreen;

        // Read pixels from WebGL framebuffer
        const gl = this.renderer.getContext();
        const pixels = new Uint8Array(size * size * 4);
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);


        // Create canvas and draw pixels
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(size, size);

        // Flip Y axis (WebGL reads bottom-to-top, canvas is top-to-bottom)
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const srcIdx = ((size - 1 - y) * size + x) * 4;
                const dstIdx = (y * size + x) * 4;
                imageData.data[dstIdx] = pixels[srcIdx];
                imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
                imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
                imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Export as PNG
        const dataURL = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `UNIT-V3-PNG-${Date.now()}.png`;
        link.click();

        // Restore preview size and visuals
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.composer.setSize(originalSize.x, originalSize.y);
        this.sphere.setResolution(originalSize.x, originalSize.y);
        this.bloomPass.radius = originalBloomRadius;
    }


    public sendFrame(pixels: Uint8Array) {
        if (typeof electronAPI !== 'undefined') {
            electronAPI.sendFrame(pixels);
        }
    }
}
