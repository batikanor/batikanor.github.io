// components/GlobeWrapper.js
"use client";
import React, { useEffect, useRef } from "react";
import GlobeGL from "react-globe.gl";

/**
 * GlobeWrapper Component
 * 
 * This component wraps the GlobeGL component from react-globe.gl,
 * forwards refs, and exposes imperative methods to the parent
 * via the `onGlobeLoad` callback.
 * 
 * Props:
 * - onGlobeLoad: Function to receive the globe instance.
 * - ...props: All other props to pass to GlobeGL.
 */
const GlobeWrapper = ({ onGlobeLoad, ...props }) => {
  const globeRef = useRef();

  useEffect(() => {
    if (globeRef.current) {
      // Set the initial point of view to focus on Antarctica
      globeRef.current.pointOfView(
        { lat: -90, lng: 0, altitude: 3 }, // Adjust altitude as needed
        1000 // Animation duration in milliseconds
      );

      // Pass the globe instance back to the parent component
      if (onGlobeLoad) {
        onGlobeLoad(globeRef.current);
      }
    }
  }, [onGlobeLoad]);

  return <GlobeGL ref={globeRef} {...props} />;
};

export default GlobeWrapper;
