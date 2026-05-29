// --- Core System Global State References ---
let scene, camera, renderer, gltfLoader, animationMixer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const clock = new THREE.Clock();

let horrorEntity = null;
let gameActive = false;
let isPaused = false;
let escapeDoor = null;

// --- Camera Zoom System ---
let cameraFov = 65;
const defaultFov = 65;
const zoomedFov = 35;
let isZooming = false;

// --- Monster Upgrade System ---
let monsterBaseSpeed = 2.8;
let monsterScaleMultiplier = 11;

// --- Audio Stream Context Architecture ---
let audioCtx = null;
let monsterTrackBuffer = null;
let monsterAudioSource = null;
let monsterGainNode = null;
let breathingInterval = null;

// --- Jumpscare Audio ---
let jumpscareBuffer = null;
let jumpscareSource = null;

// --- Document Objective Tracking Mechanics ---
let collectedFiles = 0;
const totalFilesRequired = 7;
let evidenceFileMeshes = [];

// --- Stamina Physical Properties & States ---
let stamina = 100;
const maxStamina = 100;
let isSprinting = false;
let isExhausted = false;

// --- Jump State Mechanics ---
let isJumping = false;
let verticalVelocity = 0;
const gravityConstant = 32.0;
let defaultPlayerHeight = 1.7;

// --- Raycast Vector Math Engine ---
const crosshairRaycaster = new THREE.Raycaster();
const screenCenterVector = new THREE.Vector2(0, 0);

// --- Collision Geometry Boundaries ---
let wallBoxes = [];
const playerRadius = 0.45;

// --- DOM References ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const initializeBtn = document.getElementById('initialize-btn');
const jumpscareOverlay = document.getElementById('jumpscare-overlay');
const filesCountText = document.getElementById('files-count');
const keyStatusText = document.getElementById('key-status');
const sprintBarFill = document.getElementById('sprint-bar-fill');
const pauseScreen = document.getElementById('pause-screen');

let mouseSensitivity = 0.0022;

// --- Start Game ---
initializeBtn.addEventListener('click', () => {

    startScreen.style.display = 'none';

    initAudioEngine();

    startBreathingEngine();

    document.body.requestPointerLock();

    gameActive = true;
});

// --- Pointer Lock ---
document.addEventListener('pointerlockchange', () => {

    if (
        gameOverScreen.style.display === 'flex' ||
        jumpscareOverlay.style.display === 'block'
    ) {
        return;
    }

    gameActive =
        (document.pointerLockElement === document.body);

    if (!gameActive && !isPaused) {

        startScreen.style.display = 'flex';

        if (monsterGainNode && audioCtx) {

            monsterGainNode.gain.setValueAtTime(
                0,
                audioCtx.currentTime
            );
        }
    }
});

// --- Audio Engine ---
function initAudioEngine() {

    if (audioCtx) {

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        return;
    }

    audioCtx =
        new (
            window.AudioContext ||
            window.webkitAudioContext
        )();

    monsterGainNode =
        audioCtx.createGain();

    monsterGainNode.gain.setValueAtTime(
        0,
        audioCtx.currentTime
    );

    monsterGainNode.connect(
        audioCtx.destination
    );

    // Monster Ambient
    fetch('./monster_ambient.mp3')

        .then(response => {

            if (!response.ok) {
                throw new Error();
            }

            return response.arrayBuffer();
        })

        .then(data =>
            audioCtx.decodeAudioData(data)
        )

        .then(buffer => {

            monsterTrackBuffer = buffer;

            startMonsterAmbientLoop();
        });

    // Jumpscare Audio
    fetch('./jumpscare.mp3')

        .then(response => {

            if (!response.ok) {
                throw new Error();
            }

            return response.arrayBuffer();
        })

        .then(data =>
            audioCtx.decodeAudioData(data)
        )

        .then(buffer => {

            jumpscareBuffer = buffer;
        });
}

function startMonsterAmbientLoop() {

    if (!audioCtx || !monsterTrackBuffer) return;

    if (monsterAudioSource) {

        try {
            monsterAudioSource.stop();
        } catch(e) {}

        monsterAudioSource.disconnect();
    }

    monsterAudioSource =
        audioCtx.createBufferSource();

    monsterAudioSource.buffer =
        monsterTrackBuffer;

    monsterAudioSource.loop = true;

    monsterAudioSource.connect(
        monsterGainNode
    );

    monsterAudioSource.start(0);
}

