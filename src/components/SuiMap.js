import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export default function SuiMap({ onMapChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [52, 19],
      zoom: 6,
      minZoom: 3,
      maxZoom: 18,
      scrollWheelZoom: true,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(map);

    const handleMapChange = () => {
      if (onMapChange) {
        onMapChange({
          zoom: map.getZoom(),
          center: map.getCenter(),
        });
      }
    };

    map.on("zoomend", handleMapChange);
    map.on("moveend", handleMapChange);

    mapInstanceRef.current = map;
    handleMapChange(); // Initial call

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onMapChange]);

  return <div ref={mapRef} className="w-full h-full" />;
}
