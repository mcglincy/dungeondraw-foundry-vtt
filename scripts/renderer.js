import * as geo from "./geo-utils.js";
import "./lib/pixi-filters.min.js";
// TODO: decide if we want to use turf.js instead
import "./lib/jsts.min.js";


export const render = async (container, state) => {
  container.clear();
  const gfx = new PIXI.Graphics();

  if (state.geometry) {
    // draw an outer surrounding blurred shadow
    addOuterShadow(container, state.geometry);

    // maybe add a tiled background
    if (state.config.floorTexture) {
      // use a mask to clip the tiled background
      const clipMask = new PIXI.Graphics();
      if (state.geometry instanceof jsts.geom.MultiPolygon) {
        drawMultiPolygonMask(clipMask, state.geometry);
      } else if (state.geometry instanceof jsts.geom.Polygon) {
        drawPolygonMask(clipMask, state.geometry);
      }
      container.addChild(clipMask);
      await addTiledBackground(container, clipMask, state);      
    }

    // draw the dungeon geometry room(s)
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      drawMultiPolygonRoom(gfx, state.config, state.geometry);
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      drawPolygonRoom(gfx, state.config, state.geometry);
    }
  }
  // draw doors
  for (let door of state.doors) {
    drawDoor(gfx, state.config, door);
  }

  container.addChild(gfx);
}

const addTiledBackground = async (container, mask, state) => {
  const texture = await loadTexture(state.config.floorTexture);
  if (!texture?.valid) {
    return;
  }

  // const textureSize = state.config.floorTextureSize ? state.config.floorTextureSize : 100;
  // assume square textures
  const textureSize = texture.width;
  const rows = Math.ceil(canvas.scene.data.height / textureSize);
  const cols = Math.ceil(canvas.scene.data.width / textureSize);

  const bg = new PIXI.Container();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // only create a sprite if this row/col rectangle intersects with our map geometry
      const rect = geo.pointsToPolygon([
        [col * textureSize, row * textureSize],
        [(col + 1) * textureSize, row * textureSize],
        [(col + 1) * textureSize, (row + 1) * textureSize],
        [col * textureSize, (row + 1) * textureSize],
        [col * textureSize, row * textureSize],
      ]);
      if (state.geometry.intersects(rect) && !state.geometry.touches(rect)) {
        // console.log(`sprite at row ${row}, col ${col}`);
        const sprite = new PIXI.TilingSprite(texture, textureSize, textureSize);
        sprite.x = col * textureSize;
        sprite.y = row * textureSize;
        bg.addChild(sprite);        
      }
    }
  }
  bg.mask = mask;
  container.addChild(bg);
};

const rectangleForSegment = (config, x1, y1, x2, y2) => {
  const slope = geo.slope(x1, y1, x2, y2);
  const rectDelta = config.doorThickness / 2.0;

  // slope is delta y / delta x
  if (slope === 0) {
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
  if (slope === Infinity) {
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
  };

  // https://math.stackexchange.com/questions/656500/given-a-point-slope-and-a-distance-along-that-slope-easily-find-a-second-p/656512
  const theta = Math.atan(slope);
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

// TODO: this is wrong for first drawn rectangle
// maybe simple poly has different vertex ordering?
// or we should adjust our POLY string vertex order
const needsShadow = (x1, y1, x2, y2) => {
  if (x1 === x2) {
    // north to south vertical
    return y2 > y1;
  }
  if (y1 === y2) {
    // east to west horizontal
    return x1 > x2;
  }
  const slope = geo.slope(x1, y1, x2, y2);
  // we know slope is non-zero and non-infinity because of earlier checks
  return slope < 0 && y2 > y1;
};

const doorNeedsShadow = (x1, y1, x2, y2) => {
  if (x1 === x2) {
    // vertical doors always need shadow
    return true;
  }
  if (y1 === y2) {
    // horizontal doors always need shadow
    return true;
  }
  const slope = geo.slope(x1, y1, x2, y2);
  // we know slope is non-zero and non-infinity because of earlier checks
  return slope < 0 && y2 > y1;
};

const drawPolygonMask = (gfx, poly) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map(c => [c.x, c.y]).flat();
  gfx.beginFill(0xFFFFFF, 1.0);
  gfx.drawPolygon(flatCoords);
  gfx.endFill();

  const numHoles = poly.getNumInteriorRing();    
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();
    gfx.lineStyle(0, 0x000000, 1.0, 1, 0.5);
    gfx.beginHole();
    gfx.drawPolygon(flatCoords);
    gfx.endHole();
  }
};

const drawMultiPolygonMask = (gfx, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    drawPolygonMask(gfx, poly);
  }
};

