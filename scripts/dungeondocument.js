
/**
 * @extends abstract.Document
 * @extends abstract.BaseDrawing
 * @extends CanvasDocumentMixin
 */
 // TODO: we don't need to bother with BaseDrawing any more, I don't think?
 // and we likely need to separate the Dungeon geometry/state saving from the Config stuff
export class DungeonDocument extends CanvasDocumentMixin(foundry.documents.BaseDrawing) {

}