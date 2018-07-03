import { Observable, Subject } from 'rxjs';
import { VirtualGridConfig } from './v-grid-config.interface';
import { VirtualGridItem } from './v-grid-item';

export class VirtualGrid {
  private _items: VirtualGridItem[];
  private _item_map: { [index: string]: VirtualGridItem };
  private _grid: VirtualGridItem[][];
  private _config: VirtualGridConfig;
  private _grid_size: { x: number; y: number };
  private _change_subject = new Subject<VirtualGridItem>();

  public on_changes: Observable<VirtualGridItem>;

  get size_x() {
    return this._grid_size.x;
  }

  get size_y() {
    return this._grid_size.y;
  }

  get items() {
    return this._items;
  }

  constructor(items?: any[], config?: VirtualGridConfig) {
    this._grid = [];
    this._items = [];
    this._item_map = {};
    this._grid_size = { x: 0, y: 0 };
    this._config = this.default_config(config);
    this.on_changes = this._change_subject.asObservable();
    this.ensure_size(this._config.x_lanes.min, this._config.y_lanes.min);

    if (items) {
      for (let i = 0; i < items.length; i++) {
        this.add_item(items[i]);
      }
    }
  }

  public add_item(item: any): VirtualGridItem {
    const v_item = item instanceof VirtualGridItem ? item : new VirtualGridItem(item || {});
    this._items.push(v_item);
    this._item_map[v_item.id] = v_item;
    this.add_to_grid(v_item);
    return v_item;
  }

  public remove_item(item: VirtualGridItem) {
    delete this._item_map[item.id];
    const idx = this._items.indexOf(item);
    this._items.splice(idx, 1);
    this.remove_from_grid([item]);
  }

  public update_item(item: VirtualGridItem) {
    this.remove_from_grid([item]);
    this.add_to_grid(item);
  }

  public update_config(config: VirtualGridConfig) {
    this._config = this.default_config(config);
    this.reload();
  }

  public reload() {
    this._grid = [];
    for (let i = 0; i < this._items.length; i++) {
      this.add_to_grid(this._items[i]);
    }
  }

  public toString() {
    console.log(this);
    let str = '';
    for (let j = 0; j < this._grid_size.y; j++) {
      for (let i = 0; i < this._grid_size.x; i++) {
        if (this._grid[i][j]) {
          str += this._items.indexOf(this._grid[i][j]);
        } else {
          str += '-';
        }
        str += ' ';
      }
      str += '\n';
    }
    return str;
  }

  private default_config(config: any, default_config?: any): any {
    config = config || {};
    default_config = default_config || {
      gravity: 'nw',
      x_lanes: { min: 3, max: 9 },
      y_lanes: { min: 3, max: 9 },
      namespace: ['default'],
    };

    const new_config = {};
    const keys = Object.keys(default_config);
    for (let i = 0; i < keys.length; i++) {
      if (typeof default_config[keys[i]] === 'object' && !Array.isArray(default_config[keys[i]]) && config[keys[i]]) {
        new_config[keys[i]] = this.default_config(config[keys[i]], default_config[keys[i]]);
      } else if (!(keys[i] in config)) {
        new_config[keys[i]] = default_config[keys[i]];
      } else {
        new_config[keys[i]] = config[keys[i]];
      }
    }
    return new_config;
  }

  private ensure_size(x: number, y: number) {
    if (x > this._grid_size.x) {
      const num_new_x = x - this._grid_size.x;
      for (let i = 0; i < num_new_x; i++) {
        this._grid.push([]);
      }
      this._grid_size.x += num_new_x;
    }
    if (y > this._grid_size.y) {
      const num_new_y = y - this._grid_size.y;
      for (let i = 0; i < this._grid_size.x; i++) {
        for (let j = 0; j < num_new_y; j++) {
          this._grid[i].push(null);
        }
      }
      this._grid_size.y += num_new_y;
    }
  }

  private ensure_in_bounds(item: VirtualGridItem) {
    const max_x = item.x + item.w;
    const max_y = item.y + item.h;
    if (max_x > this._config.x_lanes.max) {
      item.x -= max_x - this._config.x_lanes.max;
    }
    if (max_y > this._config.y_lanes.max) {
      item.y -= max_y - this._config.y_lanes.max;
    }
  }

  private shrink_to_fit() {
    const empty_row = (row: any[]) => row.some(e => e);
    const highest_val = (row: any[]) => {
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i]) {
          return i + 1;
        }
      }
    };
    let max_y = this._config.y_lanes.min;
    for (let i = 0; i < this._grid_size.x; i++) {
      if (empty_row(this._grid[i])) {
        this._grid.splice(i);
        this._grid_size.x = i;
        break;
      }
      max_y = Math.max(max_y, highest_val(this._grid[i]));
    }
    max_y = Math.max(max_y, this._config.y_lanes.min);
    for (let i = 0; i < this._grid_size.x; i++) {
      this._grid[i].splice(max_y);
    }
    this._grid_size.y = max_y;
  }

  private has_conflicts(item: VirtualGridItem): VirtualGridItem[] {
    const conflicts = [];
    for (let i = item.x; i < item.x + item.w; i++) {
      for (let j = item.y; j < item.y + item.h; j++) {
        if (this._grid[i][j] && !conflicts.includes(this._grid[i][j])) {
          conflicts.push(this._grid[i][j]);
        }
      }
    }
    return conflicts;
  }

  private apply_gravity(direction?: string) {
    if (!direction) {
      direction = this._config.gravity;
    }
    if (direction.length > 1) {
      for (let i = 0; i < direction.length; i++) {
        this.apply_gravity(direction[i]);
      }
      return;
    }
  }

  private make_room(item: VirtualGridItem, displacer: VirtualGridItem) {
    item.y = displacer.y + displacer.h;
    this.add_to_grid(item);
  }

  private push_items(items: VirtualGridItem[], displacer: VirtualGridItem) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      this.make_room(item, displacer);
    }
  }

  private add_to_grid(item: VirtualGridItem) {
    this.ensure_in_bounds(item);
    const conflicts = this.has_conflicts(item);
    this.mark_on_grid(item);
    this.remove_from_grid(conflicts);
    if (conflicts.length) {
      this.push_items(conflicts, item);
    }
    this.apply_gravity();
    this._change_subject.next(item);
  }

  private remove_from_grid(items: VirtualGridItem[]) {
    for (let i = 0; i < this._grid_size.x; i++) {
      for (let j = 0; j < this._grid_size.y; j++) {
        if (items.includes(this._grid[i][j])) {
          this._grid[i][j] = null;
        }
      }
    }
  }

  private mark_on_grid(item: VirtualGridItem) {
    this.ensure_size(item.x + item.w, item.y + item.h);
    for (let i = item.x; i < item.x + item.w; i++) {
      for (let j = item.y; j < item.y + item.h; j++) {
        this._grid[i][j] = item;
      }
    }
  }

 
}
