import { ACCENTS, getSettings, saveSettings, clearHistory } from '../store.js'
import { el, svgIcon, toast, backButton } from '../ui.js'

export function renderSettings (app, { navigate, serverSettings }) {
  const settings = getSettings()

  const darkToggle = el('button.switch', {
    type: 'button', role: 'switch', 'aria-checked': String(settings.dark), 'data-autofocus': true,
    onclick: () => {
      const next = saveSettings({ dark: darkToggle.getAttribute('aria-checked') !== 'true' })
      darkToggle.setAttribute('aria-checked', String(next.dark))
    },
  }, el('span.switch-knob'))

  const swatches = el('.swatch-row', {}, Object.entries(ACCENTS).map(([name, color]) =>
    el('button.swatch', {
      type: 'button',
      'aria-label': `${name} accent`,
      'aria-current': settings.accent === name ? 'true' : null,
      style: `background:${color}`,
      onclick: (event) => {
        saveSettings({ accent: name })
        for (const swatch of swatches.children) swatch.removeAttribute('aria-current')
        event.currentTarget.setAttribute('aria-current', 'true')
      },
    })
  ))

  const systemButtons = [
    el('button.wide-button', {
      type: 'button',
      onclick: () => { clearHistory(); toast('Watch history cleared') },
    }, svgIcon('eyeOff', 26), 'Clear Watch History'),
  ]

  if (serverSettings.clientCanShutdownServer) {
    systemButtons.push(el('button.wide-button', {
      type: 'button',
      onclick: async () => {
        const res = await fetch('/cmd/shutdown-server', { method: 'POST' })
        toast(res.ok ? 'Server shutting down…' : 'Server refused the shutdown request')
      },
    }, svgIcon('power', 26), 'Shutdown Server'))
  }

  app.append(
    el('header.page-header', {}, backButton(() => navigate('back')), el('h1.page-title', {}, 'Settings')),
    el('.settings-body', {},
      el('h2.settings-heading', {}, 'Colors'),
      el('.settings-row', {}, darkToggle, el('span.settings-row-label', {}, 'Dark Mode')),
      el('.settings-row', {}, el('span.settings-row-label', {}, 'Choose Accent Color'), swatches),
      el('h2.settings-heading', {}, 'System'),
      el('.settings-stack', {}, systemButtons),
    ),
  )
}
