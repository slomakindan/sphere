import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders/sphere.glsl.ts';

export class UnitSphere {
    mesh: THREE.Points;
    coreMesh: THREE.Mesh;
    stripsGroup: THREE.Group;
    material: THREE.ShaderMaterial;
    group: THREE.Group;
    private detail: number = 100;

    constructor(detail: number = 100) {
        this.detail = detail;
        this.group = new THREE.Group();

        // Initial geometry
        const geometry = new THREE.IcosahedronGeometry(1.5, this.detail);

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uStaticMode: { value: false },
                uSpeed: { value: 0.2 },
                uNoiseDensity: { value: 1.5 },
                uNoiseStrength: { value: 0.3 },
                uNoiseScale: { value: 1.0 },
                uOctaves: { value: 3.0 },
                uRadialBias: { value: 0.5 },
                uOpacity: { value: 0.6 },
                uSizeRange: { value: new THREE.Vector2(0.8, 2.5) },
                uAudioLevel: { value: 0 },
                uBass: { value: 0 },
                uMid: { value: 0 },
                uTreble: { value: 0 },
                // v2.3 Color Spot Engine
                uBaseColor: { value: new THREE.Color(0xf2f4f7) },
                uAccentColor: { value: new THREE.Color(0xff0000) },
                // v5.0 Audio-Reactive Colors
                uBassColor: { value: new THREE.Color(0xff3300) },    // Deep red/orange for bass
                uMidColor: { value: new THREE.Color(0x00ff88) },     // Cyan/green for voice
                uTrebleColor: { value: new THREE.Color(0x00aaff) },  // Bright blue for treble
                uAudioColorMix: { value: 0.7 },
                uAudioColorsEnabled: { value: true },
                uSpotScale: { value: 2.0 },
                uSpotThreshold: { value: 0.6 },
                uAudioInfluence: { value: 1.0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                // v2.5 Galaxy Swirl Mode

                uSwirlEnabled: { value: false },
                uSwirlSpeed: { value: 0.4 },
                uTwistAmount: { value: 2.0 },
                uSwirlDetail: { value: 4.0 },
                uClusterIntensity: { value: 3.0 },
                uVoidRadius: { value: 0.0 },
                uOrbitChaos: { value: 0.0 }, // NEW // NEW
                // v3.0 Shape Morphing
                uMorphTarget: { value: 0 },
                uMorphProgress: { value: 0.0 },
                // v3.0 Attractors
                uAttractorPos: { value: new THREE.Vector3(0, 0, 0) },
                uAttractorStrength: { value: 0.0 },
                // v3.0 Glitch
                uGlitchActive: { value: false },
                uGlitchIntensity: { value: 0.5 },
                uGlitchSeed: { value: 0.0 },
                // v3.0 Visual DNA
                uImageTexture: { value: null },
                uImageMorphFactor: { value: 0.0 },
                uImageDisplacementFactor: { value: 0.0 },
                uImageColorMix: { value: 0.0 },
                uImageEnabled: { value: false },
                // v3.2 Loop Mode
                uLoopActive: { value: false },
                uLoopDuration: { value: 10.0 },
                // v3.3 Chaos Mode
                uChaosAmplitude: { value: 0.0 },
                uChaosSpeed: { value: 1.0 },
                uCameraPosition: { value: new THREE.Vector3() },
                uViewClear: { value: 0.0 },
                // v4.0 Flow Field
                uFlowEnabled: { value: false },
                uFlowStrength: { value: 0.5 },
                uFlowSpeed: { value: 0.3 },
                uFlowFrequency: { value: 2.0 },
                uFlowOctaves: { value: 3.0 },
                uFlowTurbulence: { value: 0.5 },
                // v4.1 Sphere Scale
                uSphereScale: { value: 1.0 },
                // v4.2 Vortex Streams
                uVortexEnabled: { value: false },
                uVortexCount: { value: 5.0 },
                uVortexStrength: { value: 1.0 },
                uVortexSpeed: { value: 0.5 },
                uVortexTilt: { value: 0.0 },
                // v4.3 Containment
                uContainmentRadius: { value: 1.5 },
                uContainmentStrength: { value: 0.0 },
                // v4.5 Flocking
                uFlockingStrength: { value: 0.0 },
                uFlockingScale: { value: 3.0 },
                uFlockingSpeed: { value: 0.3 }
            },
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.Points(geometry, this.material);
        this.group.add(this.mesh);

        // 1. Central Core with HDR Shader (v2.5)
        const coreGeo = new THREE.SphereGeometry(0.02, 32, 32);
        const coreMat = new THREE.ShaderMaterial({
            uniforms: {
                uCoreColor: { value: new THREE.Color(0x0057FF) },
                uCoreIntensity: { value: 1.5 }
            },
            vertexShader: `
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uCoreColor;
                uniform float uCoreIntensity;
                void main() {
                    gl_FragColor = vec4(uCoreColor * uCoreIntensity, 1.0);
                }
            `
        });
        this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
        this.group.add(this.coreMesh);

        // 2. Interface Strips (Crosshair)
        this.stripsGroup = new THREE.Group();
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            linewidth: 1 // Note: linewidth > 1 is not supported in most browsers for basic lines
        });

        const createFlareLine = (axis: 'x' | 'y' | 'z') => {
            const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
            points[1][axis] = 0.5;
            points[0][axis] = -0.5;
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            return new THREE.Line(geo, lineMat.clone());
        };

        this.stripsGroup.add(createFlareLine('x'));
        this.stripsGroup.add(createFlareLine('y'));
        this.stripsGroup.add(createFlareLine('z'));
        this.group.add(this.stripsGroup);
    }

    update(time: number, audio: { level: number, bass: number, mid: number, treble: number }) {
        this.material.uniforms.uTime.value = time;
        this.material.uniforms.uAudioLevel.value = audio.level;
        this.material.uniforms.uBass.value = audio.bass;
        this.material.uniforms.uMid.value = audio.mid;
        this.material.uniforms.uTreble.value = audio.treble;

        // Pulse logic for core based on Bass
        const coreBaseScale = this.coreMesh.userData.baseScale || 1.0;
        const coreAudioScale = coreBaseScale * (1.0 + audio.bass * 2.0);
        this.coreMesh.scale.set(coreAudioScale, coreAudioScale, coreAudioScale);

        // Rotation & Movement
        if (this.material.uniforms.uLoopActive.value) {
            const duration = this.material.uniforms.uLoopDuration.value;
            const progress = (time % duration) / duration;

            // Loop Mode - breathing/oscillation
            // When staticMode is on, don't oscillate position or rotation
            const isStatic = this.material.uniforms.uStaticMode?.value;

            if (!isStatic) {
                this.group.rotation.y = Math.sin(progress * Math.PI * 2.0) * 0.3;
                this.stripsGroup.rotation.z = Math.sin(progress * Math.PI * 2.0) * 0.1;
                this.group.position.y = Math.sin(progress * Math.PI * 2.0) * 0.05;
            } else {
                // Lock position when Фикс.Центр is on
                this.group.rotation.y = 0;
                this.stripsGroup.rotation.z = 0;
                this.group.position.y = 0;
            }
        } else {
            // Standard Mode (Chaos is now handled in Shader)
            const isStatic = this.material.uniforms.uStaticMode?.value;

            if (!isStatic) {
                this.group.rotation.y = time * 0.12;
                this.stripsGroup.rotation.z = time * 0.25;
                this.group.position.y = Math.sin(time * 0.4) * 0.05;
            } else {
                // Lock position when Фикс.Центр is on
                this.group.rotation.y = 0;
                this.stripsGroup.rotation.z = 0;
                this.group.position.y = 0;
            }
        }

        // Pass Chaos params to Shader (Internal Chaos)
        if (this.material.uniforms.uChaosAmplitude) {
            // We can modulate chaos time here if needed, but simple value passing is enough
        }
    }

    setParams(params: any) {
        const u = this.material.uniforms;

        // v3.3 Chaos Mode
        if (params.chaosAmplitude !== undefined) {
            if (!u.uChaosAmplitude) u.uChaosAmplitude = { value: 0 };
            u.uChaosAmplitude.value = params.chaosAmplitude;
        }
        if (params.chaosSpeed !== undefined) {
            if (!u.uChaosSpeed) u.uChaosSpeed = { value: 1.0 };
            u.uChaosSpeed.value = params.chaosSpeed;
        }

        // Material & Noise
        if (params.baseColor !== undefined) u.uBaseColor.value.set(params.baseColor);
        if (params.accentColor !== undefined) u.uAccentColor.value.set(params.accentColor);
        if (params.spotScale !== undefined) u.uSpotScale.value = params.spotScale;
        if (params.spotThreshold !== undefined) u.uSpotThreshold.value = params.spotThreshold;

        if (params.minSize !== undefined) u.uSizeRange.value.x = params.minSize;
        if (params.maxSize !== undefined) u.uSizeRange.value.y = params.maxSize;
        if (params.opacity !== undefined) u.uOpacity.value = params.opacity;
        if (params.blending !== undefined) {
            this.material.blending = params.blending;
            this.material.needsUpdate = true;
        }

        if (params.speed !== undefined) u.uSpeed.value = params.speed;
        if (params.density !== undefined) u.uNoiseDensity.value = params.density;
        if (params.strength !== undefined) u.uNoiseStrength.value = params.strength;
        if (params.scale !== undefined) u.uNoiseScale.value = params.scale;
        if (params.octaves !== undefined) u.uOctaves.value = params.octaves;
        if (params.radialBias !== undefined) u.uRadialBias.value = params.radialBias;
        if (params.audioStrength !== undefined) u.uAudioInfluence.value = params.audioStrength;

        // v5.0 Audio Colors
        if (params.bassColor !== undefined) u.uBassColor.value.set(params.bassColor);
        if (params.midColor !== undefined) u.uMidColor.value.set(params.midColor);
        if (params.trebleColor !== undefined) u.uTrebleColor.value.set(params.trebleColor);
        if (params.audioColorMix !== undefined) u.uAudioColorMix.value = params.audioColorMix;
        if (params.audioColorsEnabled !== undefined) u.uAudioColorsEnabled.value = params.audioColorsEnabled;
        if (params.staticMode !== undefined) u.uStaticMode.value = params.staticMode;

        // Galaxy Swirl Mode (v2.5)
        if (params.swirlEnabled !== undefined) u.uSwirlEnabled.value = params.swirlEnabled;
        if (params.swirlSpeed !== undefined) u.uSwirlSpeed.value = params.swirlSpeed;
        if (params.twistAmount !== undefined) u.uTwistAmount.value = params.twistAmount;
        if (params.swirlDetail !== undefined) u.uSwirlDetail.value = params.swirlDetail;
        if (params.clusterIntensity !== undefined) u.uClusterIntensity.value = params.clusterIntensity;
        if (params.voidRadius !== undefined) u.uVoidRadius.value = params.voidRadius;
        if (params.orbitChaos !== undefined) u.uOrbitChaos.value = params.orbitChaos;
        if (params.viewClear !== undefined) u.uViewClear.value = params.viewClear;

        // v4.0 Flow Field
        if (params.flowEnabled !== undefined) u.uFlowEnabled.value = params.flowEnabled;
        if (params.flowStrength !== undefined) u.uFlowStrength.value = params.flowStrength;
        if (params.flowSpeed !== undefined) u.uFlowSpeed.value = params.flowSpeed;
        if (params.flowFrequency !== undefined) u.uFlowFrequency.value = params.flowFrequency;
        if (params.flowOctaves !== undefined) u.uFlowOctaves.value = params.flowOctaves;
        if (params.flowTurbulence !== undefined) u.uFlowTurbulence.value = params.flowTurbulence;

        // v4.1 Sphere Scale
        if (params.sphereScale !== undefined) u.uSphereScale.value = params.sphereScale;

        // v4.2 Vortex Streams
        if (params.vortexEnabled !== undefined) u.uVortexEnabled.value = params.vortexEnabled;
        if (params.vortexCount !== undefined) u.uVortexCount.value = params.vortexCount;
        if (params.vortexStrength !== undefined) u.uVortexStrength.value = params.vortexStrength;
        if (params.vortexSpeed !== undefined) u.uVortexSpeed.value = params.vortexSpeed;
        if (params.vortexTilt !== undefined) u.uVortexTilt.value = params.vortexTilt;

        // v4.3 Containment
        if (params.containmentRadius !== undefined) u.uContainmentRadius.value = params.containmentRadius;
        if (params.containmentStrength !== undefined) u.uContainmentStrength.value = params.containmentStrength;

        // v4.5 Flocking
        if (params.flockingStrength !== undefined) u.uFlockingStrength.value = params.flockingStrength;
        if (params.flockingScale !== undefined) u.uFlockingScale.value = params.flockingScale;
        if (params.flockingSpeed !== undefined) u.uFlockingSpeed.value = params.flockingSpeed;

        // v3.0 Shape Morphing
        if (params.morphTarget !== undefined) u.uMorphTarget.value = params.morphTarget;
        if (params.morphProgress !== undefined) u.uMorphProgress.value = params.morphProgress;

        // v3.0 Attractors
        if (params.attractorStrength !== undefined) u.uAttractorStrength.value = params.attractorStrength;
        if (params.attractorX !== undefined) u.uAttractorPos.value.x = params.attractorX;
        if (params.attractorY !== undefined) u.uAttractorPos.value.y = params.attractorY;
        if (params.attractorZ !== undefined) u.uAttractorPos.value.z = params.attractorZ;

        // v3.0 Glitch
        if (params.glitchActive !== undefined) u.uGlitchActive.value = params.glitchActive;
        if (params.glitchIntensity !== undefined) u.uGlitchIntensity.value = params.glitchIntensity;

        // v3.0 Visual DNA
        if (params.imageTexture !== undefined) u.uImageTexture.value = params.imageTexture;
        if (params.imageEnabled !== undefined) u.uImageEnabled.value = params.imageEnabled;
        if (params.imageMorphFactor !== undefined) u.uImageMorphFactor.value = params.imageMorphFactor;
        if (params.imageDisplacementFactor !== undefined) u.uImageDisplacementFactor.value = params.imageDisplacementFactor;
        if (params.imageColorMix !== undefined) u.uImageColorMix.value = params.imageColorMix;

        // v3.2 Loop Mode
        if (params.loopActive !== undefined) u.uLoopActive.value = params.loopActive;
        if (params.loopDuration !== undefined) u.uLoopDuration.value = params.loopDuration;


        // Center Interface Control
        const coreU = (this.coreMesh.material as THREE.ShaderMaterial).uniforms;
        if (params.showCore !== undefined) this.coreMesh.visible = params.showCore;
        if (params.coreSize !== undefined) {
            this.coreMesh.userData.baseScale = params.coreSize;
            this.coreMesh.scale.setScalar(params.coreSize);
        }
        if (params.coreColor !== undefined) coreU.uCoreColor.value.set(params.coreColor);
        if (params.coreIntensity !== undefined) coreU.uCoreIntensity.value = params.coreIntensity;

        if (params.showStrips !== undefined) this.stripsGroup.visible = params.showStrips;
        if (params.stripsOpacity !== undefined) {
            this.stripsGroup.children.forEach(child => {
                ((child as THREE.Line).material as THREE.LineBasicMaterial).opacity = params.stripsOpacity;
            });
        }
        if (params.stripsColor !== undefined) {
            this.stripsGroup.children.forEach(child => {
                ((child as THREE.Line).material as THREE.LineBasicMaterial).color.set(params.stripsColor);
            });
        }
    }

    public setResolution(width: number, height: number) {
        this.material.uniforms.uResolution.value.set(width, height);
    }

    public rebuildGeometry(detail: number) {
        this.detail = detail;

        // Dispose old geometry
        const oldGeometry = this.mesh.geometry;
        oldGeometry.dispose();

        // Create new geometry
        const newGeometry = new THREE.IcosahedronGeometry(1.5, this.detail);

        // Update mesh
        this.mesh.geometry = newGeometry;

        console.log(`[SPHERE] Rebuilt with ${newGeometry.getAttribute('position').count} particles (detail: ${this.detail})`);
    }
}
