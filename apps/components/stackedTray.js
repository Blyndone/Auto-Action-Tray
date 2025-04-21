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
      this.setTrayPositions([
        0,
        this.hotbar.iconSize * 5,
        this.hotbar.iconSize * 31 / 3 + 2
      ]);
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

  checkDiff() {
    this.trays.forEach(tray => {
      tray.checkDiff();
    });
  }

  setTrayPositions(trayPositions) {
    this.trays[0].xPos =
      trayPositions[0] >= 0 &&
      trayPositions[0] < this.hotbar.iconSize * this.hotbar.columnCount
        ? trayPositions[0]
        : 0;
    this.trays[1].xPos =
      trayPositions[1] >= 0 &&
      trayPositions[1] < this.hotbar.iconSize * this.hotbar.columnCount
        ? trayPositions[1]
        : 150;
    this.trays[2].xPos =
      trayPositions[2] >= 0 &&
      trayPositions[2] < this.hotbar.iconSize * this.hotbar.columnCount
        ? trayPositions[2]
        : 300;
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
