import { pointsToPolygon, union } from "./geo-utils.js";

export class GridPainterHelper {
  constructor() {
    this.gridDrawings = [];
    this.gridSpaceDictionary = {};
  }
  gridDrawings;
  gridSpaceDictionary;
  paintedGeometry;

  onGridPainterMouseDraw(i, j) {
    this.gridSpaceDictionary[i] ??= new Set();

    if (!this.gridSpaceDictionary[i].has(j)) {
      this.gridSpaceDictionary[i].add(j);

      //This works for square and hex grids
      const vertices = canvas.grid.getVertices({ i, j });
      const pointsForPolygon = [
        ...vertices.map((x) => [x.x, x.y]),
        [vertices[0].x, vertices[0].y],
      ];
      const pointsForShapeData = pointsForPolygon.flat();

      this._addPreviewDrawing(pointsForShapeData);

      this._addGridSpaceGeometry(pointsForPolygon);
    }
  }

  _addGridSpaceGeometry(points) {
    if (this.paintedGeometry == null) {
      this.paintedGeometry = pointsToPolygon(points);
    } else {
      this.paintedGeometry = union(
        this.paintedGeometry,
        pointsToPolygon(points)
      );
    }
  }

  _addPreviewDrawing(points) {
    const scene = game.scenes.current;
    const id = foundry.utils.randomID();

    const subDrawingDocument = DrawingDocument.create(
      {
        fillColor: game.user.color.css,
        shape: {
          type: Drawing.SHAPE_TYPES.POLYGON,
          points: points,
        },
        fillAlpha: 0.7,
        fillType: CONST.DRAWING_FILL_TYPES.SOLID,
        strokeWidth: 0,
        _id: id,
      },
      { parent: scene }
    );

    this.gridDrawings.push(subDrawingDocument);
  }
}
