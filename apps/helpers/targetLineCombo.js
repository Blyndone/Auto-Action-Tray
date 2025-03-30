export class TargetLineCombo {
  constructor(options) {
    this.yOffset = options.yOffset || 0;
    this.phantom = options.phantom || false;
    this.id = options.id || foundry.utils.randomID();
    this.actorId = options.actorId;
    this.line = new TargetLine({ ...options, yOffset: this.yOffset });
    this.glowLine = new GlowLine({ ...options, yOffset: this.yOffset });
    this.text = !this.phantom ? new TargetText(options) : null;
    this.firstLine = options.firstLine !== undefined ? options.firstLine : true;
    this.targettingText = this.firstLine ? new TargettingText(options) : null;
    this.startPos = options.startPos;
    this.startLinePos = options.startLinePos;
    this.lastPos = options.startPos;
    this.color = options.color || game.user.color.css || 0xffff00;
    this.inRange = true;
  }

  clearLines() {
    this.line.clear();
    this.glowLine.clear();
    this.firstLine ? this.targettingText.clear() : null;
    if (!this.phantom) {
      this.clearText();
    }
  }
  destroyLines() {
    this.line.destroy();
    this.glowLine.destroy();
    this.firstLine ? this.targettingText.clear() : null;
    if (!this.phantom) {
      this.clearText();
    }
  }

  drawLines(endPos) {
    this.line.drawLine(endPos);
    this.glowLine.drawLine(endPos);
    if (!this.phantom) {
      this.text.moveText(endPos);
    }
    this.lastPos = endPos;
  }
  setText(newText) {
    if (this.phantom) return;
    this.text.setText(newText);
  }
  setTargetingText(pos, itemType, itemName) {
    this.targettingText.setTargetingText(pos, itemType, itemName);
  }
  setFirstLine(firstLine) {
    this.firstLine = firstLine;
  }
  transferTargettingText(targettingText) {
    this.targettingText = targettingText;
  }
  moveText(endPos) {
    if (this.phantom) return;
    this.text.moveText(endPos);
  }
  clearText() {
    if (this.phantom) return;
    this.text.clear();
  }
  setInRange(inRange) {
    this.inRange = inRange;
    this.line.inRange = inRange;
    this.glowLine.inRange = inRange;
  }
  setYOffset(yOffset) {
    this.yOffset = yOffset;
    this.line.yOffset = yOffset;
    this.glowLine.yOffset = yOffset;
  }
}
class protoLine {
  constructor(options) {
    this.inRange = true;
    this.yOffset = options.yOffset || 0;
    this.startPos = options.startPos;
    this.startLinePos = options.startLinePos;
  }
  destroy() {
    let tween = gsap.to(this.line, {
      pixi: { blur: 0, alpha: 0 },
      duration: 0.5,
      onComplete: function() {
        canvas.app.stage.removeChild(this.line);
        tween.kill();
      }.bind(this)
    });
  }
  clear() {
    this.line.clear();
  }
  drawLine(endPos) {
    this.clear();
    let midpoint1 = {
      x: this.startLinePos.x + (endPos.x - this.startLinePos.x) / 3,
      y: this.startLinePos.y - 200 - this.yOffset * 50
    };

    let midpoint2 = {
      x: endPos.x - (endPos.x - this.startLinePos.x) / 3,
      y: endPos.y - 200 - this.yOffset * 50
    };
    this.line.lineStyle(
      this.width,
      this.inRange ? this.color : this.outOfRangeColor,
      this.alpha
    );
    this.line.moveTo(this.startLinePos.x, this.startLinePos.y);
    this.line.bezierCurveTo(
      midpoint1.x,
      midpoint1.y,
      midpoint2.x,
      midpoint2.y,
      endPos.x,
      endPos.y
    );
    gsap.set(this.line, {
      pixi: { blur: this.blur, alpha: this.alpha, saturation: this.saturation }
    });
    canvas.app.stage.addChild(this.line);
  }
}

