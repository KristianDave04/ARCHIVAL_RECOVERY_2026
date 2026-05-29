// --- Core System Global State References ---
let scene, camera, renderer, gltfLoader, animationMixer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
const clock = new THREE.Clock();

let horrorEntity = null;
let gameActive = false;
let isPaused = false; 
let escapeDoor = null;

// Audio Stream Context Architecture
let audioCtx = null;
let monsterTrackBuffer = null;
let monsterAudioSource = null;
let monsterGainNode = null;
let breathingInterval = null;

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

// Dom Element Target Map Pointers
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const initializeBtn = document.getElementById('initialize-btn');
const retryBtn = document.getElementById('retry-btn');
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

let hasStartedGame = false;
let mouseSensitivity = 0.0022;

// Dread Quotes Bank Array
const horrorQuotes = [
    "This is not over...",
    "Sen. Bato is getting away again, do it and collect some evidence.",
    "The tape cannot be stopped.",
    "You are running out of warehouse rooms.",
    "It watches through the lens.",
    "You are bound to the tracking cycle."
];

// --- Event Handlers & Interface Directives ---
initializeBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';
    initAudioEngine();
    startBreathingEngine();
    hasStartedGame = true;
    document.body.requestPointerLock();
    gameActive = true;
});

// --- Pointer Lock Handler Handshaking ---
document.addEventListener('pointerlockchange', () => {
    if (gameOverScreen.style.display === 'flex' || jumpscareOverlay.style.display === 'block') {
        return; 
    }
    gameActive = (document.pointerLockElement === document.body);
    if (!gameActive && !isPaused) {
        startScreen.style.display = 'flex';
        if (monsterGainNode && audioCtx) {
            monsterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        }
    }
});

// --- Audio Generation Pipelines ---
function initAudioEngine() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    monsterGainNode = audioCtx.createGain();
    monsterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    monsterGainNode.connect(audioCtx.destination);

    fetch('./monster_ambient.mp3')
        .then(response => { if (!response.ok) throw new Error(); return response.arrayBuffer(); })
        .then(data => audioCtx.decodeAudioData(data))
        .then(buffer => {
            monsterTrackBuffer = buffer;
            startMonsterAmbientLoop();
        })
        .catch(err => console.error("Audio failed:", err));
}

function startMonsterAmbientLoop() {
    if (!audioCtx || !monsterTrackBuffer) return;
    if (monsterAudioSource) {
        try { monsterAudioSource.stop(); } catch(e) {}
        monsterAudioSource.disconnect();
    }
    monsterAudioSource = audioCtx.createBufferSource();
    monsterAudioSource.buffer = monsterTrackBuffer;
    monsterAudioSource.loop = true;
    monsterAudioSource.connect(monsterGainNode);
    monsterAudioSource.start(0);
}

function startBreathingEngine() {
    if (breathingInterval) clearInterval(breathingInterval);
    breathingInterval = setInterval(() => {
        if (!gameActive) return;
        let panicIntensity = (stamina < 35) ? 0.15 : (isSprinting && (moveForward || moveBackward || moveLeft || moveRight) ? 0.06 : 0.01);
        if (stamina < 75 || isSprinting) playProceduralBreathSigh(panicIntensity);
    }, 1200);
}

function playProceduralBreathSigh(volume) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const bufferSize = audioCtx.sampleRate * 0.4;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    const filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(stamina < 35 ? 450 : 300, audioCtx.currentTime);

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    noiseNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseNode.start();
}

