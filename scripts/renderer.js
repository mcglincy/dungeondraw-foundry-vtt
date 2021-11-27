import * as geo from "./geo-utils.js";
import "./lib/pixi-filters.min.js";
import "./lib/jsts.min.js";
import { getTheme } from "./themes.js";

export const render = async (container, state) => {
  container.clear();
  await addBackgroundImage(container, state.config);
  // subfloor render pass, no additional clipping
  await renderPass(container, state, null);
  // draw theme-painted floors as additional render passes
  await paintThemes(container, state);
}

const paintThemes = async (container, state) => {
  for (let floor of state.floors) {
    const theme = getTheme(floor.themeKey, floor.themeType);
    if (!theme) {
      console.log(`No such ${floor.themeType} theme: ${floor.themeKey}`);
      return;
    }
    // TODO: hacky way to pass down the theme to paint
    const floorState = state.clone();    
    floorState.config = theme.config;

    // mask for our painted rectangle
    const floorContainer = new PIXI.Container();
    const floorMask = new PIXI.Graphics();
    const floorCoords = [
      floor.rect.x, floor.rect.y,
      floor.rect.x + floor.rect.width, floor.rect.y,
      floor.rect.x + floor.rect.width, floor.rect.y + floor.rect.height,
      floor.rect.x, floor.rect.y + floor.rect.height,
      floor.rect.x, floor.rect.y,
    ];    
    floorMask.beginFill(0xFFFFFF, 1.0);
    floorMask.drawPolygon(floorCoords);
    floorMask.endFill();
    floorContainer.mask = floorMask;

    // render the theme, clipping to our rectangle
    const clipPoly = geo.rectToPolygon(floor.rect);
    await renderPass(floorContainer, floorState, clipPoly);

    container.addChild(floorMask);
    container.addChild(floorContainer);
  }
}

const renderPass = async (container, state, clipPoly) => {
  const subfloorGfx = new PIXI.Graphics();
  const floorGfx = new PIXI.Graphics();
  const interiorShadowGfx = new PIXI.Graphics();
  const wallGfx = new PIXI.Graphics();

  if (state.geometry) {
    // maybe draw an outer surrounding blurred shadow
    addExteriorShadow(container, state.config, state.geometry);

    // use a mask to clip the tiled background and interior shadows
    const clipMask = new PIXI.Graphics();
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      drawMultiPolygonMask(clipMask, state.geometry);
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      drawPolygonMask(clipMask, state.geometry);
    }
    container.addChild(clipMask);

    interiorShadowGfx.mask = clipMask;
    // apply alpha filter once for entire shadow graphics, so overlaps aren't additive
    const alphaFilter = new PIXI.filters.AlphaFilter(state.config.interiorShadowOpacity);
    const blurFilter = new PIXI.filters.BlurFilter();
    interiorShadowGfx.filters = [alphaFilter, blurFilter];

    // maybe add a tiled background
    if (state.config.floorTexture) {
      // TODO: clipMask / clipPoly is confusing. 
      await addTiledBackground(container, clipMask, state.config, state.geometry, clipPoly);
    }

    // draw the dungeon geometry room(s)
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      drawMultiPolygonRoom(subfloorGfx, interiorShadowGfx, wallGfx, state.config, state.geometry);
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      drawPolygonRoom(subfloorGfx, interiorShadowGfx, wallGfx, state.config, state.geometry);
    }
  }

  // draw interior walls
  for (let wall of state.interiorWalls) {
    drawInteriorWall(interiorShadowGfx, wallGfx, state.config, wall);
  }

  // draw doors
  for (let door of state.doors) {
    drawDoor(interiorShadowGfx, wallGfx, state.config, door);
  }

  // layer everything properly
  container.addChild(subfloorGfx);
  container.addChild(floorGfx);
  container.addChild(interiorShadowGfx);
  container.addChild(wallGfx);
};

/** Possibly add a background image. */
const addBackgroundImage = async (container, config) => {
  if (config.backgroundImage) {
    // mimicking MapLayer._drawBackground() behavior
    const texture = await loadTexture(config.backgroundImage);
    if (texture?.valid) {
      const d = canvas.dimensions;
      const bg = new PIXI.Sprite(texture);
      bg.position.set(d.paddingX - d.shiftX, d.paddingY - d.shiftY);
      // resize the background image to match the scene dimensions
      bg.width = d.sceneWidth;
      bg.height = d.sceneHeight;
      container.addChild(bg);      
    }
  }
};

