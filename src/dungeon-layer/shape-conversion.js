import * as geo from "../geo-utils.js";

/**
 * Convert a rectangle to an array of wall segments.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
export function rectangleToWallSegments(x, y, width, height) {
  return [
    [x, y, x + width, y], // top
    [x + width, y, x + width, y + height], // right
    [x + width, y + height, x, y + height], // bottom
    [x, y + height, x, y], // left
  ];
}

/**
 * Convert an ellipse to an array of wall segments using geo.ellipse.
 * Uses simplification to reduce segment count for game walls (same as room walls).
 * @param {number} x - X position (top-left corner of bounding box)
 * @param {number} y - Y position (top-left corner of bounding box)
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
export function ellipseToWallSegments(x, y, width, height) {
  // geo.ellipse expects center coordinates
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const ellipsePoly = geo.ellipse(centerX, centerY, width, height);
  // Simplify the ellipse to reduce segment count (same tolerance as room walls in wallmaker.js)
  const simplified = geo.simplify(ellipsePoly, 10.0);
  const coords = simplified.getExteriorRing().getCoordinates();

  const segments = [];
  for (let i = 0; i < coords.length - 1; i++) {
    segments.push([coords[i].x, coords[i].y, coords[i + 1].x, coords[i + 1].y]);
  }
  return segments;
}

/**
 * Convert polygon points to wall segments.
 * @param {Array} points - Array of [x, y] points
 * @returns {Array} Array of [x1, y1, x2, y2] wall segments
 */
export function polygonToWallSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([
      points[i][0],
      points[i][1],
      points[i + 1][0],
      points[i + 1][1],
    ]);
  }
  return segments;
}

/**
 * Convert a rectangle to polygon points for theme areas.
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x, y] points forming a closed polygon
 */
export function rectangleToPolygonPoints(x, y, width, height) {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
    [x, y], // close the polygon
  ];
}

/**
 * Convert an ellipse to polygon points for theme areas.
 * @param {number} x - X position (top-left corner of bounding box)
 * @param {number} y - Y position (top-left corner of bounding box)
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Array} Array of [x, y] points
 */
export function ellipseToPolygonPoints(x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const ellipsePoly = geo.ellipse(centerX, centerY, width, height);
  const coords = ellipsePoly.getExteriorRing().getCoordinates();
  return coords.map((c) => [c.x, c.y]);
}

/**
 * Convert drawing data shape points to offset points array.
 * @param {Object} createData - Drawing data with x, y, and shape.points
 * @returns {Array} Array of [x, y] points with offset applied
 */
export function createDataOffsetPoints(createData) {
  const offsetPoints = [];
  for (let i = 0; i <= createData.shape.points.length - 2; i += 2) {
    offsetPoints.push([
      createData.shape.points[i] + createData.x,
      createData.shape.points[i + 1] + createData.y,
    ]);
  }
  return offsetPoints;
}

/**
 * Calculate stair trapezoid geometry from first edge and mouse position.
 * @param {Object} firstEdge - { x1, y1, x2, y2 } the first edge of the stairs
 * @param {Object} mousePos - { x, y } current mouse position
 * @returns {Object|null} - { x1, y1, x2, y2, x3, y3, x4, y4 } trapezoid corners, or null if invalid
 */
export function calculateStairGeometry(firstEdge, mousePos) {
  const { x1, y1, x2, y2 } = firstEdge;

  // First edge vector
  const edgeVec = { x: x2 - x1, y: y2 - y1 };
  const edgeLength = Math.sqrt(edgeVec.x ** 2 + edgeVec.y ** 2);

  if (edgeLength < 1) {
    return null;
  }

  // Perpendicular unit vector (rotated 90°)
  const perpVec = { x: -edgeVec.y / edgeLength, y: edgeVec.x / edgeLength };

  // Edge unit vector
  const edgeUnit = { x: edgeVec.x / edgeLength, y: edgeVec.y / edgeLength };

  // Mouse position relative to first edge start
  const mouseVec = { x: mousePos.x - x1, y: mousePos.y - y1 };

  // Perpendicular distance (stair length) - can be negative
  const perpDist = mouseVec.x * perpVec.x + mouseVec.y * perpVec.y;

  // Parallel position along edge (for width ratio)
  const parallelPos = mouseVec.x * edgeUnit.x + mouseVec.y * edgeUnit.y;

  // Calculate width ratio based on parallel position
  // At center of edge -> 5% width (minimum)
  // At edge endpoint -> 100% width (parallel lines)
  // Beyond edge -> >100% width (reverse taper)
  const edgeCenter = edgeLength / 2;
  const distFromCenter = Math.abs(parallelPos - edgeCenter);
  let widthRatio = Math.max(0.05, distFromCenter / edgeCenter);

  // If mouse is beyond the edge endpoints, allow wider second edge
  if (parallelPos < 0 || parallelPos > edgeLength) {
    const beyondDist =
      parallelPos < 0 ? -parallelPos : parallelPos - edgeLength;
    widthRatio = 1 + beyondDist / edgeLength;
  }

  // Calculate second edge
  const secondEdgeLength = edgeLength * widthRatio;

  // Second edge start (perpendicular from x1, y1)
  let x3 = x1 + perpVec.x * perpDist;
  let y3 = y1 + perpVec.y * perpDist;

  // Center the second edge relative to first edge
  const offset = (edgeLength - secondEdgeLength) / 2;
  x3 += edgeUnit.x * offset;
  y3 += edgeUnit.y * offset;

  // Second edge end
  const x4 = x3 + edgeUnit.x * secondEdgeLength;
  const y4 = y3 + edgeUnit.y * secondEdgeLength;

  return { x1, y1, x2, y2, x3, y3, x4, y4 };
}
