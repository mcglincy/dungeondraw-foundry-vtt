import * as geo from "./geo-utils.js";

/**
 * Render the given dungeon state into the given container.
 */
export const render = async (container, state) => {
  // clear everything
  container.clear();
  // main geometry/config render pass
  await renderPass(container, state);
  // draw theme-painted areas as additional render passes
  await drawThemeAreas(container, state);
};

/** If texture is a video, start playing it. */
const maybeStartTextureVideo = (texture) => {
  const source = texture?.baseTexture?.resource?.source;
  const isVideo = source && source.tagName === "VIDEO";
  if (isVideo) {
    source.loop = true;
    // set to muted to avoid "play() failed because the user didn't interact with the document first" error
    source.muted = true;
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
  let tiledWallContainer = null;

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
  const alphaFilter = new PIXI.AlphaFilter(state.config.interiorShadowOpacity);
  const blurFilter = new PIXI.BlurFilter();
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

  // draw interior wall shapes (dense geometry for smooth curves)
  for (const shape of state.interiorWallShapes || []) {
    drawInteriorWallShapeShadow(interiorShadowGfx, state.config, shape);
    if (state.config.wallTexture) {
      drawInteriorWallShape(wallMask, maskConfig, shape);
    } else {
      drawInteriorWallShape(wallGfx, state.config, shape);
    }
  }

  // draw invisible walls
  for (const wall of state.invisibleWalls) {
    // draw on the door gfx, so invis walls get layered on top of regular
    // walls. E.g., when used as visible windows.
    drawInvisibleWallShadow(interiorShadowGfx, state.config, wall);
    drawInvisibleWall(doorGfx, wallGfx, wallMask, state.config, wall);
  }

  // draw invisible wall shapes (dense geometry for smooth curves)
  for (const shape of state.invisibleWallShapes || []) {
    drawInvisibleWallShapeShadow(interiorShadowGfx, state.config, shape);
    drawInvisibleWallShape(doorGfx, state.config, shape);
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
  for (const window of state.windows || []) {
    drawWindowShadow(interiorShadowGfx, state.config, window);
    drawWindow(doorGfx, wallGfx, wallMask, state.config, window);
  }

  // draw stairs
  const stairsGfx = new PIXI.Graphics();
  for (const stair of state.stairs || []) {
    drawStairs(stairsGfx, state.config, stair);
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
    const texture = await getTexture(state.config.wallTexture);
    if (texture?.valid) {
      maybeStartTextureVideo(texture);
      if (state.config.wallTileEnabled) {
        // Sprite-based tiled rendering: place repeating tiles along each segment,
        // clipped by wallMask so the last tile is cut off at the segment end.
        tiledWallContainer = new PIXI.Container();
        drawTiledWallGeometry(
          tiledWallContainer,
          state.config,
          texture,
          state.geometry
        );
        for (const wall of state.interiorWalls) {
          drawTiledWallSegment(
            tiledWallContainer,
            state.config,
            texture,
            wall[0],
            wall[1],
            wall[2],
            wall[3]
          );
        }
        for (const shape of state.interiorWallShapes || []) {
          drawTiledWallShape(tiledWallContainer, state.config, texture, shape);
        }
        tiledWallContainer.mask = wallMask;
      } else if (state.config.wallTextureDirectional) {
        // Per-segment directional texture: rotate each segment's texture to match its angle
        drawDirectionalWallTextures(
          wallGfx,
          state.config,
          texture,
          state.geometry
        );
        for (const wall of state.interiorWalls) {
          drawDirectionalSegmentTexture(
            wallGfx,
            state.config,
            texture,
            wall[0],
            wall[1],
            wall[2],
            wall[3]
          );
        }
        for (const shape of state.interiorWallShapes || []) {
          drawDirectionalShapeTexture(wallGfx, state.config, texture, shape);
        }
        wallGfx.mask = wallMask;
        if (state.config.wallTextureTint) {
          wallGfx.tint = PIXI.utils.string2hex(state.config.wallTextureTint);
        }
      } else {
        // Single global texture fill over the expanded geometry
        const expandedGeometry = geo.expandGeometry(
          state.geometry,
          state.config.wallThickness / 2.0
        );
        const matrix = PIXI.Matrix.IDENTITY.clone();
        if (state.config.wallTextureRotation) {
          matrix.rotate(state.config.wallTextureRotation * PIXI.DEG_TO_RAD);
        }
        if (state.config.WallTextureScaling) {
          matrix.scale(
            state.config.WallTextureScaling,
            state.config.WallTextureScaling
          );
        }
        wallGfx.beginTextureFill({ texture, alpha: 1.0, matrix });
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
    }
  }
  container.addChild(stairsGfx);
  if (tiledWallContainer) {
    container.addChild(tiledWallContainer);
  }
  container.addChild(wallGfx);
  container.addChild(doorGfx);
};

const drawThemeAreas = async (container, state) => {
  for (const area of state.themeAreas) {
    // hacky way to pass down the actual theme to paint
    const areaState = state.clone();
    areaState.config = area.config;
    // For now, just keep certain values from the main state config,
    // so the dungeon doors etc look consistent at meet up areas
    areaState.config.doorColor = state.config.doorColor;
    areaState.config.doorFillColor = state.config.doorFillColor;
    areaState.config.doorFillOpacity = state.config.doorFillOpacity;
    areaState.config.doorThickness = state.config.doorThickness;
    if (areaState.config.matchBaseWalls) {
      areaState.config.wallColor = state.config.wallColor;
      areaState.config.wallTexture = state.config.wallTexture;
      areaState.config.wallTextureTint = state.config.wallTextureTint;
      areaState.config.wallThickness = state.config.wallThickness;
    }
    areaState.config.exteriorShadowOpacity = 0.0; // don't draw additional exterior shadows

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
    const texture = await foundry.canvas.loadTexture(path);
    if (!texture) {
      ui.notifications.error(
        `${game.i18n.localize("DD.TextureLoadFailure")}: ${path}`
      );
    }
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
  const alphaFilter = new PIXI.AlphaFilter(config.exteriorShadowOpacity);
  const blurFilter = new PIXI.BlurFilter();
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
    const texture = await getTexture(config.floorTexture);
    if (texture?.valid) {
      let matrix = null;
      matrix = PIXI.Matrix.IDENTITY.clone();
      if (config.floorTextureRotation) {
        matrix.rotate(config.floorTextureRotation * PIXI.DEG_TO_RAD);
      }
      if (config.floorTextureScaling) {
        matrix.scale(config.floorTextureScaling, config.floorTextureScaling);
      }
      maybeStartTextureVideo(texture);
      floorGfx.beginTextureFill({
        texture,
        alpha: config.floorOpacity,
        matrix,
      });
      floorGfx.drawPolygon(flatCoords);
      floorGfx.endFill();
      if (config.floorTextureTint) {
        floorGfx.tint = PIXI.utils.string2hex(config.floorTextureTint);
      }
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
      1.0,
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
        1.0
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
    alpha: 1.0,
    alignment: 0.5, // middle
    cap: "round",
  });
  wallGfx.moveTo(wall[0], wall[1]);
  wallGfx.lineTo(wall[2], wall[3]);
};

const drawInvisibleWall = (doorGfx, wallGfx, wallMask, config, wall) => {
  const doorConfig = {
    doorColor: config.invisibleWallColor,
    doorLineThickness: config.invisibleWallLineThickness,
    doorFillColor: config.invisibleWallFillColor,
    doorFillOpacity: config.invisibleWallFillOpacity,
    doorThickness: config.invisibleWallThickness,
    wallColor: config.wallColor,
    wallTexture: config.wallTexture,
    wallThickness: config.wallThickness,
  };
  drawDoor(doorGfx, wallGfx, wallMask, doorConfig, wall);
  // and another line across the rectangle
  doorGfx.lineStyle({
    width: config.invisibleWallLineThickness,
    color: PIXI.utils.string2hex(config.invisibleWallColor),
    alpha: 1.0,
    alignment: 0.5, // middle
  });
  doorGfx.moveTo(wall[0], wall[1]);
  doorGfx.lineTo(wall[2], wall[3]);
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

// Draw interior wall shape as closed polygon (dense points for smooth curves)
// shape is [[x, y], [x, y], ...]
const drawInteriorWallShape = (wallGfx, config, shape) => {
  wallGfx.lineStyle({
    width: config.wallThickness,
    color: PIXI.utils.string2hex(config.wallColor),
    alpha: 1.0,
    alignment: 0.5, // middle
    join: "round",
  });
  const flatCoords = shape.flat();
  wallGfx.drawPolygon(flatCoords);
};

const drawInteriorWallShapeShadow = (gfx, config, shape) => {
  gfx.lineStyle({
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
  });
  const flatCoords = shape.flat();
  gfx.drawPolygon(flatCoords);
};

// Draw invisible wall shape as closed polygon (dense points for smooth curves)
const drawInvisibleWallShape = (doorGfx, config, shape) => {
  doorGfx.lineStyle({
    width: config.invisibleWallLineThickness,
    color: PIXI.utils.string2hex(config.invisibleWallColor),
    alpha: 1.0,
    alignment: 0.5, // middle
    join: "round",
  });
  const flatCoords = shape.flat();
  doorGfx.drawPolygon(flatCoords);
};

const drawInvisibleWallShapeShadow = (gfx, config, shape) => {
  gfx.lineStyle({
    width: config.invisibleWallLineThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5, // middle
    join: "round",
  });
  const flatCoords = shape.flat();
  gfx.drawPolygon(flatCoords);
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
      alpha: 1.0,
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
      alpha: 1.0,
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

const drawInvisibleWallShadow = (gfx, config, wall) => {
  const doorConfig = {
    doorLineThickness: config.invisibleWallLineThickness,
    doorThickness: config.invisibleWallThickness,
    interiorShadowColor: config.interiorShadowColor,
    interiorShadowThickness: config.interiorShadowThickness,
    wallThickness: config.wallThickness,
  };
  drawDoorShadow(gfx, doorConfig, wall);
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

// [x1, y1, x2, y2]
const drawWindow = (doorGfx, wallGfx, wallMask, config, window) => {
  // calculate window dimensions (similar to door)
  const totalLength = geo.distanceBetweenPoints(
    window[0],
    window[1],
    window[2],
    window[3]
  );
  const jambLength = 15;
  const windowLength = totalLength - 2 * jambLength;
  const jambFraction = jambLength / totalLength;
  const windowFraction = windowLength / totalLength;
  const windowEndFraction = jambFraction + windowFraction;
  const deltaX = window[2] - window[0];
  const deltaY = window[3] - window[1];
  const jamb1End = [
    window[0] + deltaX * jambFraction,
    window[1] + deltaY * jambFraction,
  ];
  const windowEnd = [
    window[0] + deltaX * windowEndFraction,
    window[1] + deltaY * windowEndFraction,
  ];

  // draw the window jambs at wall thickness
  if (config.wallTexture) {
    wallMask.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex(config.wallColor),
      alpha: 1.0,
      alignment: 0.5,
      cap: "round",
    });
    wallMask.moveTo(window[0], window[1]);
    wallMask.lineTo(jamb1End[0], jamb1End[1]);
    wallMask.moveTo(windowEnd[0], windowEnd[1]);
    wallMask.lineTo(window[2], window[3]);
  } else {
    wallGfx.lineStyle({
      width: config.wallThickness,
      color: PIXI.utils.string2hex(config.wallColor),
      alpha: 1.0,
      alignment: 0.5,
      cap: "round",
    });
    wallGfx.moveTo(window[0], window[1]);
    wallGfx.lineTo(jamb1End[0], jamb1End[1]);
    wallGfx.moveTo(windowEnd[0], windowEnd[1]);
    wallGfx.lineTo(window[2], window[3]);
  }

  // draw crossed lines to indicate window (non-solid wall)
  // use door color for the window frame
  const lineThickness = config.doorLineThickness || 2;
  doorGfx.lineStyle(
    lineThickness,
    PIXI.utils.string2hex(config.doorColor),
    1.0,
    0.5
  );

  // calculate perpendicular direction for cross lines
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const perpX = (-deltaY / length) * (config.doorThickness / 2);
  const perpY = (deltaX / length) * (config.doorThickness / 2);

  // draw cross lines along the window, starting at jamb1End and ending at windowEnd
  const numCrossLines = 3;
  for (let i = 0; i < numCrossLines; i++) {
    // t ranges from 0 to 1, so first line is at start, last line is at end
    const t = numCrossLines > 1 ? i / (numCrossLines - 1) : 0.5;
    const crossX = jamb1End[0] + (windowEnd[0] - jamb1End[0]) * t;
    const crossY = jamb1End[1] + (windowEnd[1] - jamb1End[1]) * t;

    doorGfx.moveTo(crossX - perpX, crossY - perpY);
    doorGfx.lineTo(crossX + perpX, crossY + perpY);
  }

  // draw the window frame outline (thin line along the window)
  doorGfx.moveTo(jamb1End[0], jamb1End[1]);
  doorGfx.lineTo(windowEnd[0], windowEnd[1]);
};

const drawWindowShadow = (gfx, config, window) => {
  const totalLength = geo.distanceBetweenPoints(
    window[0],
    window[1],
    window[2],
    window[3]
  );
  const jambLength = 15;
  const jambFraction = jambLength / totalLength;
  const windowFraction = (totalLength - 2 * jambLength) / totalLength;
  const windowEndFraction = jambFraction + windowFraction;
  const deltaX = window[2] - window[0];
  const deltaY = window[3] - window[1];
  const jamb1End = [
    window[0] + deltaX * jambFraction,
    window[1] + deltaY * jambFraction,
  ];
  const windowEnd = [
    window[0] + deltaX * windowEndFraction,
    window[1] + deltaY * windowEndFraction,
  ];

  gfx.lineStyle({
    width: config.wallThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5,
    join: "round",
  });

  // left jamb shadow
  gfx.moveTo(window[2], window[3]);
  gfx.lineTo(windowEnd[0], windowEnd[1]);

  // right jamb shadow
  gfx.moveTo(jamb1End[0], jamb1End[1]);
  gfx.lineTo(window[0], window[1]);

  // window line shadow (thinner)
  gfx.lineStyle({
    width: config.doorLineThickness + config.interiorShadowThickness,
    color: PIXI.utils.string2hex(config.interiorShadowColor),
    alignment: 0.5,
    join: "round",
  });
  gfx.moveTo(jamb1End[0], jamb1End[1]);
  gfx.lineTo(windowEnd[0], windowEnd[1]);
};

/**
 * Draw stairs as parallel lines within a trapezoid shape.
 * @param {PIXI.Graphics} gfx - Graphics object to draw on
 * @param {Object} config - Dungeon config with wall color settings
 * @param {Object} stair - Stair data { x1, y1, x2, y2, x3, y3, x4, y4 }
 */
const drawStairs = (gfx, config, stair) => {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = stair;

  // Calculate perpendicular distance (stair length)
  const perpDist = Math.sqrt((x3 - x1) ** 2 + (y3 - y1) ** 2);

  if (perpDist < 1) return;

  // Fixed line spacing (1/3 of grid size)
  const lineSpacing = canvas.grid.size / 3;
  const lineCount = Math.max(2, Math.floor(perpDist / lineSpacing) + 1);

  // Use stairs color
  gfx.lineStyle({
    width: config.wallThickness || 8,
    color: PIXI.utils.string2hex(config.stairsColor || "#000000"),
    alpha: 1.0,
    alignment: 0.5,
    cap: "round",
  });

  for (let i = 0; i < lineCount; i++) {
    const t = lineCount > 1 ? i / (lineCount - 1) : 0;

    // Interpolate start point along left edge (x1,y1 → x3,y3)
    const startX = x1 + (x3 - x1) * t;
    const startY = y1 + (y3 - y1) * t;

    // Interpolate end point along right edge (x2,y2 → x4,y4)
    const endX = x2 + (x4 - x2) * t;
    const endY = y2 + (y4 - y2) * t;

    // Draw line
    gfx.moveTo(startX, startY);
    gfx.lineTo(endX, endY);
  }
};

/**
 * Place repeating tile sprites along a single wall segment.
 * Each sprite is uniformly scaled so its width equals wallTileLength grid
 * squares; height is preserved by aspect ratio and clipped by the wallMask.
 */
const drawTiledWallSegment = (container, config, texture, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLength = Math.sqrt(dx * dx + dy * dy);
  if (segmentLength === 0) return;

  const angle = Math.atan2(dy, dx);
  const tileWorldWidth = config.wallTileLength * canvas.grid.size;
  // Uniform scale: set width = tileWorldWidth, preserve aspect ratio.
  // The wallMask clips whatever extends past the wall stroke thickness.
  const scale = tileWorldWidth / texture.width;
  const numTiles = Math.ceil(segmentLength / tileWorldWidth);

  for (let i = 0; i < numTiles; i++) {
    const tileX = x1 + Math.cos(angle) * i * tileWorldWidth;
    const tileY = y1 + Math.sin(angle) * i * tileWorldWidth;

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0, 0.5);
    sprite.position.set(tileX, tileY);
    sprite.rotation = angle;
    sprite.scale.set(scale, scale);
    if (config.wallTextureTint) {
      sprite.tint = PIXI.utils.string2hex(config.wallTextureTint);
    }
    container.addChild(sprite);
  }
};

/** Tile all exterior wall edges of a MultiPolygon geometry. */
const drawTiledWallGeometry = (container, config, texture, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    const exterior = poly.getExteriorRing();
    const coords = exterior.getCoordinates();
    for (let j = 0; j < coords.length - 1; j++) {
      drawTiledWallSegment(
        container,
        config,
        texture,
        coords[j].x,
        coords[j].y,
        coords[j + 1].x,
        coords[j + 1].y
      );
    }
    const numHoles = poly.getNumInteriorRing();
    for (let h = 0; h < numHoles; h++) {
      const hole = poly.getInteriorRingN(h);
      const holeCoords = hole.getCoordinates();
      for (let j = 0; j < holeCoords.length - 1; j++) {
        drawTiledWallSegment(
          container,
          config,
          texture,
          holeCoords[j].x,
          holeCoords[j].y,
          holeCoords[j + 1].x,
          holeCoords[j + 1].y
        );
      }
    }
  }
};

/** Tile all edges of a closed interior wall shape. */
const drawTiledWallShape = (container, config, texture, shape) => {
  for (let i = 0; i < shape.length - 1; i++) {
    drawTiledWallSegment(
      container,
      config,
      texture,
      shape[i][0],
      shape[i][1],
      shape[i + 1][0],
      shape[i + 1][1]
    );
  }
  if (shape.length > 1) {
    const last = shape[shape.length - 1];
    drawTiledWallSegment(
      container,
      config,
      texture,
      last[0],
      last[1],
      shape[0][0],
      shape[0][1]
    );
  }
};

/**
 * Draw a single wall segment as a textured rectangle, with the texture
 * rotated to align with the segment's direction.
 */
const drawDirectionalSegmentTexture = (
  wallGfx,
  config,
  texture,
  x1,
  y1,
  x2,
  y2
) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const matrix = PIXI.Matrix.IDENTITY.clone();
  matrix.rotate(angle);
  if (config.WallTextureScaling) {
    matrix.scale(config.WallTextureScaling, config.WallTextureScaling);
  }
  const rect = geo.rectangleForSegment(config.wallThickness, x1, y1, x2, y2);
  wallGfx.beginTextureFill({ texture, alpha: 1.0, matrix });
  wallGfx.drawPolygon(rect);
  wallGfx.endFill();
};

/**
 * Draw all exterior wall edges of a MultiPolygon geometry with directional textures.
 */
const drawDirectionalWallTextures = (wallGfx, config, texture, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    const exterior = poly.getExteriorRing();
    const coords = exterior.getCoordinates();
    for (let j = 0; j < coords.length - 1; j++) {
      drawDirectionalSegmentTexture(
        wallGfx,
        config,
        texture,
        coords[j].x,
        coords[j].y,
        coords[j + 1].x,
        coords[j + 1].y
      );
    }
    const numHoles = poly.getNumInteriorRing();
    for (let h = 0; h < numHoles; h++) {
      const hole = poly.getInteriorRingN(h);
      const holeCoords = hole.getCoordinates();
      for (let j = 0; j < holeCoords.length - 1; j++) {
        drawDirectionalSegmentTexture(
          wallGfx,
          config,
          texture,
          holeCoords[j].x,
          holeCoords[j].y,
          holeCoords[j + 1].x,
          holeCoords[j + 1].y
        );
      }
    }
  }
};

/**
 * Draw all edges of an interior wall shape with directional textures.
 * shape is [[x, y], [x, y], ...] (closed polygon)
 */
const drawDirectionalShapeTexture = (wallGfx, config, texture, shape) => {
  for (let i = 0; i < shape.length - 1; i++) {
    drawDirectionalSegmentTexture(
      wallGfx,
      config,
      texture,
      shape[i][0],
      shape[i][1],
      shape[i + 1][0],
      shape[i + 1][1]
    );
  }
  if (shape.length > 1) {
    const last = shape[shape.length - 1];
    drawDirectionalSegmentTexture(
      wallGfx,
      config,
      texture,
      last[0],
      last[1],
      shape[0][0],
      shape[0][1]
    );
  }
};
