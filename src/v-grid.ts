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

  //   update_location_map(item: DirgItem) {
  //     this.for_each_location(item, (x, y) => {
  //       if (!this._location_map[x]) {
  //         this._location_map[x] = {};
  //       }
  //       this._location_map[x][y] = item;
  //     });
  //   }

  //   has_conflict(item: DirgItem): DirgItem[] {
  //     const conflicts = [];
  //     this.for_each_location(item, (x, y) => {
  //       if (this._location_map[x] && this._location_map[x][y]) {
  //         if (!conflicts.includes(this._location_map[x][y])) {
  //           conflicts.push(this._location_map[x][y]);
  //         }
  //       }
  //     });
  //     return conflicts;
  //   }

  //   push_item(conflict: DirgItem, replacer: DirgItem, all_items: DirgItem[]) {
  //     const buf = this._config.push_buffer;
  //     const max_x = this._config.x.exactly ? this._config.x.exactly : this._config.x.max;
  //     const max_y = this._config.y.exactly ? this._config.y.exactly : this._config.y.max;

  //     const r_x = replacer.x;
  //     const r_w = replacer.width;
  //     const r_y = replacer.y;
  //     const r_h = replacer.height;

  //     const c_x = conflict.x;
  //     const c_w = conflict.width;
  //     const c_y = conflict.y;
  //     const c_h = conflict.height;

  //     const bound = {
  //       x: [Math.max(0, r_x - c_w - buf), Math.min(max_x - c_w, r_x + buf + 1)],
  //       y: [Math.max(0, r_y - c_h - buf), Math.min(max_y - c_h, r_y + buf + 1)],
  //     };

  //     const direction_map: any = {
  //       n: { x: [c_x, r_x + r_w], y: [bound.y[0], Math.max(bound.y[0], r_y - c_h)] },
  //       e: { x: [r_x + r_w, bound.x[1]], y: [c_y, c_y + 1] },
  //       s: { x: [c_x, r_x + r_w], y: [r_y + r_h, bound.y[1]] },
  //       w: { x: [bound.x[0], Math.max(bound.x[0], r_x - c_w)], y: [c_y, c_y + 1] },
  //       ne: { x: [r_x + r_w, bound.x[1]], y: [bound.y[0], c_y] },
  //       nw: { x: [bound.x[0], c_x], y: [bound.y[0], c_y] },
  //       se: { x: [r_x + r_w, bound.x[1]], y: [c_y + c_h, bound.y[1]] },
  //       sw: { x: [bound.x[0], c_x], y: [c_y + c_h, bound.y[1]] },
  //     };

  //     const opposite_dir = {
  //       n: 's',
  //       s: 'n',
  //       e: 'w',
  //       w: 'e',
  //       ne: 'ne',
  //       nw: 'nw',
  //       en: 'ne',
  //       wn: 'nw',
  //       se: 'se',
  //       sw: 'sw',
  //       es: 'se',
  //       ws: 'sw',
  //     };

  //     const dir = this._config.push_gravity;
  //     const order = [
  //       dir[0],
  //       dir[1],
  //       opposite_dir[[dir[0], dir[1]].join('')] || dir[2],
  //       opposite_dir[[dir[0], dir[1]].join('')] ? dir[2] : opposite_dir[[dir[0], dir[2]].join('')],
  //       opposite_dir[[dir[1], dir[2]].join('')] || opposite_dir[[dir[2], dir[0]].join('')],
  //       dir[3],
  //       opposite_dir[[dir[3], dir[0]].join('')] || opposite_dir[[dir[3], dir[1]].join('')],
  //       opposite_dir[[dir[3], dir[2]].join('')] || opposite_dir[[dir[3], dir[1]].join('')],
  //     ];

  //     for (let i = 0; i < order.length; i++) {
  //       const map = direction_map[order[i]];
  //       for (let j = map.x[0]; j < map.x[1]; j++) {
  //         for (let k = map.y[0]; k < map.y[1]; k++) {
  //           conflict.__locked = true;
  //           conflict.x = j;
  //           conflict.y = k;
  //           conflict.__locked = false;
  //           if (this.has_conflict(conflict).length === 0) {
  //             return;
  //           }
  //         }
  //       }
  //     }
  //     conflict.__locked = true;
  //     conflict.y = r_y + r_h;
  //     conflict.x = c_x;
  //     conflict.__locked = false;
  //   }

  //   remove_item(item: DirgItem, items: DirgItem[]) {
  //     for (let i = 0; i < items.length; i++) {
  //       if (items[i].__id === item.__id) {
  //         items.splice(i, 1);
  //         // delete this._id_map[item.__id];
  //         this.remove_from_location_map(item);
  //         return;
  //       }
  //     }
  //   }

  //   remove_from_location_map(item: DirgItem) {
  //     this.for_each_location(item, (x, y) => {
  //       if (this._location_map[x] && this._location_map[x][y] && this._location_map[x][y].__id === item.__id) {
  //         this._location_map[x][y] = undefined;
  //       }
  //     });
  //   }

  //   resolve_conflicts(new_items: DirgItem[], existing_items: DirgItem[]): DirgItem[] {
  //     for (let i = new_items.length - 1; i >= 0; i--) {
  //       const item = new_items[i];
  //       const conflicts = this.has_conflict(item);
  //       existing_items.push(item);
  //       this.update_location_map(item);
  //       for (let j = 0; j < conflicts.length; j++) {
  //         this.remove_item(conflicts[j], existing_items);
  //         this.push_item(conflicts[j], new_items[i], existing_items);
  //       }
  //       existing_items = this.resolve_conflicts(conflicts, existing_items);
  //     }
  //     return existing_items;
  //   }

  //   initialize_items(items: DirgItem[]) {
  //     const resolved_items = this.resolve_conflicts(items, []);
  //     // const proxy_items = watch_change_array(resolved_items, this.items_changed());
  //     return resolved_items;
  //   }

  //   for_each_location(item: DirgItem, method: (x, y) => any | void) {
  //     for (let i = 0; i < item.width; i++) {
  //       for (let j = 0; j < item.height; j++) {
  //         const x = item.x + i;
  //         const y = item.y + j;
  //         const res = method(x, y);
  //         // tslint:disable-next-line:triple-equals
  //         if (res != undefined) {
  //           return res;
  //         }
  //       }
  //     }
  //   }

  //   update_item(item: DirgItem) {
  //     const updating_item = item;

  //     updating_item.__locked = true;
  //     updating_item.x = updating_item.x < 0 ? 0 : updating_item.x;
  //     updating_item.x = updating_item.y < 0 ? 0 : updating_item.y;
  //     updating_item.x = updating_item.width < 1 ? 1 : updating_item.width;
  //     updating_item.x = updating_item.height < 1 ? 1 : updating_item.height;
  //     updating_item.__locked = false;

  //     this.remove_item(updating_item, this._items);
  //     this.resolve_conflicts([updating_item], this._items);
  //   }
}
