// --- Core System Global State References ---
let scene, camera, renderer, gltfLoader, animationMixer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const clock = new THREE.Clock();

let horrorEntity = null;
let gameActive = false;
let isPaused = false;
let escapeDoor = null;

// --- Flashlight System ---
let flashlightNode = null;
let flashlightEnabled = true;

// Audio Stream Context Architecture
let audioCtx = null;
let monsterTrackBuffer = null;
let monsterAudioSource = null;
let monsterGainNode = null;
let breathingInterval = null;

// --- Jumpscare Audio ---
let jumpscareAudio = null;

// Document Objective Tracking Mechanics
let collectedFiles = 0;
const totalFilesRequired = 7;
let evidenceFileMeshes = [];

// Stamina Physical Properties & States
let stamina = 100;
const maxStamina = 100;
let isSprinting = false;
let isExhausted = false;

// Jump state mechanics
let isJumping = false;
let verticalVelocity = 0;
const gravityConstant = 32.0;
let defaultPlayerHeight = 1.7;

// Raycast Vector Math Engine
const crosshairRaycaster = new THREE.Raycaster();
const screenCenterVector = new THREE.Vector2(0, 0);

// Collision Geometry Boundaries
let wallBoxes = [];
const playerRadius = 0.45;

// DOM References
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const initializeBtn = document.getElementById('initialize-btn');
const jumpscareOverlay = document.getElementById('jumpscare-overlay');
const filesCountText = document.getElementById('files-count');
const keyStatusText = document.getElementById('key-status');
const sprintBarFill = document.getElementById('sprint-bar-fill');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const pauseSettingsBtn = document.getElementById('pause-settings-btn');
const pauseQuitBtn = document.getElementById('pause-quit-btn');
const cutsceneScreen = document.getElementById('cutscene-screen');
const cutsceneVideo = document.getElementById('cutscene-video');
const skipCutsceneBtn = document.getElementById('skip-cutscene-btn');
const horrorQuoteText = document.getElementById('horror-quote');
const getUpText = document.getElementById('get-up-text');

let mouseSensitivity = 0.0022;

// Horror Quotes
const horrorQuotes = [
    "This is not over...",
    "Sen. Bato is getting away again.",
    "The tape cannot be stopped.",
    "It watches through the lens.",
    "You are trapped forever.",
    "GET OUT WHILE YOU STILL CAN."
];

// --- Initialize Button ---
initializeBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';

    initAudioEngine();
    startBreathingEngine();

    gameActive = true;

    if (!isMobileDevice()) {
        document.body.requestPointerLock();
    }
});

// --- Pointer Lock ---
document.addEventListener('pointerlockchange', () => {

    if (isMobileDevice()) return;

    if (gameOverScreen.style.display === 'flex') return;

    gameActive = (document.pointerLockElement === document.body);

    if (!gameActive && !isPaused) {
        startScreen.style.display = 'flex';
    }
});

// --- Audio Engine ---
function initAudioEngine() {

    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    monsterGainNode = audioCtx.createGain();
    monsterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    monsterGainNode.connect(audioCtx.destination);

    // Monster Ambient
    fetch('./monster_ambient.mp3')
        .then(res => res.arrayBuffer())
        .then(data => audioCtx.decodeAudioData(data))
        .then(buffer => {
            monsterTrackBuffer = buffer;
            startMonsterAmbientLoop();
        });

    // Jumpscare Audio
    jumpscareAudio = new Audio('./jumpscare.mp3');
    jumpscareAudio.volume = 1;
}

function startMonsterAmbientLoop() {

    if (!audioCtx || !monsterTrackBuffer) return;

    if (monsterAudioSource) {
        try { monsterAudioSource.stop(); } catch(e){}
    }

    monsterAudioSource = audioCtx.createBufferSource();
    monsterAudioSource.buffer = monsterTrackBuffer;
    monsterAudioSource.loop = true;

    monsterAudioSource.connect(monsterGainNode);
    monsterAudioSource.start(0);
}

// --- Breathing ---
function startBreathingEngine() {

    if (breathingInterval) clearInterval(breathingInterval);

    breathingInterval = setInterval(() => {

        if (!gameActive) return;

        if (stamina < 75 || isSprinting) {
            playProceduralBreathSigh(0.08);
        }

    }, 1200);
}

