import * as geo from "./geo-utils.js";
import { getTheme } from "./themes.js";
// importing a local copy of PIXI filters, to avoid a long chain of npm pixi dependencies
import "./lib/pixi-filters.min.js";

export const render = async (container, state) => {
  container.clear();
  await addBackgroundImage(container, state.config);
  // floor render pass, no additional clipping
  await renderPass(container, state);
  // draw theme-painted areas as additional render passes
  await drawThemeAreas(container, state);
}

const drawThemeAreas = async (container, state) => {
  for (let area of state.themeAreas) {
    const theme = getTheme(area.themeKey);
    if (!theme) {
      console.log(`No such ${area.themeType} theme: ${area.themeKey}`);
      continue;
    }
    // TODO: hacky way to pass down the actual theme to paint
    const areaState = state.clone();    
    // TODO: how should we deal with different wall thicknesses, door colors, etc
    // which look jarring/off when two different themes meet up
    areaState.config = theme.config;
    // TODO: for now, just keep certain values from the main state config,
    // so the dungeon walls etc look consistent at meet up areas
    areaState.config.doorColor = state.config.doorColor;
    areaState.config.doorFillColor = state.config.doorFillColor;
    areaState.config.doorFillOpacity = state.config.doorFillOpacity;
    areaState.config.doorThickness = state.config.doorThickness;
    areaState.config.wallColor = state.config.wallColor;
    areaState.config.wallThickness = state.config.wallThickness;
    areaState.config.exteriorShadowOpacity = 0.0;  // don't draw additional exterior shadows

    // mask for our area shape
    const areaContainer = new PIXI.Container();
    const areaMask = new PIXI.Graphics();
    areaMask.beginFill(0xFFFFFF, 1.0);
    areaMask.drawPolygon(area.points.flat());
    areaMask.endFill();
    areaContainer.mask = areaMask;

    // render the theme, clipping to our rectangle
    const clipPoly = geo.pointsToPolygon(area.points);
    await renderPass(areaContainer, areaState, {clipPoly});

    container.addChild(areaMask);
    container.addChild(areaContainer);
  }
};

const renderPass = async (container, state, options={}) => {
  const floorGfx = new PIXI.Graphics();
  const interiorShadowGfx = new PIXI.Graphics();
  const wallGfx = new PIXI.Graphics();

  if (state.geometry) {
    // maybe draw an outer surrounding blurred shadow
    addExteriorShadow(container, state.config, state.geometry);

    // use a mask to clip the tiled background and interior shadows
    const clipMask = new PIXI.Graphics();
    if (geo.isMultiPolygon(state.geometry)) {
      drawMultiPolygonMask(clipMask, state.geometry);
    } else if (geo.isPolygon(state.geometry)) {
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
      // TODO: having both clipMask / clipPoly parameters is confusing. 
      await addTiledBackground(container, clipMask, state.config, state.geometry, options.clipPoly);
    }

    // draw the dungeon geometry room(s)
    if (geo.isMultiPolygon(state.geometry)) {
      drawMultiPolygonRoom(floorGfx, interiorShadowGfx, wallGfx, state.config, state.geometry);
    } else if (geo.isPolygon(state.geometry)) {
      drawPolygonRoom(floorGfx, interiorShadowGfx, wallGfx, state.config, state.geometry);
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
  for (let secretDoor of state.secretDoors) {
    drawSecretDoor(interiorShadowGfx, wallGfx, state.config, secretDoor);
  }

  // layer everything properly
  container.addChild(floorGfx);
  container.addChild(interiorShadowGfx);
  container.addChild(wallGfx);
};

/** Try-catch wrapper around loadTexture. */
const getTexture = async (path) => {
  try {
    const texture = await loadTexture(path);
    return texture;
  } catch (error) {
    console.log(error);
  }
};

/** Possibly add a background image. */
const addBackgroundImage = async (container, config) => {
  if (config.backgroundImage) {
    // mimicking MapLayer._drawBackground() behavior
    const texture = await getTexture(config.backgroundImage);
    if (texture?.valid) {
      const d = canvas.dimensions;
      const bg = new PIXI.Sprite(texture);
      bg.position.set(d.paddingX - d.shiftX, d.paddingY - d.shiftY);
      // resize the background image to match the scene dimensions
      bg.width = d.sceneWidth;
      bg.height = d.sceneHeight;
      maybeStartSpriteVideo(bg);
      container.addChild(bg); 
    }
  }
};

const maybeStartSpriteVideo = (sprite) => {
  // if video, start playing it
  const source = sprite.texture.baseTexture.resource.source;
  const isVideo = source && source.tagName === "VIDEO";
  if (isVideo) {
    source.loop = true;
    source.volume = game.settings.get("core", "globalAmbientVolume");
    game.video.play(source);   
  }
};

/** Add an exterior blurred shadow. */
const addExteriorShadow = (container, config, geometry) => {
  if (!config.exteriorShadowThickness || !config.exteriorShadowOpacity || !geometry) {
    return;
  }
  if (geo.isMultiPolygon(geometry)) {
    for (let i = 0; i < geometry.getNumGeometries(); i++) {
      const poly = geometry.getGeometryN(i);      
      addExteriorShadowForPoly(container, config, poly);
    }
  } else if (geo.isPolygon(geometry)) {
    addExteriorShadowForPoly(container, config, geometry);
  }
}

/** Add an exterior blurred shadow for the given polygon. */
const addExteriorShadowForPoly = (container, config, poly) => {
  const outerShadow = new PIXI.Graphics();
  // normalize the expanded buffer to remove any oddities
  //const expanded = poly.buffer(config.exteriorShadowThickness).norm();
  const expanded = geo.expandGeometry(poly, config.exteriorShadowThickness);
  outerShadow.beginFill(PIXI.utils.string2hex(config.exteriorShadowColor), config.exteriorShadowOpacity);
  outerShadow.drawPolygon(expanded.getCoordinates().map(c => [c.x, c.y]).flat());
  outerShadow.endFill();
  const blurFilter = new PIXI.filters.BlurFilter();
  outerShadow.filters = [blurFilter];
  container.addChild(outerShadow);
}

/** Add TilingSprites for floor texture. */
const addTiledBackground = async (container, mask, config, geometry, clipPoly) => {
  const texture = await getTexture(config.floorTexture);
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
        (!clipPoly || geo.intersects(clipPoly, rect)) &&
        geo.intersects(geometry, rect) && 
        !geo.touches(geometry, rect)
        ) {
        const sprite = new PIXI.TilingSprite(texture, textureSize, textureSize);
        sprite.x = col * textureSize;
        sprite.y = row * textureSize;
        if (config.floorTextureTint) {
          sprite.tint = foundry.utils.colorStringToHex(config.floorTextureTint);
        }
        maybeStartSpriteVideo(sprite);
        bg.addChild(sprite);
      }
    }
  }
  bg.mask = mask;
  container.addChild(bg);
};

