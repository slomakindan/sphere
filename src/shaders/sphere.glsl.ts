export const vertexShader = `
    uniform float uTime;
    uniform bool uStaticMode;
    uniform float uSpeed;
    uniform float uNoiseDensity;
    uniform float uNoiseStrength;
    uniform float uNoiseScale;
    uniform float uOctaves;
    uniform float uRadialBias;
    uniform float uAudioInfluence;
    
    // v2.5 Galaxy Swirl Uniforms
    uniform bool uSwirlEnabled;
    uniform float uSwirlSpeed;
    uniform float uTwistAmount;
    uniform float uSwirlDetail;
    uniform float uClusterIntensity;
    uniform float uVoidRadius;
    uniform float uOrbitChaos;
    uniform vec3 uCameraPosition; // NEW
    uniform float uViewClear;     // NEW

    // v5.1 Global Control
    uniform float uGlobalSpeed;
    uniform bool uHideChaos;
    
    // v3.0 Shape Morphing
    uniform int uMorphTarget; // 0=sphere, 1=cube, 2=torus
    uniform float uMorphProgress;
    
    // v3.0 Attractors
    uniform vec3 uAttractorPos;
    uniform float uAttractorStrength;
    
    // v3.0 Glitch
    uniform bool uGlitchActive;
    uniform float uGlitchIntensity;
    uniform float uGlitchSeed;
    
    // v3.0 Visual DNA
    uniform sampler2D uImageTexture;
    uniform float uImageMorphFactor;
    uniform float uImageDisplacementFactor;
    uniform bool uImageEnabled;
    
    // v2.3 Color Spot Engine Uniforms
    uniform float uSpotScale;
    uniform float uSpotThreshold;
    
    uniform float uAudioLevel;
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    
    uniform vec2 uSizeRange;
    uniform vec2 uResolution;
    
    // v3.2 Loop Mode
    uniform bool uLoopActive;
    uniform float uLoopDuration;

    // v3.3 Chaos Mode
    uniform float uChaosAmplitude;
    uniform float uChaosSpeed;

    // v4.0 Flow Field (Curl Noise)
    uniform bool uFlowEnabled;
    uniform float uFlowStrength;
    uniform float uFlowSpeed;
    uniform float uFlowFrequency;
    uniform float uFlowOctaves;
    uniform float uFlowTurbulence;

    // v4.1 Sphere Scale
    uniform float uSphereScale;

    // v4.2 Vortex Streams (Atmospheric Bands)
    uniform bool uVortexEnabled;
    uniform float uVortexCount;      // Number of latitude bands
    uniform float uVortexStrength;   // Rotation strength
    uniform float uVortexSpeed;      // Animation speed
    uniform float uVortexTilt;       // Axis tilt (0 = horizontal bands, 1 = diagonal)

    // v4.3 Containment (Keep particles cohesive)
    uniform float uContainmentRadius;  // Max radius before particles are pulled back
    uniform float uContainmentStrength;  // How strong the pull is

    // v4.5 Flocking (Bird-like streaming)
    uniform float uFlockingStrength;    // How much particles cluster into streams
    uniform float uFlockingScale;       // Size of the flocking clusters
    uniform float uFlockingSpeed;       // Animation speed of streams

    // v5.2 Animation Modes (Audio-Reactive Presets)
    // 0 = None, 1 = Breathing, 2 = Pulse, 3 = Tension, 4 = Chaos, 5 = Flow, 6-10 = Advanced
    uniform int uAnimationMode;

    // v5.3 Size Lock - prevents sphere from changing size (for Telegram circles, etc.)
    uniform bool uLockSize;


    varying vec3 vNormal;
    varying float vNoise;
    varying float vAccent;
    varying float vColorMask;
    varying float vDistToCenter;
    varying float vDensity;
    varying float vStructureIntensity; // Added for Hide Chaos feature
    varying vec2 vUV;

    // Simplex Noise (Ashima Arts)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    float fbm(vec3 p, float octaves, float scale) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = scale;
        for (int i = 0; i < 8; i++) {
            if (float(i) >= octaves) break;
            value += amplitude * snoise(p * frequency);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    // v4.0 Curl Noise for Flow Fields
    // Computes the curl (rotation) of a 3D noise field
    // Creates divergence-free, smooth, non-intersecting flow
    vec3 curlNoise(vec3 p) {
        float eps = 0.01;
        
        // Compute partial derivatives using central differences
        float n1, n2;
        vec3 curl;
        
        // dFz/dy - dFy/dz
        n1 = snoise(p + vec3(0.0, eps, 0.0));
        n2 = snoise(p - vec3(0.0, eps, 0.0));
        float dz_dy = (n1 - n2) / (2.0 * eps);
        
        n1 = snoise(p + vec3(0.0, 0.0, eps));
        n2 = snoise(p - vec3(0.0, 0.0, eps));
        float dy_dz = (n1 - n2) / (2.0 * eps);
        curl.x = dz_dy - dy_dz;
        
        // dFx/dz - dFz/dx
        n1 = snoise(p + vec3(eps, 0.0, 0.0));
        n2 = snoise(p - vec3(eps, 0.0, 0.0));
        float dz_dx = (n1 - n2) / (2.0 * eps);
        curl.y = dy_dz - dz_dx;
        
        // dFy/dx - dFx/dy
        curl.z = dz_dx - dz_dy;
        
        return curl;
    }
    
    // Multi-octave Curl Noise (Fractal Flow)
    vec3 curlFBM(vec3 p, float octaves, float freq) {
        vec3 sum = vec3(0.0);
        float amp = 1.0;
        float f = freq;
        for (int i = 0; i < 6; i++) {
            if (float(i) >= octaves) break;
            sum += amp * curlNoise(p * f);
            f *= 2.0;
            amp *= 0.5;
        }
        return sum;
    }

    // Swirl Rotation Helper
    vec3 rotateY(vec3 p, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    }
    vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
        return mix(dot(axis, p) * axis, p, cos(angle)) + cross(axis, p) * sin(angle);
    }

    // v3.0 Shape Morphing Helpers
    vec3 sphereToCube(vec3 p) {
        float len = max(abs(p.x), max(abs(p.y), abs(p.z)));
        return p / len * 1.5;
    }
    vec3 sphereToTorus(vec3 p, float R, float r) {
        float theta = atan(p.y, p.x);
        float phi = atan(p.z, length(p.xy) - R);
        return vec3((R + r * cos(phi)) * cos(theta), (R + r * cos(phi)) * sin(theta), r * sin(phi));
    }
    vec3 sphereToImageGrid(vec3 p) {
        // Map sphere to flat grid for image morph
        float u = 0.5 + atan(p.z, p.x) / (2.0 * 3.14159);
        float v = 0.5 - asin(p.y / length(p)) / 3.14159;
        return vec3((u - 0.5) * 3.0, (v - 0.5) * 3.0, 0.0);
    }
    // Implement actual twist logic
    vec3 sphereToTwist(vec3 p) {
        float angle = p.y * 3.0;
        float s = sin(angle);
        float c = cos(angle);
        return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
    }
    // Implement actual helix logic
    vec3 sphereToHelix(vec3 p) {
         float t = p.y * 5.0;
         return vec3(sin(t) + p.x * 0.2, p.y, cos(t) + p.z * 0.2);
    }

    void main() {
        vNormal = normal;
        vec3 pos = position;
        vStructureIntensity = 0.0; // Reset
        
        // v5.1: Apply Global Speed
        float effectiveTime = uTime * uGlobalSpeed;
        
        // ... (Morphing logic is fine) ...
        // ...

            // For Swirl mode, structure is defined by the density (arms)
            if (uSwirlEnabled) {
               // Approximate structure from position for Swirl
               // This is a bit rough since actual density is calculated via Noise later,
               // but we can assume Swirl is "STRUCTURED" enough to show mostly everything
               // or we can try to recalculate a simple mask.
               vStructureIntensity = max(vStructureIntensity, 0.5); 
            }
        
        // ... 

        // v4.2 Vortex Streams
        if (uVortexEnabled) {
            float vortexTime = effectiveTime * uVortexSpeed;
            for (int i = 0; i < 5; i++) {
                 if (float(i) >= uVortexCount) break;
                 // ... (simple vortex logic) ...
                 // We need to capture the fact that this particle is being moved by a vortex
                 // The actual vortex logic was inline. Let's look at where it was.
            }
        }
        
        // Let's look at the actual Vortex block down below and add vStructureIntensity there.
        // I will just add the functions here and leave the main block search for the next step.


        // v3.0 Shape Morphing
        if (uMorphProgress > 0.0) {
            vec3 targetPos = pos;
            
            if (uMorphTarget == 1) {
                targetPos = sphereToCube(pos);
            } else if (uMorphTarget == 2) {
                targetPos = sphereToTorus(pos, 1.0, 0.4);
            } else if (uMorphTarget == 3) {
                targetPos = sphereToTwist(pos);
            } else if (uMorphTarget == 4) {
                targetPos = sphereToImageGrid(pos);
            } else if (uMorphTarget == 5) {
                targetPos = sphereToHelix(pos);
            }
            
            pos = mix(pos, targetPos, uMorphProgress);
        }

        // v3.0 Visual DNA Image Morph
        if (uImageEnabled && uImageMorphFactor > 0.0) {
            vec3 imagePos = sphereToImageGrid(normalize(position));
            pos = mix(pos, imagePos, uImageMorphFactor);
        }

        // v3.0 Attractors
        if (uAttractorStrength > 0.0) {
            vec3 toAttractor = uAttractorPos - pos;
            float dist = length(toAttractor);
            pos += normalize(toAttractor) * uAttractorStrength / (dist + 0.5);
        }

        // v3.0 Glitch
        if (uGlitchActive) {
            float glitchNoise = snoise(pos * 10.0 + vec3(uGlitchSeed));
            pos += normal * glitchNoise * uGlitchIntensity * 0.5;
        }

        float noise = 0.0;
        float density = 0.0;

        // v4.0 Flow Field (Curl Noise) - Applied before other modes
        if (uFlowEnabled) {
            // Calculate time for flow (circular if looping)
            float flowTime;
            if (uLoopActive) {
                float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
                float loopRadius = uLoopDuration * uFlowSpeed * 0.5;
                flowTime = cos(angle) * loopRadius; // Circular motion for seamless loop
            } else {
                flowTime = effectiveTime * uFlowSpeed;
            }
            
            // Get flow velocity from curl noise
            vec3 flowPos = pos * uFlowFrequency + vec3(flowTime);
            vec3 flowVelocity = curlFBM(flowPos, uFlowOctaves, 1.0);
            
            // Add turbulence layer (higher frequency noise)
            if (uFlowTurbulence > 0.0) {
                vec3 turbulence = curlNoise(flowPos * 4.0 + vec3(flowTime * 2.0));
                flowVelocity += turbulence * uFlowTurbulence;
            }
            
            // Displace particle along flow
            pos += flowVelocity * uFlowStrength;
            
            // Compute density for glow (particles in convergent flows are brighter)
            density = length(flowVelocity) * 0.5;
        }

        // v4.2 Vortex Streams (Atmospheric Bands)
        if (uVortexEnabled) {
            // Calculate latitude-like position (apply tilt)
            vec3 tiltedPos = pos;
            if (uVortexTilt > 0.0) {
                // Rotate around X axis for tilt effect
                float tiltAngle = uVortexTilt * 0.5;
                float cosT = cos(tiltAngle);
                float sinT = sin(tiltAngle);
                tiltedPos.y = pos.y * cosT - pos.z * sinT;
                tiltedPos.z = pos.y * sinT + pos.z * cosT;
            }
            
            // Get latitude (-1 to 1)
            float latitude = tiltedPos.y / max(length(pos), 0.001);
            
            // Create bands based on latitude
            float bandPhase = latitude * uVortexCount * 3.14159;
            float bandStrength = sin(bandPhase);
            
            // Calculate rotation angle based on band
            float vortexTime;
            if (uLoopActive) {
                // For seamless looping: multiply by speed INSIDE the mod
                // uVortexSpeed determines how many complete rotations per loop
                float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853 * uVortexSpeed;
                vortexTime = angle;
            } else {
                vortexTime = effectiveTime * uVortexSpeed;
            }
            
            // Alternating direction for adjacent bands
            // bandStrength already oscillates -1 to 1, so rotation is symmetric
            float rotationAngle = bandStrength * uVortexStrength * vortexTime;
            
            // Apply rotation around Y axis (longitude rotation)
            float cosR = cos(rotationAngle);
            float sinR = sin(rotationAngle);
            vec3 rotatedPos = vec3(
                pos.x * cosR - pos.z * sinR,
                pos.y,
                pos.x * sinR + pos.z * cosR
            );
            pos = rotatedPos;
            
            // Capture vortex structure intensity (peaks at band centers)
            // Use smoothstep to define the "width" of the visible band when hiding chaos
            float bandMask = smoothstep(0.2, 0.8, abs(bandStrength));
            vStructureIntensity = max(vStructureIntensity, bandMask);
        }

        if (uSwirlEnabled) {
            // 1. Initial Volumetric Scattering (Solid Ball distribution)
            // Use static noise to place particles anywhere from center to edge
            float staticNoise = snoise(pos * 42.0); // Different seed
            // Distribute particles from r=0.0 to r=3.0
            // abs(staticNoise) gives 0.0 to 1.0 distribution
            pos = normalize(pos) * (0.1 + abs(staticNoise) * 3.0); 

            // 2. Chaotic Rotation
            float dist = length(pos);
            if (uOrbitChaos > 0.0) {
                 float chaosAngle = effectiveTime * uOrbitChaos * 0.5 + dist * uTwistAmount;
                 vec3 randomAxis = normalize(vec3(
                     snoise(pos + vec3(0.0)),
                     snoise(pos + vec3(100.0)),
                     snoise(pos + vec3(200.0))
                 ));
                 pos = rotateAxis(pos, randomAxis, chaosAngle);
            } else {
                 float angle = effectiveTime * uSwirlSpeed + dist * uTwistAmount;
                 pos = rotateY(pos, angle);
            }

            // 3. Black Hole Effect: Spherical Shift (Event Horizon)
            // Instead of clamping (which creating a hard shell), we SHIFT everything outward.
            // This preserves the cloud structure but pushes it away from the singularity.
            // 3. Black Hole Effect: Spherical Shift (Event Horizon)
            if (uVoidRadius > 0.0) {
                float r = length(pos);
                pos = normalize(pos) * (uVoidRadius + r);
            }
            

            density = fbm(pos + vec3(effectiveTime * 0.2), uSwirlDetail, 2.0);
            vDensity = max(0.0, density) * uClusterIntensity;
            noise = fbm(pos * uNoiseDensity + vec3(effectiveTime * uSpeed), uOctaves, uNoiseScale);
        } else {
            // v3.2 Seamless Loop Mode & Chaos
            float baseTime;
            vec3 noiseOffset;
            vec3 noisePos;
            
            if (uLoopActive) {
                float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
                float radius = uLoopDuration * uSpeed * 0.5; 
                
                // When staticMode (Фикс.Центр) is on, use XZ plane only
                if (uStaticMode) {
                    noiseOffset = vec3(cos(angle), 0.0, sin(angle)) * radius; 
                } else {
                    noiseOffset = vec3(cos(angle), sin(angle), cos(angle) * 0.5 + sin(angle) * 0.5) * radius;
                }
                baseTime = angle; // Use angle as time base for chaos to ensure seamless loop
            } else {
                float dynamicTime = effectiveTime * (uSpeed + uBass * 0.4 * uAudioInfluence) + 0.123;
                noiseOffset = vec3(dynamicTime);
                baseTime = dynamicTime;
            }
            
            noisePos = normal * uNoiseDensity + noiseOffset;
            
            // Chaos Injection (Now works in Loop Mode too!)
            if (uChaosAmplitude > 0.0) {
                // Use baseTime which is either circular (Loop) or linear (Standard)
                // For Loop Mode, multiply by speed/integer to keep it seamless over 2PI
                float chaosT = baseTime * uChaosSpeed; 
                
                // Warp time non-linearly
                float timeWarp = sin(chaosT * 2.0) * uChaosAmplitude * 0.5;
                
                // Warp spatial coordinates (Domain Warping)
                vec3 warp = vec3(
                    sin(normal.z * 4.0 + chaosT),
                    cos(normal.x * 4.0 + chaosT),
                    sin(normal.y * 4.0 + chaosT)
                ) * uChaosAmplitude * 0.2;
                
                noisePos += warp;
                
                // In non-loop mode we add time to Z. In loop mode, noiseOffset handles movement.
                // But we can add the timeWarp to affect the texture evolution
                if (!uLoopActive) noisePos.z += timeWarp;
            }
            
            if (!uLoopActive) noisePos.z += baseTime; // Add base linear movement for standard mode

            noise = fbm(noisePos, uOctaves, uNoiseScale);
            vDensity = 0.0;
        }
        
        vNoise = noise;

        vNoise = noise;
        
        // v4.3 Containment - apply to pos BEFORE finalPosition to catch all effects
        if (uContainmentStrength > 0.0) {
            float dist = length(pos);
            if (dist > uContainmentRadius) {
                // Smoothly pull particles back toward the containment radius
                float excess = dist - uContainmentRadius;
                float pullStrength = smoothstep(0.0, 1.0, excess * 0.5) * uContainmentStrength;
                pos = normalize(pos) * mix(dist, uContainmentRadius, pullStrength);
            }
        }
        
        // v4.5 Flocking - cluster particles into chaotic flowing streams
        if (uFlockingStrength > 0.0) {
            // Create a seamless circular time for loop mode
            float flockAngle;
            if (uLoopActive) {
                // Seamless loop: time goes around a circle
                flockAngle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
            } else {
                flockAngle = effectiveTime * 0.5;
            }
            
            // Create circular offsets for GUARANTEED seamless looping
            // Speed controls RADIUS (how far we travel), NOT the angle
            // This ensures cos/sin always complete exactly one full circle (0 to 2π)
            float radius = uFlockingSpeed * 2.0; // Speed = how far we move through noise field
            float circleX = cos(flockAngle) * radius;
            float circleY = sin(flockAngle) * radius;
            float circleZ = cos(flockAngle + 2.094) * radius; // 120° offset for 3D motion
            
            // Sample position in noise field - offset by circular motion for seamless loop
            vec3 noisePos = pos * uFlockingScale + vec3(circleX, circleY, circleZ);
            
            // Get 3D flow direction from noise (chaotic, not just swaying)
            // Each axis gets independent noise for truly chaotic motion
            float n1 = snoise(noisePos);
            float n2 = snoise(noisePos + vec3(17.3, 31.7, 47.1)); // Different seed
            float n3 = snoise(noisePos + vec3(73.1, 13.7, 97.3)); // Different seed
            
            // Create flow velocity vector from noise
            vec3 flowVelocity = vec3(n1, n2, n3);
            
            // Add turbulence layers for more chaotic motion (also circular for seamless)
            float turbRadius = uFlockingSpeed * 3.0;
            vec3 turbOffset = vec3(
                cos(flockAngle * 2.0) * turbRadius, // 2x frequency = 2 loops per cycle
                sin(flockAngle * 2.0) * turbRadius,
                cos(flockAngle * 2.0 + 1.047) * turbRadius
            );
            vec3 turbPos = pos * uFlockingScale * 2.0 + turbOffset;
            flowVelocity += vec3(
                snoise(turbPos * 1.5),
                snoise(turbPos * 1.5 + vec3(11.1, 22.2, 33.3)),
                snoise(turbPos * 1.5 + vec3(44.4, 55.5, 66.6))
            ) * uFlockingSpeed * 0.5;
            
            // Normalize and apply tangential displacement (keeps particles near surface)
            vec3 tangentFlow = flowVelocity - normal * dot(flowVelocity, normal);
            
            // Stream intensity based on position in noise field
            float streamIntensity = (n1 + 1.0) * 0.5;
            
            // Track structure intensity for Hide Chaos feature
            vStructureIntensity = max(vStructureIntensity, streamIntensity);
            
            // Apply flow with strength
            pos += normalize(tangentFlow + vec3(0.001)) * streamIntensity * uFlockingStrength * 0.4;
        }
        
        // v3.4 Seamless Color Spots
        vec3 spotPos;
        if (uLoopActive) {
            float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
            // Use different radius/offset for spots to avoid looking exactly like the shape noise
            float radius = uLoopDuration * 0.1; 
            vec3 loopOffset = vec3(cos(angle), sin(angle), 0.0) * radius;
            spotPos = normal * uSpotScale + loopOffset;
        } else {
            spotPos = normal * uSpotScale + vec3(effectiveTime * 0.1);
        }

        float mask = snoise(spotPos);
        vColorMask = smoothstep(uSpotThreshold, uSpotThreshold + 0.3, (mask + 1.0) * 0.5);
        vAccent = smoothstep(0.2, 0.8, noise) * (0.5 + uTreble * 1.5);

        // Calculate UV for Visual DNA
        vUV = vec2(0.5 + atan(normal.z, normal.x) / (2.0 * 3.14159), 0.5 - asin(normal.y) / 3.14159);

        // v5.2 Animation Modes - Audio-Reactive Presets
        float modeExpansion = 1.0;
        float modeDisplacement = 0.0;
        vec3 modeOffset = vec3(0.0);
        
        // Create seamless time for animation modes (0 to 2PI in loop, linear otherwise)
        float loopAngle;
        if (uLoopActive) {
            loopAngle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
        } else {
            loopAngle = effectiveTime;
        }
        
        if (uAnimationMode == 1) {
            // BREATHING: Slow, deep pulsing synced to bass
            // Great for ambient, atmospheric tracks
            float breathPhase = sin(loopAngle) * 0.5 + 0.5;
            modeExpansion = 1.0 + uBass * breathPhase * 0.3;
            modeDisplacement = uBass * breathPhase * 0.1;
        }
        else if (uAnimationMode == 2) {
            // PULSE: Sharp, rhythmic reactions to beats
            // Great for electronic, percussive music
            float pulse = pow(uBass, 2.0); // Square for sharper response
            modeExpansion = 1.0 + pulse * 0.5;
            modeDisplacement = pulse * 0.2;
            // Add rhythmic "jumps" on strong beats
            modeOffset = normal * pulse * 0.1;
        }
        else if (uAnimationMode == 3) {
            // TENSION: Building, oppressive energy (great for dark soundtracks)
            // Low rumble expands, high frequencies create "nervousness"
            float tension = uBass * 0.7 + uMid * 0.5;
            float nervousness = uTreble * sin(loopAngle * 2.0 + length(pos) * 3.0);
            modeExpansion = 1.0 + tension * 0.4;
            modeDisplacement = tension * 0.15 + abs(nervousness) * 0.05;
            // Slow, menacing rotation based on bass
            float rotAngle = uBass * 0.3;
            modeOffset = vec3(
                pos.x * cos(rotAngle) - pos.z * sin(rotAngle) - pos.x,
                0.0,
                pos.x * sin(rotAngle) + pos.z * cos(rotAngle) - pos.z
            );
        }
        else if (uAnimationMode == 4) {
            // CHAOS: Wild, unpredictable reactions to all frequencies
            // Great for intense, aggressive music
            float chaos = uBass + uMid + uTreble;
            // Use circular offset for seamless looping
            vec3 chaosOffset = vec3(cos(loopAngle), sin(loopAngle), cos(loopAngle * 0.7)) * 2.0;
            float randomPhase = snoise(pos * 5.0 + chaosOffset);
            modeExpansion = 1.0 + chaos * 0.3 * (0.5 + randomPhase * 0.5);
            modeDisplacement = chaos * 0.2 * abs(randomPhase);
            // Chaotic directional displacement (seamless)
            modeOffset = vec3(
                snoise(pos + chaosOffset),
                snoise(pos + chaosOffset + vec3(10.0)),
                snoise(pos + chaosOffset + vec3(20.0))
            ) * chaos * 0.15;
        }
        else if (uAnimationMode == 5) {
            // FLOW: Smooth, liquid-like movement with audio
            // Great for melodic, flowing music
            float flow = uMid * 0.6 + uTreble * 0.3;
            vec3 flowDir = vec3(
                sin(pos.y * 3.0 + loopAngle),
                cos(pos.z * 3.0 + loopAngle * 0.7),
                sin(pos.x * 3.0 + loopAngle * 1.3)
            );
            modeExpansion = 1.0 + flow * 0.2;
            modeOffset = flowDir * flow * 0.1;
        }
        else if (uAnimationMode == 6) {
            // TOPOGRAPHIC DISPLACEMENT: Breathing landscape with explosion waves
            // Bass → wave amplitude, Treble → surface detail/grain
            float waveAmplitude = uBass * 0.5;
            float detailNoise = snoise(pos * 5.0 + vec3(cos(loopAngle), sin(loopAngle), 0.0) * uTreble * 2.0) * uTreble * 0.1;
            
            // Create concentric waves expanding from center (seamless)
            float distFromCenter = length(pos);
            float wave = sin(distFromCenter * 8.0 - loopAngle * 2.0 - uBass * 5.0) * waveAmplitude;
            
            // Explosion wave effect on bass peaks (seamless)
            float explosionWave = smoothstep(0.5, 1.0, uBass) * sin(distFromCenter * 4.0 - loopAngle * 3.0);
            
            modeExpansion = 1.0 + wave * 0.3 + explosionWave * 0.2;
            modeDisplacement = detailNoise + wave * 0.1;
            modeOffset = normal * explosionWave * 0.15;
        }
        else if (uAnimationMode == 7) {
            // KINETIC ENTROPY: Brownian chaos → ordered waves on beats
            // Silence → chaotic surface noise, Beat → organized patterns
            float beatStrength = smoothstep(0.3, 0.7, uBass); // Detect strong beats
            
            // Brownian motion (chaotic surface displacement along normal - seamless)
            vec3 brownOffset = vec3(cos(loopAngle), sin(loopAngle), cos(loopAngle * 0.7)) * 0.8;
            float brownianNoise = snoise(pos * 4.0 + brownOffset);
            vec3 brownian = normal * brownianNoise * 0.15 * (1.0 - beatStrength);
            
            // Organized wave pattern on beats (ring-like structures - seamless)
            float dist = length(pos);
            float ringPattern = sin(dist * 8.0 - loopAngle * 2.0) * 0.5 + 0.5;
            vec3 organized = normal * ringPattern * 0.1 * beatStrength;
            
            // Combine: chaos when quiet, order on beats
            modeOffset = brownian + organized;
            
            // Subtle rotation on beats (keeps sphere cohesive - seamless)
            float rotAngle = beatStrength * loopAngle * 0.3;
            modeOffset.x += pos.z * sin(rotAngle) * 0.02 * beatStrength;
            modeOffset.z -= pos.x * sin(rotAngle) * 0.02 * beatStrength;
            
            modeExpansion = 1.0; // No expansion - keep size stable
        }
        else if (uAnimationMode == 8) {
            // NEURAL IMPULSE: Web-like connections that pulse with mids
            // Creates neural network / electrical discharge effect
            float connectionDensity = uMid * 2.0 + uTreble;
            
            // Create pulsing lines emanating from random points (seamless)
            float linePattern = sin(pos.x * 10.0 + loopAngle) * sin(pos.y * 10.0 + loopAngle * 0.7);
            linePattern += sin(pos.y * 8.0 + loopAngle * 1.3) * sin(pos.z * 8.0 + loopAngle);
            linePattern += sin(pos.z * 12.0 + loopAngle * 0.5) * sin(pos.x * 12.0 + loopAngle * 1.1);
            
            // Neural pulse effect - particles cluster along "connection lines"
            float pulseIntensity = abs(linePattern) * connectionDensity;
            
            // Particles move toward line intersections when mids are strong (seamless)
            vec3 lineGradient = vec3(
                cos(pos.x * 10.0 + loopAngle) * sin(pos.y * 10.0 + loopAngle * 0.7),
                cos(pos.y * 8.0 + loopAngle * 1.3) * sin(pos.z * 8.0 + loopAngle),
                cos(pos.z * 12.0 + loopAngle * 0.5) * sin(pos.x * 12.0 + loopAngle * 1.1)
            );
            
            modeOffset = lineGradient * pulseIntensity * 0.05;
            modeDisplacement = pulseIntensity * 0.1;
            modeExpansion = 1.0 + uMid * 0.15;
        }
        else if (uAnimationMode == 9) {
            // SINGULARITY CORE: Center attracts, transients cause explosion
            // Creates black hole / supernova effect
            float distFromCore = length(pos);
            
            // Attraction toward center (always active, scaled by bass)
            float attraction = uBass * 0.3;
            vec3 towardCenter = -normalize(pos) * attraction / (distFromCore + 0.5);
            
            // Transient detection (sharp bass attacks cause explosion)
            float transient = pow(uBass, 3.0); // Cubic for detecting peaks
            
            // Explosion: repel particles outward on transients
            vec3 explosion = normalize(pos) * transient * 0.4;
            
            // Combine: normally attract, but explode on transients
            modeOffset = mix(towardCenter, explosion, smoothstep(0.3, 0.7, transient));
            
            // Core "breathing" (seamless)
            modeExpansion = 1.0 + sin(loopAngle * 2.0) * uBass * 0.1;
            modeDisplacement = transient * 0.15;
        }
        else if (uAnimationMode == 10) {
            // SHELL VIBRATION: Waves on sphere surface (Chladni patterns)
            // Amplitude = loudness, creates interference patterns
            float totalAudio = uBass + uMid + uTreble;
            
            // Spherical harmonics-like patterns
            float theta = atan(pos.z, pos.x);
            float phi = asin(pos.y / length(pos));
            
            // Multiple wave frequencies create interference (seamless)
            float wave1 = sin(theta * 3.0 + loopAngle * 2.0) * sin(phi * 2.0);
            float wave2 = sin(theta * 5.0 - loopAngle * 1.5) * sin(phi * 4.0 + loopAngle);
            float wave3 = sin(theta * 7.0 + loopAngle * 0.7) * sin(phi * 3.0 - loopAngle * 0.5);
            
            // Bass drives low-frequency waves, treble drives high-frequency
            float chladniPattern = wave1 * uBass + wave2 * uMid + wave3 * uTreble;
            
            // Displacement along normal (surface vibration)
            modeOffset = normal * chladniPattern * 0.15;
            modeDisplacement = abs(chladniPattern) * 0.1;
            modeExpansion = 1.0 + totalAudio * 0.1;
        }
        
        // Apply animation mode effects
        pos += modeOffset;

        // Calculate expansion and displacement
        float expansion = modeExpansion + uBass * uRadialBias * uAudioInfluence;
        float displacement = noise * (uNoiseStrength + uMid * 0.5 * uAudioInfluence) + modeDisplacement;
        
        // v5.3 Size Lock - prevent sphere from changing size
        if (uLockSize) {
            expansion = 1.0; // No expansion/contraction
            displacement = 0.0; // No radial displacement (keeps size)
            // But keep modeOffset for internal motion only if it's tangential
        }

        // v3.0 Visual DNA Displacement
        if (uImageEnabled && uImageDisplacementFactor > 0.0) {
            float u = 0.5 + atan(normal.z, normal.x) / (2.0 * 3.14159);
            float v = 0.5 - asin(normal.y) / 3.14159;
            vec4 texColor = texture2D(uImageTexture, vec2(u, v));
            float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
            displacement += luminance * uImageDisplacementFactor;
        }
        
        vec3 finalPosition = pos * expansion + normal * displacement;
        
        // v4.1 Sphere Scale - scale particles towards/away from center
        finalPosition *= uSphereScale;
        
        // v4.3 Containment - keep particles within radius
        if (uContainmentStrength > 0.0) {
            float dist = length(finalPosition);
            if (dist > uContainmentRadius) {
                // Smoothly pull particles back toward the containment radius
                float excess = dist - uContainmentRadius;
                float pullStrength = smoothstep(0.0, 1.0, excess / uContainmentRadius) * uContainmentStrength;
                finalPosition = normalize(finalPosition) * mix(dist, uContainmentRadius, pullStrength);
            }
        }
        
        vDistToCenter = length(finalPosition);


        // Calculate View Position using standard modelViewMatrix
        vec4 viewPosition = modelViewMatrix * vec4(finalPosition, 1.0);

        // v3.5 View Clearing (Applies to all modes)
        if (uViewClear > 0.0) {
             // Calculate Center in View Space
             vec4 centerViewPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
             float viewDist = length(viewPosition.xy - centerViewPos.xy);
             
             // Check if inside clear zone AND in front of the sphere center
             if (viewDist < uViewClear && viewPosition.z > centerViewPos.z) {
                 vec2 diff = viewPosition.xy - centerViewPos.xy;
                 float diffLen = length(diff);
                 
                 vec2 pushDir = vec2(1.0, 0.0); // Default safe dir
                 if (diffLen > 0.0001) {
                     pushDir = diff / diffLen;
                 }
                 
                 // Push to edge
                 viewPosition.xy = centerViewPos.xy + pushDir * uViewClear;
             }
        }

        vec4 projectionPosition = projectionMatrix * viewPosition;

        gl_Position = projectionPosition;
        
        float baseSize = mix(uSizeRange.x, uSizeRange.y, (noise + 1.0) * 0.5);
        float clusterSize = vDensity * 2.0;
        float resolutionScale = uResolution.y / 1080.0;
        gl_PointSize = (baseSize + clusterSize + (uTreble * 5.0 * uAudioInfluence)) * resolutionScale * (1.0 / -viewPosition.z); 
    }

`;

