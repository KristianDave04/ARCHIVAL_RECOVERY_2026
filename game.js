// =========================
// FULL FIXED MOVEMENT +
// FLASHLIGHT SYSTEM
// =========================

// --- Core System Global State References ---
let scene, camera, renderer, gltfLoader, animationMixer;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();

const clock = new THREE.Clock();

let horrorEntity = null;

let gameActive = false;

let isPaused = false;

let escapeDoor = null;

// =========================
// CAMERA ZOOM
// =========================

let cameraFov = 65;

const defaultFov = 65;

const zoomedFov = 35;

let isZooming = false;

// =========================
// FLASHLIGHT
// =========================

let flashlightNode;

// =========================
// MONSTER
// =========================

let monsterBaseSpeed = 2.8;

let monsterScaleMultiplier = 11;

// =========================
// AUDIO
// =========================

let audioCtx = null;

let monsterTrackBuffer = null;

let monsterAudioSource = null;

let monsterGainNode = null;

let breathingInterval = null;

let jumpscareBuffer = null;

let jumpscareSource = null;

// =========================
// FILES
// =========================

let collectedFiles = 0;

const totalFilesRequired = 7;

let evidenceFileMeshes = [];

// =========================
// STAMINA
// =========================

let stamina = 100;

const maxStamina = 100;

let isSprinting = false;

let isExhausted = false;

// =========================
// JUMP
// =========================

let isJumping = false;

let verticalVelocity = 0;

const gravityConstant = 32.0;

let defaultPlayerHeight = 1.7;

// =========================
// COLLISION
// =========================

let wallBoxes = [];

const playerRadius = 0.45;

// =========================
// RAYCAST
// =========================

const crosshairRaycaster =
    new THREE.Raycaster();

const screenCenterVector =
    new THREE.Vector2(0,0);

// =========================
// DOM
// =========================

const startScreen =
    document.getElementById('start-screen');

const initializeBtn =
    document.getElementById('initialize-btn');

const jumpscareOverlay =
    document.getElementById('jumpscare-overlay');

const filesCountText =
    document.getElementById('files-count');

const keyStatusText =
    document.getElementById('key-status');

const sprintBarFill =
    document.getElementById('sprint-bar-fill');

// =========================
// SETTINGS
// =========================

let mouseSensitivity = 0.0022;

// =========================
// START GAME
// =========================

initializeBtn.addEventListener('click', () => {

    startScreen.style.display = 'none';

    initAudioEngine();

    startBreathingEngine();

    document.body.requestPointerLock();

    gameActive = true;
});

// =========================
// AUDIO ENGINE
// =========================

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

    monsterGainNode.gain.value = 0;

    monsterGainNode.connect(
        audioCtx.destination
    );

    // MONSTER AMBIENT
    fetch('./monster_ambient.mp3')

        .then(r => r.arrayBuffer())

        .then(data =>
            audioCtx.decodeAudioData(data)
        )

        .then(buffer => {

            monsterTrackBuffer = buffer;

            startMonsterAmbientLoop();
        });

    // JUMPSCARE
    fetch('./jumpscare.mp3')

        .then(r => r.arrayBuffer())

        .then(data =>
            audioCtx.decodeAudioData(data)
        )

        .then(buffer => {

            jumpscareBuffer = buffer;
        });
}

