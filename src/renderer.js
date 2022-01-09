import * as geo from "./geo-utils.js";
import { getTheme } from "./themes.js";
// importing a local copy of PIXI filters, to avoid a long chain of npm pixi dependencies
import "./lib/pixi-filters.min.js";

/**
 * Render the given dungeon state into the given container.
 */
export const render = async (container, state) => {
  // clear everything
  container.clear();
  // add a background image if specified
  await addBackgroundImage(container, state.config);
  // main geometry/config render pass
  await renderPass(container, state);
  // draw theme-painted areas as additional render passes
  await drawThemeAreas(container, state);
};

/**
 * Possibly add a background image to the container.
 */
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

/** If sprite is a video, start playing it. */
const maybeStartSpriteVideo = (sprite) => {
  const source = sprite.texture.baseTexture.resource.source;
  const isVideo = source && source.tagName === "VIDEO";
  if (isVideo) {
    source.loop = true;
    source.volume = game.settings.get("core", "globalAmbientVolume");
    game.video.play(source);
  }
};

/**
 * Render pass: draw the given dungeon state/config into the given container.
 *
 * Child graphics ordering:
 * - exterior shadow
 * - floor
 * - interior shadow
 * - walls
 * - doors
 */
const renderPass = async (container, state) => {
  if (!state.geometry) {
    return;
  }

  const floorGfx = new PIXI.Graphics();
  const interiorShadowGfx = new PIXI.Graphics();
  const wallGfx = new PIXI.Graphics();
  const doorGfx = new PIXI.Graphics();

  // maybe draw an outer surrounding blurred shadow
  addExteriorShadow(container, state.config, state.geometry);

  // use a mask to clip the tiled background and interior shadows
  const clipMask = new PIXI.Graphics();
  drawMultiPolygonMask(clipMask, state.geometry);
  // TODO: verify mask add
  // the add seems necessary for inner shadows to show?
  container.addChild(clipMask);

  interiorShadowGfx.mask = clipMask;
  // apply alpha filter once for entire shadow graphics, so overlaps aren't additive
  const alphaFilter = new PIXI.filters.AlphaFilter(
    state.config.interiorShadowOpacity
  );
  const blurFilter = new PIXI.filters.BlurFilter();
  interiorShadowGfx.filters = [alphaFilter, blurFilter];

  // draw the dungeon geometry room(s)
  drawMultiPolygonRoom(
    floorGfx,
    interiorShadowGfx,
    wallGfx,
    state.config,
    state.geometry
  );

  const wallMask = new PIXI.Graphics();
  const maskConfig = JSON.parse(JSON.stringify(state.config));
  maskConfig.wallColor = "#000000";

  // draw interior walls
  for (const wall of state.interiorWalls) {
    drawInteriorWallShadow(interiorShadowGfx, state.config, wall);
    if (state.config.wallTexture) {
      drawInteriorWall(wallMask, maskConfig, wall);
    } else {
      drawInteriorWall(wallGfx, state.config, wall);
    }
  }

  // draw doors
  for (const door of state.doors) {
    drawDoorShadow(interiorShadowGfx, state.config, door);
    drawDoor(doorGfx, wallGfx, wallMask, state.config, door);
  }
  for (const secretDoor of state.secretDoors) {
    drawInteriorWallShadow(interiorShadowGfx, state.config, secretDoor);
    drawSecretDoor(doorGfx, wallGfx, wallMask, state.config, secretDoor);
  }

  // layer everything properly
  container.addChild(floorGfx);
  container.addChild(interiorShadowGfx);
  if (state.config.wallTexture) {
    drawMultiPolygonWallMask(
      wallMask,
      state.geometry,
      state.config.wallThickness
    );
    // TODO: verify mask add
    container.addChild(wallMask);
    // expand our geometry, so we add sprites
    // under the half of the wall thickness that expands past the geometry
    const expandedGeometry = geo.expandGeometry(
      state.geometry,
      state.config.wallThickness / 2.0
    );
    const tex = await getTexture(state.config.wallTexture);
    let matrix = null;
    if (state.config.wallTextureRotation) {
      matrix = PIXI.Matrix.IDENTITY.clone();
      matrix.rotate(state.config.wallTextureRotation * PIXI.DEG_TO_RAD);
    }
    wallGfx.beginTextureFill({
      texture: tex,
      alpha: state.config.wallOpacity,
      matrix,
    });
    const flatCoords = expandedGeometry
      .getCoordinates()
      .map((c) => [c.x, c.y])
      .flat();
    wallGfx.drawPolygon(flatCoords);
    wallGfx.endFill();
    wallGfx.mask = wallMask;
    if (state.config.wallTextureTint) {
      wallGfx.tint = PIXI.utils.string2hex(state.config.wallTextureTint);
    }
  }
  container.addChild(wallGfx);
  container.addChild(doorGfx);
};