// --- Breathing System ---
function startBreathingEngine() {

    if (breathingInterval) {
        clearInterval(breathingInterval);
    }

    breathingInterval = setInterval(() => {

        if (!gameActive) return;

        let panicIntensity =
            (
                stamina < 35
            )
            ? 0.15
            : (
                isSprinting
                ? 0.06
                : 0.01
            );

        if (stamina < 75 || isSprinting) {
            playProceduralBreathSigh(
                panicIntensity
            );
        }

    }, 1200);
}

function playProceduralBreathSigh(volume) {

    if (
        !audioCtx ||
        audioCtx.state === 'suspended'
    ) {
        return;
    }

    const bufferSize =
        audioCtx.sampleRate * 0.4;

    const buffer =
        audioCtx.createBuffer(
            1,
            bufferSize,
            audioCtx.sampleRate
        );

    const data =
        buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noiseNode =
        audioCtx.createBufferSource();

    noiseNode.buffer = buffer;

    const filterNode =
        audioCtx.createBiquadFilter();

    filterNode.type = 'lowpass';

    filterNode.frequency.setValueAtTime(
        stamina < 35 ? 450 : 300,
        audioCtx.currentTime
    );

    const gainNode =
        audioCtx.createGain();

    gainNode.gain.setValueAtTime(
        volume,
        audioCtx.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.35
    );

    noiseNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start();
}

// --- Engine Init ---
function init() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x12120b);

    scene.fog =
        new THREE.FogExp2(
            0x12120b,
            0.14
        );

    // Camera
    camera =
        new THREE.PerspectiveCamera(
            cameraFov,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

    camera.position.set(
        0,
        defaultPlayerHeight,
        0
    );

    // Renderer
    renderer =
        new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance"
        });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.2)
    );

    renderer.outputEncoding =
        THREE.sRGBEncoding;

    document
        .getElementById('canvas-container')
        .appendChild(renderer.domElement);

    // Lights
    const ambientFloorLight =
        new THREE.AmbientLight(
            0xffffff,
            0.6
        );

    scene.add(ambientFloorLight);

    const directionalSun =
        new THREE.DirectionalLight(
            0xffffff,
            0.5
        );

    directionalSun.position.set(5,15,5);

    scene.add(directionalSun);

    // Flashlight
    const flashlightNode =
        new THREE.SpotLight(
            0xfff5d1,
            8,
            24,
            Math.PI / 4.5,
            0.5,
            1.3
        );

    camera.add(flashlightNode);

    flashlightNode.target =
        new THREE.Object3D();

    camera.add(flashlightNode.target);

    flashlightNode.target.position.set(
        0,
        0,
        -1
    );

    scene.add(camera);

    // World
    buildSectorMap();

    buildThresholdDoor(-8,0,-38);

    spawnProceduralEvidenceFiles();

    // Monster
    gltfLoader =
        new THREE.GLTFLoader();

    gltfLoader.load(

        './monster.glb',

        (gltf) => {

            horrorEntity = gltf.scene;

            horrorEntity.position.set(
                0,
                0,
                -30
            );

            // BIGGER MONSTER
            horrorEntity.scale.set(
                monsterScaleMultiplier,
                monsterScaleMultiplier,
                monsterScaleMultiplier
            );

            horrorEntity.traverse((child) => {

                if (child.isMesh) {

                    child.material.needsUpdate = true;

                    if (child.material.map) {

                        child.material.map.encoding =
                            THREE.sRGBEncoding;
                    }
                }
            });

            if (
                gltf.animations &&
                gltf.animations.length > 0
            ) {

                animationMixer =
                    new THREE.AnimationMixer(
                        horrorEntity
                    );

                animationMixer
                    .clipAction(
                        gltf.animations[0]
                    )
                    .play();
            }

            scene.add(horrorEntity);
        }
    );

    setupControlBindings();

    window.addEventListener(
        'resize',
        handleViewportResize
    );

    animate();
}

// --- Controls ---
function setupControlBindings() {

    document.addEventListener('mousemove', (e) => {

        if (!gameActive) return;

        camera.rotation.y -=
            e.movementX * mouseSensitivity;

        camera.rotation.x -=
            e.movementY * mouseSensitivity;

        camera.rotation.x = Math.max(
            -Math.PI / 2.2,
            Math.min(
                Math.PI / 2.2,
                camera.rotation.x
            )
        );
    });

    camera.rotation.order = "YXZ";

    // Mouse
    document.addEventListener('mousedown', (e) => {

        if (!gameActive) return;

        // Left click pickup
        if (e.button === 0) {
            attemptItemPickup();
        }

        // Right click zoom
        if (e.button === 2) {
            isZooming = true;
        }
    });

    document.addEventListener('mouseup', (e) => {

        if (e.button === 2) {
            isZooming = false;
        }
    });

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {

        switch(e.code) {

            case 'KeyW':
                moveForward = true;
                break;

            case 'KeyS':
                moveBackward = true;
                break;

            case 'KeyA':
                moveLeft = true;
                break;

            case 'KeyD':
                moveRight = true;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':

                if (!isExhausted) {
                    isSprinting = true;
                }

                break;
        }
    });

    document.addEventListener('keyup', (e) => {

        switch(e.code) {

            case 'KeyW':
                moveForward = false;
                break;

            case 'KeyS':
                moveBackward = false;
                break;

            case 'KeyA':
                moveLeft = false;
                break;

            case 'KeyD':
                moveRight = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                isSprinting = false;
                break;
        }
    });
}

