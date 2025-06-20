export class StackedTray {
  constructor(options = {}) {
    this.actor = options.actor || null;
    this.hotbar = options.hotbar;
    this.trays = options.trays || [];
    this.active = false;
    this.id = options.id;
    this.type = "stacked";
    this.name = "stacked";
    this.label = "";
    this.trayLabel = '<i class="fa-solid fa-layer-group fa-rotate-270" /></i>';
    this.positions = [];
    this.savedData = false;
  }
  setActor(actor) {
    this.actor = actor;
    if (this.checkSavedData()) {
      this.getSavedData();
      this.setTrayPositions(this.positions);
    } else {
      this.setTrayPositions([0, Infinity, Infinity, Infinity]);
    }
  }
  setActive() {
    this.active = true;
    this.trays.forEach(element => {
      element.setActive();
    });
  }
  setInactive() {
    this.active = false;
    this.trays.forEach(element => {
      element.setInactive();
    });
  }

  deleteItem(itemId) {
    this.trays.forEach(tray => {
      tray.deleteItem(itemId);
    });
  }

  checkDiff(itemMap) {
    this.trays.forEach(tray => {
      tray.checkDiff(itemMap);
    });
  }

  setTrayPositions(trayPositions) {
    let handleSize = this.hotbar.iconSize / 3 + 2;
    const trayCount = this.trays.length;
    let trayPos = index => {
      if (index == 0) return 0;
      return (
        Math.floor(this.hotbar.columnCount * index / trayCount) *
          this.hotbar.iconSize +
        7 +
        (index - 1) * (handleSize + 7)
      );
    };
    let defaults = [];
    for (let i = 0; i < trayCount; i++) {
      defaults.push(trayPos(i));
    }
    const maxPos = this.hotbar.iconSize * this.hotbar.columnCount;

    for (let i = 0; i < trayCount; i++) {
      this.trays[i].xPos =
        trayPositions[i] >= 0 &&
        trayPositions[i] < maxPos &&
        trayPositions[i] != null
          ? trayPositions[i]
          : defaults[i];
    }
    this.hotbar.draggableTrays.setTrays(
      this.trays.map(tray => ({
        id: tray.id,
        xMin: tray.xPos,
        tray: tray
      }))
    );

    this.hotbar.draggableTrays.setTrayPositions(
      this.trays.map(tray => tray.xPos)
    );
  }

  setTrayPosition(trayId, xPos) {
    let tray = this.getTrayById(trayId);
    tray.xPos = xPos;
    this.positions[this.trays.indexOf(tray)] = xPos;
    this.setSavedData();
  }

  setTrays(trayArray) {
    this.trays = trayArray;
  }

  getTrayById(trayId) {
    return this.trays.find(tray => tray.id == trayId);
  }

  checkSavedData() {
    let actor = this.actor;
    if (actor != null) {
      return (
        actor.getFlag("auto-action-tray", "data." + "stackedPositions") != null
      );
    }
  }
  getSavedData() {
    let actor = this.actor;

    let data = actor.getFlag("auto-action-tray", "data.stackedPositions");
    if (data) {
      this.positions = JSON.parse(data);
      if (this.positions.length == 0) {
        actor.unsetFlag("auto-action-tray", "data.stackedPositions");
      }
      this.setSavedData();
      this.savedData = true;
    }
  }

  setSavedData() {
    let actor = this.actor;

    if (actor != null) {
      actor.setFlag("auto-action-tray", "data", {
        stackedPositions: JSON.stringify(this.positions)
      });
    }
    this.savedData = true;
  }
}
