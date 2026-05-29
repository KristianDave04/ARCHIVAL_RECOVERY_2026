// ============================================
// ARCHIVAL RECOVERY 2026
// FULL MOBILE + DESKTOP FIXED VERSION
// ============================================

// ============================================
// GLOBALS
// ============================================

let scene, camera, renderer, gltfLoader, animationMixer;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();
const clock = new THREE.Clock();

let horrorEntity = null;
let escapeDoor = null;

let gameActive = false;
let isPaused = false;

let collectedFiles = 0;
const totalFilesRequired = 7;

let evidenceFileMeshes = [];

let stamina = 100;
const maxStamina = 100;

let isSprinting = false;
let isExhausted = false;

let isJumping = false;
let verticalVelocity = 0;

const gravityConstant = 32;

let defaultPlayerHeight = 1.7;

let wallBoxes = [];

const playerRadius = 0.45;

const crosshairRaycaster = new THREE.Raycaster();
const screenCenterVector = new THREE.Vector2(0, 0);

let mouseSensitivity = 0.0022;

// ============================================
// DOM
// ============================================

const startScreen =
    document.getElementById("start-screen");

const pauseScreen =
    document.getElementById("pause-screen");

const gameOverScreen =
    document.getElementById("game-over-screen");

const jumpscareOverlay =
    document.getElementById("jumpscare-overlay");

const initializeBtn =
    document.getElementById("initialize-btn");

const newGameBtn =
    document.getElementById("newgame-btn");

const resumeBtn =
    document.getElementById("resume-btn");

const pauseSettingsBtn =
    document.getElementById("pause-settings-btn");

const pauseQuitBtn =
    document.getElementById("pause-quit-btn");

const settingsBtn =
    document.getElementById("settings-btn");

const creditsBtn =
    document.getElementById("credits-btn");

const backBtn =
    document.getElementById("back-btn");

const creditsBackBtn =
    document.getElementById("credits-back-btn");

const settingsScreen =
    document.getElementById("settings-screen");

const creditsScreen =
    document.getElementById("credits-screen");

const filesCountText =
    document.getElementById("files-count");

const keyStatusText =
    document.getElementById("key-status");

const sprintBarFill =
    document.getElementById("sprint-bar-fill");

// ============================================
// MOBILE
// ============================================

const mobileControls =
    document.getElementById("mobile-controls");

const joystickContainer =
    document.getElementById("joystick-container");

const joystick =
    document.getElementById("joystick");

const btnSprint =
    document.getElementById("btn-sprint");

const btnJump =
    document.getElementById("btn-jump");

const btnInteract =
    document.getElementById("btn-interact");

const btnPause =
    document.getElementById("btn-pause");

const isMobile =
    /Android|iPhone|iPad|iPod/i
    .test(navigator.userAgent);

// ============================================
// INIT
// ============================================

