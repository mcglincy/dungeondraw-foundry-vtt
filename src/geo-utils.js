import Coordinate from "jsts/org/locationtech/jts/geom/Coordinate.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import MultiPolygon from "jsts/org/locationtech/jts/geom/MultiPolygon";
import PrecisionModel from "jsts/org/locationtech/jts/geom/PrecisionModel.js";
import WKTReader from "jsts/org/locationtech/jts/io/WKTReader.js";
import WKTWriter from "jsts/org/locationtech/jts/io/WKTWriter.js";
import { BufferOp } from "jsts/org/locationtech/jts/operation/buffer";
import OverlayOp from "jsts/org/locationtech/jts/operation/overlay/OverlayOp.js";
import RelateOp from "jsts/org/locationtech/jts/operation/relate/RelateOp.js";
import UnionOp from "jsts/org/locationtech/jts/operation/union/UnionOp.js";

// TODO: various geometry patched functions don't show up in node module
// see jsts monkey.js for patching

export const intersects = (g1, g2) => {
  return RelateOp.intersects(g1, g2);
};

export const touches = (g1, g2) => {
  return RelateOp.touches(g1, g2);
};

export const union = (g1, g2) => {
  return UnionOp.union(g1, g2);
};

export const intersection = (g1, g2) => {
  return OverlayOp.intersection(g1, g2);
};

export const contains = (g1, g2) => {
  return RelateOp.contains(g1, g2);
};

export const expandGeometry = (geometry, distance) => {
  return BufferOp.bufferOp(geometry, distance).norm();
};

export const isMultiPolygon = (geometry) => {
  return geometry instanceof MultiPolygon;
};

export const isPolygon = (geometry) => {
  return geometry instanceof Polygon;
};

export const geometryToWkt = (geometry) => {
  if (!geometry) {
    return null;
  }
  const precisionModel = new PrecisionModel();
  const factory = new GeometryFactory(precisionModel);
  const wktWriter = new WKTWriter(factory);
  return wktWriter.write(geometry);
};

export const wktToGeometry = (wkt) => {
  if (!wkt) {
    return null;
  }
  const wktReader = new WKTReader();
  return wktReader.read(wkt);
};

// {x, y, height, width}
export const rectToPolygon = (rect) => {
  const reader = new WKTReader();
  const polyString = rectToWKTPolygonString(rect);
  return reader.read(polyString);
};

// {x, y, height, width}
export const rectToWKTPolygonString = (rect) => {
  const p = [
    rect.x,
    rect.y,
    rect.x + rect.width,
    rect.y,
    rect.x + rect.width,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height,
    // close off poly
    rect.x,
    rect.y,
  ];
  return `POLYGON((${p[0]} ${p[1]}, ${p[2]} ${p[3]}, ${p[4]} ${p[5]}, ${p[6]} ${p[7]}, ${p[8]} ${p[9]}))`;
};

export const twoPointsToLineString = (x1, y1, x2, y2) => {
  return new GeometryFactory().createLineString([
    new Coordinate(x1, y1),
    new Coordinate(x2, y2),
  ]);
};

// [[x,y]...]
export const pointsToPolygon = (points) => {
  const coords = points.map((p) => new Coordinate(p[0], p[1]));
  return new GeometryFactory().createPolygon(coords);
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

export const distanceBetweenPoints = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

export const comparePoints = (x1, y1, x2, y2) => {
  if (x1 < x2 || (x1 === x2 && y1 < y2)) {
    // less than
    return -1;
  } else if (x1 === x2 && y1 === y2) {
    // equal
    return 0;
  } else {
    // greater than
    return 1;
  }
};

export const lesserPoint = (x1, y1, x2, y2) => {
  if (comparePoints(x1, y1, x2, y2) === -1) {
    return [x1, y1];
  }
  return [x2, y2];
};

export const greaterPoint = (x1, y1, x2, y2) => {
  if (comparePoints(x1, y1, x2, y2) !== -1) {
    return [x1, y1];
  }
  return [x2, y2];
};