// --- Engine Init Bootup Sequencing ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12120b);
    scene.fog = new THREE.FogExp2(0x12120b, 0.14);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, defaultPlayerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const ambientFloorLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientFloorLight);

    const directionalSun = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalSun.position.set(5, 15, 5);
    scene.add(directionalSun);

    const flashlightNode = new THREE.SpotLight(0xfff5d1, 8, 24, Math.PI / 4.5, 0.5, 1.3);
    flashlightNode.position.set(0, 0, 0);
    camera.add(flashlightNode);
    
    flashlightNode.target = new THREE.Object3D();
    camera.add(flashlightNode.target);
    flashlightNode.target.position.set(0, 0, -1);
    scene.add(camera);

    buildSectorMap();
    buildThresholdDoor(-8, 0, -38);
    spawnProceduralEvidenceFiles();

    gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(
        './monster.glb',
        (gltf) => {
            horrorEntity = gltf.scene;
            horrorEntity.position.set(0, 0, -30);
            horrorEntity.scale.set(7.5, 7.5, 7.5);
            horrorEntity.traverse((child) => {
                if (child.isMesh) {
                    child.material.needsUpdate = true;
                    if(child.material.map) child.material.map.encoding = THREE.sRGBEncoding;
                }
            });
            if (gltf.animations && gltf.animations.length > 0) {
                animationMixer = new THREE.AnimationMixer(horrorEntity);
                animationMixer.clipAction(gltf.animations[0]).play();
            }
            scene.add(horrorEntity);
        },
        null,
        () => { spawnProxyMonsterMesh(); }
    );

    setupControlBindings();
    window.addEventListener('resize', handleViewportResize);
    animate();
}

function spawnProxyMonsterMesh() {
    const proxyGeo = new THREE.BoxGeometry(2.0, 4.0, 2.0);
    const proxyMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    horrorEntity = new THREE.Mesh(proxyGeo, proxyMat);
    horrorEntity.position.set(0, 2.0, -30);
    scene.add(horrorEntity);
}

function buildSectorMap() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x423f28, roughness: 1.0 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x4f4f42, roughness: 0.7 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 5.5; scene.add(ceiling);

    const partitionMat = new THREE.MeshStandardMaterial({ color: 0x736e43, roughness: 0.9 });
    const blueprint = [
        {w: 2, d: 20, x: -10, z: -15}, {w: 20, d: 2, x: 0, z: -25},
        {w: 2, d: 30, x: 12, z: -20},  {w: 15, d: 2, x: -5, z: -5},
        {w: 2, d: 15, x: 0, z: -40},   {w: 40, d: 2, x: -10, z: -45},
        {w: 16, d: 2, x: 25, z: -10},  {w: 2, d: 20, x: -25, z: -5},
        {w: 100, d: 2, x: 0, z: 50},   {w: 100, d: 2, x: 0, z: -50},
        {w: 2, d: 100, x: 50, z: 0},   {w: 2, d: 100, x: -50, z: 0}
    ];
    blueprint.forEach(wallDef => {
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(wallDef.w, 5.5, wallDef.d), partitionMat);
        wallMesh.position.set(wallDef.x, 2.75, wallDef.z); scene.add(wallMesh);
        wallBoxes.push(new THREE.Box3().setFromObject(wallMesh));
    });
}

function buildThresholdDoor(x, y, z) {
    escapeDoor = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 0.25), frameMat); postL.position.set(-1.1, 1.7, 0);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 0.25), frameMat); postR.position.set(1.1, 1.7, 0);
    escapeDoor.add(postL, postR);
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a0a0a, roughness: 0.8 }));
    doorPanel.position.set(0, 1.65, 0); escapeDoor.add(doorPanel);
    escapeDoor.position.set(x, y, z); scene.add(escapeDoor);
}

function spawnProceduralEvidenceFiles() {
    const possibleSpawnPoints = [{x: 32, z: 38}, {x: -38, z: 18}, {x: 22, z: -32}, {x: -42, z: -18}, {x: -18, z: -35}, {x: 5, z: 25}, {x: 18, z: 12}, {x: -28, z: 42}, {x: 40, z: -10}];
    possibleSpawnPoints.sort(() => Math.random() - 0.5);
    for (let i = 0; i < totalFilesRequired; i++) {
        const spawnPt = possibleSpawnPoints[i];
        const folderGroup = new THREE.Group();
        const backingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.7), new THREE.MeshStandardMaterial({ color: 0xe6dfb8, roughness: 0.9, emissive: 0x221e10 }));
        folderGroup.add(backingMesh); folderGroup.position.set(spawnPt.x, 0.15, spawnPt.z);
        scene.add(folderGroup); evidenceFileMeshes.push(folderGroup);
    }
}