function init() {

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x12120b);

    scene.fog =
        new THREE.FogExp2(0x12120b, 0.14);

    camera =
        new THREE.PerspectiveCamera(
            65,
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
        .getElementById("canvas-container")
        .appendChild(renderer.domElement);

    // LIGHTS

    const ambient =
        new THREE.AmbientLight(
            0xffffff,
            0.6
        );

    scene.add(ambient);

    const directional =
        new THREE.DirectionalLight(
            0xffffff,
            0.5
        );

    directional.position.set(5,15,5);

    scene.add(directional);

    // FLASHLIGHT

    const flashlight =
        new THREE.SpotLight(
            0xfff5d1,
            8,
            24,
            Math.PI / 4.5,
            0.5,
            1.3
        );

    flashlight.position.set(0,0,0);

    flashlight.target =
        new THREE.Object3D();

    flashlight.target.position.set(
        0,
        0,
        -1
    );

    camera.add(flashlight);

    camera.add(flashlight.target);

    scene.add(camera);

    // MAP

    buildSectorMap();

    buildThresholdDoor(-8,0,-38);

    spawnProceduralEvidenceFiles();

    // MONSTER

    gltfLoader =
        new THREE.GLTFLoader();

    gltfLoader.load(

        "./monster.glb",

        (gltf) => {

            horrorEntity =
                gltf.scene;

            horrorEntity.position.set(
                0,
                0,
                -30
            );

            horrorEntity.scale.set(
                7,
                7,
                7
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
        },

        null,

        () => {
            spawnProxyMonsterMesh();
        }
    );

    setupDesktopControls();

    setupMobileControls();

    setupMenus();

    mobileControls.style.display =
        "none";

    window.addEventListener(
        "resize",
        handleViewportResize
    );

    animate();
}

// ============================================
// MAP
// ============================================

function buildSectorMap() {

    const floor =
        new THREE.Mesh(

            new THREE.PlaneGeometry(
                120,
                120
            ),

            new THREE.MeshStandardMaterial({
                color:0x423f28
            })
        );

    floor.rotation.x = -Math.PI / 2;

    scene.add(floor);

    const wallMat =
        new THREE.MeshStandardMaterial({
            color:0x736e43
        });

    const blueprint = [

        {w:2,d:20,x:-10,z:-15},
        {w:20,d:2,x:0,z:-25},
        {w:2,d:30,x:12,z:-20},
        {w:15,d:2,x:-5,z:-5},

        {w:100,d:2,x:0,z:50},
        {w:100,d:2,x:0,z:-50},

        {w:2,d:100,x:50,z:0},
        {w:2,d:100,x:-50,z:0}
    ];

    blueprint.forEach(def => {

        const wall =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    def.w,
                    5.5,
                    def.d
                ),

                wallMat
            );

        wall.position.set(
            def.x,
            2.75,
            def.z
        );

        scene.add(wall);

        wallBoxes.push(
            new THREE.Box3()
            .setFromObject(wall)
        );
    });
}

// ============================================
// DOOR
// ============================================

function buildThresholdDoor(x,y,z) {

    escapeDoor =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2,
                3,
                0.2
            ),

            new THREE.MeshStandardMaterial({
                color:0x4a0a0a
            })
        );

    escapeDoor.position.set(
        x,
        1.5,
        z
    );

    scene.add(escapeDoor);
}

// ============================================
// FILES
// ============================================

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

    points.forEach(p => {

        const mesh =
            new THREE.Mesh(

                new THREE.BoxGeometry(
                    0.6,
                    0.3,
                    0.7
                ),

                new THREE.MeshStandardMaterial({
                    color:0xe6dfb8,
                    emissive:0x221e10
                })
            );

        mesh.position.set(
            p.x,
            0.15,
            p.z
        );

        scene.add(mesh);

        evidenceFileMeshes.push(mesh);
    });
}

// ============================================
// PICKUP
// ============================================

function attemptItemPickup() {

    if (!gameActive) return;

    crosshairRaycaster.setFromCamera(
        screenCenterVector,
        camera
    );

    const hits =
        crosshairRaycaster.intersectObjects(
            evidenceFileMeshes
        );

    if (hits.length > 0) {

        const item = hits[0].object;

        if (
            camera.position.distanceTo(
                item.position
            ) <= 3.5
        ) {

            scene.remove(item);

            evidenceFileMeshes.splice(
                evidenceFileMeshes.indexOf(item),
                1
            );

            collectedFiles++;

            filesCountText.innerText =
                collectedFiles +
                "/" +
                totalFilesRequired;

            if (
                collectedFiles >=
                totalFilesRequired
            ) {

                keyStatusText.innerText =
                    "UNLOCKED";
            }
        }
    }
}

// ============================================
// JUMP
// ============================================

function executeJumpLeap() {

    if (isJumping) return;

    if (stamina < 22) return;

    isJumping = true;

    stamina -= 22;

    verticalVelocity = 11.5;
}

