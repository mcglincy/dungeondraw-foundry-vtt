
import "./lib/jsts.min.js";


export const makeWalls = async (state) => {
  // scene.update() triggers a redraw, 
  // which causes an infinite loop of redraw/refresh.
  // so avoid it :P

  let walls = [];
  //await deleteAllWalls();
  if (state.geometry) {
    if (state.geometry instanceof jsts.geom.MultiPolygon) {
      walls = wallsFromMulti(state.geometry);
    } else if (state.geometry instanceof jsts.geom.Polygon) {
      walls = wallsFromPoly(state.geometry);
    }
  }

  const doors = makeDoors(state.doors);
  walls = walls.concat(doors);
  await canvas.scene.update({walls: walls});
  //   if (allWalls.length) {
  //   await canvas.scene.createEmbeddedDocuments("Wall", allWalls);
  // }
};

const deleteAllWalls = async () => {
  try {   
    const collection = canvas.scene.getEmbeddedCollection("Wall");
    const ids = Array.from(collection.keys());
    await canvas.scene.deleteEmbeddedDocuments("Wall", ids);
  } catch(error) {
    console.error(error);
  }
};

const wallsFromMulti = (multi) => {
  let allWalls = []
  for (let i = 0; i < multi.getNumGeometries(); i++) {
    const poly = multi.getGeometryN(i);
    const walls = wallsFromPoly(poly);
    allWalls = allWalls.concat(walls);
  }
  return allWalls;
};

const wallsFromPoly = (poly) => {
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
  return allWalls;
};

/** [[x1,y1,x2,y2],...] */
const makeDoors = (doors) => {
  const allDoors = [];
  for (const door of doors) {
    const doorData = {
      c: [door[0], door[1], door[2], door[3]],
      door: 1
    };
    allDoors.push(doorData);
  }
  return allDoors;
};
