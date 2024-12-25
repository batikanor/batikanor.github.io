export const loadGeoJSON = async () => {
  try {
    const response = await fetch('/ne_110m_admin_0_countries.geojson');
    if (!response.ok) {
      throw new Error('Failed to load GeoJSON data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading GeoJSON:', error);
    return { type: "FeatureCollection", features: [] };
  }
}; 