const drawThemeAreas = async (container, state) => {
  for (const area of state.themeAreas) {
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
    // so the dungeon doors etc look consistent at meet up areas
    areaState.config.doorColor = state.config.doorColor;
    areaState.config.doorFillColor = state.config.doorFillColor;
    areaState.config.doorFillOpacity = state.config.doorFillOpacity;
    areaState.config.doorThickness = state.config.doorThickness;
    areaState.config.wallColor = state.config.wallColor;
    areaState.config.wallTexture = state.config.wallTexture;
    areaState.config.wallThickness = state.config.wallThickness;
    areaState.config.exteriorShadowOpacity = 0.0; // don't draw additional exterior shadows
    //areaState.config.interiorShadowOpacity = 0.0; // don't draw additional interior shadows

    // mask for our area shape
    const areaContainer = new PIXI.Container();
    const areaMask = new PIXI.Graphics();
    areaMask.beginFill(0xffffff, 1.0);
    areaMask.drawPolygon(area.points.flat());
    areaMask.endFill();
    areaContainer.mask = areaMask;

    // render the theme, clipping to our rectangle
    const clipPoly = geo.pointsToPolygon(area.points);
    await renderPass(areaContainer, areaState, { clipPoly });

    // TODO: verify mask add
    container.addChild(areaMask);
    container.addChild(areaContainer);
  }
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

/** Add an exterior blurred shadow. */
const addExteriorShadow = (container, config, geometry) => {
  if (
    !config.exteriorShadowThickness ||
    !config.exteriorShadowOpacity ||
    !geometry
  ) {
    // no visible shadows
    return;
  }

  // one graphics for all exterior shadow
  const exteriorShadowGfx = new PIXI.Graphics();
  exteriorShadowGfx.lineStyle({
    width: config.wallThickness + config.exteriorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
  });

  // draw exterior for each poly
  for (let i = 0; i < geometry.getNumGeometries(); i++) {
    const poly = geometry.getGeometryN(i);
    addExteriorShadowForPoly(exteriorShadowGfx, config, poly);
  }

  // filters
  const alphaFilter = new PIXI.filters.AlphaFilter(
    config.exteriorShadowOpacity
  );
  const blurFilter = new PIXI.filters.BlurFilter();
  exteriorShadowGfx.filters = [alphaFilter, blurFilter];
  container.addChild(exteriorShadowGfx);
};

/** Add an exterior blurred shadow for the given polygon. */
const addExteriorShadowForPoly = (exteriorShadowGfx, config, poly) => {
  // draw shadow around the exterior ring of the polygon
  const exterior = poly.getExteriorRing();
  exteriorShadowGfx.drawPolygon(
    exterior
      .getCoordinates()
      .map((c) => [c.x, c.y])
      .flat()
  );

  // draw inner hole shadows
  const numHoles = poly.getNumInteriorRing();
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    exteriorShadowGfx.drawPolygon(
      hole
        .getCoordinates()
        .map((c) => [c.x, c.y])
        .flat()
    );
  }
};

