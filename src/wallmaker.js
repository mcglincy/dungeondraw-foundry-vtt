import * as constants from "./constants.js";

export const makeWalls = async (state) => {
  if (!game.user.isGM) {
    // need GM privs to delete/create walls
    return;
  }
  await deleteAllWalls();
  if (state.geometry) {
    await makeWallsFromMulti(state.config, state.geometry);
  }
  await makeInteriorWalls(state.config, state.interiorWalls);
  await makeDoors(state.config, state.doors);
  await makeSecretDoors(state.config, state.secretDoors);
};

const deleteAllWalls = async () => {
  try {
    // scene.update() triggers a redraw,
    // which causes an infinite loop of redraw/refresh.
    // so avoid it :P
    const walls = canvas.scene.getEmbeddedCollection("Wall");
    const ids = [];
    for (const wall of walls) {
      const flag = wall.getFlag(constants.MODULE_NAME, "dungeonVersion");
      if (flag) {
        ids.push(wall.id);
      }
    }
    await canvas.scene.deleteEmbeddedDocuments("Wall", ids);
  } catch (error) {
    console.error(error);
  }
};

const makeWallsFromMulti = async (config, multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    await makeWallsFromPoly(config, poly);
  }
};

const makeWallsFromPoly = async (config, poly) => {
  const allWalls = [];
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  for (let i = 0; i < coords.length - 1; i++) {
    // constants.MODULE_NAME
    const data = wallData(
      config,
      coords[i].x,
      coords[i].y,
      coords[i + 1].x,
      coords[i + 1].y
    );
    allWalls.push(data);
  }
  const numHoles = poly.getNumInteriorRing();
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    for (let i = 0; i < coords.length - 1; i++) {
      const data = wallData(
        config,
        coords[i].x,
        coords[i].y,
        coords[i + 1].x,
        coords[i + 1].y
      );
      allWalls.push(data);
    }
  }
  if (allWalls.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeInteriorWalls = async (config, walls) => {
  const allWalls = [];
  for (const wall of walls) {
    const data = wallData(config, wall[0], wall[1], wall[2], wall[3]);
    allWalls.push(data);
  }
  if (allWalls.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeDoors = async (config, doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = doorData(config, door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  if (allDoors.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeSecretDoors = async (config, doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = secretDoorData(config, door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  if (allDoors.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
  }
};

const threeDCanvasEnabled = () => {
  return game.settings.get(
    constants.MODULE_NAME,
    constants.SETTING_3DCANVAS_ENABLED
  );
};

const wallData = (config, x1, y1, x2, y2) => {
  const data = {
    // From Foundry API docs:
    // "The wall coordinates, a length-4 array of finite numbers [x0,y0,x1,y1]"
    c: [x1, y1, x2, y2],
    flags: {},
  };
  data.flags[constants.MODULE_NAME] = {};
  data.flags[constants.MODULE_NAME][constants.FLAG_DUNGEON_VERSION] =
    constants.DUNGEON_VERSION;
  // Maybe set Canvas3D flags
  if (threeDCanvasEnabled()) {
    data.flags["levels-3d-preview"] = {
      joinWall: true,
      wallDepth: config.wallThickness,
      wallTexture: config.wallTexture,
      wallTint: config.wallTexture ? config.wallTextureTint : config.wallColor,
    };
  }
  return data;
};

const doorData = (config, x1, y1, x2, y2) => {
  const data = wallData(config, x1, y1, x2, y2);
  data.door = 1; // door
  // Maybe set Canvas3D flags
  if (threeDCanvasEnabled()) {
    data.flags["levels-3d-preview"]["joinWall"] = false;
    // top and sides of door look like surrounding walls
    data.flags["levels-3d-preview"]["wallSidesTexture"] = config.wallTexture;
    data.flags["levels-3d-preview"]["wallSidesTint"] = config.wallTextureTint;
    // actual door texture in a 2d door
    data.flags["levels-3d-preview"]["wallTexture"] =
      "modules/dungeon-draw/assets/textures/arena-gate-texture.webp";
    // TODO: what do we want to do with wallTint?
    // data.flags["levels-3d-preview"]["wallTint"] = config.doorFillColor;
    delete data.flags["levels-3d-preview"]["wallTint"];
  }
  return data;
};

const secretDoorData = (config, x1, y1, x2, y2) => {
  const data = wallData(config, x1, y1, x2, y2);
  data.door = 2; // secret
  return data;
};