function attemptItemPickup() {
    if (!gameActive) return;
    crosshairRaycaster.setFromCamera(screenCenterVector, camera);
    const hits = crosshairRaycaster.intersectObjects(evidenceFileMeshes, true);
    if (hits.length > 0) {
        let struckObject = hits[0].object;
        while (struckObject.parent && struckObject.parent !== scene) struckObject = struckObject.parent;
        if (camera.position.distanceTo(struckObject.position) <= 3.5) {
            const indexRegistryId = evidenceFileMeshes.indexOf(struckObject);
            if (indexRegistryId !== -1) {
                scene.remove(struckObject); evidenceFileMeshes.splice(indexRegistryId, 1);
                collectedFiles++;
                filesCountText.innerText = collectedFiles + "/" + totalFilesRequired;
                if (collectedFiles === totalFilesRequired) {
                    filesCountText.className = "success-txt"; keyStatusText.innerText = "UNLOCKED"; keyStatusText.className = "success-txt";
                }
            }
        }
    }
}

function executeJumpLeap() {
    if (isJumping || stamina < 22) return;
    isJumping = true; stamina -= 22; verticalVelocity = 11.5; 
}

function setupControlBindings() {
    document.addEventListener('mousemove', (e) => {
        if (!gameActive) return;
        camera.rotation.y -= e.movementX * mouseSensitivity; camera.rotation.x -= e.movementY * mouseSensitivity;
        camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));
    });
    camera.rotation.order = "YXZ";
    document.addEventListener('mousedown', (e) => { if (gameActive && e.button === 0) attemptItemPickup(); });
    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': moveForward = true; break; case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break; case 'KeyD': moveRight = true; break;
            case 'Space': executeJumpLeap(); break; case 'KeyE': attemptItemPickup(); break; 
            case 'ShiftLeft': case 'ShiftRight': if (!isExhausted) isSprinting = true; break;
        }
    });
    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveForward = false; break; case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break; case 'KeyD': moveRight = false; break;
            case 'ShiftLeft': case 'ShiftRight': isSprinting = false; break;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();
    const frameDelta = (currentTime - prevTime) / 1000;

    if (animationMixer) animationMixer.update(clock.getDelta());

    if (gameActive) {
        const userIsMoving = (moveForward || moveBackward || moveLeft || moveRight);
        if (isSprinting && userIsMoving && !isJumping) {
            stamina -= 18.5 * frameDelta; 
            if (stamina <= 0) { stamina = 0; isSprinting = false; isExhausted = true; sprintBarFill.classList.add('exhausted'); }
        } else {
            stamina += (userIsMoving ? 7.5 : 14.0) * frameDelta;
            if (stamina > maxStamina) stamina = maxStamina;
            if (isExhausted && stamina >= 30) { isExhausted = false; sprintBarFill.classList.remove('exhausted'); }
        }
        sprintBarFill.style.width = ((stamina / maxStamina) * 100) + "%";

        let sprintModifier = isSprinting ? 11.5 : 5.8;
        if (isJumping && isSprinting) sprintModifier = 14.2; 

        let forwardHeading = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let sideHeading = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        forwardHeading.y = 0; sideHeading.y = 0; forwardHeading.normalize(); sideHeading.normalize();

        let displacement = new THREE.Vector3();
        if (moveForward)  displacement.addScaledVector(forwardHeading, sprintModifier * frameDelta);
        if (moveBackward) displacement.addScaledVector(forwardHeading, -sprintModifier * frameDelta);
        if (moveRight)    displacement.addScaledVector(sideHeading, sprintModifier * frameDelta);
        if (moveLeft)     displacement.addScaledVector(sideHeading, -sprintModifier * frameDelta);

        let currentX = camera.position.x; camera.position.x += displacement.x;
        for (let i = 0; i < wallBoxes.length; i++) {
            if (wallBoxes[i].containsPoint(new THREE.Vector3(camera.position.x + Math.sign(displacement.x) * playerRadius, camera.position.y, camera.position.z))) { camera.position.x = currentX; break; }
        }
        let currentZ = camera.position.z; camera.position.z += displacement.z;
        for (let i = 0; i < wallBoxes.length; i++) {
            if (wallBoxes[i].containsPoint(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z + Math.sign(displacement.z) * playerRadius))) { camera.position.z = currentZ; break; }
        }

        if (isJumping) {
            verticalVelocity -= gravityConstant * frameDelta; defaultPlayerHeight += verticalVelocity * frameDelta;
            if (defaultPlayerHeight <= 1.7) { defaultPlayerHeight = 1.7; verticalVelocity = 0; isJumping = false; }
        }
        camera.position.y = (!isJumping && userIsMoving) ? (defaultPlayerHeight + Math.sin(currentTime * (isSprinting ? 0.013 : 0.008)) * (isSprinting ? 0.065 : 0.03)) : defaultPlayerHeight;

        evidenceFileMeshes.forEach(itemMesh => { itemMesh.rotation.y += 1.2 * frameDelta; });

        if (escapeDoor && camera.position.distanceTo(escapeDoor.position) < 2.2 && collectedFiles >= totalFilesRequired) {
            gameActive = false; document.exitPointerLock();
            document.body.innerHTML = "<div style='color:#00ff00; font-family:monospace; padding:80px; text-align:center;'><h1>CASE FILE RESOLVED</h1><p>All lost data successfully locked down.</p></div>";
            return;
        }

        if (horrorEntity) {
            let distanceToTarget = horrorEntity.position.distanceTo(camera.position);
            horrorEntity.lookAt(new THREE.Vector3(camera.position.x, horrorEntity.position.y, camera.position.z));
            horrorEntity.translateZ((1.9 + (collectedFiles * 0.45)) * frameDelta);

            if (monsterGainNode && audioCtx && audioCtx.state !== 'suspended') {
                let targetVolume = (distanceToTarget < 28.0) ? Math.pow(1.0 - (distanceToTarget / 28.0), 2) * 0.85 : 0;
                monsterGainNode.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 0.1);
            }
            if (distanceToTarget < 3.4) triggerAnomalyJumpscare();
        }
    }
    prevTime = currentTime;
    renderer.render(scene, camera);
}