function playProceduralBreathSigh(volume) {

    if (!audioCtx) return;

    const bufferSize = audioCtx.sampleRate * 0.4;

    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    source.connect(gain);
    gain.connect(audioCtx.destination);

    source.start();
}

// --- INIT ---
function init() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x080803);
    scene.fog = new THREE.FogExp2(0x080803, 0.12);

    camera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, defaultPlayerHeight, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: false
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    document.getElementById('canvas-container')
        .appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    scene.add(ambient);

    // --- FLASHLIGHT FIX ---
    flashlightNode = new THREE.SpotLight(
        0xfff2cc,
        18,
        35,
        Math.PI / 5,
        0.45,
        1
    );

    flashlightNode.position.set(0, 0, 0);

    flashlightNode.castShadow = false;

    flashlightNode.target.position.set(0, 0, -10);

    camera.add(flashlightNode);
    camera.add(flashlightNode.target);

    scene.add(camera);

    buildSectorMap();

    buildThresholdDoor(-8, 0, -38);

    spawnProceduralEvidenceFiles();

    // Monster
    gltfLoader = new THREE.GLTFLoader();

    gltfLoader.load(
        './monster.glb',

        (gltf) => {

            horrorEntity = gltf.scene;

            horrorEntity.position.set(0, 0, -30);

            // --- BIGGER MONSTER ---
            horrorEntity.scale.set(12, 12, 12);

            if (gltf.animations.length > 0) {

                animationMixer =
                    new THREE.AnimationMixer(horrorEntity);

                animationMixer
                    .clipAction(gltf.animations[0])
                    .play();
            }

            scene.add(horrorEntity);
        },

        undefined,

        () => {
            spawnProxyMonsterMesh();
        }
    );

    setupControlBindings();

    window.addEventListener('resize', handleViewportResize);

    animate();
}

// --- Proxy Monster ---
function spawnProxyMonsterMesh() {

    const geo = new THREE.BoxGeometry(4, 8, 4);

    const mat = new THREE.MeshBasicMaterial({
        color: 0xff0000
    });

    horrorEntity = new THREE.Mesh(geo, mat);

    horrorEntity.position.set(0, 4, -30);

    scene.add(horrorEntity);
}

// --- Map ---
function buildSectorMap() {

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 120),
        new THREE.MeshStandardMaterial({
            color: 0x2a2a1e
        })
    );

    floor.rotation.x = -Math.PI / 2;

    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x736e43
    });

    const blueprint = [
        {w:2,d:20,x:-10,z:-15},
        {w:20,d:2,x:0,z:-25},
        {w:2,d:30,x:12,z:-20},
        {w:15,d:2,x:-5,z:-5},
        {w:2,d:15,x:0,z:-40},
        {w:40,d:2,x:-10,z:-45},
        {w:16,d:2,x:25,z:-10},
        {w:2,d:20,x:-25,z:-5},
        {w:100,d:2,x:0,z:50},
        {w:100,d:2,x:0,z:-50},
        {w:2,d:100,x:50,z:0},
        {w:2,d:100,x:-50,z:0}
    ];

    blueprint.forEach(w => {

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w.w, 5.5, w.d),
            wallMat
        );

        mesh.position.set(w.x, 2.75, w.z);

        scene.add(mesh);

        wallBoxes.push(
            new THREE.Box3().setFromObject(mesh)
        );
    });
}

// --- Door ---
function buildThresholdDoor(x,y,z) {

    escapeDoor = new THREE.Group();

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2,3.5,0.2),
        new THREE.MeshStandardMaterial({
            color: 0x550000
        })
    );

    mesh.position.y = 1.75;

    escapeDoor.add(mesh);

    escapeDoor.position.set(x,y,z);

    scene.add(escapeDoor);
}

