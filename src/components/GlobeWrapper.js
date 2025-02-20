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
  const [cloudsLoaded, setCloudsLoaded] = useState(false);
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

    // Only pass the globe instance back after clouds are loaded
    if (isMounted && globeRef.current && onGlobeLoad && cloudsLoaded) {
      onGlobeLoad(globeRef.current);
    }
  }, [onGlobeLoad, initialView, isMounted, cloudsLoaded]);

  // Add clouds when the globe is mounted
  useEffect(() => {
    if (isMounted && globeRef.current) {
      const CLOUDS_IMG_URL = '/clouds.png';
      const CLOUDS_ALT = 0.004; 
      const CLOUDS_ROTATION_SPEED = -0.006;

      // Preload clouds texture
      new THREE.TextureLoader().load(CLOUDS_IMG_URL, cloudsTexture => {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(globeRef.current.getGlobeRadius() * (1 + CLOUDS_ALT), 75, 75),
          new THREE.MeshPhongMaterial({ 
            map: cloudsTexture, 
            transparent: true,
            opacity: 0 // Start with 0 opacity
          })
        );
        
        cloudsRef.current = clouds;
        globeRef.current.scene().add(clouds);

        // Fade in clouds
        const startTime = Date.now();
        const duration = 500; // 500ms fade in

        const fadeInClouds = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          if (cloudsRef.current) {
            cloudsRef.current.material.opacity = cloudOpacity * progress;
          }

          if (progress < 1) {
            requestAnimationFrame(fadeInClouds);
          } else {
            setCloudsLoaded(true);
          }
        };

        fadeInClouds();

        // Rotate clouds
        const rotateClouds = () => {
          if (cloudsRef.current) {
            cloudsRef.current.rotation.y += CLOUDS_ROTATION_SPEED * Math.PI / 180;
          }
          requestAnimationFrame(rotateClouds);
        };
        rotateClouds();
      });

      // Cleanup function to remove clouds when component unmounts
      return () => {
        if (cloudsRef.current && globeRef.current) {
          globeRef.current.scene().remove(cloudsRef.current);
          cloudsRef.current.geometry.dispose();
          cloudsRef.current.material.dispose();
          cloudsRef.current = null;
        }
      };
    }
  }, [isMounted]); // Only depend on isMounted

  // Update cloud opacity when it changes
  useEffect(() => {
    if (cloudsRef.current && cloudsLoaded) {
      cloudsRef.current.material.opacity = cloudOpacity;
    }
  }, [cloudOpacity, cloudsLoaded]);

  if (!isMounted) {
    return null;
  }

  return <GlobeGL ref={globeRef} {...props} />;
};

export default GlobeWrapper;
