export class ReactionPromptTray {
  constructor(options = {}) {
    this.application = options.application || null
    this.id = 'reaction-prompt'
    this.type = 'reaction'
    this.label = 'Reaction'
    this.active = false
    this.actorName = ''
    this.content = ''
    this.buttons = []
    this.timeout = 0
    this.timeRemaining = 0
    this.dialogApp = null
    this.tickInterval = null
    this.closing = false
    this.entered = false
    this.enterPromise = null
  }

  get percentRemaining() {
    if (!this.timeout) return 0
    return Math.max(0, Math.min(100, (this.timeRemaining / this.timeout) * 100))
  }

  setActive() {
    this.active = true
  }

  setInactive() {
    this.active = false
  }

  intercept(dialogApp, application) {
    this.dialogApp = dialogApp
    this.actorName = dialogApp.data.actor?.name ?? ''
    this.label = this.actorName ? `${this.actorName} - Reaction` : 'Reaction'
    this.content = dialogApp.data.content ?? ''
    this.buttons = Object.entries(dialogApp.data.buttons).map(([key, button]) => ({
      key,
      label: button.label,
    }))
    this.timeout = dialogApp.data.timeout
    this.timeRemaining = dialogApp.timeRemaining
    this.active = true
    this.entered = false

    this.tickInterval = setInterval(() => {
      if (!this.dialogApp) return
      this.timeRemaining = this.dialogApp.timeRemaining
      application.requestRender('centerTray')
    }, 1000)
  }

  selectButton(key) {
    const dialogApp = this.dialogApp
    const button = dialogApp?.data.buttons?.[key]
    if (!button) return
    // Start the exit animation now rather than waiting for the closeReactionDialog hook, which
    // Foundry only fires once ApplicationV2.close() has finished its own window transition.
    // submit() is deliberately not awaited so midi runs the activity while the tray animates out.
    this.application?.closeReactionPrompt(dialogApp)
    dialogApp.submit(button)
  }

  decline() {
    const dialogApp = this.dialogApp
    if (!dialogApp) return
    this.application?.closeReactionPrompt(dialogApp)
    dialogApp.close()
  }

  stopTicking() {
    if (this.tickInterval) clearInterval(this.tickInterval)
    this.tickInterval = null
  }

  reset() {
    this.stopTicking()
    this.dialogApp = null
    this.active = false
    this.buttons = []
    this.closing = false
    this.entered = false
    this.enterPromise = null
  }
}