const drawPolygonMask = (gfx, poly) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map((c) => [c.x, c.y]).flat();
  gfx.beginFill(0xffffff, 1.0);
  gfx.drawPolygon(flatCoords);
  gfx.endFill();

  const numHoles = poly.getNumInteriorRing();
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map((c) => [c.x, c.y]).flat();
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

const drawPolygonWallMask = (gfx, poly, wallThickness) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map((c) => [c.x, c.y]).flat();
  gfx.lineStyle(wallThickness, PIXI.utils.string2hex("#000000"), 1.0, 0.5);
  gfx.drawPolygon(flatCoords);

  // draw interior hole wall polys
  const numHoles = poly.getNumInteriorRing();
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map((c) => [c.x, c.y]).flat();
    gfx.lineStyle(wallThickness, PIXI.utils.string2hex("#000000"), 1.0);
    gfx.drawPolygon(flatCoords);
  }
};

const drawMultiPolygonWallMask = (gfx, multi, wallThickness) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    drawPolygonWallMask(gfx, poly, wallThickness);
  }
};

const drawMultiPolygonRoom = (
  floorGfx,
  interiorShadowGfx,
  wallGfx,
  config,
  multi
) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    drawPolygonRoom(floorGfx, interiorShadowGfx, wallGfx, config, poly);
  }
};

const drawPolygonRoom = async (
  floorGfx,
  interiorShadowGfx,
  wallGfx,
  config,
  poly
) => {
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  const flatCoords = coords.map((c) => [c.x, c.y]).flat();

  // draw a floor texture if specified, otherwise solid-color floor
  if (config.floorTexture) {
    // TODO: optimize to not load the texture each pass
    const tex = await getTexture(config.floorTexture);
    let matrix = null;
    if (config.floorTextureRotation) {
      matrix = PIXI.Matrix.IDENTITY.clone();
      matrix.rotate(config.floorTextureRotation * PIXI.DEG_TO_RAD);
    }
    floorGfx.beginTextureFill({
      texture: tex,
      alpha: config.floorOpacity,
      matrix,
    });
    floorGfx.drawPolygon(flatCoords);
    floorGfx.endFill();
    if (config.floorTextureTint) {
      floorGfx.tint = PIXI.utils.string2hex(config.floorTextureTint);
    }
  } else {
    floorGfx.beginFill(
      PIXI.utils.string2hex(config.floorColor),
      config.floorOpacity
    );
    floorGfx.drawPolygon(flatCoords);
    floorGfx.endFill();
  }

  // cut out holes
  const numHoles = poly.getNumInteriorRing();
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map((c) => [c.x, c.y]).flat();
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
      width: config.wallThickness + config.interiorShadowThickness,
      color: PIXI.utils.string2hex(config.interiorShadowColor),
      alignment: 0.5, // middle
      join: "round",
    });
    interiorShadowGfx.drawPolygon(flatCoords);
  }

  // draw outer wall poly
  if (!config.wallTexture) {
    wallGfx.lineStyle(
      config.wallThickness,
      PIXI.utils.string2hex(config.wallColor),
      config.wallOpacity,
      0.5
    );
    wallGfx.drawPolygon(flatCoords);
  }

  // draw interior hole walls/shadows
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    const flatCoords = coords.map((c) => [c.x, c.y]).flat();

    // draw hole wall outer drop shadows
    interiorShadowGfx.drawPolygon(flatCoords);

    // draw hole wall poly
    if (!config.wallTexture) {
      wallGfx.lineStyle(
        config.wallThickness,
        PIXI.utils.string2hex(config.wallColor),
        config.wallOpacity
      );
      wallGfx.drawPolygon(flatCoords);
    }
  }
};

