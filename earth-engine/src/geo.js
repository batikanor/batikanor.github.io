// All simulation coordinates are WGS84 longitude/latitude; the vehicle integrates in metres.
export const EARTH_RADIUS_METRES = 6_371_008.8;
export function stepPosition([lng, lat], headingDeg, metres) {
  const radians = headingDeg*Math.PI/180;
  const north = Math.cos(radians)*metres;
  const east = Math.sin(radians)*metres;
  const latNext = lat + north/EARTH_RADIUS_METRES*180/Math.PI;
  const lngNext = lng + east/(EARTH_RADIUS_METRES*Math.cos(lat*Math.PI/180))*180/Math.PI;
  return [lngNext,latNext];
}
export function distanceMetres([lng1,lat1],[lng2,lat2]){
  const rad=Math.PI/180;
  const dLat=(lat2-lat1)*rad,dLng=(lng2-lng1)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS_METRES*Math.asin(Math.min(1,Math.sqrt(h)));
}