// ============================================
// RESET
// ============================================

function resetGameEnvironment() {

    camera.position.set(0,1.7,0);

    camera.rotation.set(0,0,0);

    collectedFiles = 0;

    stamina = maxStamina;

    isJumping = false;

    verticalVelocity = 0;

    defaultPlayerHeight = 1.7;

    filesCountText.innerText =
        "0/" + totalFilesRequired;

    keyStatusText.innerText =
        "LOCKED";

    evidenceFileMeshes.forEach(mesh => {
        scene.remove(mesh);
    });

    evidenceFileMeshes = [];

    spawnProceduralEvidenceFiles();

    if (horrorEntity) {
        horrorEntity.position.set(
            0,
            0,
            -30
        );
    }
}

// ============================================
// START GAME
// ============================================

function startGameplay() {

    startScreen.style.display =
        "none";

    settingsScreen.style.display =
        "none";

    creditsScreen.style.display =
        "none";

    pauseScreen.style.display =
        "none";

    gameOverScreen.style.display =
        "none";

    gameActive = true;

    isPaused = false;

    resetGameEnvironment();

    if (isMobile) {

        mobileControls.style.display =
            "block";

    } else {

        document.body
        .requestPointerLock();
    }
}

// ============================================
// MENUS
// ============================================

function setupMenus() {

    initializeBtn.addEventListener(
        "click",
        startGameplay
    );

    newGameBtn.addEventListener(
        "click",
        startGameplay
    );

    settingsBtn.addEventListener(
        "click",
        () => {

            startScreen.style.display =
                "none";

            settingsScreen.style.display =
                "flex";
        }
    );

    creditsBtn.addEventListener(
        "click",
        () => {

            startScreen.style.display =
                "none";

            creditsScreen.style.display =
                "flex";
        }
    );

    backBtn.addEventListener(
        "click",
        () => {

            settingsScreen.style.display =
                "none";

            startScreen.style.display =
                "flex";
        }
    );

    creditsBackBtn.addEventListener(
        "click",
        () => {

            creditsScreen.style.display =
                "none";

            startScreen.style.display =
                "flex";
        }
    );

    resumeBtn.addEventListener(
        "click",
        () => {

            pauseScreen.style.display =
                "none";

            gameActive = true;

            isPaused = false;

            if (!isMobile) {

                document.body
                .requestPointerLock();
            }
        }
    );

    pauseQuitBtn.addEventListener(
        "click",
        () => {

            gameActive = false;

            isPaused = false;

            pauseScreen.style.display =
                "none";

            startScreen.style.display =
                "flex";

            mobileControls.style.display =
                "none";
        }
    );

    pauseSettingsBtn.addEventListener(
        "click",
        () => {

            pauseScreen.style.display =
                "none";

            settingsScreen.style.display =
                "flex";
        }
    );

    document.addEventListener(
        "keydown",
        (e) => {

            if (e.code === "Escape") {

                if (
                    gameActive &&
                    !isPaused
                ) {

                    gameActive = false;

                    isPaused = true;

                    pauseScreen.style.display =
                        "flex";

                    document.exitPointerLock();
                }
            }
        }
    );
}

// ============================================
// DESKTOP CONTROLS
// ============================================