const rectangleForSegment = (thickness, x1, y1, x2, y2) => {
  const slope = geo.slope(x1, y1, x2, y2);
  const rectDelta = thickness / 2.0;

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
    // TODO: there's a weird lag or visual artifact happening between the inner blur shadow and the solid line wall,
    // that sometimes leaves an unshadowed or lighter pixel line/area next to the wall.
    // To (partially) work around that, draw a wider shadow from the middle of the wall, rather than inside.
    interiorShadowGfx.lineStyle({
//      width: config.interiorShadowThickness,
      width: config.wallThickness + config.interiorShadowThickness,
      color: PIXI.utils.string2hex(config.interiorShadowColor),
      alignment: 0.5,  // middle
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
  const doorRect = rectangleForSegment(config.doorThickness, jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);

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

const rectangleForDoor = (thickness, door) => {

};

const drawSecretDoor = (interiorShadowGfx, wallGfx, config, door) => {
  const isGM = game.user.isGM;
  if ((isGM && config.secretDoorStyleGM === "door") ||
      (!isGM && config.secretDoorStylePlayer === "door")) {
    drawDoor(interiorShadowGfx, wallGfx, config, door);
    return;
  }

  const totalLength = geo.distanceBetweenPoints(door[0], door[1], door[2], door[3]);
  const rectLength = 40.0;
  const jambLength = (totalLength - rectLength) / 2.0;
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [door[0] + (deltaX * jambFraction), door[1] + (deltaY * jambFraction)];
  const middle = [door[0] + (deltaX * 0.5), door[1] + (deltaY * 0.5)];
  const rectEnd = [door[0] + (deltaX * rectEndFraction), door[1] + (deltaY * rectEndFraction)]
  const doorRect = rectangleForSegment(30.0, jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);

  // draw drop shadows
  drawInteriorWallShadow(interiorShadowGfx, config, door);

  // draw a wall across the door opening
  wallGfx.lineStyle({
    width: config.wallThickness,
    color: PIXI.utils.string2hex(config.wallColor),
    alpha: 1.0,
    alignment: 0.5, // middle
    cap: "round",
  });
  wallGfx.moveTo(door[0], door[1]);
  wallGfx.lineTo(door[2], door[3]);

  // possibly draw an additional S-shape through the wall
  if ((isGM && config.secretDoorStyleGM === "secret") ||
      (!isGM && config.secretDoorStylePlayer === "secret")) {
    const midRect = rectangleForSegment(50.0, jamb1End[0], jamb1End[1], middle[0], middle[1]);
    const midRect2 = rectangleForSegment(50.0, middle[0], middle[1], rectEnd[0], rectEnd[1]);
    wallGfx.lineStyle({
      width: 5.0,
      color: PIXI.utils.string2hex(config.secretDoorSColor),
      alpha: 1.0,
      alignment: 0.5, // middle
      cap: "round",
    });
    wallGfx.moveTo(doorRect[6], doorRect[7]);
    wallGfx.bezierCurveTo(midRect[0], midRect[1], midRect[2], midRect[3], middle[0], middle[1]);
    wallGfx.bezierCurveTo(midRect2[6], midRect2[7], midRect2[4], midRect2[5], doorRect[2], doorRect[3]);  
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
  const doorRect = rectangleForSegment(config.doorThickness, jamb1End[0], jamb1End[1], rectEnd[0], rectEnd[1]);

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
