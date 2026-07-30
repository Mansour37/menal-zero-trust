"use client";

// Animated dotted wave surface (Three.js) — adapted for Elson:
//  • theme via <html data-theme> (not next-themes)
//  • inline styles (no Tailwind/cn), sized to its PARENT container
//  • brand-tinted dots, pauses when the tab is hidden, capped pixel ratio
// Drop it as an absolute background layer behind hero content (parent: position
// relative + overflow hidden; content above with a higher z-index).

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type DottedSurfaceProps = Omit<React.ComponentProps<"div">, "ref">;

export function DottedSurface({ style, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false); // app default theme is LIGHT (white bg)

  // Live theme (so the dots recolor if the user toggles light/dark).
  // Dark ONLY when explicitly set — otherwise treat as light (matches :root default,
  // so we draw DARK dots on the white landing, never invisible light-on-light).
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SEPARATION = 150;
    const AMOUNTX = 40;
    const AMOUNTY = 60;

    const w = () => container.offsetWidth || window.innerWidth;
    const h = () => container.offsetHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w() / h(), 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for perf
    renderer.setSize(w(), h());
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // DEBUG: bright magenta dots, impossible to miss (revert to teal after).
    const [r, g, b] = [255, 40, 130];
    const positions: number[] = [];
    const colors: number[] = [];
    const geometry = new THREE.BufferGeometry();
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        positions.push(
          ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
        );
        colors.push(r, g, b);
      }
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 18, vertexColors: true, transparent: true,
      opacity: 1, sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;
    let running = true;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!running) return;
      const pos = geometry.attributes.position.array as Float32Array;
      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          pos[i * 3 + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
          i++;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.1;
    };

    const resize = () => {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Pause when the tab is hidden (battery/CPU friendly).
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", ...style }}
      {...props}
    />
  );
}

export default DottedSurface;