function setupDesktopControls() {

    document.addEventListener(
        "mousemove",
        (e) => {

            if (!gameActive) return;

            camera.rotation.order =
                "YXZ";

            camera.rotation.y -=
                e.movementX *
                mouseSensitivity;

            camera.rotation.x -=
                e.movementY *
                mouseSensitivity;

            camera.rotation.x =
                Math.max(
                    -Math.PI / 2,
                    Math.min(
                        Math.PI / 2,
                        camera.rotation.x
                    )
                );
        }
    );

    document.addEventListener(
        "keydown",
        (e) => {

            switch(e.code) {

                case "KeyW":
                    moveForward = true;
                    break;

                case "KeyS":
                    moveBackward = true;
                    break;

                case "KeyA":
                    moveLeft = true;
                    break;

                case "KeyD":
                    moveRight = true;
                    break;

                case "ShiftLeft":
                    isSprinting = true;
                    break;

                case "Space":
                    executeJumpLeap();
                    break;

                case "KeyE":
                    attemptItemPickup();
                    break;
            }
        }
    );

    document.addEventListener(
        "keyup",
        (e) => {

            switch(e.code) {

                case "KeyW":
                    moveForward = false;
                    break;

                case "KeyS":
                    moveBackward = false;
                    break;

                case "KeyA":
                    moveLeft = false;
                    break;

                case "KeyD":
                    moveRight = false;
                    break;

                case "ShiftLeft":
                    isSprinting = false;
                    break;
            }
        }
    );
}

// ============================================
// MOBILE CONTROLS
// ============================================

function setupMobileControls() {

    if (!isMobile) return;

    let joystickTouchId = null;

    let lookTouchId = null;

    let centerX = 0;
    let centerY = 0;

    let prevX = 0;
    let prevY = 0;

    const radius = 40;

    joystickContainer.addEventListener(
        "touchstart",
        (e) => {

            const touch =
                e.changedTouches[0];

            joystickTouchId =
                touch.identifier;

            const rect =
                joystickContainer
                .getBoundingClientRect();

            centerX =
                rect.left + rect.width / 2;

            centerY =
                rect.top + rect.height / 2;
        },

        { passive:false }
    );

    window.addEventListener(
        "touchstart",
        (e) => {

            for (const touch of e.changedTouches) {

                if (
                    touch.identifier !==
                    joystickTouchId
                ) {

                    lookTouchId =
                        touch.identifier;

                    prevX = touch.clientX;
                    prevY = touch.clientY;
                }
            }
        },

        { passive:false }
    );

    window.addEventListener(
        "touchmove",
        (e) => {

            for (const touch of e.changedTouches) {

                // JOYSTICK

                if (
                    touch.identifier ===
                    joystickTouchId
                ) {

                    let dx =
                        touch.clientX -
                        centerX;

                    let dy =
                        touch.clientY -
                        centerY;

                    const dist =
                        Math.sqrt(
                            dx*dx + dy*dy
                        );

                    if (dist > radius) {

                        dx =
                            (dx / dist) *
                            radius;

                        dy =
                            (dy / dist) *
                            radius;
                    }

                    joystick.style.transform =
                        `translate(${dx}px,${dy}px)`;

                    moveForward = dy < -10;
                    moveBackward = dy > 10;

                    moveLeft = dx < -10;
                    moveRight = dx > 10;
                }

                // CAMERA

                if (
                    touch.identifier ===
                    lookTouchId
                ) {

                    const dx =
                        touch.clientX -
                        prevX;

                    const dy =
                        touch.clientY -
                        prevY;

                    prevX = touch.clientX;
                    prevY = touch.clientY;

                    camera.rotation.order =
                        "YXZ";

                    camera.rotation.y -=
                        dx * 0.003;

                    camera.rotation.x -=
                        dy * 0.003;

                    camera.rotation.x =
                        Math.max(
                            -Math.PI / 2,
                            Math.min(
                                Math.PI / 2,
                                camera.rotation.x
                            )
                        );
                }
            }
        },

        { passive:false }
    );

    window.addEventListener(
        "touchend",
        (e) => {

            for (const touch of e.changedTouches) {

                if (
                    touch.identifier ===
                    joystickTouchId
                ) {

                    joystickTouchId =
                        null;

                    joystick.style.transform =
                        "translate(0px,0px)";

                    moveForward = false;
                    moveBackward = false;
                    moveLeft = false;
                    moveRight = false;
                }

                if (
                    touch.identifier ===
                    lookTouchId
                ) {

                    lookTouchId = null;
                }
            }
        }
    );

    btnSprint.addEventListener(
        "touchstart",
        () => {
            isSprinting = true;
        }
    );

    btnSprint.addEventListener(
        "touchend",
        () => {
            isSprinting = false;
        }
    );

    btnJump.addEventListener(
        "touchstart",
        () => {
            executeJumpLeap();
        }
    );

    btnInteract.addEventListener(
        "touchstart",
        () => {
            attemptItemPickup();
        }
    );

    btnPause.addEventListener(
        "touchstart",
        () => {

            gameActive = false;

            isPaused = true;

            pauseScreen.style.display =
                "flex";
        }
    );
}

