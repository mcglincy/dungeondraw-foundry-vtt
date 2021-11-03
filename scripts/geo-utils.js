// TODO: decide if we want to use turf.js instead
import * as jsts from "./jsts.js";

export const geometryToWkt = (geometry) => {
  if (!geometry) {
    return null;
  }
  const precisionModel = new jsts.geom.PrecisionModel();
  const factory = new jsts.geom.GeometryFactory(precisionModel);
  const wktWriter = new jsts.io.WKTWriter(factory);
  return wktWriter.write(geometry);
};

export const wktToGeometry = (wkt) => {
  if (!wkt) {
    return null;
  }
  const wktReader = new jsts.io.WKTReader(); 
  return wktReader.read(wkt);
};

export const rectToPolygon = (rect) => {
  const reader = new jsts.io.WKTReader(); 
  const polyString = rectToWKTPolygonString(rect);
  return reader.read(polyString);
};

export const rectToWKTPolygonString = (rect) => {
  const p = [
    rect.x, rect.y,
    rect.x + rect.width, rect.y,
    rect.x + rect.width, rect.y + rect.height,
    rect.x, rect.y + rect.height,
    // close off poly
    rect.x, rect.y,
  ];
  return `POLYGON((${p[0]} ${p[1]}, ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]}, ${p[8]} ${p[9]}))`;
};

export const slope = (x1, y1, x2, y2) => {
  if (x1 === x2) {
    // vertical line has undefined slope
    return Infinity;
  }
  return (y2 - y1) / (x2 - x1);
};

export const inverseSlope = (slope) => {
  if (slope === Infinity) {
    // vertical line; inverse/perpendicular is horizontal
    return 0.0;
  }
  if (slope === 0) {
    // horizontal line; inverse/pendendicular is vertical
    return Infinity;
  }
  return -1.0 / slope;
};

