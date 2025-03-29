export class TargetLineCombo {
  constructor(options) {
    this.yOffset = options.yOffset || 0;
    this.phantom = options.phantom || false;
    this.id = options.id || foundry.utils.randomID();
    this.actorId = options.actorId;
    this.line = new TargetLine({ ...options, yOffset: this.yOffset });
    this.glowLine = new GlowLine({ ...options, yOffset: this.yOffset });
    this.text = !this.phantom ? new TargetText(options) : null;
    this.startPos = options.startPos;
    this.lastPos = options.startPos;
    this.color = options.color || game.user.color.css || 0xffff00;
    this.inRange = true;
  }

  clearLines() {
    this.line.clear();
    this.glowLine.clear();
    if (!this.phantom) {
      this.clearText();
    }
  }
  destroyLines() {
    this.line.destroy();
    this.glowLine.destroy();
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
    this.startPos = options.startPos;
    this.inRange = true;
    this.yOffset = options.yOffset || 0;
  }
  destroy() {
    gsap.to(this.line, {
      pixi: { blur: 0, alpha: 0 },
      duration: 0.5,
      onComplete: () => {
        this.line.clear();
      }
    });
  }
  clear() {
    this.line.clear();
  }
  drawLine(endPos) {
    this.clear();
    let midpoint1 = {
      x: this.startPos.x + (endPos.x - this.startPos.x) / 3,
      y: this.startPos.y - 200 - this.yOffset * 50
    };

    let midpoint2 = {
      x: endPos.x - (endPos.x - this.startPos.x) / 3,
      y: endPos.y - 200 - this.yOffset * 50
    };
    this.line.lineStyle(
      this.width,
      this.inRange ? this.color : this.outOfRangeColor,
      this.alpha
    );
    this.line.moveTo(this.startPos.x, this.startPos.y);
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

class TargetText {
  constructor(options) {
    this.text = new PIXI.Text(
      "",
      new PIXI.TextStyle({
        fontSize: options.fontSize || 25,
        fill: options.color || 0xffffff,
        fontWeight: "bold"
      })
    );

    this.alpha = options.alpha || 1;
    canvas.app.stage.addChild(this.text);
  }
  moveText(endPos) {
    if (this.text) {
      this.text.position.set(endPos.x + 15, endPos.y + 15);
      // canvas.app.stage.addChild(this.targetText);
    }
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
