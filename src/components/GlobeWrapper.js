"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const initialViewSet = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

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

  if (!isMounted) {
    return null; // or a loading placeholder
  }

  return <GlobeGL ref={globeRef} {...props} />;
};

export default GlobeWrapper;
