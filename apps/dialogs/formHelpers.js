export function createSliderInput(options) {
  const wrapper = document.createElement('div')
  wrapper.classList.add('form-fields', 'aat-slider-field')

  const input = document.createElement('input')
  input.type = 'range'
  input.name = options.name
  input.style.flex = 'auto'

  if (typeof options.min === 'number') input.setAttribute('min', String(options.min))
  if (typeof options.max === 'number') input.setAttribute('max', String(options.max))
  if (typeof options.step === 'number') input.setAttribute('step', String(options.step))
  if (typeof options.value === 'number') input.setAttribute('value', String(options.value))
  if (options.disabled) input.setAttribute('disabled', 'disabled')

  const display = document.createElement('div')
  display.id = options.name + '-label'
  display.classList.add('value-display')
  display.textContent = options.value

  wrapper.appendChild(input)
  wrapper.appendChild(display)

  return wrapper
}

export function createFieldset(legend, groups) {
  const fieldset = document.createElement('fieldset')

  const legendEl = document.createElement('legend')
  legendEl.textContent = legend
  fieldset.appendChild(legendEl)

  for (const group of groups) fieldset.appendChild(group)

  return fieldset
}