/** Add an exterior blurred shadow. */
const addExteriorShadow = (container, config, geometry) => {
  if (!config.exteriorShadowThickness || !config.exteriorShadowOpacity || !geometry) {
    return;
  }
  if (geometry instanceof jsts.geom.MultiPolygon) {
    for (let i = 0; i < geometry.getNumGeometries(); i++) {
      const poly = geometry.getGeometryN(i);
      addExteriorShadowForPoly(container, config, poly);
    }
  } else if (geometry instanceof jsts.geom.Polygon) {
    addExteriorShadowForPoly(container, config, geometry);
  }
}

/** Add an exterior blurred shadow for the given polygon. */
const addExteriorShadowForPoly = (container, config, poly) => {
  const outerShadow = new PIXI.Graphics();
  const expanded = poly.buffer(config.exteriorShadowThickness);
  outerShadow.beginFill(PIXI.utils.string2hex(config.exteriorShadowColor), config.exteriorShadowOpacity);
  outerShadow.drawPolygon(expanded.getCoordinates().map(c => [c.x, c.y]).flat());
  outerShadow.endFill();
  const blurFilter = new PIXI.filters.BlurFilter();
  outerShadow.filters = [blurFilter];
  container.addChild(outerShadow);
}

/** Add TilingSprites for floor texture. */
const addTiledBackground = async (container, mask, config, geometry, clipPoly) => {
  const texture = await loadTexture(config.floorTexture);
  if (!texture?.valid) {
    return;
  }

  // assume square textures
  const textureSize = texture.width;
  // allow for scene padding in our total height/width
  const height = canvas.scene.data.height * (1 + 2 * canvas.scene.data.padding);
  const width = canvas.scene.data.width * (1 + 2 * canvas.scene.data.padding);
  const rows = Math.ceil(height / textureSize);
  const cols = Math.ceil(width / textureSize);

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
      if (
        (!clipPoly || clipPoly.intersects(rect)) &&
        geometry.intersects(rect) && 
        !geometry.touches(rect)
        ) {
        const sprite = new PIXI.TilingSprite(texture, textureSize, textureSize);
        sprite.x = col * textureSize;
        sprite.y = row * textureSize;
        if (config.floorTextureTint) {
          sprite.tint = foundry.utils.colorStringToHex(config.floorTextureTint);
        }
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

const drawMultiPolygonRoom = (floorGfx, interiorShadowGfx, wallGfx, config, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    drawPolygonRoom(floorGfx, interiorShadowGfx, wallGfx, config, poly);
  }
};

const drawPolygonRoom = (floorGfx, interiorShadowGfx, wallGfx, config, poly) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map(c => [c.x, c.y]).flat();

  // if no floor texture is specified, draw a solid-color floor
  if (!config.floorTexture) {
    floorGfx.beginFill(PIXI.utils.string2hex(config.floorColor), 1.0);
    floorGfx.drawPolygon(flatCoords);
    floorGfx.endFill();
  }

  // cut out holes
  const numHoles = poly.getNumInteriorRing();    
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();
    floorGfx.lineStyle(0, 0x000000, 1.0, 1, 0.5);
    floorGfx.beginHole();
    floorGfx.drawPolygon(flatCoords);
    floorGfx.endHole();
  }

  // draw inner wall drop shadows
  if (config.interiorShadowOpacity) {
    // TODO: don't need to set this multiple times... bubble up?
    interiorShadowGfx.lineStyle({
      width: config.interiorShadowThickness,
      color: PIXI.utils.string2hex(config.interiorShadowColor),
      alignment: 1,  // outside
      join: "round"
    });
    interiorShadowGfx.drawPolygon(flatCoords);
  }

  // draw outer wall poly
  wallGfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.wallColor), 1.0, 0.5);
  wallGfx.drawPolygon(flatCoords);

  // draw interior hole walls/shadows
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map(c => [c.x, c.y]).flat();

    // draw hole wall outer drop shadows
    interiorShadowGfx.drawPolygon(flatCoords);

    // draw hole wall poly
    wallGfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.wallColor), 1.0);
    wallGfx.drawPolygon(flatCoords);
  }
};