// New Automated Loops & Layout Controls
function triggerAnomalyJumpscare() {
    gameActive = false;
    document.exitPointerLock();
    if (monsterGainNode && audioCtx) monsterGainNode.gain.setValueAtTime(0, audioCtx.currentTime); 
    
    jumpscareOverlay.style.display = "block";

    setTimeout(() => {
        jumpscareOverlay.style.display = "none";
        renderStaticGameOverScreen();
    }, 1500);
}

function renderStaticGameOverScreen() {
    // Select a completely random horror message from the array bank
    const pickedPhrase = horrorQuotes[Math.floor(Math.random() * horrorQuotes.length)];
    
    // Set the text and make sure "GET UP." is completely hidden initially
    horrorQuoteText.textContent = pickedPhrase;
    horrorQuoteText.style.display = "block";
    getUpText.style.display = "none";
    getUpText.classList.remove('reveal'); // Clear old CSS transitions if any remain

    // Instant hard cut to the game over screen
    gameOverScreen.style.display = "flex";

    // Step 1: Wait 2 seconds, then remove the quote and snap "GET UP." on screen with a hard cut
    setTimeout(() => {
        horrorQuoteText.style.display = "none";
        getUpText.style.display = "block";
        getUpText.classList.add('reveal'); // Keeps the text styled and fully visible

        // Step 2: Leave "GET UP." on screen for 1.5 seconds, then instantly cut back to the game
        setTimeout(() => {
            gameOverScreen.style.display = 'none';
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            
            resetGameEnvironment();
            document.body.requestPointerLock();
        }, 1500);

    }, 2000);
}

