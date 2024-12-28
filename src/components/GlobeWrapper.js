"use client";

import React, { useEffect, useRef, useState } from "react";
import GlobeGL from "react-globe.gl";
import * as THREE from 'three';
/**
 * GlobeWrapper Component
 * 
 * This component wraps the GlobeGL component from react-globe.gl,
 * forwards refs, and exposes imperative methods to the parent
 * via the `onGlobeLoad` callback.
 * 
 * Props:
 * - onGlobeLoad: Function to receive the globe instance.
 * - initialView: Object containing { lat, lng, altitude } for initial point of view.
 * - ...props: All other props to pass to GlobeGL.
 */
const GlobeWrapper = ({ onGlobeLoad, initialView, cloudOpacity = 0.25, ...props }) => {
  const globeRef = useRef();
  const cloudsRef = useRef();
  const initialViewSet = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showBorders, setShowBorders] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && globeRef.current && initialView && !initialViewSet.current) {
      // Set the initial point of view only once
      globeRef.current.pointOfView(initialView, 1000);
      initialViewSet.current = true;
    }

    // Pass the globe instance back to the parent component
    if (isMounted && globeRef.current && onGlobeLoad) {
      onGlobeLoad(globeRef.current);
    }
  }, [onGlobeLoad, initialView, isMounted]);

  // Add clouds when the globe is mounted
  useEffect(() => {
    if (isMounted && globeRef.current) {
      const CLOUDS_IMG_URL = '/clouds.png';
      const CLOUDS_ALT = 0.004; 
      const CLOUDS_ROTATION_SPEED = -0.006;

      new THREE.TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(globeRef.current.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
          new THREE.MeshPhongMaterial({ 
            map: cloudsTexture, 
            transparent: true,
            opacity: cloudOpacity 
          })
        );
        
        cloudsRef.current = clouds;
        globeRef.current.scene().add(clouds);

        // Rotate clouds
        const rotateClouds = () => {
          if (cloudsRef.current) {
            cloudsRef.current.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
          }
          requestAnimationFrame(rotateClouds);
        };
        rotateClouds();
      });
    }
  }, [isMounted]);

  // Update cloud opacity when it changes
  useEffect(() => {
    if (cloudsRef.current) {
      cloudsRef.current.material.opacity = cloudOpacity;
    }
  }, [cloudOpacity]);

  if (!isMounted) {
    return null; // or a loading placeholder
  }

  return <GlobeGL ref={globeRef} {...props} />;
};

export default GlobeWrapper;
