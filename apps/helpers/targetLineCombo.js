export class TargetLineCombo {
  constructor(options) {
    this.phantom = options.phantom || false;
    this.line = new TargetLine(options);
    this.glowLine = new GlowLine(options);
    this.text = new TargetText(options);
    this.startPos = options.startPos;
    this.lastPos = options.startPos;
  }

  clearLines() {
    this.line.clear();
    this.glowLine.clear();
    this.clearText();
  }
  drawLines(endPos) {
    this.line.drawLine(endPos);
    this.glowLine.drawLine(endPos);
    this.text.moveText(endPos);
    this.lastPos = endPos;
  }
  setText(newText) {
    this.text.setText(newText);
  }
  moveText(endPos) {
    this.text.moveText(endPos);
  }
  clearText() {
    this.text.clear();
  }
  setInRange(inRange) {
    this.line.inRange = inRange;
    this.glowLine.inRange = inRange;
  }
}
class protoLine {
  constructor(options) {
    this.startPos = options.startPos;
    this.inRange = true;
  }
  clear() {
    this.line.clear();
  }
  drawLine(endPos) {
    this.clear();
    let midpoint1 = {
      x: this.startPos.x + (endPos.x - this.startPos.x) / 3,
      y: this.startPos.y - 200
    };
    let midpoint2 = {
      x: endPos.x - (endPos.x - this.startPos.x) / 3,
      y: endPos.y - 200
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

class GlowLine extends protoLine {
  constructor(options) {
    super(options);
    this.line = new PIXI.Graphics();
    this.color = options.color || 0xff0000;
    this.outOfRangeColor = options.outOfRangeColor || 0xff0000;
    this.blur = options.blur || 10;
    this.saturation = options.saturation || 3;
    this.width = options.width || 3;
    this.alpha = options.alpha || 0.8;
  }
}

class TargetLine extends protoLine {
  constructor(options) {
    super(options);
    this.line = new PIXI.Graphics();
    this.color = options.color || 0xffff00;
    this.outOfRangeColor = options.outOfRangeColor || 0xff0000;
    this.blur = options.blur || 1;
    this.saturation = options.saturation || 1;
    this.width = options.width || 2;
    this.alpha = options.alpha || 1;
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