// --- Animate ---
function animate() {

    requestAnimationFrame(animate);

    const currentTime = performance.now();

    const frameDelta =
        (currentTime - prevTime) / 1000;

    if (animationMixer) {
        animationMixer.update(
            clock.getDelta()
        );
    }

    // Zoom
    const targetFov =
        isZooming
        ? zoomedFov
        : defaultFov;

    camera.fov +=
        (targetFov - camera.fov)
        * 6
        * frameDelta;

    camera.updateProjectionMatrix();

    // Game
    if (gameActive) {

        // Monster
        if (horrorEntity) {

            let distanceToTarget =
                horrorEntity.position.distanceTo(
                    camera.position
                );

            horrorEntity.lookAt(
                new THREE.Vector3(
                    camera.position.x,
                    horrorEntity.position.y,
                    camera.position.z
                )
            );

            // Dynamic Monster Speed
            let monsterSpeed =
                monsterBaseSpeed +
                (collectedFiles * 0.9);

            if (isSprinting) {
                monsterSpeed += 1.8;
            }

            if (stamina < 30) {
                monsterSpeed += 1.2;
            }

            if (isZooming) {
                monsterSpeed += 0.6;
            }

            horrorEntity.translateZ(
                monsterSpeed * frameDelta
            );

            // Dynamic Monster Growth
            let growth =
                11 +
                (collectedFiles * 0.45);

            horrorEntity.scale.set(
                growth,
                growth,
                growth
            );

            // Camera Distortion
            if (distanceToTarget < 10) {

                camera.rotation.z =
                    Math.sin(currentTime * 0.02)
                    * 0.01
                    * (10 - distanceToTarget);

            } else {

                camera.rotation.z = 0;
            }

            // Audio Distance
            if (
                monsterGainNode &&
                audioCtx &&
                audioCtx.state !== 'suspended'
            ) {

                let targetVolume =
                    (
                        distanceToTarget < 28
                    )
                    ? Math.pow(
                        1 - (distanceToTarget / 28),
                        2
                    ) * 0.85
                    : 0;

                monsterGainNode.gain
                    .linearRampToValueAtTime(
                        targetVolume,
                        audioCtx.currentTime + 0.1
                    );
            }

            // Jumpscare Trigger
            if (distanceToTarget < 3.4) {
                triggerAnomalyJumpscare();
            }
        }
    }

    prevTime = currentTime;

    renderer.render(scene, camera);
}

// --- Jumpscare ---
function triggerAnomalyJumpscare() {

    gameActive = false;

    document.exitPointerLock();

    // STOP AMBIENT
    if (monsterGainNode && audioCtx) {

        monsterGainNode.gain.setValueAtTime(
            0,
            audioCtx.currentTime
        );
    }

    // PLAY JUMPSCARE AUDIO
    if (audioCtx && jumpscareBuffer) {

        jumpscareSource =
            audioCtx.createBufferSource();

        jumpscareSource.buffer =
            jumpscareBuffer;

        jumpscareSource.connect(
            audioCtx.destination
        );

        jumpscareSource.start(0);
    }

    // SHOW OVERLAY
    jumpscareOverlay.style.display = "block";

    setTimeout(() => {

        jumpscareOverlay.style.display = "none";

        resetGameEnvironment();

    }, 1500);
}

// --- Reset ---
function resetGameEnvironment() {

    camera.position.set(
        0,
        1.7,
        0
    );

    camera.rotation.set(0,0,0);

    collectedFiles = 0;

    stamina = maxStamina;

    if (horrorEntity) {

        horrorEntity.position.set(
            0,
            0,
            -30
        );
    }

    gameActive = true;

    document.body.requestPointerLock();
}

// --- Resize ---
function handleViewportResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

// --- Placeholder Functions ---
function buildSectorMap() {}
function buildThresholdDoor() {}
function spawnProceduralEvidenceFiles() {}
function attemptItemPickup() {}

// --- Start ---
window.onload = init;
