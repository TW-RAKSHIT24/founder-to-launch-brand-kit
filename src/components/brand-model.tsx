'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type BrandModelProps = {
  colors: readonly string[];
  label: string;
  compact?: boolean;
};

export function BrandModel({ colors, label, compact = false }: BrandModelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paletteKey = colors.join('-');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const palette = colors.map((color) => new THREE.Color(color));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.3, 6.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8fff4, 0x23414a, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(palette[1] ?? 0x5ac5b5, 2.4);
    rimLight.position.set(4, -2, -3);
    scene.add(rimLight);

    const model = new THREE.Group();
    scene.add(model);

    const nodes = [
      new THREE.Vector3(-1.48, 0.7, 0),
      new THREE.Vector3(1.48, 0.7, 0),
      new THREE.Vector3(0, -1.12, 0),
    ];

    const wireMaterial = new THREE.LineBasicMaterial({ color: 0xe0f3e9, transparent: true, opacity: 0.72 });
    const outlinePoints = [...nodes, nodes[0]];
    model.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), wireMaterial));

    const ringPoints: THREE.Vector3[] = [];
    for (let index = 0; index <= 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.cos(angle) * 2.13, Math.sin(angle) * 1.55, -0.18));
    }
    model.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: palette[1] ?? 0x5ac5b5, transparent: true, opacity: 0.4 })));

    nodes.forEach((position, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: palette[index] ?? 0xffffff,
        roughness: 0.3,
        metalness: 0.36,
        emissive: palette[index] ?? 0x000000,
        emissiveIntensity: 0.12,
      });
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.68, 0.46), material);
      block.position.copy(position);
      block.rotation.set(index * 0.13, index * 0.28, index === 2 ? 0.13 : -0.11);
      block.userData.baseY = position.y;
      block.userData.phase = index * 1.8;
      model.add(block);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(block.geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
      );
      block.add(edges);

      const anchor = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: 0xf2ffe8 }),
      );
      anchor.position.copy(position);
      anchor.position.z = -0.1;
      model.add(anchor);
    });

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.49, 0),
      new THREE.MeshStandardMaterial({ color: 0xf3f1d7, roughness: 0.22, metalness: 0.22, emissive: 0x6cae9a, emissiveIntensity: 0.38 }),
    );
    core.position.set(0, 0.08, 0.12);
    core.rotation.set(0.24, 0.2, Math.PI / 4);
    model.add(core);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const bounds = entries[0]?.contentRect;
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;
      camera.aspect = bounds.width / bounds.height;
      camera.position.z = bounds.width < 420 ? 7.1 : compact ? 6.8 : 6.4;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(host);

    const animate = (time: number): void => {
      model.rotation.y = Math.sin(time * 0.00018) * 0.24 + pointerX * 0.18;
      model.rotation.x = Math.cos(time * 0.00017) * 0.08 + pointerY * 0.1;
      model.children.forEach((child) => {
        if (child instanceof THREE.Mesh && typeof child.userData.baseY === 'number') {
          child.position.y = child.userData.baseY + Math.sin(time * 0.0011 + child.userData.phase) * 0.07;
        }
      });
      renderer.render(scene, camera);
      if (!prefersReducedMotion) animationFrame = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      const bounds = host.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      if (prefersReducedMotion) animate(performance.now());
    };

    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', handlePointerMove);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [colors, compact, paletteKey]);

  return (
    <div className={`brand-model${compact ? ' brand-model-compact' : ''}`} role="img" aria-label={`${label} three-dimensional brand model with colors ${colors.join(', ')}`}>
      <div className="brand-model-canvas" ref={hostRef} />
      <div className="model-caption" aria-hidden="true">
        <span>IDENTITY / 3D</span>
        <span>{label}</span>
      </div>
      <div className="model-color-key" aria-hidden="true">
        {colors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
      </div>
    </div>
  );
}