/**
 * 
 */ 
const drawFloor = (floorGfx, floor) => {
  console.log(floor);
  const theme = getTheme(floor.themeKey, floor.themeType);
  if (!theme) {
    console.log(`Non-existent floor theme ${floor.themeKey}, skipping`);
    return;
  }
  const flatCoords = [
    floor.rect.x, floor.rect.y,
    floor.rect.x + floor.rect.width, floor.rect.y,
    floor.rect.x + floor.rect.width, floor.rect.y + floor.rect.height,
    floor.rect.x, floor.rect.y + floor.rect.height,
    floor.rect.x, floor.rect.y,
    ];
  // TODO: figure out texture
  if (theme.config.floorColor) {
    floorGfx.beginFill(PIXI.utils.string2hex(theme.config.floorColor), 1.0);
    floorGfx.drawPolygon(flatCoords);
    floorGfx.endFill();    
  }
};

// [x1, y1, x2, y2]
const drawInteriorWall = (interiorShadowGfx, wallGfx, config, wall) => {
  drawInteriorWallShadow(interiorShadowGfx, config, wall);

  wallGfx.lineStyle({
    width: config.wallThickness,
    color: PIXI.utils.string2hex(config.wallColor),
    alpha: 1.0,
    alignment: 0.5,  // middle
    cap: "round"
  });
  wallGfx.moveTo(wall[0], wall[1]);
  wallGfx.lineTo(wall[2], wall[3]);
};

const drawInteriorWallShadow = (gfx, config, wall) => {
  gfx.lineStyle({
    // wide enough to be exposed on either side
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5,  // middle
    join: "round",
    cap: "round"
  });
  gfx.moveTo(wall[2], wall[3]);
  gfx.lineTo(wall[0], wall[1]);
};

// [x1, y1, x2, y2]
const drawDoor = (interiorShadowGfx, wallGfx, config, door) => {
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

  // draw drop shadows
  drawDoorShadow(interiorShadowGfx, config, door);        

  // draw door
  wallGfx.lineStyle({
    width: config.wallThickness,
    color: PIXI.utils.string2hex(config.wallColor),
    alpha: 1.0,
    alignment: 0.5, // middle
    cap: "round",
  });
  wallGfx.moveTo(door[0], door[1]);
  // left jamb
  wallGfx.lineTo(jamb1End[0], jamb1End[1]);
  // right jamb
  wallGfx.moveTo(rectEnd[0], rectEnd[1]);
  wallGfx.lineTo(door[2], door[3]);
  // door rectangle
  if (config.doorFillOpacity) {
    wallGfx.beginFill(PIXI.utils.string2hex(config.doorFillColor), config.doorFillOpacity);
  }
  // TODO: redundant/remove?
  wallGfx.lineStyle(config.wallThickness, PIXI.utils.string2hex(config.doorColor), 1.0, 0.5);    
  wallGfx.drawPolygon(
    doorRect[0], doorRect[1], 
    doorRect[2], doorRect[3],
    doorRect[4], doorRect[5], 
    doorRect[6], doorRect[7],
    doorRect[0], doorRect[1]
    );
  if (config.doorFillColor) {
    wallGfx.endFill();
  }
};

const drawDoorShadow = (gfx, config, door) => {
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

  gfx.lineStyle({
    // wide enough to be exposed on either side
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5,  // middle
    join: "round"
  });

  // left jamb
  gfx.moveTo(door[2], door[3]);
  gfx.lineTo(rectEnd[0], rectEnd[1]);

  // right jamb
  gfx.moveTo(jamb1End[0], jamb1End[1]);
  gfx.lineTo(door[0], door[1]);

  // door rectangle
  gfx.drawPolygon(
    doorRect[0], doorRect[1], 
    doorRect[2], doorRect[3],
    doorRect[4], doorRect[5], 
    doorRect[6], doorRect[7],
    doorRect[0], doorRect[1]
    );    
};