// [x1, y1, x2, y2]
const drawInteriorWall = (wallGfx, config, wall) => {
  wallGfx.lineStyle({
    width: config.wallThickness,
    color: PIXI.utils.string2hex(config.wallColor),
    alpha: config.wallOpacity,
    alignment: 0.5, // middle
    cap: "round",
  });
  wallGfx.moveTo(wall[0], wall[1]);
  wallGfx.lineTo(wall[2], wall[3]);
};

const drawInteriorWallShadow = (gfx, config, wall) => {
  gfx.lineStyle({
    // wide enough to be exposed on either side
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
    cap: "round",
  });
  gfx.moveTo(wall[2], wall[3]);
  gfx.lineTo(wall[0], wall[1]);
};

// [x1, y1, x2, y2]
const drawDoor = (doorGfx, wallGfx, wallMask, config, door) => {
  // calculate some door dimensions
  const totalLength = geo.distanceBetweenPoints(
    door[0],
    door[1],
    door[2],
    door[3]
  );
  const jambLength = 20;
  const rectLength = totalLength - 2 * jambLength;
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [
    door[0] + deltaX * jambFraction,
    door[1] + deltaY * jambFraction,
  ];
  const rectEnd = [
    door[0] + deltaX * rectEndFraction,
    door[1] + deltaY * rectEndFraction,
  ];
  const doorRect = geo.rectangleForSegment(
    config.doorThickness,
    jamb1End[0],
    jamb1End[1],
    rectEnd[0],
    rectEnd[1]
  );

  // draw the door jamb at wall thickness, either into the texture mask or onto the wall graphics
  if (config.wallTexture) {
    wallMask.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex(config.wallColor),
      alpha: config.wallOpacity,
      alignment: 0.5, // middle
      cap: "round",
    });
    wallMask.moveTo(door[0], door[1]);
    // left jamb
    wallMask.lineTo(jamb1End[0], jamb1End[1]);
    // right jamb
    wallMask.moveTo(rectEnd[0], rectEnd[1]);
    wallMask.lineTo(door[2], door[3]);
  } else {
    wallGfx.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex(config.wallColor),
      alpha: config.wallOpacity,
      alignment: 0.5, // middle
      cap: "round",
    });
    wallGfx.moveTo(door[0], door[1]);
    // left jamb
    wallGfx.lineTo(jamb1End[0], jamb1End[1]);
    // right jamb
    wallGfx.moveTo(rectEnd[0], rectEnd[1]);
    wallGfx.lineTo(door[2], door[3]);
  }
  // door rectangle
  if (config.doorFillOpacity) {
    doorGfx.beginFill(
      PIXI.utils.string2hex(config.doorFillColor),
      config.doorFillOpacity
    );
  }
  // door rectangle is drawn at a different line thickness
  doorGfx.lineStyle(
    config.doorLineThickness,
    PIXI.utils.string2hex(config.doorColor),
    1.0,
    0.5
  );
  doorGfx.drawPolygon(
    doorRect[0],
    doorRect[1],
    doorRect[2],
    doorRect[3],
    doorRect[4],
    doorRect[5],
    doorRect[6],
    doorRect[7],
    doorRect[0],
    doorRect[1]
  );
  if (config.doorFillColor) {
    doorGfx.endFill();
  }
};

