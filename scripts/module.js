import { AutoActionTray } from "../apps/hotbar.js";
// import { registerHooks } from "./hooks.js";

export async function preloadHandlebarsTemplates() {
  const partials = [
    "modules/auto-action-tray/templates/parts/character-tray.hbs",
    "modules/auto-action-tray/templates/parts/effect-tray.hbs",
    "modules/auto-action-tray/templates/parts/equip-tray.hbs",
    "modules/auto-action-tray/templates/parts/resource-tray.hbs",
    "modules/auto-action-tray/templates/parts/turn-tray.hbs",
    "modules/auto-action-tray/templates/parts/type-tray.hbs",
    "modules/auto-action-tray/templates/parts/ability-tray.hbs",
    "modules/auto-action-tray/templates/parts/item.hbs",
    "modules/auto-action-tray/templates/parts/item-spell.hbs",
    "modules/auto-action-tray/templates/parts/full-tray.hbs",
    "modules/auto-action-tray/templates/parts/item-tooltip.hbs",
    "modules/auto-action-tray/templates/parts/character-hp.hbs",
    "modules/auto-action-tray/templates/parts/skill-tray.hbs"
  ];
  const paths = {};
  for (const path of partials) {
    paths[path.replace(".hbs", ".html")] = path;
    paths[`AAT.${path.split("/").pop().replace(".hbs", "")}`] = path;
  }

  return loadTemplates(paths);
}

(() => {})();

Hooks.once("init", async function() {
  console.log("Hello World!");
  preloadHandlebarsTemplates();
});

Hooks.once("ready", async function() {
  console.log("-------Ready-----------");

  game.settings.register("auto-action-tray", "enable", {
    name: "Enabled",
    hint: "Enable or Disable the Hotbar",
    scope: "client", // "world" = sync to db, "client" = local storage
    config: true, // false if you dont want it to show in module config

    type: Boolean,
    default: false,

    requiresReload: true // true if you want to prompt the user to reload
    /** Creates a select dropdown */
  });
  if (game.settings.get("auto-action-tray", "enable")) {
    let hotbar = new AutoActionTray();
    hotbar.render(true);
  }
});
