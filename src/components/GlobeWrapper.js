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
 * - initialView: Object containing { lat, lng, altitude } for initial point of view.
 * - ...props: All other props to pass to GlobeGL.
 */
const GlobeWrapper = ({ onGlobeLoad, initialView, ...props }) => {
  const globeRef = useRef();

  useEffect(() => {
    if (globeRef.current && initialView) {
      // Set the initial point of view based on provided initialView prop
      globeRef.current.pointOfView(initialView, 1000); // Animation duration in milliseconds

      // Pass the globe instance back to the parent component
      if (onGlobeLoad) {
        onGlobeLoad(globeRef.current);
      }
    } else if (globeRef.current && onGlobeLoad) {
      // Pass the globe instance back to the parent component without setting POV
      onGlobeLoad(globeRef.current);
    }
  }, [onGlobeLoad, initialView]);

  return <GlobeGL ref={globeRef} {...props} />;
};

export default GlobeWrapper;