function startMonsterAmbientLoop() {

    if (
        !audioCtx ||
        !monsterTrackBuffer
    ) {
        return;
    }

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

// =========================
// BREATHING
// =========================

function startBreathingEngine() {

    if (breathingInterval) {

        clearInterval(
            breathingInterval
        );
    }

    breathingInterval = setInterval(() => {

        if (!gameActive) return;

        if (
            stamina < 75 ||
            isSprinting
        ) {

            playProceduralBreathSigh(
                stamina < 35
                ? 0.15
                : 0.05
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

        data[i] =
            Math.random() * 2 - 1;
    }

    const noiseNode =
        audioCtx.createBufferSource();

    noiseNode.buffer = buffer;

    const filterNode =
        audioCtx.createBiquadFilter();

    filterNode.type = 'lowpass';

    filterNode.frequency.value =
        350;

    const gainNode =
        audioCtx.createGain();

    gainNode.gain.setValueAtTime(
        volume,
        audioCtx.currentTime
    );

    gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.4
    );

    noiseNode.connect(filterNode);

    filterNode.connect(gainNode);

    gainNode.connect(audioCtx.destination);

    noiseNode.start();
}

// =========================
// INIT
// =========================

function init() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x12120b);

    scene.fog =
        new THREE.FogExp2(
            0x12120b,
            0.14
        );

    // CAMERA
    camera =
        new THREE.PerspectiveCamera(
            cameraFov,
            window.innerWidth /
            window.innerHeight,
            0.1,
            1000
        );

    camera.position.set(
        0,
        defaultPlayerHeight,
        0
    );

    camera.rotation.order = 'YXZ';

    // RENDERER
    renderer =
        new THREE.WebGLRenderer({
            antialias: false
        });

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            1.2
        )
    );

    renderer.outputEncoding =
        THREE.sRGBEncoding;

    document
        .getElementById('canvas-container')
        .appendChild(renderer.domElement);

    // LIGHTS
    const ambientFloorLight =
        new THREE.AmbientLight(
            0xffffff,
            0.55
        );

    scene.add(ambientFloorLight);

    const directionalSun =
        new THREE.DirectionalLight(
            0xffffff,
            0.45
        );

    directionalSun.position.set(
        5,
        15,
        5
    );

    scene.add(directionalSun);

    // =========================
    // FLASHLIGHT FIX
    // =========================

    flashlightNode =
        new THREE.SpotLight(
            0xffe8b5,
            12,
            30,
            Math.PI / 5,
            0.45,
            1.4
        );

    flashlightNode.position.set(
        0,
        0,
        0
    );

    camera.add(flashlightNode);

    flashlightNode.target =
        new THREE.Object3D();

    flashlightNode.target.position.set(
        0,
        0,
        -10
    );

    camera.add(
        flashlightNode.target
    );

    scene.add(camera);

    // WORLD
    buildSectorMap();

    // MONSTER
    gltfLoader =
        new THREE.GLTFLoader();

    gltfLoader.load(

        './monster.glb',

        (gltf) => {

            horrorEntity =
                gltf.scene;

            horrorEntity.position.set(
                0,
                0,
                -30
            );

            horrorEntity.scale.set(
                monsterScaleMultiplier,
                monsterScaleMultiplier,
                monsterScaleMultiplier
            );

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

// =========================
// CONTROLS
// =========================

function setupControlBindings() {

    // CAMERA LOOK
    document.addEventListener(
        'mousemove',
        (e) => {

            if (!gameActive) return;

            camera.rotation.y -=
                e.movementX *
                mouseSensitivity;

            camera.rotation.x -=
                e.movementY *
                mouseSensitivity;

            camera.rotation.x =
                Math.max(
                    -Math.PI / 2.1,
                    Math.min(
                        Math.PI / 2.1,
                        camera.rotation.x
                    )
                );
        }
    );

    // ZOOM
    document.addEventListener(
        'mousedown',
        (e) => {

            if (e.button === 2) {

                isZooming = true;
            }
        }
    );

    document.addEventListener(
        'mouseup',
        (e) => {

            if (e.button === 2) {

                isZooming = false;
            }
        }
    );

    document.addEventListener(
        'contextmenu',
        (e) => e.preventDefault()
    );

    // KEYS
    document.addEventListener(
        'keydown',
        (e) => {

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
        }
    );

    document.addEventListener(
        'keyup',
        (e) => {

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
        }
    );
}

// =========================
// ANIMATE
// =========================

function animate() {

    requestAnimationFrame(
        animate
    );

    const currentTime =
        performance.now();

    const frameDelta =
        (currentTime - prevTime)
        / 1000;

    if (animationMixer) {

        animationMixer.update(
            clock.getDelta()
        );
    }

    // ZOOM
    const targetFov =
        isZooming
        ? zoomedFov
        : defaultFov;

    camera.fov +=
        (targetFov - camera.fov)
        * 6
        * frameDelta;

    camera.updateProjectionMatrix();

    // FLASHLIGHT FLICKER
    flashlightNode.intensity =
        10 +
        Math.sin(currentTime * 0.02)
        * 0.6;

    if (gameActive) {

        // =========================
        // MOVEMENT FIX
        // =========================

        const userIsMoving =
            moveForward ||
            moveBackward ||
            moveLeft ||
            moveRight;

        // STAMINA
        if (
            isSprinting &&
            userIsMoving
        ) {

            stamina -=
                18.5 * frameDelta;

            if (stamina <= 0) {

                stamina = 0;

                isSprinting = false;

                isExhausted = true;

                sprintBarFill.classList.add(
                    'exhausted'
                );
            }

        } else {

            stamina +=
                (userIsMoving
                ? 7.5
                : 14.0)
                * frameDelta;

            if (stamina > maxStamina) {

                stamina = maxStamina;
            }

            if (
                isExhausted &&
                stamina >= 30
            ) {

                isExhausted = false;

                sprintBarFill.classList.remove(
                    'exhausted'
                );
            }
        }

        sprintBarFill.style.width =
            (
                (stamina / maxStamina)
                * 100
            ) + "%";

        // SPEED
        let moveSpeed =
            isSprinting
            ? 11.5
            : 5.8;

        // DIRECTION
        const forward =
            new THREE.Vector3();

        camera.getWorldDirection(
            forward
        );

        forward.y = 0;

        forward.normalize();

        const right =
            new THREE.Vector3();

        right.crossVectors(
            forward,
            new THREE.Vector3(0,1,0)
        );

        right.normalize();

        // VELOCITY
        const velocity =
            new THREE.Vector3();

        if (moveForward) {
            velocity.add(forward);
        }

        if (moveBackward) {
            velocity.sub(forward);
        }

        if (moveRight) {
            velocity.sub(right);
        }

        if (moveLeft) {
            velocity.add(right);
        }

        velocity.normalize();

        velocity.multiplyScalar(
            moveSpeed * frameDelta
        );

        camera.position.add(
            velocity
        );

        // =========================
        // MONSTER
        // =========================

        if (horrorEntity) {

            const distanceToTarget =
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

            let monsterSpeed =
                monsterBaseSpeed +
                (collectedFiles * 0.9);

            if (isSprinting) {
                monsterSpeed += 1.8;
            }

            horrorEntity.translateZ(
                monsterSpeed *
                frameDelta
            );

            // AUDIO
            if (
                monsterGainNode &&
                audioCtx
            ) {

                let targetVolume =
                    (
                        distanceToTarget < 28
                    )
                    ? Math.pow(
                        1 -
                        (distanceToTarget / 28),
                        2
                    ) * 0.85
                    : 0;

                monsterGainNode.gain
                    .linearRampToValueAtTime(
                        targetVolume,
                        audioCtx.currentTime + 0.1
                    );
            }

            // CAMERA SHAKE
            if (distanceToTarget < 10) {

                camera.rotation.z =
                    Math.sin(currentTime * 0.02)
                    * 0.01
                    * (10 - distanceToTarget);

            } else {

                camera.rotation.z = 0;
            }

            // JUMPSCARE
            if (distanceToTarget < 3.4) {

                triggerAnomalyJumpscare();
            }
        }
    }

    // FLASHLIGHT FOLLOW
    camera.updateMatrixWorld();

    prevTime = currentTime;

    renderer.render(
        scene,
        camera
    );
}

// =========================
// JUMPSCARE
// =========================

function triggerAnomalyJumpscare() {

    gameActive = false;

    document.exitPointerLock();

    if (
        monsterGainNode &&
        audioCtx
    ) {

        monsterGainNode.gain.setValueAtTime(
            0,
            audioCtx.currentTime
        );
    }

    // SOUND
    if (
        audioCtx &&
        jumpscareBuffer
    ) {

        jumpscareSource =
            audioCtx.createBufferSource();

        jumpscareSource.buffer =
            jumpscareBuffer;

        jumpscareSource.connect(
            audioCtx.destination
        );

        jumpscareSource.start(0);
    }

    jumpscareOverlay.style.display =
        'block';

    setTimeout(() => {

        jumpscareOverlay.style.display =
            'none';

        resetGameEnvironment();

    }, 1500);
}

// =========================
// RESET
// =========================

function resetGameEnvironment() {

    camera.position.set(
        0,
        1.7,
        0
    );

    camera.rotation.set(
        0,
        0,
        0
    );

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

// =========================
// RESIZE
// =========================

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

// =========================
// PLACEHOLDER
// =========================

function buildSectorMap() {}
function attemptItemPickup() {}

// =========================
// START
// =========================

window.onload = init;