const drawSecretDoor = (doorGfx, wallGfx, wallMask, config, door) => {
  const isGM = game.user.isGM;
  if (
    (isGM && config.secretDoorStyleGM === "door") ||
    (!isGM && config.secretDoorStylePlayer === "door")
  ) {
    // TODO: need to draw door shadow. where?
    drawDoor(doorGfx, wallGfx, wallMask, config, door);
    return;
  }

  const totalLength = geo.distanceBetweenPoints(
    door[0],
    door[1],
    door[2],
    door[3]
  );
  const rectLength = 40.0;
  const jambLength = (totalLength - rectLength) / 2.0;
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [
    door[0] + deltaX * jambFraction,
    door[1] + deltaY * jambFraction,
  ];
  const middle = [door[0] + deltaX * 0.5, door[1] + deltaY * 0.5];
  const rectEnd = [
    door[0] + deltaX * rectEndFraction,
    door[1] + deltaY * rectEndFraction,
  ];
  const doorRect = geo.rectangleForSegment(
    30.0,
    jamb1End[0],
    jamb1End[1],
    rectEnd[0],
    rectEnd[1]
  );

  // draw a wall across the door opening
  if (config.wallTexture) {
    wallMask.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex("#000000"),
      alpha: 1.0,
      alignment: 0.5, // middle
      cap: "round",
    });
    wallMask.moveTo(door[0], door[1]);
    wallMask.lineTo(door[2], door[3]);
  } else {
    wallGfx.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex(config.wallColor),
      alpha: config.wallOpacity,
      alignment: 0.5, // middle
      cap: "round",
    });
    wallGfx.moveTo(door[0], door[1]);
    wallGfx.lineTo(door[2], door[3]);
  }

  // possibly draw an additional S-shape through the wall
  if (
    (isGM && config.secretDoorStyleGM === "secret") ||
    (!isGM && config.secretDoorStylePlayer === "secret")
  ) {
    const midRect = geo.rectangleForSegment(
      50.0,
      jamb1End[0],
      jamb1End[1],
      middle[0],
      middle[1]
    );
    const midRect2 = geo.rectangleForSegment(
      50.0,
      middle[0],
      middle[1],
      rectEnd[0],
      rectEnd[1]
    );
    doorGfx.lineStyle({
      width: 5.0,
      color: PIXI.utils.string2hex(config.secretDoorSColor),
      alpha: 1.0,
      alignment: 0.5, // middle
      cap: "round",
    });
    doorGfx.moveTo(doorRect[6], doorRect[7]);
    doorGfx.bezierCurveTo(
      midRect[0],
      midRect[1],
      midRect[2],
      midRect[3],
      middle[0],
      middle[1]
    );
    doorGfx.bezierCurveTo(
      midRect2[6],
      midRect2[7],
      midRect2[4],
      midRect2[5],
      doorRect[2],
      doorRect[3]
    );
  }
};

const drawDoorShadow = (gfx, config, door) => {
  // TODO: DRY up these repeated dimension calculations
  const totalLength = geo.distanceBetweenPoints(
    door[0],
    door[1],
    door[2],
    door[3]
  );
  const jambLength = 20;
  const rectLength = totalLength - 2 * jambLength;
  const jambFraction = jambLength / totalLength;
  const rectFraction = rectLength / totalLength;
  const rectEndFraction = jambFraction + rectFraction;
  const deltaX = door[2] - door[0];
  const deltaY = door[3] - door[1];
  const jamb1End = [
    door[0] + deltaX * jambFraction,
    door[1] + deltaY * jambFraction,
  ];
  const rectEnd = [
    door[0] + deltaX * rectEndFraction,
    door[1] + deltaY * rectEndFraction,
  ];
  const doorRect = geo.rectangleForSegment(
    config.doorThickness,
    jamb1End[0],
    jamb1End[1],
    rectEnd[0],
    rectEnd[1]
  );

  gfx.lineStyle({
    // wide enough to be exposed on either side
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
  });

  // left jamb
  gfx.moveTo(door[2], door[3]);
  gfx.lineTo(rectEnd[0], rectEnd[1]);

  // right jamb
  gfx.moveTo(jamb1End[0], jamb1End[1]);
  gfx.lineTo(door[0], door[1]);

  gfx.lineStyle({
    // wide enough to be exposed on either side
    width: config.doorLineThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
  });

  // door rectangle
  gfx.drawPolygon(
    doorRect[0],
    doorRect[1],
    doorRect[2],
    doorRect[3],
    doorRect[4],
    doorRect[5],
    doorRect[6],
    doorRect[7],
    doorRect[0],
    doorRect[1]
  );
};