const drawPolygonRoom = (gfx, config, poly) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map(c => [c.x, c.y]).flat();

  if (!config.floorTexture) {
    // no texture; draw solid-color floor
    gfx.beginFill(PIXI.utils.string2hex(config.floorColor), 1.0);
    gfx.drawPolygon(flatCoords);
    gfx.endFill();
  }

  // cut out holes
  const numHoles = poly.getNumInteriorRing();    
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();
    gfx.lineStyle(0, 0x000000, 1.0, 1, 0.5);
    gfx.beginHole();
    gfx.drawPolygon(flatCoords);
    gfx.endHole();
  }

  // draw inner wall drop shadows
  gfx.lineStyle({
    width: config.wallThickness / 2.0 + 8.0,
    color: 0x000000,
    alpha: 0.2,
    alignment: 1,
    join: "round"
  });
  gfx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) {
    if (needsShadow(coords[i-1].x, coords[i-1].y, coords[i].x, coords[i].y)) {
      gfx.lineTo(coords[i].x, coords[i].y);
    } else {
      gfx.moveTo(coords[i].x, coords[i].y);
    }
  }

  // draw outer wall poly
  gfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.wallColor), 1.0, 0.5);
  gfx.drawPolygon(flatCoords);

  // draw interior hole walls/shadows
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();
    // draw hole wall outer drop shadows
    gfx.lineStyle(config.wallThickness / 2.0 + 8.0, 0x000000, 0.2, 1);
    for (let i = 0; i < coords.length - 1; i++) {
      gfx.moveTo(coords[i].x, coords[i].y);
      if (needsShadow(coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y)) {
        gfx.lineTo(coords[i+1].x, coords[i+1].y);
      } 
    }      
    // draw hole wall poly
    gfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.wallColor), 1.0);
    gfx.drawPolygon(flatCoords);
  }
}

const drawMultiPolygonRoom = (gfx, config, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    drawPolygonRoom(gfx, config, poly);        
  }
};

// [x1, y1, x2, y2]
const drawDoor = (gfx, config, door) => {
  const totalLength = geo.distanceBetweenPoints(door[0], door[1], door[2], door[3]);
  const jambLength = 20;
  const rectLength = totalLength - (2 * jambLength);
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [door[0] + (deltaX * jambFraction), door[1] + (deltaY * jambFraction)];
  const rectEnd = [door[0] + (deltaX * rectEndFraction), door[1] + (deltaY * rectEndFraction)]
  const doorRect = rectangleForSegment(config, jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);

  gfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.doorColor), 1.0, 0.5);    
  gfx.moveTo(door[0], door[1]);
  // left jamb
  gfx.lineTo(jamb1End[0], jamb1End[1]);
  // right jamb
  gfx.moveTo(rectEnd[0], rectEnd[1]);
  gfx.lineTo(door[2], door[3]);
  // door rectangle
  if (config.doorFillOpacity) {
    gfx.beginFill(PIXI.utils.string2hex(config.doorFillColor), config.doorFillOpacity);
  }
  gfx.drawPolygon(
    doorRect[0], doorRect[1], 
    doorRect[2], doorRect[3],
    doorRect[4], doorRect[5], 
    doorRect[6], doorRect[7],
    doorRect[0], doorRect[1]
    );
  if (config.doorFillColor) {
    gfx.endFill();
  }

  // draw drop shadows
  // our needsShadow check is assuming counter-clockwise??? ordering
  // TODO: doors need different shadow-logic than walls.
  // doors are always interior and should always have shadows if vert/horiz,
  // regardless of original ordering. So maybe we reorder the door
  // to lowest x/y starting?
  // TODO: this door shadow logic is hacky and awful; rewrite with a calm brain.
  if (door[2] < door[0]) {
    drawDoorShadow(gfx, config, [door[2], door[3], door[0], door[1]]);
  } else if (door[2] === door[0] && door[3] >= door[1]) {
    drawDoorShadow(gfx, config, [door[2], door[3], door[0], door[1]]);
  } else {
    drawDoorShadow(gfx, config, door);        
  }
};

const drawDoorShadow = (gfx, config, door) => {
  if (!doorNeedsShadow(door[2], door[3], door[0], door[1])) {
    return;
  }
  const totalLength = geo.distanceBetweenPoints(door[0], door[1], door[2], door[3]);
  const jambLength = 20;
  const rectLength = totalLength - (2 * jambLength);
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [door[0] + (deltaX * jambFraction), door[1] + (deltaY * jambFraction)];
  const rectEnd = [door[0] + (deltaX * rectEndFraction), door[1] + (deltaY * rectEndFraction)]
  const doorRect = rectangleForSegment(jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);

  gfx.lineStyle({
    width: config.wallThickness / 2.0 + 8.0,
    color: 0x000000,
    alpha: 0.2,
    alignment: 1,
    join: "round"
  });      
  gfx.moveTo(door[2], door[3]);
  // left jamb
  gfx.lineTo(rectEnd[0], rectEnd[1]);
  // door rect top
  gfx.moveTo(doorRect[4], doorRect[5]);
  gfx.lineTo(doorRect[6], doorRect[7]);
  // door rect bottom
  gfx.moveTo(doorRect[2], doorRect[3]);
  gfx.lineTo(doorRect[0], doorRect[1]);
  // right jamb
  gfx.moveTo(jamb1End[0], jamb1End[1]);
  gfx.lineTo(door[0], door[1]);
};

export const addOuterShadow = (container, geometry) => {
  if (!geometry) {
    return;
  }
  if (geometry instanceof jsts.geom.MultiPolygon) {
    for (let i = 0; i < geometry.getNumGeometries(); i++) {
      const poly = geometry.getGeometryN(i);
      addOuterShadowForPoly(container, poly);
    }
  } else if (geometry instanceof jsts.geom.Polygon) {
    addOuterShadowForPoly(container, geometry);
  }
}

const addOuterShadowForPoly = (container, poly) => {
  const outerShadow = new PIXI.Graphics();
  const expanded = poly.buffer(20.0);
  outerShadow.beginFill(0x000000, 0.5);
  outerShadow.drawPolygon(expanded.getCoordinates().map(c => [c.x, c.y]).flat());
  outerShadow.endFill();
  const blurFilter = new PIXI.filters.BlurFilter();
  outerShadow.filters = [blurFilter];
  container.addChild(outerShadow);
}
