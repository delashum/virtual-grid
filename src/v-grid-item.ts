export class VirtualGridItem {
  public x: number;
  public y: number;
  public w: number;
  public h: number;

  private _item: any;
  private _id: string;

  get id() {
    return this._id;
  }
  get object() {
    return this._item;
  }

  constructor(item: any) {
    this.x = item.x || 0;
    this.y = item.y || 0;
    this.w = item.w || 0;
    this.h = item.h || 0;
    this._item = item;
    this._id = Math.random()
      .toString(32)
      .slice(2);
  }
}
