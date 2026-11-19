import { gsap } from "gsap";

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Position de la souris normalisée
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
});

// Lumières
scene.add(new THREE.AmbientLight(0xffffff, 4));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 0, 7);
scene.add(light);


//Réglages de rotation 
const MAX_ROT_Y = THREE.MathUtils.degToRad(40); // gauche / droite
const MAX_ROT_X = THREE.MathUtils.degToRad(10); // haut / bas
const SMOOTHING = 0.01;                          // 0.01 = lent, 1 = instantané

// pour que la rotation se fasse autour du centre de l'objet.
const pivot = new THREE.Group();
scene.add(pivot);

let retroModel;
const loader = new GLTFLoader();
loader.load(
  new URL('../assets/Retro_blender.glb', import.meta.url).href,
  ({ scene: model }) => {
    retroModel = model;
    // rotation initiale de l'objet
      model.rotation.set(
    THREE.MathUtils.degToRad(0),   // x
    THREE.MathUtils.degToRad(90), // y
    THREE.MathUtils.degToRad(8)    // z
    );
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    model.position.sub(center); // centre le modèle dans le pivot
    pivot.add(model);
    camera.position.set(0, 0, Math.max(maxDimension, 1) * 2.5);
    camera.lookAt(-1, 0, 0);
  },
  undefined,
  (error) => console.error('Could not load Retro_blender.glb:', error)
);

function animate() {
  requestAnimationFrame(animate);

  // Rotation cible, limitée par les maximums
  const targetY = THREE.MathUtils.clamp(mouse.x * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y);
  const targetX = THREE.MathUtils.clamp(mouse.y * MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X);

  // Interpolation douce vers la cible
  pivot.rotation.y += (targetY - pivot.rotation.y) * SMOOTHING;
  pivot.rotation.x += (targetX - pivot.rotation.x) * SMOOTHING;

  renderer.render(scene, camera);
}
animate();

// Redimensionnement de la fenêtre
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("click", (event) => {
  if (!retroModel) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  if (!raycaster.intersectObject(retroModel, true).length) return;

  gsap.to(retroModel.rotation, {
    y: retroModel.rotation.y + Math.PI * 4,
    duration: 1.2,
    ease: "power2.inOut",
    overwrite: true,
  });
});