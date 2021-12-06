import * as constants from "./constants.js";
import * as geo from "./geo-utils.js";

export const makeWalls = async (state) => {
  if (!game.user.isGM) {
    // need GM privs to delete/create walls
    return;
  }
  await deleteAllWalls();
  if (state.geometry) {
    if (geo.isMultiPolygon(state.geometry)) {
      await makeWallsFromMulti(state.geometry);
    } else if (geo.isPolygon(state.geometry)) {
      await makeWallsFromPoly(state.geometry);
    }
  }
  await makeInteriorWalls(state.interiorWalls);
  await makeDoors(state.doors);
  await makeSecretDoors(state.secretDoors);
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

const makeWallsFromMulti = async (multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    await makeWallsFromPoly(poly);
  }
};

const wallData = (x1, y1, x2, y2) => {
  return {
    // From Foundry API docs:
    // "The wall coordinates, a length-4 array of finite numbers [x0,y0,x1,y1]"
    c: [x1, y1, x2, y2],
    flags: {
      "dungeon-draw": {
        // extract string constant somewhere
        dungeonVersion: "1.0",
      },
    },
  };
};

const doorData = (x1, y1, x2, y2) => {
  const data = wallData(x1, y1, x2, y2);
  data.door = 1; // door
  return data;
};

const secretDoorData = (x1, y1, x2, y2) => {
  const data = wallData(x1, y1, x2, y2);
  data.door = 2; // secret
  return data;
};

const makeWallsFromPoly = async (poly) => {
  const allWalls = [];
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  for (let i = 0; i < coords.length - 1; i++) {
    // constants.MODULE_NAME
    const data = wallData(
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
const makeInteriorWalls = async (walls) => {
  const allWalls = [];
  for (const wall of walls) {
    const data = wallData(wall[0], wall[1], wall[2], wall[3]);
    allWalls.push(data);
  }
  if (allWalls.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeDoors = async (doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = doorData(door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  if (allDoors.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeSecretDoors = async (doors) => {
  const allDoors = [];
  for (const door of doors) {
    const data = secretDoorData(door[0], door[1], door[2], door[3]);
    allDoors.push(data);
  }
  if (allDoors.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
  }
};
