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


    varying vec3 vNormal;
    varying float vNoise;
    varying float vAccent;
    varying float vColorMask;
    varying float vDistToCenter;
    varying float vDensity; // For Cluster Glow
    varying vec2 vUV; // For Visual DNA

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

    void main() {
        vNormal = normal;
        vec3 pos = position;
        
        // effectiveTime - always use real time (staticMode only locks JS group position, not shader animations)
        float effectiveTime = uTime;

        // v3.0 Shape Morphing
        if (uMorphProgress > 0.0) {
            vec3 targetPos = pos;
            if (uMorphTarget == 1) targetPos = sphereToCube(normalize(pos) * 1.5);
            else if (uMorphTarget == 2) targetPos = sphereToTorus(normalize(pos), 1.0, 0.4);
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
                float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
                vortexTime = angle;
            } else {
                vortexTime = effectiveTime * uVortexSpeed;
            }
            
            // Alternating direction for adjacent bands
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
            float dynamicTime = effectiveTime * (uSpeed + uBass * 0.4 * uAudioInfluence) + 0.123;
            vec3 noisePos = normal * uNoiseDensity + vec3(dynamicTime);

            // v3.2 Seamless Loop Mode
            if (uLoopActive) {
                float angle = (mod(effectiveTime, uLoopDuration) / uLoopDuration) * 6.2831853;
                float radius = uLoopDuration * uSpeed * 0.5; 
                
                // When staticMode (Фикс.Центр) is on, use XZ plane only to prevent Y-drift
                vec3 loopOffset;
                if (uStaticMode) {
                    loopOffset = vec3(cos(angle), 0.0, sin(angle)) * radius; // XZ plane only
                } else {
                    loopOffset = vec3(cos(angle), sin(angle), cos(angle) * 0.5 + sin(angle) * 0.5) * radius;
                }
                noisePos = normal * uNoiseDensity + loopOffset;
            } else {
                // Standard Mode with Chaos
                float chaosTime = dynamicTime;
                
                // Chaos Injection
                if (uChaosAmplitude > 0.0) {
                    // Warp time non-linearly
                    chaosTime += sin(dynamicTime * uChaosSpeed * 2.0) * uChaosAmplitude * 0.5;
                    
                    // Warp spatial coordinates (Domain Warping)
                    vec3 warp = vec3(
                        sin(normal.z * 4.0 + dynamicTime * uChaosSpeed),
                        cos(normal.x * 4.0 + dynamicTime * uChaosSpeed),
                        sin(normal.y * 4.0 + dynamicTime * uChaosSpeed)
                    ) * uChaosAmplitude * 0.2;
                    
                    noisePos += warp;
                }
                
                noisePos.z += chaosTime; 
            }

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

        float expansion = 1.0 + uBass * uRadialBias * uAudioInfluence;
        float displacement = noise * (uNoiseStrength + uMid * 0.5 * uAudioInfluence);

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

    // Audio Reactivity
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;

    // Hue Shift Helper
    vec3 shiftHue(vec3 color, float shift) {
        vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(shift);
        return vec3(color * cosAngle + cross(k, color) * sin(shift) + k * dot(k, color) * (1.0 - cosAngle));
    }

    void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float particleFade = smoothstep(0.5, 0.1, dist) * 0.6;
        
        // Audio Reactive Accent
        vec3 activeAccent = uAccentColor;
        
        // 1. Bass boosts intensity
        activeAccent += uBass * 0.5;
        
        // 2. Treble shifts hue (Shimmer)
        if (uTreble > 0.01) {
            activeAccent = shiftHue(activeAccent, uTreble * 1.5);
        }

        // Color Spot Engine Mixing
        vec3 color = mix(uBaseColor, activeAccent, vColorMask);
        
        // v3.0 Visual DNA Color Mapping
        if (uImageEnabled && uImageColorMix > 0.0) {
            vec4 texColor = texture2D(uImageTexture, vUV);
            color = mix(color, texColor.rgb, uImageColorMix);
        }
        
        // Add brightness at noise peaks
        color += vNoise * 0.1;

        // v3.3 Chaos Color Injection - DISABLED by user request
        /*
        if (uChaosAmplitude > 0.0) {
            // Chaotic Hue Shift based on noise and time
             float chaosShift = sin(vNoise * 5.0 + uTime * uChaosSpeed) * uChaosAmplitude;
             color = shiftHue(color, chaosShift);
             
             // Chaotic Brightness
             color += vec3(sin(vNoise * 10.0 + uTime * uChaosSpeed * 2.0)) * uChaosAmplitude * 0.2;
        }
        */

        // Galaxy Swirl HDR Glow
        color += vDensity * uAccentColor;
        
        gl_FragColor = vec4(color, uOpacity * particleFade);
    }
`;