export const fragmentShader = `
    uniform vec3 uBaseColor;
    uniform vec3 uAccentColor;
    uniform float uOpacity;
    uniform float uTime;
    uniform bool uStaticMode;

    
    // v3.0 Visual DNA
    uniform sampler2D uImageTexture;
    uniform float uImageColorMix;
    uniform bool uImageEnabled;
    
    varying float vNoise;
    varying float vAccent;
    varying float vColorMask;
    varying float vDistToCenter;
    varying float vDensity;
    varying vec2 vUV;

    // v3.3 Chaos Mode
    uniform float uChaosAmplitude;
    uniform float uChaosSpeed;

    // v5.1 Global Control
    uniform float uGlobalSpeed;
    uniform bool uHideChaos;

    varying float vStructureIntensity; // How much this particle is part of a structure

    // Audio Reactivity
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    
    // v5.0 Audio-Reactive Colors
    uniform vec3 uBassColor;      // Color triggered by bass frequencies
    uniform vec3 uMidColor;       // Color triggered by mid frequencies (voice)
    uniform vec3 uTrebleColor;    // Color triggered by treble frequencies
    uniform float uAudioColorMix; // How much audio affects color (0-1)
    uniform bool uAudioColorsEnabled; // Master toggle for audio colors

    // Hue Shift Helper
    vec3 shiftHue(vec3 color, float shift) {
        vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(shift);
        return vec3(color * cosAngle + cross(k, color) * sin(shift) + k * dot(k, color) * (1.0 - cosAngle));
    }

    void main() {
        // v5.1 Hide Chaos (Show only structured particles)
        if (uHideChaos) {
            // If particle is not sufficiently part of a structure (Vortex, Flock, Flow), hide it
            if (vStructureIntensity < 0.3) discard;
            
            // Soft fade for remaining particles
            float structFade = smoothstep(0.3, 0.6, vStructureIntensity);
            if (structFade < 0.01) discard;
        }

        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float particleFade = smoothstep(0.5, 0.1, dist) * 0.6;
        
        // Apply structure fade if hiding chaos
        if (uHideChaos) {
            particleFade *= smoothstep(0.3, 0.8, vStructureIntensity);
        }
        
        // Base color mix with spots
        vec3 color = mix(uBaseColor, uAccentColor, vColorMask);
        
        // v3.0 Visual DNA Color Mapping
        if (uImageEnabled && uImageColorMix > 0.0) {
            vec4 texColor = texture2D(uImageTexture, vUV);
            color = mix(color, texColor.rgb, uImageColorMix);
        }
        
        // v5.0 Audio-Reactive Color Mix
        if (uAudioColorsEnabled && uAudioColorMix > 0.0) {
            // New logic: Weighted blending without aggressive normalization to keep colors vibrant
            vec3 targetAudioColor = vec3(0.0);
            float weight = 0.0;
            
            // Bass (Deep/Logic) - stronger weight
            if (uBass > 0.01) {
                targetAudioColor += uBassColor * uBass * 3.0; // Boosted intensity
                weight += uBass;
            }
            
            // Mid (Voice) - add to mix
            if (uMid > 0.01) {
                targetAudioColor += uMidColor * uMid * 3.0;
                weight += uMid;
            }
            
            // Treble (Shimmer) 
            if (uTreble > 0.01) {
                targetAudioColor += uTrebleColor * uTreble * 3.0;
                weight += uTreble;
            }
            
            // Apply if there is sound
            if (weight > 0.01) {
                // Mix based on how loud the sound is (dynamic strength)
                float mixFactor = uAudioColorMix * clamp(weight * 0.5, 0.0, 1.0);
                
                // Use MAX blending to prevent washing out (keep dominant colors)
                // mix() can sometimes dull colors. Let's try direct influence.
                color = mix(color, targetAudioColor, mixFactor);
            }
            
            // Separated Voice Glow (Mid frequencies)
            // Adds a halo effect specifically for vocals
            float voiceGlow = smoothstep(0.1, 0.6, uMid) * vDensity * 3.0;
            color += uMidColor * voiceGlow * uAudioColorMix;
        }
        
        // Add brightness at noise peaks
        color += vNoise * 0.1;

        // Galaxy Swirl HDR Glow (density-based)
        color += vDensity * uAccentColor * 0.5;
        
        // Final brightness boost - apply to OPACITY/GLOW, not white color addiction
        // This prevents the sphere from turning white
        float audioGlow = (uBass + uMid + uTreble) * 0.3 * uAudioColorMix;
        
        // Instead of adding white, we boost the COLOR intensity
        color = color * (1.0 + audioGlow * 0.5);
        
        gl_FragColor = vec4(color, uOpacity * particleFade * (1.0 + audioGlow * 0.2));
    }
`;



