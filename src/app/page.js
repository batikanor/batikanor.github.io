"use client";
import dynamic from "next/dynamic";
import React, { useEffect, useState, useRef, forwardRef } from "react";

// Dynamically import the Globe component and forward the ref
const Globe = dynamic(
  () =>
    import("react-globe.gl").then((mod) => {
      const GlobeComponent = forwardRef((props, ref) => (
        <mod.default {...props} ref={ref} />
      ));
      GlobeComponent.displayName = "Globe";
      return GlobeComponent;
    }),
  { ssr: false }
);

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const globeContainerRef = useRef(null);
  const globeEl = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [clickedMarker, setClickedMarker] = useState(null);

  // This ensures the Globe is only rendered on the client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get container dimensions after client renders
  useEffect(() => {
    if (globeContainerRef.current) {
      const { clientWidth, clientHeight } = globeContainerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }
  }, [isClient]);

  // Set the point of view when the globe component is ready
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView(
        { lat: 48.1351, lng: 11.582, altitude: 1.5 },
        0
      );
    }
  }, [globeEl]);

  // Markers for the globe
  const markers = [
    {
      lat: 41.0082, // Istanbul
      lng: 28.9784,
      label: "BSc Computer Science, Turkish German University",
      size: 10,
      color: "red",
      description:
        "Studied BSc Computer Science at the Turkish German University in Istanbul.",
    },
    {
      lat: 48.1351, // Munich
      lng: 11.582,
      label: "MSc Informatics, Technical University of Munich",
      size: 10,
      color: "blue",
      description:
        "Currently pursuing MSc Informatics at the Technical University of Munich.",
    },
    // Add more markers here as needed
  ];

  // Generate arcs between markers
  const arcs = markers.slice(0, -1).map((marker, i) => ({
    startLat: marker.lat,
    startLng: marker.lng,
    endLat: markers[i + 1].lat,
    endLng: markers[i + 1].lng,
    color: [marker.color, markers[i + 1].color],
  }));

  return (
    <div>
      <main className="flex flex-col items-center justify-center">
        {/* Header and Menu */}
        <header className="text-center">
          <br />
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            Batikanor
          </h1>
          <p className="text-xl sm:text-2xl mt-4">Batıkan Bora Ormancı</p>
        </header>

        {/* Spinnable Earth - Render only on the client */}
        {isClient && (
          <div
            ref={globeContainerRef}
            className="relative w-full max-w-2xl h-[700px] sm:h-[800px] md:h-[900px]"
          >
            <Globe
              ref={globeEl}
              width={dimensions.width}
              height={dimensions.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              backgroundColor="rgba(0,0,0,0)"
              pointsData={markers}
              pointSize="size"
              pointColor="color"
              pointLabel={(point) => `${point.label}`}
              pointAltitude={0.01}
              onPointClick={(point, event) => {
                setClickedMarker(point);
              }}
              // Arcs properties
              arcsData={arcs}
              arcColor="color"
              arcStroke={1.5}
              arcDashLength={0.25}
              arcDashGap={0.2}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={1500}
              arcsTransitionDuration={0}
            />
          </div>
        )}

        {/* Modal Popup */}
        {clickedMarker && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto">
              <p className="text-lg font-semibold">
                {clickedMarker.description}
              </p>
              <button
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => setClickedMarker(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Divider */}
        <hr className="w-full border-t border-gray-300 my-8" />

        {/* Description Content */}
        <p className="text-center max-w-lg text-base sm:text-lg leading-relaxed">
          The fourth letter of my name &quot;ı&quot; (i without a dot) is
          pronounced the way &quot;e&quot; is pronounced while saying
          &quot;folder&quot;.
        </p>
      </main>
    </div>
  );
}
