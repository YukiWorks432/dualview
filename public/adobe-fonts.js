/* Adobe Fonts is enabled only for HanaYuki-operated DualView hosts.
 * Clones and third-party forks fall back to the open/system font stack. */
;(function (d, w) {
  var host = w.location.hostname
  var isProduction =
    host === 'dualview.yukiworks432.workers.dev' || host === 'dualview.hanayuki.xyz'
  var isWorkersPreview = /-dualview\.yukiworks432\.workers\.dev$/.test(host)

  if (!isProduction && !isWorkersPreview) return

  var fontOrigin = 'https://use.typekit.net'
  var preconnect = d.createElement('link')
  preconnect.rel = 'preconnect'
  preconnect.href = fontOrigin
  preconnect.crossOrigin = 'anonymous'
  d.head.appendChild(preconnect)

  var config = {
      kitId: 'qhu1llm',
      scriptTimeout: 3000,
      async: true,
    },
    h = d.documentElement,
    t = setTimeout(function () {
      h.className = h.className.replace(/\bwf-loading\b/g, '') + ' wf-inactive'
    }, config.scriptTimeout),
    tk = d.createElement('script'),
    f = false,
    s = d.getElementsByTagName('script')[0],
    a

  h.className += ' wf-loading'
  tk.src = fontOrigin + '/' + config.kitId + '.js'
  tk.async = true
  tk.onload = tk.onreadystatechange = function () {
    a = this.readyState
    if (f || (a && a !== 'complete' && a !== 'loaded')) return
    f = true
    clearTimeout(t)
    try {
      Typekit.load(config)
    } catch (e) {}
  }
  s.parentNode.insertBefore(tk, s)
})(document, window)