function resetGameEnvironment() {
    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    collectedFiles = 0;
    stamina = maxStamina;
    isExhausted = false; isJumping = false; verticalVelocity = 0; defaultPlayerHeight = 1.7;
    sprintBarFill.classList.remove('exhausted');

    filesCountText.innerText = "0/" + totalFilesRequired;
    filesCountText.className = "alert-txt";
    keyStatusText.innerText = "LOCKED";
    keyStatusText.className = "danger-txt";

    evidenceFileMeshes.forEach(mesh => scene.remove(mesh));
    evidenceFileMeshes = [];
    spawnProceduralEvidenceFiles();

    if (horrorEntity) horrorEntity.position.set(0, 0, -30);
    startMonsterAmbientLoop();
    gameActive = true;
}

function handleViewportResize() {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Menu Bindings ---
document.getElementById('settings-btn').addEventListener('click', () => { startScreen.style.display = 'none'; document.getElementById('settings-screen').style.display = 'flex'; });
document.getElementById('credits-btn').addEventListener('click', () => { startScreen.style.display = 'none'; document.getElementById('credits-screen').style.display = 'flex'; });
document.getElementById('back-btn').addEventListener('click', () => { document.getElementById('settings-screen').style.display = 'none'; startScreen.style.display = 'flex'; });
document.getElementById('credits-back-btn').addEventListener('click', () => { document.getElementById('credits-screen').style.display = 'none'; startScreen.style.display = 'flex'; });
document.getElementById('quit-btn').addEventListener('click', () => { window.close(); });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        e.preventDefault(); 
        if (gameActive && !isPaused) {
            gameActive = false; isPaused = true; document.exitPointerLock();
            startScreen.style.display = 'none'; pauseScreen.style.display = 'flex';
            if (monsterGainNode && audioCtx) monsterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        } else if (pauseScreen.style.display === 'flex') {
            closePauseMenu();
        }
    }
});

function closePauseMenu() { pauseScreen.style.display = 'none'; isPaused = false; document.body.requestPointerLock(); gameActive = true; }
resumeBtn.addEventListener('click', () => { closePauseMenu(); });
pauseSettingsBtn.addEventListener('click', () => { pauseScreen.style.display = 'none'; document.getElementById('settings-screen').style.display = 'flex'; });
pauseQuitBtn.addEventListener('click', () => { pauseScreen.style.display = 'none'; isPaused = false; gameActive = false; startScreen.style.display = 'flex'; });

const audioSlider = document.getElementById('audio-volume');
const graphicsSlider = document.getElementById('graphics-quality');
const sensitivitySlider = document.getElementById('mouse-sensitivity');

audioSlider.addEventListener('input', () => { if (monsterGainNode && audioCtx) monsterGainNode.gain.setValueAtTime(audioSlider.value / 100, audioCtx.currentTime); });
graphicsSlider.addEventListener('input', () => { renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphicsSlider.value / 3)); });
sensitivitySlider.addEventListener('input', () => { mouseSensitivity = sensitivitySlider.value * 0.0005; });

document.getElementById('newgame-btn').addEventListener('click', () => {
    startScreen.style.display = 'none'; cutsceneScreen.style.display = 'flex'; cutsceneVideo.currentTime = 0;
    initAudioEngine();
    cutsceneVideo.play().catch(err => console.log(err));
});

