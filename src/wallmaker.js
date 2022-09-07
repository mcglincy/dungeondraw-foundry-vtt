import * as constants from "./constants.js";
import { Settings } from "./settings.js";
import * as geo from "./geo-utils.js";

export const makeWalls = async (state) => {
  if (!game.user.isGM) {
    // need GM privs to delete/create walls
    return;
  }

  // calculate a new set of walls
  let walls = [];
  if (state.geometry) {
    // simplify our geometry to downsample the amount of walls created
    const simplified = geo.simplify(state.geometry, 10.0);
    const allDoors = state.doors.concat(state.secretDoors);
    walls = makeWallsFromMulti(state.config, simplified, allDoors);
  }

  const interiorWalls = makeInteriorWalls(state.config, state.interiorWalls);
  const invisibleWalls = makeInvisibleWalls(state.config, state.invisibleWalls);
  const doors = makeDoors(state.config, state.doors);
  const secretDoors = makeSecretDoors(state.config, state.secretDoors);
  const allWalls = walls.concat(
    interiorWalls,
    invisibleWalls,
    doors,
    secretDoors
  );

  // figure out what walls need to be created, deleted, or left in place
  const wallDocs = dungeonDrawWallDocuments();
  const wallDocsStillNeeded = [];
  const wallsToCreate = [];
  for (const wall of allWalls) {
    let foundDoc = false;
    for (const wallDoc of wallDocs) {
      if (wallDataEqual(wall, wallDoc.data)) {
        wallDocsStillNeeded.push(wallDoc);
        foundDoc = true;
        break;
      }
    }
    if (!foundDoc) {
      wallsToCreate.push(wall);
    }
  }
  const idsStillNeeded = wallDocsStillNeeded.map((x) => x.id);
  const idsToDelete = wallDocs
    .filter((x) => !idsStillNeeded.includes(x.id))
    .map((x) => x.id);

  // create our new walls before deleting old ones,
  // to prevent any unwanted vision reveals.
  //
  // scene.update() triggers a redraw, which causes an infinite loop of redraw/refresh.
  // so we avoid using it :P
  if (wallsToCreate.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", wallsToCreate);
  }
  // finally, delete the previous set of walls
  if (idsToDelete.length) {
    try {
      await canvas.scene.deleteEmbeddedDocuments("Wall", idsToDelete);
    } catch (error) {
      console.error(error);
    }
  }
};

const wallDataEqual = (w1, w2) => {
  return (
    w1.c.length == w2.c.length &&
    w1.c[0] == w2.c[0] &&
    w1.c[1] == w2.c[1] &&
    w1.c[2] == w2.c[2] &&
    w1.c[3] == w2.c[3] &&
    w1.door == w2.door &&
    JSON.stringify(w1.flags) == JSON.stringify(w2.flags)
  );
};

const dungeonDrawWallDocuments = () => {
  const walls = canvas.scene.getEmbeddedCollection("Wall");
  const ddWalls = [];
  for (const wall of walls) {
    const flag = wall.getFlag(constants.MODULE_NAME, "dungeonVersion");
    if (flag) {
      ddWalls.push(wall);
    }
  }
  return ddWalls;
};

const makeWallsFromMulti = (config, multi, doors) => {
  let walls = [];
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    walls = walls.concat(makeWallsFromPoly(config, poly, doors));
  }
  return walls;
};

const makeWallsFromPoly = (config, poly, doors) => {
  const allWalls = [];
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  for (let i = 0; i < coords.length - 1; i++) {
    const x1 = coords[i].x;
    const y1 = coords[i].y;
    const x2 = coords[i + 1].x;
    const y2 = coords[i + 1].y;
    const splits = geo.maybeSplitWall(x1, y1, x2, y2, doors);
    for (const split of splits) {
      const data = wallData(config, split[0], split[1], split[2], split[3]);
      allWalls.push(data);
    }
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
  return allWalls;
};

/** [[x1,y1,x2,y2],...] */
const makeInteriorWalls = (config, walls) => {
  const allWalls = [];
  for (const wall of walls) {
    const data = wallData(config, wall[0], wall[1], wall[2], wall[3]);
    allWalls.push(data);
  }
  return allWalls;
};

const makeInvisibleWalls = (config, walls) => {
  const allWalls = [];
  for (const wall of walls) {
    const data = invisibleWallData(config, wall[0], wall[1], wall[2], wall[3]);
    allWalls.push(data);
  }
  return allWalls;
};

/** [[x1,y1,x2,y2],...] */
const makeDoors = (config, doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = doorData(config, door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  return allDoors;
};

/** [[x1,y1,x2,y2],...] */
const makeSecretDoors = (config, doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = secretDoorData(config, door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  return allDoors;
};

const wallData = (config, x1, y1, x2, y2) => {
  const data = {
    // From Foundry API docs:
    // "The wall coordinates, a length-4 array of finite numbers [x0,y0,x1,y1]"
    c: [x1, y1, x2, y2],
    door: 0, // wall
    flags: {},
  };
  data.flags[constants.MODULE_NAME] = {};
  data.flags[constants.MODULE_NAME][constants.FLAG_DUNGEON_VERSION] =
    constants.DUNGEON_VERSION;
  // Maybe set Canvas3D flags
  if (Settings.threeDCanvasEnabled()) {
    data.flags["levels-3d-preview"] = {
      joinWall: true,
      wallDepth: config.wallThickness,
      wallSidesTexture: config.threeDWallSidesTexture,
      wallSidesTint: config.threeDWallSidesTextureTint,
      wallTexture: config.threeDWallTexture,
      wallTint: config.threeDWallTextureTint,
    };
  }
  return data;
};

const doorData = (config, x1, y1, x2, y2) => {
  const data = wallData(config, x1, y1, x2, y2);
  data.door = 1; // door
  // Maybe set Canvas3D flags
  if (Settings.threeDCanvasEnabled()) {
    data.flags["levels-3d-preview"]["joinWall"] = false;
    data.flags["levels-3d-preview"]["wallTexture"] = config.threeDDoorTexture;
    data.flags["levels-3d-preview"]["wallTint"] = config.threeDDoorTextureTint;
  }
  return data;
};

const secretDoorData = (config, x1, y1, x2, y2) => {
  const data = wallData(config, x1, y1, x2, y2);
  data.door = 2; // secret
  return data;
};

const invisibleWallData = (config, x1, y1, x2, y2) => {
  const data = wallData(config, x1, y1, x2, y2);
  data.door = 0; // secret
  data.light = 0;
  data.sight = 0;
  return data;
};
