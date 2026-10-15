/**
 * Compose the view transform into the DOM scene before CSS rendering.
 * The result has the same projection as the WebGL camera, while the CSS
 * camera keeps a fixed position. This avoids Chromium losing pointer targets
 * on screens turned 90 degrees inside a separately transformed camera layer.
 */
export function renderGalleryRoomDom(renderer, scene, camera, viewCamera) {
  camera.updateMatrixWorld(true);
  viewCamera.updateMatrixWorld(true);
  scene.matrixAutoUpdate = false;
  scene.matrix.copy(viewCamera.matrixWorld).multiply(camera.matrixWorldInverse);
  scene.matrixWorldNeedsUpdate = true;
  viewCamera.projectionMatrix.copy(camera.projectionMatrix);
  viewCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  viewCamera.view = camera.view ? {...camera.view} : null;
  viewCamera.layers.mask = camera.layers.mask;
  renderer.render(scene, viewCamera);
}
