export class StackedTray {
  constructor(options = {}) {
    this.hotbar = options.hotbar;
    this.trays = options.trays || [];
    this.active = false;
    this.id = options.id;
    this.type = "stacked";
    this.name = "stacked";
    this.x = 0;
  }
  setActive(active) {
    this.active = active;
    this.trays.forEach(element => {
      element.active = true;
    });
  }
  setDeavtive() {
    this.active = false;
    this.trays.forEach(element => {
      element.active = false;
    });
  }
  //[tray1, tray2, tray3]
  setTrays(trayArray) {
    this.trays = trayArray;
  }
  getTrayById(trayId) {
    return this.trays.find(tray => tray.id == trayId);
  }
}
