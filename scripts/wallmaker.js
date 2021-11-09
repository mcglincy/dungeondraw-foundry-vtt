
import "./lib/jsts.min.js";


export const makeWalls = async (state) => {
  await deleteAllWalls();
  if (state.geometry) {
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      await makeWallsFromMulti(state.geometry);
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      await makeWallsFromPoly(state.geometry);
    }
  }
  await makeDoors(state.doors);
};

const deleteAllWalls = async () => {
  try {   
    // scene.update() triggers a redraw, 
    // which causes an infinite loop of redraw/refresh.
    // so avoid it :P
    const collection = canvas.scene.getEmbeddedCollection("Wall");
    const ids = Array.from(collection.keys());
    await canvas.scene.deleteEmbeddedDocuments("Wall", ids);
  } catch(error) {
    console.error(error);
  }
};

const makeWallsFromMulti = async (multi) => {
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    await makeWallsFromPoly(poly);
  }
};

const makeWallsFromPoly = async (poly) => {
  const allWalls = [];
  const exterior = poly.getExteriorRing();
  const coords = exterior.getCoordinates();
  for (let i = 0; i < coords.length - 1; i++) {
    const wallData = {
      // From Foundry API docs:
      // "The wall coordinates, a length-4 array of finite numbers [x0,y0,x1,y1]"
      c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
    };
    allWalls.push(wallData);
  }
  const numHoles = poly.getNumInteriorRing();    
  for (let i = 0; i < numHoles; i++) {
    const hole = poly.getInteriorRingN(i);
    const coords = hole.getCoordinates();
    for (let i = 0; i < coords.length - 1; i++) {
      const wallData = {
        c: [coords[i].x, coords[i].y, coords[i+1].x, coords[i+1].y],
      };
      allWalls.push(wallData);
    }      
  }
  if (allWalls.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
  }
};

/** [[x1,y1,x2,y2],...] */
const makeDoors = async (doors) => {
  const allDoors = [];
  for (const door of doors) {
    const doorData = {
      c: [door[0], door[1], door[2], door[3]],
      door: 1
    };
    allDoors.push(doorData);
  }
  if (allDoors.length) {
    await canvas.scene.createEmbeddedDocuments("Wall", allDoors);
  }
};
