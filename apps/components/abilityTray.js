export class AbilityTray {
  constructor(options = {}) {
    this.id = null;
    this.abilities = [];
    this.category = options.category || null;
    this.actorUuid = options.actorUuid || null;
    this.active = false;
    this.type = "";
    this.application = options.application || null;
  }

  static padArray(arr, length = 20, filler = null) {
    let rowCount = 2;
    let columnCount = 10;
    if (game.settings.get("auto-action-tray", "rowCount")) {
      rowCount = game.settings.get("auto-action-tray", "rowCount");
      document.documentElement.style.setProperty(
        "--item-tray-item-height-count",
        rowCount
      );
    }

    if (game.settings.get("auto-action-tray", "columnCount")) {
      rowCount = game.settings.get("auto-action-tray", "columnCount");
      document.documentElement.style.setProperty(
        " --item-tray-item-width-count",
        columnCount
      );
    }

    let totalabilities = rowCount * columnCount;

    if (arr == null) return new Array(length).fill(filler);
    return [
      ...arr,
      ...Array(Math.max(0, totalabilities - arr.length)).fill(filler)
    ];
  }
}