// --- Evidence ---
function spawnProceduralEvidenceFiles() {

    const points = [
        {x:32,z:38},
        {x:-38,z:18},
        {x:22,z:-32},
        {x:-42,z:-18},
        {x:-18,z:-35},
        {x:5,z:25},
        {x:18,z:12}
    ];

    for (let i=0;i<totalFilesRequired;i++) {

        const p = points[i];

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.6,0.3,0.7),
            new THREE.MeshStandardMaterial({
                color:0xe6dfb8,
                emissive:0x221e10
            })
        );

        mesh.position.set(p.x,0.15,p.z);

        scene.add(mesh);

        evidenceFileMeshes.push(mesh);
    }
}

// --- Pickup ---
function attemptItemPickup() {

    if (!gameActive) return;

    crosshairRaycaster.setFromCamera(
        screenCenterVector,
        camera
    );

    const hits = crosshairRaycaster
        .intersectObjects(evidenceFileMeshes);

    if (hits.length > 0) {

        const object = hits[0].object;

        if (camera.position.distanceTo(object.position) <= 3.5) {

            scene.remove(object);

            evidenceFileMeshes.splice(
                evidenceFileMeshes.indexOf(object),
                1
            );

            collectedFiles++;

            filesCountText.innerText =
                collectedFiles + "/" + totalFilesRequired;

            if (collectedFiles >= totalFilesRequired) {

                keyStatusText.innerText = "UNLOCKED";
                keyStatusText.className = "success-txt";
            }
        }
    }
}

// --- Jump ---
function executeJumpLeap() {

    if (isJumping || stamina < 22) return;

    isJumping = true;

    stamina -= 22;

    verticalVelocity = 11.5;
}

