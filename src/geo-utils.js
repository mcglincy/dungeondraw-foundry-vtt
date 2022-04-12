import Densifier from "jsts/org/locationtech/jts/densify/Densifier.js";
import Coordinate from "jsts/org/locationtech/jts/geom/Coordinate.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
// needed by Densifier
import LineString from "jsts/org/locationtech/jts/geom/LineString.js";
// needed by Densifier
import MultiPolygon from "jsts/org/locationtech/jts/geom/MultiPolygon.js";
import PrecisionModel from "jsts/org/locationtech/jts/geom/PrecisionModel.js";
import WKTReader from "jsts/org/locationtech/jts/io/WKTReader.js";
import WKTWriter from "jsts/org/locationtech/jts/io/WKTWriter.js";
import { BufferOp } from "jsts/org/locationtech/jts/operation/buffer";
import OverlayOp from "jsts/org/locationtech/jts/operation/overlay/OverlayOp.js";
import RelateOp from "jsts/org/locationtech/jts/operation/relate/RelateOp.js";
import UnionOp from "jsts/org/locationtech/jts/operation/union/UnionOp.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import TopologyPreservingSimplifier from "jsts/org/locationtech/jts/simplify/TopologyPreservingSimplifier.js";
import GeometricShapeFactory from "jsts/org/locationtech/jts/util/GeometricShapeFactory.js";
import GeometryTransformer from "jsts/org/locationtech/jts/geom/util/GeometryTransformer.js";

// TODO: various geometry patched functions don't show up in node module
// see jsts monkey.js for patching

export const isValid = (geometry) => {
  return IsValidOp.isValid(geometry);
};

export const difference = (g1, g2) => {
  return OverlayOp.difference(g1, g2);
};

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

export const ellipse = (x, y, width, height) => {
  const gsf = new GeometricShapeFactory();
  const centre = gsf.coord(x, y);
  gsf.setCentre(centre);
  gsf.setWidth(width);
  gsf.setHeight(height);
  return gsf.createEllipse();
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

export const rectangleForSegment = (thickness, x1, y1, x2, y2) => {
  const m = slope(x1, y1, x2, y2);
  const rectDelta = thickness / 2.0;

  // slope is delta y / delta x
  if (m === 0) {
    // door is horizontal
    return [
      x1,
      y1 + rectDelta,
      x2,
      y1 + rectDelta,
      x2,
      y1 - rectDelta,
      x1,
      y1 - rectDelta,
    ];
  }
  if (m === Infinity) {
    // door is vertical
    return [
      x1 - rectDelta,
      y1,
      x1 - rectDelta,
      y2,
      x2 + rectDelta,
      y2,
      x2 + rectDelta,
      y1,
    ];
  }

  // https://math.stackexchange.com/questions/656500/given-a-point-slope-and-a-distance-along-that-slope-easily-find-a-second-p/656512
  const theta = Math.atan(m);
  // flipped dx/dy and +/- to make things work
  const dy = rectDelta * Math.cos(theta);
  const dx = rectDelta * Math.sin(theta);
  return [
    // lower right - more x, more y
    x1 - dx,
    y1 + dy,
    // upper right - more x, less y
    x2 - dx,
    y2 + dy,
    // upper left - less x, less y
    x2 + dx,
    y2 - dy,
    // lower left - less x, more y
    x1 + dx,
    y1 - dy,
    // close the polygon
    x1 + dy,
    y1 - dx,
  ];
};

export const simplify = (geom, distanceTolerance = 5.0) => {
  return TopologyPreservingSimplifier.simplify(geom, distanceTolerance);
};

// working around "e.buffer doesn't exist" monkey patching issue
class DensifyTransformer extends GeometryTransformer {
  constructor() {
    super();
    DensifyTransformer.constructor_.apply(this, arguments);
  }
  static constructor_() {
    this.distanceTolerance = null;
    const distanceTolerance = arguments[0];
    this.distanceTolerance = distanceTolerance;
  }
  transformMultiPolygon(geom, parent) {
    const roughGeom = super.transformMultiPolygon.call(this, geom, parent);
    return this.createValidArea(roughGeom);
  }
  transformPolygon(geom, parent) {
    const roughGeom = super.transformPolygon.call(this, geom, parent);
    if (parent instanceof MultiPolygon) return roughGeom;

    return this.createValidArea(roughGeom);
  }
  transformCoordinates(coords, parent) {
    const inputPts = coords.toCoordinateArray();
    let newPts = Densifier.densifyPoints(
      inputPts,
      this.distanceTolerance,
      parent.getPrecisionModel()
    );
    if (parent instanceof LineString && newPts.length === 1)
      newPts = new Array(0).fill(null);

    return this._factory.getCoordinateSequenceFactory().create(newPts);
  }
  createValidArea(roughAreaGeom) {
    // geometry.buffer function doesn't exist w/out monkey patching
    //return roughAreaGeom.buffer(0.0)
    return BufferOp.bufferOp(roughAreaGeom, 0.0);
  }
}

export const densify = (geom, distanceTolerance = 50.0) => {
  //return Densifier.densify(geom, distanceTolerance);
  // return new DensifyTransformer(this._distanceTolerance).transform(this._inputGeom)
  return new DensifyTransformer(distanceTolerance).transform(geom);
};

// need to smooth each area etc in a multipolygon
export const smooth = (geometry) => {
  const polygons = [];
  for (let i = 0; i < geometry.getNumGeometries(); i++) {
    let smoothed = smoothPoly(geometry.getGeometryN(i));
    smoothed = expandGeometry(smoothed, 0.0);
    polygons.push(smoothed);
  }
  return new GeometryFactory().createMultiPolygon(polygons);
};

export const smoothPoly = (poly) => {
  const oldCoords = poly.getCoordinates();
  const newCoords = [];
  newCoords.push(oldCoords[0]);
  for (let i = 0; i < oldCoords.length - 1; i++) {
    const c0 = oldCoords[i];
    const c1 = oldCoords[i + 1];
    const q = new Coordinate(
      0.75 * c0.x + 0.25 * c1.x,
      0.75 * c0.y + 0.25 * c1.y
    );
    const r = new Coordinate(
      0.25 * c0.x + 0.75 * c1.x,
      0.25 * c0.y + 0.75 * c1.y
    );
    newCoords.push(q);
    newCoords.push(r);
  }
  newCoords.push(oldCoords[oldCoords.length - 1]);
  return new GeometryFactory().createPolygon(newCoords);
};
