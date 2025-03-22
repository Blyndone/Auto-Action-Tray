export class StackedTray {
  constructor(options = {}) {
    this.actor = options.actor || null;
    this.hotbar = options.hotbar;
    this.trays = options.trays || [];
    this.active = false;
    this.id = options.id;
    this.type = "stacked";
    this.name = "stacked";
    this.positions = [];
    this.savedData = false;
  }
  setActor(actor) {
    this.actor = actor;
    if (this.checkSavedData()) {
      this.getSavedData();
      this.setTrayPositions(this.positions);
    } else {
      this.setTrayPositions([0, 150, 300]);
    }
  }
  setActive() {
    this.active = true;
    this.trays.forEach(element => {
      element.active = true;
    });
  }
  setDeactive() {
    this.active = false;
    this.trays.forEach(element => {
      element.active = false;
    });
  }

  setTrayPositions(trayPositions) {
    this.trays[0].xPos = trayPositions[0];
    this.trays[1].xPos = trayPositions[1];
    this.trays[2].xPos = trayPositions[2];
  }

  setTrayPosition(trayId, xPos) {
    let tray = this.getTrayById(trayId);
    tray.xPos = xPos;
    this.positions[this.trays.indexOf(tray)] = xPos;
    this.setSavedData();
  }

  //[tray1, tray2, tray3]
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