// --- Controls ---
function setupControlBindings() {

    // Mouse Look
    document.addEventListener('mousemove', (e) => {

        if (!gameActive || isMobileDevice()) return;

        camera.rotation.y -=
            e.movementX * mouseSensitivity;

        camera.rotation.x -=
            e.movementY * mouseSensitivity;

        camera.rotation.x = Math.max(
            -Math.PI/2.2,
            Math.min(Math.PI/2.2, camera.rotation.x)
        );
    });

    camera.rotation.order = "YXZ";

    // Pickup
    document.addEventListener('mousedown', (e) => {

        if (gameActive && e.button === 0) {
            attemptItemPickup();
        }
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

            case 'Space':
                executeJumpLeap();
                break;

            case 'KeyE':
                attemptItemPickup();
                break;

            case 'ShiftLeft':
            case 'ShiftRight':

                if (!isExhausted)
                    isSprinting = true;

                break;

            // --- FLASHLIGHT TOGGLE ---
            case 'KeyF':

                flashlightEnabled = !flashlightEnabled;

                flashlightNode.visible = flashlightEnabled;

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

// --- GAME LOOP ---
function animate() {

    requestAnimationFrame(animate);

    const currentTime = performance.now();

    const delta = (currentTime - prevTime) / 1000;

    if (animationMixer) {
        animationMixer.update(clock.getDelta());
    }

    if (gameActive) {

        // --- Stamina ---
        const moving =
            moveForward || moveBackward ||
            moveLeft || moveRight;

        if (isSprinting && moving) {

            stamina -= 18 * delta;

            if (stamina <= 0) {

                stamina = 0;

                isSprinting = false;

                isExhausted = true;

                sprintBarFill.classList.add('exhausted');
            }

        } else {

            stamina += 12 * delta;

            if (stamina > maxStamina)
                stamina = maxStamina;

            if (stamina > 30) {

                isExhausted = false;

                sprintBarFill.classList.remove('exhausted');
            }
        }

        sprintBarFill.style.width =
            (stamina / maxStamina) * 100 + "%";

        // --- MOVEMENT FIX ---
        const speed = isSprinting ? 10 : 5.5;

        const forward =
            new THREE.Vector3(0,0,-1)
            .applyQuaternion(camera.quaternion);

        const right =
            new THREE.Vector3(1,0,0)
            .applyQuaternion(camera.quaternion);

        forward.y = 0;
        right.y = 0;

        forward.normalize();
        right.normalize();

        let velocity = new THREE.Vector3();

        if (moveForward)
            velocity.add(forward);

        if (moveBackward)
            velocity.sub(forward);

        if (moveRight)
            velocity.add(right);

        if (moveLeft)
            velocity.sub(right);

        velocity.normalize();

        velocity.multiplyScalar(speed * delta);

        const oldX = camera.position.x;
        const oldZ = camera.position.z;

        camera.position.x += velocity.x;
        camera.position.z += velocity.z;

        // Collision
        for (let wall of wallBoxes) {

            if (
                wall.containsPoint(
                    new THREE.Vector3(
                        camera.position.x,
                        camera.position.y,
                        camera.position.z
                    )
                )
            ) {

                camera.position.x = oldX;
                camera.position.z = oldZ;

                break;
            }
        }

        // Jump
        if (isJumping) {

            verticalVelocity -= gravityConstant * delta;

            defaultPlayerHeight +=
                verticalVelocity * delta;

            if (defaultPlayerHeight <= 1.7) {

                defaultPlayerHeight = 1.7;

                verticalVelocity = 0;

                isJumping = false;
            }
        }

        camera.position.y = defaultPlayerHeight;

        // Evidence Rotation
        evidenceFileMeshes.forEach(mesh => {
            mesh.rotation.y += 1.2 * delta;
        });

        // --- MONSTER AI FASTER ---
        if (horrorEntity) {

            horrorEntity.lookAt(
                camera.position.x,
                horrorEntity.position.y,
                camera.position.z
            );

            const distance =
                horrorEntity.position.distanceTo(
                    camera.position
                );

            // MUCH FASTER
            horrorEntity.translateZ(
                (4 + collectedFiles * 0.9) * delta
            );

            // Audio proximity
            if (monsterGainNode && audioCtx) {

                const volume =
                    distance < 30
                    ? (1 - distance / 30)
                    : 0;

                monsterGainNode.gain.linearRampToValueAtTime(
                    volume,
                    audioCtx.currentTime + 0.1
                );
            }

            if (distance < 4) {
                triggerAnomalyJumpscare();
            }
        }
    }

    prevTime = currentTime;

    renderer.render(scene, camera);
}

// --- JUMPSCARE ---
function triggerAnomalyJumpscare() {

    gameActive = false;

    if (monsterGainNode && audioCtx) {
        monsterGainNode.gain.setValueAtTime(
            0,
            audioCtx.currentTime
        );
    }

    // --- PLAY JUMPSCARE SOUND ---
    if (jumpscareAudio) {

        jumpscareAudio.currentTime = 0;

        jumpscareAudio.play();
    }

    jumpscareOverlay.style.display = 'block';

    setTimeout(() => {

        jumpscareOverlay.style.display = 'none';

        renderStaticGameOverScreen();

    }, 1500);
}

// --- Game Over ---
function renderStaticGameOverScreen() {

    const quote =
        horrorQuotes[
            Math.floor(Math.random() * horrorQuotes.length)
        ];

    horrorQuoteText.textContent = quote;

    horrorQuoteText.style.display = 'block';

    getUpText.style.display = 'none';

    gameOverScreen.style.display = 'flex';

    setTimeout(() => {

        horrorQuoteText.style.display = 'none';

        getUpText.style.display = 'block';

        setTimeout(() => {

            gameOverScreen.style.display = 'none';

            resetGameEnvironment();

            if (!isMobileDevice()) {
                document.body.requestPointerLock();
            }

        }, 1500);

    }, 2000);
}

// --- Reset ---
function resetGameEnvironment() {

    camera.position.set(0,1.7,0);

    camera.rotation.set(0,0,0);

    collectedFiles = 0;

    stamina = maxStamina;

    filesCountText.innerText =
        "0/" + totalFilesRequired;

    keyStatusText.innerText = "LOCKED";

    keyStatusText.className = "danger-txt";

    evidenceFileMeshes.forEach(m => scene.remove(m));

    evidenceFileMeshes = [];

    spawnProceduralEvidenceFiles();

    if (horrorEntity) {
        horrorEntity.position.set(0,0,-30);
    }

    startMonsterAmbientLoop();

    gameActive = true;
}

// --- Resize ---
function handleViewportResize() {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

// --- Mobile Detection ---
function isMobileDevice() {

    return /Mobi|Android|iPhone|iPad/i
        .test(navigator.userAgent);
}

// --- Start ---
window.onload = init;