skipCutsceneBtn.addEventListener('click', () => { cutsceneVideo.pause(); cutsceneScreen.style.display = 'none'; startGameplay(); });
cutsceneVideo.addEventListener('ended', () => { cutsceneScreen.style.display = 'none'; startGameplay(); });
function startGameplay() { hasStartedGame = true; document.body.requestPointerLock(); resetGameEnvironment(); }

let mobileLookSensitivity = 0.0015;

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

window.addEventListener('load', () => {
  if (isMobileDevice()) {
    document.getElementById('mobile-controls').style.display = 'block';
    setupMobileControls();
    setupMobileCamera();
  }
});

function setupMobileControls() {
  const joystick = document.getElementById('joystick');
  const container = document.getElementById('joystick-container');
  const center = { x: container.offsetWidth / 2, y: container.offsetHeight / 2 };
  let active = false;

  container.addEventListener('touchstart', (e) => {
    active = true;
    handleJoystick(e.touches[0]);
  });
  container.addEventListener('touchmove', (e) => {
    if (active) handleJoystick(e.touches[0]);
  });
  container.addEventListener('touchend', () => {
    active = false;
    joystick.style.left = center.x - joystick.offsetWidth / 2 + 'px';
    joystick.style.top = center.y - joystick.offsetHeight / 2 + 'px';
    moveForward = moveBackward = moveLeft = moveRight = false;
  });

  function handleJoystick(touch) {
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const dx = x - center.x;
    const dy = y - center.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = container.offsetWidth / 2;
    const angle = Math.atan2(dy, dx);
    const limitedDist = Math.min(dist, maxDist - joystick.offsetWidth/2);

    joystick.style.left = center.x + Math.cos(angle) * limitedDist - joystick.offsetWidth/2 + 'px';
    joystick.style.top = center.y + Math.sin(angle) * limitedDist - joystick.offsetHeight/2 + 'px';

    moveForward = dy < -20;
    moveBackward = dy > 20;
    moveLeft = dx < -20;
    moveRight = dx > 20;
  }

  // Jump
  document.getElementById('btn-jump').addEventListener('touchstart', () => executeJumpLeap());
  // Sprint
  document.getElementById('btn-sprint').addEventListener('touchstart', () => { if (!isExhausted) isSprinting = true; });
  document.getElementById('btn-sprint').addEventListener('touchend', () => isSprinting = false);
  // Interact
  document.getElementById('btn-interact').addEventListener('touchstart', () => attemptItemPickup());
  // Pause
  document.getElementById('btn-pause').addEventListener('touchstart', () => {
    gameActive = false;
    pauseActive = true;
    document.exitPointerLock();
    pauseScreen.style.display = 'flex';
    startScreen.style.display = 'none';
    document.getElementById('mobile-hud').style.display = 'none'; // hide HUD in menu
  });
}

function setupMobileCamera() {
  let lastX = null, lastY = null;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && lastX !== null) {
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      camera.rotation.y -= dx * mobileLookSensitivity;
      camera.rotation.x -= dy * mobileLookSensitivity;
      camera.rotation.x = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, camera.rotation.x));
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  });
  document.addEventListener('touchend', () => { lastX = null; lastY = null; });
}

// Update HUD only during gameplay
function updateMobileHUD() {
  if (!gameActive || pauseActive) {
    document.getElementById('mobile-hud').style.display = 'none';
    return;
  }
  document.getElementById('mobile-hud').style.display = 'block';
  document.getElementById('mobile-files-count').innerText = collectedFiles + "/" + totalFilesRequired;
  document.getElementById('mobile-key-status').innerText = (collectedFiles === totalFilesRequired) ? "UNLOCKED" : "LOCKED";
  document.getElementById('mobile-sprint-bar-fill').style.width = (stamina / maxStamina) * 100 + "%";
  document.getElementById('mobile-quest-text').textContent = quests[currentQuestIndex];
}

window.onload = init;
