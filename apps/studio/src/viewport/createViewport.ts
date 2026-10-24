import * as THREE from "three";

// Task 01 fixture only. This is not an entity or AI-generated asset.
export const FIXTURE_COLOR = "#985731";

export function createViewport(container: HTMLDivElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute(
    "aria-label",
    "Development fixture: a green cube on a ground grid",
  );
  renderer.domElement.setAttribute("role", "img");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e5e8df");
  scene.fog = new THREE.Fog("#e5e8df", 22, 48);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(12, 11, 14);
  camera.lookAt(0, 0.4, 0);

  const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: FIXTURE_COLOR,
    roughness: 1,
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.y = 1.5;
  scene.add(cube);

  const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: "#66744f",
    transparent: true,
    opacity: 0.35,
  });
  cube.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
  const grid = new THREE.GridHelper(100, 100, "#aab3a0", "#cbd1c5");
  scene.add(grid);
  scene.add(new THREE.HemisphereLight("#ffffff", "#7b886c", 2.6));
  const sun = new THREE.DirectionalLight("#fff8e5", 3);
  sun.position.set(-5, 12, 6);
  scene.add(sun);

  function resizeViewport() {
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resizeViewport);
  observer.observe(container);
  resizeViewport();

  // No animation loop is needed for a static scaffold. StrictMode/HMR can safely remount it.
  return function disposeViewport() {
    observer.disconnect();
    cubeGeometry.dispose();
    cubeMaterial.dispose();
    edgeGeometry.dispose();
    edgeMaterial.dispose();
    grid.geometry.dispose();
    const materials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