// ============================================
// FALLBACK MONSTER
// ============================================

function spawnProxyMonsterMesh() {

    horrorEntity =
        new THREE.Mesh(

            new THREE.BoxGeometry(
                2,
                4,
                2
            ),

            new THREE.MeshBasicMaterial({
                color:0xff0000
            })
        );

    horrorEntity.position.set(
        0,
        2,
        -30
    );

    scene.add(horrorEntity);
}

// ============================================
// GAME OVER
// ============================================

function triggerAnomalyJumpscare() {

    gameActive = false;

    jumpscareOverlay.style.display =
        "block";

    setTimeout(() => {

        jumpscareOverlay.style.display =
            "none";

        gameOverScreen.style.display =
            "flex";

    }, 1500);
}

// ============================================
// ANIMATE
// ============================================

function animate() {

    requestAnimationFrame(animate);

    const currentTime =
        performance.now();

    const delta =
        (currentTime - prevTime) / 1000;

    if (animationMixer) {

        animationMixer.update(
            clock.getDelta()
        );
    }

    if (gameActive) {

        const speed =
            isSprinting ? 11 : 5.8;

        let forward =
            new THREE.Vector3(0,0,-1)
            .applyQuaternion(
                camera.quaternion
            );

        let right =
            new THREE.Vector3(1,0,0)
            .applyQuaternion(
                camera.quaternion
            );

        forward.y = 0;
        right.y = 0;

        forward.normalize();
        right.normalize();

        const move =
            new THREE.Vector3();

        if (moveForward)
            move.addScaledVector(
                forward,
                speed * delta
            );

        if (moveBackward)
            move.addScaledVector(
                forward,
                -speed * delta
            );

        if (moveLeft)
            move.addScaledVector(
                right,
                -speed * delta
            );

        if (moveRight)
            move.addScaledVector(
                right,
                speed * delta
            );

        camera.position.add(move);

        // JUMP

        if (isJumping) {

            verticalVelocity -=
                gravityConstant * delta;

            defaultPlayerHeight +=
                verticalVelocity * delta;

            if (defaultPlayerHeight <= 1.7) {

                defaultPlayerHeight = 1.7;

                verticalVelocity = 0;

                isJumping = false;
            }
        }

        camera.position.y =
            defaultPlayerHeight;

        // FILE ROTATION

        evidenceFileMeshes.forEach(mesh => {

            mesh.rotation.y +=
                1.5 * delta;
        });

        // DOOR

        if (
            escapeDoor &&
            collectedFiles >=
            totalFilesRequired &&
            camera.position.distanceTo(
                escapeDoor.position
            ) < 2
        ) {

            alert("CASE FILE RESOLVED");

            gameActive = false;
        }

        // MONSTER

        if (horrorEntity) {

            horrorEntity.lookAt(
                camera.position
            );

            horrorEntity.translateZ(
                2 * delta
            );

            const dist =
                horrorEntity.position.distanceTo(
                    camera.position
                );

            if (dist < 3) {

                triggerAnomalyJumpscare();
            }
        }
    }

    prevTime = currentTime;

    renderer.render(scene, camera);
}

// ============================================
// RESIZE
// ============================================

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

// ============================================
// START
// ============================================

window.onload = init;
