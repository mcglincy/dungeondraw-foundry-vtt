
/**
 * @extends abstract.Document
 * @extends abstract.BaseDrawing
 * @extends CanvasDocumentMixin
 */
export class DungeonDocument extends CanvasDocumentMixin(foundry.documents.BaseDrawing) {
  /**
   * A reference to the User who created the Drawing document.
   * @type {User}
   */
  get author() {
    return game.users.get(this.data.author);
  }
}