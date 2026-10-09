# Auto Action Tray – A Dynamic Character Action Bar

![image](https://github.com/user-attachments/assets/4e0b8937-a6b4-47d8-adad-6ab4723884e9)

![Foundry Version](https://img.shields.io/badge/Foundry-v13-informational)
![dnd5e](https://img.shields.io/badge/system-dnd5e%203.3%2B-red)
![Latest Release](https://img.shields.io/github/v/release/Blyndone/Auto-Action-Tray)
![Downloads](https://img.shields.io/github/downloads/Blyndone/Auto-Action-Tray/total)

## Overview

Auto Action Tray is a sleek, dynamic action bar and character tray for Foundry VTT. It auto-sorts your actions, spells, and abilities into categorized trays, complete with smart tooltips that show damage estimates and critical info.

Designed for both players and GMs, it includes quick-access bars for skills, saves, and dice rolls, plus a Targeting Helper that provides visual feedback for item use. Trays and themes adapt based on class or creature type, while NPC multiattacks are parsed and grouped for clarity.

> Auto Action Tray replaces the default Foundry hotbar — the core macro hotbar is hidden automatically when the tray loads.

**New to the module?** Run the built-in **Auto Action Tray Tour** from Foundry's *Tours* sidebar for a 17-step guided walkthrough of every control.

## Requirements

| Requirement | Version |
| --- | --- |
| Foundry VTT | v13 (13.302 – 13.999, verified 13.351) |
| Game System | `dnd5e` 3.3.0 – 5.x |
| [libWrapper](https://foundryvtt.com/packages/lib-wrapper) | required |
| [socketlib](https://foundryvtt.com/packages/socketlib) | required |
| [Midi-QOL](https://foundryvtt.com/packages/midi-qol) | optional — enables the Reaction Tray |

Both required modules must be **installed and active** — the tray will not function without them and will show an error notification to the GM on startup.

## 📥 Installation

### 🔹 Foundry VTT (Manifest URL — recommended)

Paste the following manifest URL into Foundry's **Add-on Modules → Install Module** screen:

```
https://github.com/Blyndone/Auto-Action-Tray/releases/latest/download/module.json
```

### 🔹 Manual Installation

1. Download `module.zip` from the [latest release](https://github.com/Blyndone/Auto-Action-Tray/releases/latest).
2. Extract it into `FoundryVTT/Data/modules/` so the module lives at `FoundryVTT/Data/modules/auto-action-tray/`.
3. Enable the module in **Game Settings → Manage Modules**.

## ✨ Features

✅ **All-in-One Character HUD** – Nearly all items and abilities are accessible in one place.

✅ **Automatically Sorted Trays** – Categorically sorted trays for commonly used item types.

![stacked](https://github.com/user-attachments/assets/f4edbff2-bfd3-497e-9f58-cd9058a9ede3)

✅ **Dynamic Tooltips** – Custom tooltips that display total damage ranges and critical information.

![Tooltip](https://github.com/user-attachments/assets/2f909c96-98fd-4fc7-9d9f-6316cf5b56e8)

✅ **Dynamic Themes** – Dynamic Themes that change based on the character class, or creature type.

![Class](https://github.com/user-attachments/assets/bd37a517-6c3f-4f0e-b96c-d17108a1c884)

![Creature](https://github.com/user-attachments/assets/e5bafcb1-243a-4837-899e-9bf042c9950b)

✅ **Dynamically Set Static Trays** – Actions, class features, and spells are displayed in set trays.

![Static](https://github.com/user-attachments/assets/c34590bc-4711-4eb6-a8df-f2dc5e5ec9b3)

✅ **Quick Access Skill/Saves** – Access to all skills and saves on a condensed bar.

![Skill](https://github.com/user-attachments/assets/d7c3c930-1cd4-40c1-a091-52d936780d54)

✅ **Target Helper** – Targeting lines provide targeting feedback to all players.

![fireBolt](https://github.com/user-attachments/assets/367f93d1-95f1-4424-a383-9390a30da3e0)

![Rays](https://github.com/user-attachments/assets/5d9588b6-8e20-4ac6-886e-181c4bca3fd2)

✅ **Custom Condition Handling** – Easy to access Condition Tray with Custom Condition Icons.

![Condition](https://github.com/user-attachments/assets/d13365ef-0867-44cd-bf55-42d32a2bf96e)

✅ **NPC Multiattack** – NPC Multiattacks are parsed and displayed as separate items with different groups Highlighted.

![Multi](https://github.com/user-attachments/assets/f9477d46-ffa2-4a2e-bec9-2e0e2cfcae9b)

## Using the Tray

### Selecting an actor

Selecting a token loads that actor into the tray. Players without a selected token fall back to their assigned character. Vehicles and group actors are ignored.

Right-clicking a token — or right-clicking empty canvas — cancels an in-progress targeting action.

Clicking the character portrait opens the actor sheet.

### Advantage & Disadvantage

Hold a modifier key while clicking any attack, skill, save, ability check, or death save:

| Key | Effect |
| --- | --- |
| **Alt** | Roll with advantage (tray highlights green) |
| **Ctrl** | Roll with disadvantage (tray highlights red) |

Holding both cancels the highlight and rolls normally.

### Using items, activities, and spell levels

Clicking an item runs its default activity. If an item has multiple activities, an **activity tray** opens so you can pick one. Spells with multiple castable levels open a **spell level tray**, including a *Use Slot* toggle so you can cast without spending a slot.

When the Target Helper is active, a target tray lets you increase or decrease the required target count, or confirm your current targets early.

### Quick slots and targeting

The tray has two dedicated weapon slots — **melee** and **ranged** — populated by dragging a weapon onto them. Drag a slot onto the canvas to clear it.

- **Range hover** highlights every item that can reach the token you are hovering.
- **Range boundary** draws the reach/range of the selected item on the canvas.
- **Target lines** are drawn from your token to your targets and, if enabled, are broadcast to every other connected player over socketlib.
- **Targeting chat messages** post a live message as you pick targets, which is removed once targeting is confirmed or canceled.

### Customizing trays

- Drag items **or macros** from a character sheet, the sidebar, or another tray slot into any custom tray slot.
- Drag a slot out onto the canvas to empty it.
- Static trays (Actions, class features, spells) are generated automatically and cannot be rearranged.
- **Lock** the tray to prevent accidental rearranging.

### Tray controls reference

| Icon | Action |
| --- | --- |
| ⏩ Fast Forward | Skip the roll configuration dialog for ability uses |
| 🎯 Target Helper | Toggle the guided targeting workflow |
| ⚙️ Tray Config | Open the per-actor Tray Config dialog |
| ⬛ Range Boundary | Toggle the on-canvas range overlay |
| ➖ Minimize | Collapse the tray to a small restore button |
| 🔒 Lock | Lock / unlock tray layout |
| 🔄 Swap Skill Tray | Page between primary and secondary skills/saves |
| 🧪 Condition Tray | Open the condition tray |
| ➕ / ➖ | Change token elevation, or item row count if **Quick Elevation Change** is off |
| 🎲 Dice | Roll a bare die — cycles d20/d12/d10/d8/d6/d4/d100 (out of combat only; replaced by **End Turn** in combat) |

### Keybindings

| Action | Default |
| --- | --- |
| Toggle HP Text Input | `NumpadEnter` |

Rebind under **Game Settings → Configure Controls**.

## Reaction Tray

When [Midi-QOL](https://foundryvtt.com/packages/midi-qol) is active, Auto Action Tray can replace Midi's reaction popup with a prompt rendered directly on the tray — complete with a countdown ring showing the time remaining. Pick a reaction to use it, or decline to pass.

The prompt only appears when the reaction belongs to the actor currently shown in your tray. Controlled by **(Experimental) Intercept Midi-QOL Reaction Prompts**; with Midi-QOL absent the setting does nothing.

> This relies on Midi-QOL internals that are not part of a public API, so it may break with future Midi-QOL releases. Disable the setting to fall back to Midi's own popup.

## Configuration

### Tray Config (per actor)

Opened with the ⚙️ button. Settings are saved per actor and organized into three tabs.

**Appearance**

| Option | Description |
| --- | --- |
| Tray Theme | Override the theme for this actor only |
| Target Line and Range Boundary Color | Color of this actor's target lines and range overlay |
| Select Character Image Type | Show the actor portrait or the token image |
| Image Scale / X Offset / Y Offset | Fine-tune framing of the character image |
| Health Indicator | Show the red missing-health ring around the portrait |

**Behavior**

| Option | Description |
| --- | --- |
| Auto Add Items | Automatically place newly created items into the tray |
| Class Skills | Show class-specific skills in the skill tray |
| Override Skills | Manually choose which skills appear instead of the class defaults |

**Custom Trays**

| Option | Description |
| --- | --- |
| Additional Custom Static Tray | Name an item with limited uses to generate a static tray keyed to that resource |
| Clear Custom Static Trays | Remove previously added custom static trays |

### Item Config (per item)

Configure an individual item's behavior. Settings are stored as a flag on the item.

| Option | Description |
| --- | --- |
| Enable Target Helper | Use the guided targeting workflow for this item |
| Use Default Target Count | Use the item's own target count |
| Number of Targets | Override the target count |
| Roll Individual Attacks | Roll separately per target instead of one shared roll |
| Always Fast Forward | Tray Default / Always / Never |
| Multiple Use Animation Wait Time | Delay between animations when the item is used several times |

Use **Reset** to clear all overrides for that item.

### Module Settings

Open **Game Settings → Configure Settings → Auto Action Tray → Configure Settings** for the tabbed settings window.
`Reload` marks settings that require a world reload to take effect.

#### General

| Setting | Scope | Default | Reload | Description |
| --- | --- | --- | --- | --- |
| Enabled | Client | On | ✔ | Enable or disable the tray entirely |
| Scale | Client | 0.6 | ✔ | Overall tray scale (0.2 – 1.5) |
| Background Opacity | Client | 0.85 | | Opacity of the tray background (applies immediately) |
| Quick Elevation Change | Client | On | | Turn the ➕/➖ buttons into token elevation controls instead of row count |
| Number of Rows | Client | 3 | ✔ | Item rows per tray (2 – 5) |
| Number of Columns | Client | 15 | ✔ | Item columns per tray (10 – 30) |

#### Appearance

| Setting | Scope | Default | Reload | Description |
| --- | --- | --- | --- | --- |
| Auto Theme | Client | On | ✔ | Pick the theme from the selected actor's class or creature type |
| Auto Theme Targeting Color | Client | On | | Derive the targeting color from the active theme |
| Color Theme | Client | Mind Flayer | | Fallback theme when Auto Theme is off or unavailable |
| Custom Condition Icons | Client | On | ✔ | Replace the system condition icons with the module's set |
| Custom Targeting Cursors | Client | On | ✔ | Use the module's targeting cursors |

#### Targeting & Range

| Setting | Scope | Default | Reload | Description |
| --- | --- | --- | --- | --- |
| Enable Range Hover | Client | Off | | Highlight in-range items when hovering a token |
| Default Range Boundary | Client | On | | Whether the overlay starts enabled on each tray |
| Enable Range Boundary | Client | On | ✔ | Enable the range boundary overlay feature |
| Receive Target Lines | Client | On | ✔ | Show other players' target lines |
| Send Target Lines | Client | On | ✔ | Send your target lines to other players |
| Enable Targeting Chat Message | **World** | On | | Post a live chat message while a player is picking targets |
| Target Line Poll Rate | **World** | 50 ms | ✔ | Broadcast interval (10 – 1000); lower values may impact performance |

#### Item Use

| Setting | Scope | Default | Reload | Description |
| --- | --- | --- | --- | --- |
| Enable Use Item Name | Client | On | | Show the item name above the token on use |
| Enable Use Item Icon | Client | On | | Show the item icon above the token on use |
| Use Item Icon Size | Client | 45 | | Icon size (20 – 100) |
| Use Item Text Size | Client | 19 | | Text size (5 – 30) |
| Multi Item Use Delay | Client | 1000 ms | ✔ | Delay between consecutive item uses (0 – 3000) |
| Prompt Concentration Overwrite | Client | On | ✔ | Ask before breaking existing concentration |
| Save Npc Data | **World** | On | ✔ | Persist tray configuration for NPC tokens |

#### Experimental

| Setting | Scope | Default | Reload | Description |
| --- | --- | --- | --- | --- |
| Quick Attack Automation | Client | Off | ✔ | Enable move-and-attack automation for the quick slots |
| Ignore Actor Speed Limit | Client | Off | ✔ | Path the full Quick Action Depth instead of stopping at remaining movement |
| Quick Action Depth | Client | 6 | ✔ | Max pathfinding distance in squares (1 – 50); larger values cost performance |
| Quick Action Path Color | Client | `#ff00ff` | | Color of the movement preview drawn while aiming a quick action |
| Intercept Midi-QOL Reaction Prompts | Client | On | ✔ | Show Midi-QOL reactions on the tray instead of in a popup |

## Themes

24 themes ship with the module: 13 class themes (Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard) and 11 general themes (Mind Flayer, Arcane, Sanguine, Ocean, Ember, Frost, Subterfuge, Titan, Vesper, Earth, Slate).

With **Auto Theme** on, player characters use the theme of their highest-level class. NPCs are themed by creature type:

| Creature Type | Theme | | Creature Type | Theme |
| --- | --- | --- | --- | --- |
| Aberration | Warlock | | Giant | Titan |
| Beast | Ranger | | Humanoid | Slate (Goblinoid → Monk) |
| Celestial | Cleric | | Monstrosity | Rogue |
| Construct | Fighter | | Ooze | Artificer |
| Dragon | Barbarian | | Plant | Druid |
| Elemental | Bard | | Undead | Subterfuge |
| Fey | Sorcerer | | *(anything else)* | Slate |
| Fiend | Ember | | | |

## Conditions & Effects

The condition tray covers the standard 5e conditions with custom artwork, plus four extra markers the module tracks itself:

- **Concentrating** — also shown on the portrait with a one-click cancel button and an animated border
- **Held Action** — 1-round duration
- **Advantage** / **Disadvantage**

Temporary active effects appear in their own tray with enriched tooltips. At 0 HP, characters get a death save arc — click the die to roll, and successes/failures are tracked on the portrait.

## Experimental: Quick Attack Automation

> ⚠️ Disabled by default. This feature is under active development and may change or misbehave.

When enabled, the melee and ranged quick slots can path your token toward a target and attack in one action.

The pathfinder routes around other tokens and walls, honours the scene's grid distance and diagonal movement rule, and works on square and hex grids. Tokens larger than one square are supported on both ends: the whole footprint has to fit, and weapon range is measured footprint-to-footprint. Tokens you cannot see do not affect the route, and tokens on a different elevation do not block it.

By default the search is bounded by the actor's **remaining** movement for the turn, capped by **Quick Action Depth**. Enable **Ignore Actor Speed Limit** to always search the full depth. Larger depths cost performance. Gridless scenes fall back to a direct line.

## For GMs

- **NPC Multiattack parsing** — NPC `Multiattack` features are parsed into their component attacks and grouped visually.
- **Save Npc Data** (world setting) — keeps per-NPC tray configuration between sessions.
- **Enable Targeting Chat Message** (world setting) — turns the live targeting chat messages on or off for everyone.
- **Target Line Poll Rate** (world setting) — controls the broadcast rate for all clients; raise it if you see network pressure with many players.
- Target line visibility is opt-in per client via **Send / Receive Target Lines**.

## Compatibility & Known Conflicts

Auto Action Tray uses libWrapper to wrap core Foundry behavior:

- `foundry.canvas.placeables.Token#_onClickLeft`, `#_onClickLeft2`, `#_onClickRight`, `#_canControl`
- `foundry.canvas.layers.TokenLayer#_onClickRight`
- `PIXI.EventSystem#setCursor` (only while **Custom Targeting Cursors** is enabled)

The core macro hotbar is hidden on load. Modules that replace the hotbar, override token click/selection behavior, or swap the canvas cursor may conflict. If you hit a conflict, try disabling **Custom Targeting Cursors** first.

The Reaction Tray hooks Midi-QOL's internal `ReactionDialog`, which is not a public API — see the [Reaction Tray](#reaction-tray) section.

## Support

Found a bug or have a feature request? Open an issue on the [issue tracker](https://github.com/Blyndone/Auto-Action-Tray/issues).

## Credits

- [libWrapper](https://github.com/ruipin/fvtt-lib-wrapper) by ruipin
- [socketlib](https://github.com/manuelVo/foundryvtt-socketlib) by Manuel Vögele
- Animation powered by [GSAP](https://gsap.com/), bundled with Foundry VTT

## License

Licensed under the [GNU Lesser General Public License v3.0](LICENSE.md).
