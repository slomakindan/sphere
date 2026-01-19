import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
    private isBusyExporting: boolean = false;
    private exportSize: number = 4096;

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

        // --- Alpha Fix ---
        // Patch UnrealBloomPass to preserve alpha
        if ((this.bloomPass as any).separableBlurMaterials) {
            (this.bloomPass as any).separableBlurMaterials.forEach((material: THREE.ShaderMaterial) => {
                material.fragmentShader = `
                    #include <common>
                    varying vec2 vUv;
                    uniform sampler2D colorTexture;
                    uniform vec2 texSize;
                    uniform vec2 direction;

                    float gaussianPdf(in float x, in float sigma) {
                        return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
                    }

                    void main() {
                        vec2 invSize = 1.0 / texSize;
                        float fSigma = 4.0;
                        float weightSum = gaussianPdf(0.0, fSigma);
                        float alphaSum = 0.0;
                        vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;
                        
                        for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
                            float x = float( i );
                            float w = gaussianPdf(x, fSigma);
                            vec2 uvOffset = direction * invSize * x;
                            vec4 sample1 = texture2D( colorTexture, vUv + uvOffset );
                            vec4 sample2 = texture2D( colorTexture, vUv - uvOffset );
                            diffuseSum += (sample1 + sample2) * w;
                            weightSum += 2.0 * w;
                        }
                        
                        gl_FragColor = vec4(diffuseSum.rgb / weightSum, diffuseSum.a / weightSum);
                    }
                `;
                material.defines = { 'KERNEL_RADIUS': 27 };
            });
        }

        // Patch Composite Material to mix alpha correctly
        if ((this.bloomPass as any).compositeMaterial) {
            (this.bloomPass as any).compositeMaterial.fragmentShader = `
                varying vec2 vUv;
                uniform sampler2D blurTexture1;
                uniform sampler2D blurTexture2;
                uniform sampler2D blurTexture3;
                uniform sampler2D blurTexture4;
                uniform sampler2D blurTexture5;
                uniform sampler2D dirtTexture;
                uniform float bloomStrength;
                uniform float bloomRadius;
                uniform float bloomFactors[NUM_MIPS];
                uniform vec3 bloomTintColors[NUM_MIPS];
                
                float lerpBloomFactor(const in float factor) { 
                    float mirrorFactor = 1.2 - factor;
                    return mix(factor, mirrorFactor, bloomRadius);
                }
                
                void main() {
                    float bloomFactor1 = lerpBloomFactor(bloomFactors[0]);
                    float bloomFactor2 = lerpBloomFactor(bloomFactors[1]);
                    float bloomFactor3 = lerpBloomFactor(bloomFactors[2]);
                    float bloomFactor4 = lerpBloomFactor(bloomFactors[3]);
                    float bloomFactor5 = lerpBloomFactor(bloomFactors[4]);
                    
                    vec4 color1 = texture2D(blurTexture1, vUv);
                    vec4 color2 = texture2D(blurTexture2, vUv);
                    vec4 color3 = texture2D(blurTexture3, vUv);
                    vec4 color4 = texture2D(blurTexture4, vUv);
                    vec4 color5 = texture2D(blurTexture5, vUv);
                    
                    vec4 bloomColor = bloomStrength * ( 
                        color1 * bloomFactor1 + 
                        color2 * bloomFactor2 + 
                        color3 * bloomFactor3 + 
                        color4 * bloomFactor4 + 
                        color5 * bloomFactor5 
                    );
                    
                    gl_FragColor = bloomColor;
                }
            `;
            // Note: The composite pass in UnrealBloomPass is additive! 
            // It just outputs the bloom color. The MixShader then blends it?
            // Wait, UnrealBloomPass source uses its own internal composite material to render to screen?
            // Actually, looking at UnrealBloomPass source:
            // "this.fsQuad.material = this.basicMaterial;" when rendering simple?
            // "this.fsQuad.material = this.compositeMaterial;" 

            // Standard UnrealBloomPass Composite Shader includes blending with the toneMapped scene?
            // No, the standard implementation usually does:
            // gl_FragColor = vec4( bloom, 1.0 ); OR it might render ADDITIVELY to the read buffer?

            (this.bloomPass as any).compositeMaterial.blending = THREE.AdditiveBlending;
            (this.bloomPass as any).compositeMaterial.transparent = true;
        }

        // Fix Alpha using ShaderPass (Safety Net)
        // Ensures that visible pixels have alpha, avoiding black outlines or missing glow alpha
        // Fix Alpha using ShaderPass (Safety Net)
        // Ensures that visible pixels have alpha, avoiding black outlines or missing glow alpha
        const AlphaRecoveryShader = {
            uniforms: {
                'tDiffuse': { value: null },
                'alphaThreshold': { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float alphaThreshold;
                varying vec2 vUv;
                void main() {
                    vec4 tex = texture2D( tDiffuse, vUv );
                    float brightness = max(tex.r, max(tex.g, tex.b));
                    // If pixel is bright enough, it should have alpha.
                    float recoveredAlpha = max(tex.a, step(alphaThreshold, brightness) * brightness);
                    gl_FragColor = vec4( tex.rgb, recoveredAlpha );
                }
            `
        };

        const alphaPass = new ShaderPass(AlphaRecoveryShader);
        this.composer.addPass(alphaPass);

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
        // During motion frame export, skip ALL updates to prevent interference
        if (this.isRenderingMotion) return;

        if (this.isCapturingProRes && this.isBusyExporting) return;

        if (this.isCapturingProRes) {
            this.currentTime += this.timeStep;
        } else {
            this.clock.getDelta();
            this.currentTime = this.clock.getElapsedTime();
        }

        this.sphere.update(this.currentTime, audio);
        this.controls.update();

        if (this.isCapturingProRes) {
            this.renderForExport();
        } else {
            this.composer.render();
        }
    }


    private async renderForExport() {
        if (this.isBusyExporting) return;
        this.isBusyExporting = true;

        try {
            // Render at high resolution regardless of window size
            const originalSize = new THREE.Vector2();
            this.renderer.getSize(originalSize);

            // Calculate scale factor for fidelity
            const scaleFactor = this.exportSize / originalSize.height;

            // Snapshot Fix: Ensure clear alpha is 0
            this.renderer.setClearColor(0x000000, 0);

            this.renderer.setSize(this.exportSize, this.exportSize, false);
            this.composer.setSize(this.exportSize, this.exportSize);

            // Scale visuals for export
            this.sphere.setResolution(this.exportSize, this.exportSize);
            const originalBloomRadius = this.bloomPass.radius;
            const originalBloomStrength = this.bloomPass.strength;

            this.bloomPass.radius *= scaleFactor;
            this.bloomPass.strength *= 0.85; // Slight reduction for 4K density


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
            await this.sendFrame(pixels);

            // Restore preview size and visuals
            this.sphere.setResolution(originalSize.x, originalSize.y);
            this.bloomPass.radius = originalBloomRadius;
            this.bloomPass.strength = originalBloomStrength;
            this.renderer.setSize(originalSize.x, originalSize.y, false);
            this.composer.setSize(originalSize.x, originalSize.y);
        } finally {
            this.isBusyExporting = false;
        }
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

        // Snapshot Fix: Ensure clear alpha is 0
        this.renderer.setClearColor(0x000000, 0);

        this.renderer.setSize(this.exportSize, this.exportSize, false);
        this.composer.setSize(this.exportSize, this.exportSize);

        // Scale visuals for export
        this.sphere.setResolution(this.exportSize, this.exportSize);
        const originalBloomRadius = this.bloomPass.radius;
        const originalBloomStrength = this.bloomPass.strength;

        this.bloomPass.radius *= scaleFactor;
        this.bloomPass.strength *= 0.85;

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
        this.bloomPass.strength = originalBloomStrength;

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
    public async startProResExport(width: number = 2048, height: number = 2048, fps: number = 60, format: 'mov' | 'webm' | 'apng' = 'mov', audioPath: string | null = null, duration: number = 0, maxSize: number = 0) {
        // Check if running in Electron
        if (typeof electronAPI === 'undefined') {
            console.error('Electron API not available');
            return false;
        }

        // Prepare filename based on format
        let filename: string;
        if (format === 'webm') {
            filename = `UNIT-WebM-${Date.now()}.webm`;
        } else if (format === 'apng') {
            filename = `UNIT-APNG-${Date.now()}.png`;
        } else {
            filename = `UNIT-ProRes-${Date.now()}.mov`;
        }

        const options = {
            width,
            height,
            fps,
            format,
            audioPath,
            duration,
            maxSize,
            filename
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

        // Snapshot Fix: Ensure clear alpha is 0
        this.renderer.setClearColor(0x000000, 0);

        // Render at 4K with composer (includes bloom and tone mapping)
        this.renderer.setSize(size, size, false);
        this.composer.setSize(size, size);


        // Scale visuals for export
        this.sphere.setResolution(size, size);
        const originalBloomRadius = this.bloomPass.radius;
        const originalBloomStrength = this.bloomPass.strength;

        this.bloomPass.radius *= scaleFactor;
        // User requested slight reduction (0.85) to prevent overexposure/whiteout in 4K
        this.bloomPass.strength *= 0.85;

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
        this.bloomPass.strength = originalBloomStrength;
    }


    public async sendFrame(pixels: Uint8Array) {
        if (typeof electronAPI !== 'undefined') {
            await electronAPI.sendFrame(pixels);
        }
    }
}

