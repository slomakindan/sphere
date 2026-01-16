import * as THREE from 'three';
import { gsap } from 'gsap';
import { UnitSphere } from './UnitSphere';

export type SystemState = 'INIT' | 'ANALYSIS' | 'STABILIZE' | 'ACTIVE';

interface StateParams {
    speed: number;
    density: number;
    strength: number;
    color: THREE.Color;
}

export class StateManager {
    private sphere: UnitSphere;
    private currentState: SystemState = 'INIT';

    private states: Record<SystemState, StateParams> = {
        INIT: {
            speed: 0.1,
            density: 1.2,
            strength: 0.2,
            color: new THREE.Color(0xf2f4f7) // Base White
        },
        ANALYSIS: {
            speed: 1.5,
            density: 4.0,
            strength: 0.8,
            color: new THREE.Color(0xff0033) // Error Red
        },
        STABILIZE: {
            speed: 0.4,
            density: 1.8,
            strength: 0.4,
            color: new THREE.Color(0x00ff41) // Stabilize Green
        },
        ACTIVE: {
            speed: 0.6,
            density: 2.2,
            strength: 0.5,
            color: new THREE.Color(0x002896) // Core Blue
        }
    };

    constructor(sphere: UnitSphere) {
        this.sphere = sphere;
        this.applyState('INIT', 0); // Apply initial state instantly
    }

    public transitionTo(state: SystemState) {
        if (state === this.currentState) return;

        const target = this.states[state];
        const duration = 1.5;

        // Transition numeric values
        gsap.to(this.sphere.material.uniforms.uSpeed, { value: target.speed, duration, ease: 'power2.inOut' });
        gsap.to(this.sphere.material.uniforms.uNoiseDensity, { value: target.density, duration, ease: 'power2.inOut' });
        gsap.to(this.sphere.material.uniforms.uNoiseStrength, { value: target.strength, duration, ease: 'power2.inOut' });

        // Transition color
        const currentColor = this.sphere.material.uniforms.uColor.value;
        gsap.to(currentColor, {
            r: target.color.r,
            g: target.color.g,
            b: target.color.b,
            duration,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.sphere.material.uniforms.uColor.value = currentColor;
            }
        });

        this.currentState = state;
    }

    private applyState(state: SystemState, duration: number) {
        const target = this.states[state];
        if (duration === 0) {
            this.sphere.setParams(target);
        } else {
            // Re-use transitionTo logic
            this.transitionTo(state);
        }
    }

    public getCurrentState() {
        return this.currentState;
    }
}
