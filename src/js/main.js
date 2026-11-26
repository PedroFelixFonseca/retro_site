import { gsap } from "gsap";
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Lumières
scene.add(new THREE.AmbientLight(0xffffff, 4));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 0, 7);
scene.add(light);

// Réglages de rotation
const MAX_ROT_Y = THREE.MathUtils.degToRad(40);
const MAX_ROT_X = THREE.MathUtils.degToRad(10);
const SMOOTHING = 0.01;

const pivot = new THREE.Group();
scene.add(pivot);

/* ---------- Zones interactives (noms du .glb) ----------
 * mode 'each'  : un target par objet (chaque touche)
 * mode 'group' : un seul target pour tous les meshes qui matchent
 * root         : noeud à animer pour un groupe                         */
const RULES = [
  { type: 'key',      test: /^Mac_Touche_R\d+_C\d+$/,                   mode: 'each' },
  { type: 'keyboard', test: /^Mac_Clavier_Base$/,                       mode: 'group', root: 'Mac_Clavier' },
  { type: 'power',    test: /^Mac_Moniteur_Voyant$/,                    mode: 'each' },
  { type: 'button',   test: /^Mac_Bouton_0[1-6]$/,                      mode: 'each' },
  { type: 'monitor',  test: /^Mac_Moniteur_(Coque|Verre|Base|Plaque)$/, mode: 'group', root: 'Mac_Moniteur' },
  { type: 'tower',    test: /^Mac_Tour_(Boitier|Detail|Lecteur)$/,      mode: 'group', root: 'Mac_Tour' },
];

/* ---------- Tes animations ----------
 * Handlers : enter, leave, down, up, click
 * Reçoivent : { type, root, base:{x,y,z}, data, meshes }                  */
const actions = {
  key: {
    down: (t) => gsap.to(t.root.position, { y: t.base.y - t.data.travel, duration: 0.06, overwrite: true }),
    up:   (t) => gsap.to(t.root.position, { y: t.base.y, duration: 0.35, ease: 'elastic.out(1, 0.5)', overwrite: true }),
  },
  power:   { click: () => console.log('power') },
  monitor: { click: () => console.log('monitor') },
  tower:   { click: () => console.log('tower') },
};

/* ---------- Construction des targets (une seule fois) ---------- */
const meshToTarget = new Map();
const hitList = [];            // seuls les meshes interactifs sont testés au raycast
const _size = new THREE.Vector3();

function buildTargets(model) {
  const groups = {};
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let n = mesh; n; n = n.parent) {
      const rule = RULES.find((r) => r.test.test(n.name));
      if (!rule) continue;

      let t = rule.mode === 'group' ? groups[rule.type] : null;
      if (!t) {
        const root = rule.mode === 'group' ? model.getObjectByName(rule.root) : n;
        t = { type: rule.type, root, base: root.position.clone(), data: {}, meshes: [] };
        if (rule.mode === 'group') groups[rule.type] = t;
        if (rule.type === 'key') {
          mesh.geometry.computeBoundingBox();
          t.data.travel = mesh.geometry.boundingBox.getSize(_size).y * 0.35;
          t.data.name = n.name;
        }
      }
      t.meshes.push(mesh);
      meshToTarget.set(mesh, t);
      hitList.push(mesh);
      break;
    }
  });
}

/* ---------- Chargement ---------- */
let retroModel;
new GLTFLoader().load(
  new URL('../assets/mac_racine_2.glb', import.meta.url).href,
  ({ scene: model }) => {
    retroModel = model;
    model.rotation.set(0, THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(8));

    buildTargets(model); // avant toute animation (mémorise les positions d'origine)

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    pivot.add(model);
    camera.position.set(0, 0, Math.max(size.x, size.y, size.z, 1) * 2.5);
    camera.lookAt(-1, 0, 0);
  },
  undefined,
  (error) => console.error('Could not load mac_racine_2.glb:', error)
);

// pointeur

const mouse = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let moved = false, hovered = null, pressed = null;

function pick() {
  if (!retroModel) return null;
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(hitList, false)[0];
  return hit ? meshToTarget.get(hit.object) : null;
}
const emit = (name, t) => t && actions[t.type]?.[name]?.(t);

function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  setNdc(e);
  moved = true;
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  setNdc(e);
  pressed = pick();
  emit('down', pressed);
});

window.addEventListener('pointerup', (e) => {
  if (!pressed) return;
  setNdc(e);
  emit('up', pressed);
  if (pick() === pressed) emit('click', pressed);
  pressed = null;
});

// boucle
function animate() {
  requestAnimationFrame(animate);

  pivot.rotation.y += (THREE.MathUtils.clamp(mouse.x * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y) - pivot.rotation.y) * SMOOTHING;
  pivot.rotation.x += (THREE.MathUtils.clamp(mouse.y * MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X) - pivot.rotation.x) * SMOOTHING;

  // Survol : seulement si la souris a bougé ou si le modèle bouge (pivot)
  if (moved || Math.abs(mouse.x * MAX_ROT_Y - pivot.rotation.y) > 1e-3) {
    moved = false;
    const t = pick();
    if (t !== hovered) {
      emit('leave', hovered);
      hovered = t;
      emit('enter', hovered);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
    }
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