class protoText {
  constructor(options) {
    this.actorId = options.actorId;
    this.color = options.color || game.user.color.css || 0xffff00;
    this.text = new PIXI.Text("");

    this.text.zIndex = 1;

    this.alpha = options.alpha || 1;
    canvas.app.stage.addChild(this.text);
  }
  clear() {
    if (this.text) {
      this.text.destroy();
      this.text = null;
    }
  }
  setText(newText) {
    if (this.text) {
      this.text.text = newText;
    }
  }
}

class TargetLine extends protoLine {
  constructor(options) {
    super(options);
    this.line = new PIXI.Graphics();
    this.color = options.color
      ? Color.fromString(options.color).add(Color.fromString("#333333")).css
      : game.user.color.add(Color.fromString("#333333")).css || 0xffff00;
    this.outOfRangeColor =
      Color.fromString(this.color).multiply(0.5) || 0xff0000;
    this.blur = options.blur || 1;
    this.saturation = options.saturation || 1;
    this.width = options.width || 2;
    this.alpha = options.alpha || 1;
  }
}

class GlowLine extends protoLine {
  constructor(options) {
    super(options);
    this.line = new PIXI.Graphics();
    this.color = options.color || game.user.color.css || 0xff0000;
    this.outOfRangeColor =
      Color.fromString(this.color).multiply(0.5) || 0xff0000;
    this.blur = options.blur || 10;
    this.saturation = options.saturation || 3;
    this.width = options.width || 3;
    this.alpha = options.alpha || 0.8;
  }
}
class TargettingText extends protoText {
  constructor(options) {
    super(options);
    this.itemName = options.itemName || "itemName";
    this.itemType = options.itemType || "itemType";
    this.startPos = options.startPos;
    this.animation;
    this.style = new PIXI.TextStyle({
      dropShadow: true,
      dropShadowAlpha: 0.6,
      dropShadowAngle: 0,
      dropShadowBlur: 5,
      dropShadowDistance: 0,
      dropShadowColor: this.color,
      fill: "#ffffff",
      fontFamily: "Georgia",
      fontSize: 20,
      fontStyle: "italic",
      strokeThickness: 3
    });
    this.text.style = this.style;
    this.setTargetingText(options.startPos, this.itemType, this.itemName);
  }

  clear() {
    if (this.animation) {
      if (this.text) {
        gsap.killTweensOf(this.text);
        gsap.to(this.text, {
          pixi: { blur: 0, alpha: 0 },
          duration: 0.5,
          onComplete: function() {
            this.animation.kill();
            if (this.text) {
              this.text.destroy();
              this.text = null;
            }
          }.bind(this)
        });
      }
    }
  }
  setTargetingText(pos, itemType, itemName) {
    let anchor =
      game.actors.get(this.actorId).prototypeToken.height *
        canvas.grid.size /
        2 +
      30;
    if (this.text) {
      let prefix = itemType === "spell" ? "Casting " : "Using ";
      this.text.text = `   ${prefix} ${itemName}   `;
      this.text.anchor.set(0.5, 0.5);
      this.text.position.set(pos.x, pos.y - anchor);

      this.animation = gsap.to(this.text, {
        y: this.text.y + 10,
        duration: 2,
        repeat: -1,
        ease: "sine.inOut",
        yoyo: true
      });
    }
  }
}

class TargetText extends protoText {
  constructor(options) {
    super(options);
    this.style = new PIXI.TextStyle({
      dropShadow: true,
      dropShadowAlpha: 0.6,
      dropShadowAngle: 0,
      dropShadowBlur: 5,
      dropShadowDistance: 0,
      dropShadowColor: "#000000",
      fill: "#ffffff",
      fontFamily: "Georgia",
      fontSize: 25,
      strokeThickness: 3
    });
    this.text.style = this.style;
  }
  moveText(endPos) {
    if (this.text) {
      this.text.position.set(endPos.x + 15, endPos.y + 15);
      // canvas.app.stage.addChild(this.targetText);
    }
  }
}
