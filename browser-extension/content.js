(function () {
  if (document.getElementById('tp-dm-host')) return

  // ─── CSS declared first — used below ────────────────────────────
  var CSS = [
    '*{box-sizing:border-box;margin:0;padding:0}',
    '#wrap{position:absolute;inset:0;background:#1e1e1e;',
    'font-family:SF Mono,Fira Code,ui-monospace,monospace;',
    'font-size:12px;color:#d4d4d4;display:flex;flex-direction:column;overflow:hidden;',
    'border-left:1px solid #3e3e42;box-shadow:-4px 0 24px rgba(0,0,0,.6)}',

    '#collapse-tab{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '#expand-btn{background:none;border:1px solid #3e3e42;color:#c8a96e;',
    'font-family:inherit;font-size:14px;padding:6px 4px;border-radius:3px;cursor:pointer;',
    'writing-mode:vertical-rl;width:22px}',
    '#expand-btn:hover{border-color:#c8a96e}',
    '#ctx-bar-wrap{background:#181818;padding:5px 12px 6px;border-bottom:1px solid #3e3e42;flex-shrink:0}',
    '#ctx-bar-label{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px}',
    '#ctx-bar-text{color:#858585;font-size:9px;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}',
    '#ctx-bar-nums{color:#4e4e52;font-size:9px;letter-spacing:.03em;flex-shrink:0}',
    '#model-toggle{display:flex;gap:2px;flex:1;justify-content:center}',
    '.model-btn{background:none;border:1px solid #3e3e42;color:#4e4e52;',
    'font-family:inherit;font-size:9px;padding:1px 7px;border-radius:2px;cursor:pointer;letter-spacing:.04em}',
    '.model-btn.active{border-color:#c8a96e;color:#c8a96e}',
    '.model-btn:not(.active):hover{color:#858585;border-color:#858585}',
    '#ctx-bar-track{height:3px;background:#2a2a2a;border-radius:2px;overflow:hidden}',
    '#ctx-bar-fill{height:100%;width:0%;background:#89d4a7;border-radius:2px;transition:width .3s,background .3s}',
    '#chat-hdr{display:flex;align-items:center;justify-content:space-between;',
    'padding:6px 12px;border-bottom:1px solid #2a2a2a;flex-shrink:0}',
    '#tp-clear-chat{background:none;border:1px solid #3e3e42;color:#858585;',
    'font-family:inherit;font-size:10px;padding:2px 7px;border-radius:2px;cursor:pointer}',
    '#tp-clear-chat:hover{color:#f44747;border-color:#f44747}',
    '#hdr{background:#181818;padding:9px 12px;border-bottom:1px solid #3e3e42;',
    'display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
    '#title{color:#c8a96e;font-size:11px;letter-spacing:.08em;font-weight:700}',
    '#cur{display:inline-block;width:7px;height:12px;background:#c8a96e;',
    'margin-left:3px;vertical-align:text-bottom;border-radius:1px;',
    'animation:blink 1.1s step-end infinite}',
    '@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}',
    '#tp-toggle{background:none;border:1px solid #3e3e42;color:#858585;',
    'font-family:inherit;font-size:12px;padding:1px 7px;border-radius:2px;cursor:pointer}',
    '#tp-toggle:hover{color:#d4d4d4;border-color:#858585}',

    '#tabbar{display:flex;background:#181818;border-bottom:1px solid #3e3e42;flex-shrink:0}',
    '.tab{flex:1;background:none;border:none;border-bottom:2px solid transparent;',
    'color:#858585;font-size:10px;letter-spacing:.05em;padding:6px 4px;cursor:pointer;font-family:inherit}',
    '.tab.active{color:#89d4a7;border-bottom-color:#89d4a7}',
    '.tab:hover{color:#d4d4d4}',

    '.panel{flex:1;overflow-y:auto;display:flex;flex-direction:column;',
    'scrollbar-width:thin;scrollbar-color:#3e3e42 transparent}',
    '.panel::-webkit-scrollbar{width:4px}',
    '.panel::-webkit-scrollbar-thumb{background:#3e3e42;border-radius:2px}',

    '.sec{padding:10px 12px;border-bottom:1px solid #2a2a2a;',
    'display:flex;flex-direction:column;gap:6px}',
    '.lbl{color:#6a9955;font-size:10px;letter-spacing:.05em}',

    'textarea{background:#252526;border:1px solid #3e3e42;color:#d4d4d4;',
    'font-family:inherit;font-size:11px;padding:7px 9px;border-radius:3px;',
    'resize:vertical;width:100%;line-height:1.5;outline:none}',
    'textarea:focus{border-color:#569cd6}',
    'textarea::placeholder{color:#4e4e52}',
    '#tp-ctx{min-height:80px;max-height:150px}',
    '#tp-chat-input{resize:none;height:56px}',

    '.btn-blue{background:#252526;border:1px solid #3e3e42;color:#9cdcfe;',
    'font-family:inherit;font-size:11px;padding:5px 9px;',
    'border-radius:3px;cursor:pointer;text-align:left;width:100%}',
    '.btn-blue:hover{border-color:#9cdcfe;background:#2a2a2a}',

    '.btn-green{background:#1c2a1c;border:1px solid #89d4a7;color:#89d4a7;',
    'font-family:inherit;font-size:11px;padding:7px;',
    'border-radius:3px;cursor:pointer;width:100%}',
    '.btn-green:hover{background:#243324}',
    '.btn-green:disabled{opacity:.5;cursor:not-allowed}',

    '.btn-yellow{background:#252526;border:1px solid #3e3e42;color:#dcdcaa;',
    'font-family:inherit;font-size:11px;padding:5px 9px;',
    'border-radius:3px;cursor:pointer;text-align:left;width:100%}',
    '.btn-yellow:hover{border-color:#dcdcaa;background:#2a2a2a}',

    '.si{display:flex;align-items:flex-start;gap:7px;padding:8px 0;border-bottom:1px solid #2a2a2a}',
    '.si:last-child{border-bottom:none}',
    '.si-n{color:#b5cea8;flex-shrink:0;padding-top:2px;font-size:11px}',
    '.si-body{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}',
    '.si-t{color:#89d4a7;line-height:1.5;word-break:break-word;font-size:11px}',
    '.cp{background:none;border:1px solid #3e3e42;color:#858585;',
    'font-family:inherit;font-size:10px;padding:2px 6px;border-radius:2px;cursor:pointer;flex-shrink:0}',
    '.cp:hover{color:#dcdcaa;border-color:#dcdcaa}',

    '.st{font-size:10px;padding:5px 12px;min-height:18px;color:#858585}',
    '.st.ok{color:#89d4a7}.st.warn{color:#dcdcaa}.st.error{color:#f44747}.st.info{color:#9cdcfe}',

    '#chat-msgs{flex:1;overflow-y:auto;padding:10px 12px;',
    'display:flex;flex-direction:column;gap:8px;',
    'scrollbar-width:thin;scrollbar-color:#3e3e42 transparent}',
    '#chat-msgs::-webkit-scrollbar{width:4px}',
    '#chat-msgs::-webkit-scrollbar-thumb{background:#3e3e42;border-radius:2px}',
    '.msg{padding:7px 9px;border-radius:3px;font-size:11px;line-height:1.5;word-break:break-word}',
    '.msg.user{background:#252526;color:#9cdcfe;align-self:flex-end;max-width:92%}',
    '.msg.assistant{background:#1c2a1c;color:#89d4a7;align-self:flex-start;max-width:96%}',
    '.msg-wrap{display:flex;flex-direction:column;gap:3px}',
    '.msg-actions{display:flex;gap:4px;padding:0 2px}',
    '.msg-btn{background:none;border:1px solid #3e3e42;color:#858585;',
    'font-family:inherit;font-size:10px;padding:2px 6px;border-radius:2px;cursor:pointer}',
    '.msg-btn:hover{color:#9cdcfe;border-color:#9cdcfe}',
    '.msg-btn.save:hover{color:#dcdcaa;border-color:#dcdcaa}',
    '.msg-btn.trans:hover{color:#ce9178;border-color:#ce9178}',
    '.msg-btn.use:hover{color:#89d4a7;border-color:#89d4a7}',
    '.msg-translation{color:#ce9178;font-size:11px;line-height:1.5;',
    'padding:4px 9px;margin-top:2px;word-break:break-word;font-style:italic}',
    '#chat-footer{padding:8px 12px;border-top:1px solid #3e3e42;',
    'display:flex;flex-direction:column;gap:6px;flex-shrink:0}',

    '.tmpl{padding:8px 12px;border-bottom:1px solid #2a2a2a;',
    'display:flex;align-items:flex-start;gap:7px;cursor:pointer}',
    '.tmpl:hover{background:#252526}',
    '.tmpl-t{color:#d4d4d4;font-size:11px;flex:1;line-height:1.4}',
    '.del{background:none;border:none;color:#4e4e52;font-size:13px;cursor:pointer;',
    'padding:0 2px;flex-shrink:0;font-family:inherit}',
    '.del:hover{color:#f44747}',
    '.empty{color:#4e4e52;font-size:11px;padding:16px 12px;text-align:center}',
  ].join(' ')

  // ─── HTML declared second ────────────────────────────────────────
  var HTML = (
    '<div id="wrap">' +
    '<div id="collapse-tab" style="display:none">' +
      '<button id="expand-btn">▶</button>' +
    '</div>' +
    '<div id="hdr">' +
      '<span id="title">TP ASSIST<span id="cur"></span></span>' +
      '<button id="tp-toggle">–</button>' +
    '</div>' +
    '<div id="ctx-bar-wrap">' +
      '<div id="ctx-bar-label">' +
        '<span id="ctx-bar-text">Context</span>' +
        '<div id="model-toggle">' +
          '<button class="model-btn active" data-model="claude-sonnet-4-6">sonnet</button>' +
          '<button class="model-btn" data-model="claude-haiku-4-5-20251001">haiku</button>' +
        '</div>' +
        '<span id="ctx-bar-nums">0 / 200k · 0%</span>' +
      '</div>' +
      '<div id="ctx-bar-track"><div id="ctx-bar-fill"></div></div>' +
    '</div>' +
    '<div id="tabbar">' +
      '<button class="tab active" data-tab="suggest">suggest</button>' +
      '<button class="tab" data-tab="chat">chat</button>' +
      '<button class="tab" data-tab="templates">templates</button>' +
    '</div>' +
    '<div id="p-suggest" class="panel">' +
      '<div class="sec">' +
        '<div class="lbl">// conversation</div>' +
        '<textarea id="tp-ctx" placeholder="Click capture or paste the chat..."></textarea>' +
        '<button id="tp-capture" class="btn-blue">📸 capture from page</button>' +
      '</div>' +
      '<div class="sec"><button id="tp-generate" class="btn-green">▶ generate</button></div>' +
      '<div class="sec"><div class="lbl">// suggestions</div><div id="tp-suggs"></div></div>' +
      '<div class="st" id="tp-status"></div>' +
    '</div>' +
    '<div id="p-chat" class="panel" style="display:none;flex-direction:column">' +
      '<div id="chat-hdr">' +
      '<span id="chat-ctx-label" class="lbl">// no context loaded</span>' +
      '<button id="tp-clear-chat">clear</button>' +
    '</div>' +
      '<div id="chat-msgs"><div class="msg assistant">Hey! Ask me anything about reply style, tone, or how to handle a specific conversation.</div></div>' +
      '<div id="chat-footer">' +
        '<textarea id="tp-chat-input" placeholder="Ask Claude... (Enter to send)"></textarea>' +
        '<button id="tp-chat-send" class="btn-green">▶ send</button>' +
      '</div>' +
    '</div>' +
    '<div id="p-templates" class="panel" style="display:none">' +
      '<div class="sec"><div class="lbl">// saved replies</div>' +
        '<button id="tp-save-tmpl" class="btn-yellow">+ save last suggestion</button>' +
      '</div>' +
      '<div id="tp-tmpl-list"></div>' +
    '</div>' +
    '</div>'
  )

  // ─── Inject ──────────────────────────────────────────────────────
  document.body.style.setProperty('margin-right', '300px', 'important')

  var host = document.createElement('div')
  host.id = 'tp-dm-host'
  host.style.cssText = 'position:fixed;top:0;right:0;width:300px;height:100vh;z-index:2147483647;'
  document.body.appendChild(host)

  var shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<style>' + CSS + '</style>' + HTML

  // ─── Refs ────────────────────────────────────────────────────────
  var $ = function (id) { return shadow.getElementById(id) }
  var toggleBtn    = $('tp-toggle')
  var tabbar       = $('tabbar')
  var pSuggest     = $('p-suggest')
  var pChat        = $('p-chat')
  var pTemplates   = $('p-templates')
  var capture      = $('tp-capture')
  var textarea     = $('tp-ctx')
  var generate     = $('tp-generate')
  var suggs        = $('tp-suggs')
  var status       = $('tp-status')
  var chatMsgs     = $('chat-msgs')
  var chatInput    = $('tp-chat-input')
  var chatSend     = $('tp-chat-send')
  var saveTmpl     = $('tp-save-tmpl')
  var tmplList     = $('tp-tmpl-list')

  var collapsed      = false
  var activeTab      = 'suggest'
  var lastSugg       = ''
  var chatHistory    = []
  var currentContext = ''
  var sessionTokens  = 0
  var templates      = loadTemplates()
  var SERVER         = 'http://localhost:3001'
  var clearChatBtn  = $('tp-clear-chat')
  var ctxLabel      = $('chat-ctx-label')
  var ctxBarNums    = $('ctx-bar-nums')
  var ctxBarFill    = $('ctx-bar-fill')
  var MAX_TOKENS    = 200000
  var selectedModel = localStorage.getItem('tp_model') || 'claude-sonnet-4-6'

  // Model toggle
  shadow.getElementById('model-toggle').addEventListener('click', function (e) {
    var btn = e.target.closest('.model-btn')
    if (!btn) return
    selectedModel = btn.dataset.model
    localStorage.setItem('tp_model', selectedModel)
    shadow.querySelectorAll('.model-btn').forEach(function (b) { b.classList.remove('active') })
    btn.classList.add('active')
  })
  // Restore saved model
  shadow.querySelectorAll('.model-btn').forEach(function (b) {
    if (b.dataset.model === selectedModel) b.classList.add('active')
    else b.classList.remove('active')
  })

  function addTokens(n) {
    if (!n) return
    sessionTokens += n
    var pct = Math.min(100, Math.round(sessionTokens / MAX_TOKENS * 100))
    var k = sessionTokens >= 1000 ? (sessionTokens / 1000).toFixed(1) + 'k' : sessionTokens
    ctxBarNums.textContent = k + ' / 200k · ' + pct + '%'
    ctxBarFill.style.width = pct + '%'
    var color = pct < 30 ? '#89d4a7' : pct < 70 ? '#dcdcaa' : '#f44747'
    ctxBarFill.style.background = color
    ctxBarNums.style.color = color
  }

  clearChatBtn.addEventListener('click', function () {
    chatHistory = []
    currentContext = ''
    ctxLabel.textContent = '// no context loaded'
    ctxLabel.style.color = ''
    chatMsgs.innerHTML = '<div class="msg assistant">Chat cleared. New conversation started.</div>'
  })

  function loadChatContext() {
    var text = captureConversation()
    if (!text) return
    currentContext = text
    var nameEl = document.querySelector('h2, header h2, [aria-label] h1')
    var name = nameEl ? nameEl.textContent.trim().slice(0, 28) : 'conversation'
    ctxLabel.textContent = '// ' + name
    ctxLabel.style.color = '#89d4a7'
  }

  // ─── Toggle ──────────────────────────────────────────────────────
  var wrap = shadow.getElementById('wrap')

  function setCollapsed(val) {
    collapsed = val
    if (collapsed) {
      tabbar.style.display = 'none'
      showPanel(null)
      wrap.style.justifyContent = 'center'
      wrap.style.alignItems = 'center'
      shadow.getElementById('hdr').style.display = 'none'
      shadow.getElementById('collapse-tab').style.display = 'flex'
      document.body.style.setProperty('margin-right', '28px', 'important')
      host.style.width = '28px'
    } else {
      tabbar.style.display = 'flex'
      showPanel(activeTab)
      wrap.style.justifyContent = ''
      wrap.style.alignItems = ''
      shadow.getElementById('hdr').style.display = 'flex'
      shadow.getElementById('collapse-tab').style.display = 'none'
      document.body.style.setProperty('margin-right', '300px', 'important')
      host.style.width = '300px'
    }
  }

  toggleBtn.addEventListener('click', function () { setCollapsed(true) })
  shadow.getElementById('collapse-tab').addEventListener('click', function () { setCollapsed(false) })

  // ─── Tabs ────────────────────────────────────────────────────────
  tabbar.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab')
    if (!btn) return
    activeTab = btn.dataset.tab
    tabbar.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active') })
    btn.classList.add('active')
    showPanel(activeTab)
    if (activeTab === 'templates') renderTemplates()
    if (activeTab === 'chat') loadChatContext()
  })

  function showPanel(tab) {
    pSuggest.style.display   = tab === 'suggest'   ? 'flex' : 'none'
    pChat.style.display      = tab === 'chat'      ? 'flex' : 'none'
    pTemplates.style.display = tab === 'templates' ? 'flex' : 'none'
  }

  // ─── Capture ─────────────────────────────────────────────────────
  capture.addEventListener('click', function () {
    var text = captureConversation()
    if (text) { textarea.value = text; setStatus('captured ✓', 'ok') }
    else setStatus('could not read DOM — paste manually', 'warn')
  })

  // ─── Generate ────────────────────────────────────────────────────
  generate.addEventListener('click', function () {
    var text = textarea.value.trim()
    if (!text) { setStatus('add conversation first', 'warn'); return }
    generate.textContent = '⟳ generating...'
    generate.disabled = true
    setStatus('calling claude...', 'info')
    suggs.innerHTML = ''
    fetch(SERVER + '/api/claude/suggest-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, model: selectedModel })
    })
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data.suggestions) { lastSugg = data.suggestions[0]; renderSuggestions(data.suggestions); setStatus('', ''); addTokens(data.tokensUsed) }
      else setStatus(data.error || 'error', 'error')
    })
    .catch(function () { setStatus('server offline — open DM Launch', 'error') })
    .finally(function () { generate.textContent = '▶ generate'; generate.disabled = false })
  })

  // ─── Chat ────────────────────────────────────────────────────────
  chatSend.addEventListener('click', sendChat)
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
  })

  function sendChat() {
    var text = chatInput.value.trim()
    if (!text) return
    chatInput.value = ''
    chatHistory.push({ role: 'user', content: text })
    addMsg('user', text)
    chatSend.disabled = true; chatSend.textContent = '⟳'
    fetch(SERVER + '/api/claude/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatHistory: chatHistory, rawContext: currentContext || undefined, model: selectedModel })
    })
    .then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t) })
      return r.json()
    })
    .then(function (data) {
      if (data.error) throw new Error(data.error)
      var reply = data.reply || (data.suggestions && data.suggestions[0]) || '(empty response)'
      chatHistory.push({ role: 'assistant', content: reply })
      addMsg('assistant', reply)
      addTokens(data.tokensUsed)
    })
    .catch(function (err) { addMsg('assistant', 'ERROR: ' + (err.message || err)) })
    .finally(function () { chatSend.disabled = false; chatSend.textContent = '▶ send' })
  }

  function addMsg(role, text) {
    var wrap = document.createElement('div')
    wrap.className = 'msg-wrap'

    var div = document.createElement('div')
    div.className = 'msg ' + role
    div.textContent = text
    wrap.appendChild(div)

    var isGreeting = text === 'Hey! Ask me anything about reply style, tone, or how to handle a specific conversation.'

    if (role === 'assistant' && !isGreeting) {
      // Translation area
      var transDiv = document.createElement('div')
      transDiv.className = 'msg-translation'
      wrap.appendChild(transDiv)

      var actions = document.createElement('div')
      actions.className = 'msg-actions'

      // copy
      var copyBtn = mkBtn('copy', null)
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(text)
        flash(copyBtn, 'copied!')
      })

      // translate
      var transBtn = mkBtn('translate', 'trans')
      transBtn.addEventListener('click', function () {
        if (transDiv.textContent) { transDiv.textContent = ''; return }
        transBtn.textContent = '...'
        transBtn.disabled = true
        fetch(SERVER + '/api/claude/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text, model: selectedModel })
        })
        .then(function (r) { return r.json() })
        .then(function (d) { transDiv.textContent = d.translation || '' })
        .catch(function () { transDiv.textContent = 'translation error' })
        .finally(function () { transBtn.textContent = 'translate'; transBtn.disabled = false })
      })

      // save template
      var saveBtn = mkBtn('save', 'save')
      saveBtn.addEventListener('click', function () {
        templates.unshift(text)
        if (templates.length > 20) templates.pop()
        saveTemplates(templates)
        flash(saveBtn, 'saved ✓')
      })

      // use as reply
      var useBtn = mkBtn('use as reply', 'use')
      useBtn.addEventListener('click', function () {
        var ok = injectIntoInstagram(text)
        if (ok) flash(useBtn, 'sent to input ✓')
        else { navigator.clipboard.writeText(text); flash(useBtn, 'copied (paste manually)') }
      })

      actions.appendChild(copyBtn)
      actions.appendChild(transBtn)
      actions.appendChild(saveBtn)
      actions.appendChild(useBtn)
      wrap.appendChild(actions)
    }

    chatMsgs.appendChild(wrap)
    chatMsgs.scrollTop = chatMsgs.scrollHeight
  }

  function mkBtn(label, cls) {
    var btn = document.createElement('button')
    btn.className = 'msg-btn' + (cls ? ' ' + cls : '')
    btn.textContent = label
    return btn
  }

  function flash(btn, msg) {
    var orig = btn.textContent
    btn.textContent = msg
    setTimeout(function () { btn.textContent = orig }, 1800)
  }

  function injectIntoInstagram(text) {
    var selectors = [
      'div[aria-label="Message"]',
      'div[aria-label="Сообщение"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder]',
    ]
    var input = null
    for (var i = 0; i < selectors.length; i++) {
      input = document.querySelector(selectors[i])
      if (input) break
    }
    if (!input) return false

    input.focus()

    if (input.tagName === 'TEXTAREA') {
      // Native textarea
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      nativeInputValueSetter.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      // Contenteditable div (Instagram uses this)
      document.execCommand('selectAll', false, null)
      document.execCommand('insertText', false, text)
    }

    return true
  }

  // ─── Templates ───────────────────────────────────────────────────
  saveTmpl.addEventListener('click', function () {
    if (!lastSugg) return
    templates.unshift(lastSugg)
    if (templates.length > 20) templates.pop()
    saveTemplates(templates)
    renderTemplates()
    saveTmpl.textContent = 'saved ✓'
    setTimeout(function () { saveTmpl.textContent = '+ save last suggestion' }, 1500)
  })

  function renderTemplates() {
    if (!templates.length) { tmplList.innerHTML = '<div class="empty">no templates yet</div>'; return }
    tmplList.innerHTML = templates.map(function (t, i) {
      return '<div class="tmpl" data-i="' + i + '"><span class="tmpl-t">' + esc(t) + '</span><button class="del" data-i="' + i + '">✕</button></div>'
    }).join('')
    tmplList.querySelectorAll('.tmpl').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('del')) return
        navigator.clipboard.writeText(templates[+el.dataset.i])
        var span = el.querySelector('.tmpl-t'); var orig = span.textContent
        span.textContent = 'copied!'; setTimeout(function () { span.textContent = orig }, 1200)
      })
    })
    tmplList.querySelectorAll('.del').forEach(function (btn) {
      btn.addEventListener('click', function () { templates.splice(+btn.dataset.i, 1); saveTemplates(templates); renderTemplates() })
    })
  }

  // ─── Capture from DOM ────────────────────────────────────────────
  var SKIP = [/accept message request/i, /if you accept/i, /they won.t know/i, /decide who can/i]

  function captureConversation() {
    var tries = ['[role="row"] span[dir="auto"]', '[role="listitem"] span[dir="auto"]', 'span[dir="auto"]']
    for (var i = 0; i < tries.length; i++) {
      var els = Array.from(document.querySelectorAll(tries[i]))
        .map(function (el) { return el.textContent.trim() })
        .filter(function (t) {
          if (t.length < 2 || t.length > 350) return false
          return !SKIP.some(function (re) { return re.test(t) })
        })
      if (els.length >= 1) return els.slice(-20).join('\n')
    }
    return null
  }

  function loadTemplates() { try { return JSON.parse(localStorage.getItem('tp_templates') || '[]') } catch (e) { return [] } }
  function saveTemplates(list) { try { localStorage.setItem('tp_templates', JSON.stringify(list)) } catch (e) {} }
  function setStatus(msg, type) { status.textContent = msg; status.className = 'st ' + (type || '') }
  function renderSuggestions(list) {
    suggs.innerHTML = ''
    list.forEach(function (s, i) {
      var item = document.createElement('div')
      item.className = 'si'

      var num = document.createElement('span')
      num.className = 'si-n'
      num.textContent = (i + 1) + '.'

      var txt = document.createElement('div')
      txt.className = 'si-body'

      var t = document.createElement('span')
      t.className = 'si-t'
      t.textContent = s

      var transDiv = document.createElement('div')
      transDiv.className = 'msg-translation'

      var actions = document.createElement('div')
      actions.className = 'msg-actions'

      var copyBtn = mkBtn('copy', null)
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(s); flash(copyBtn, 'copied!')
      })

      var transBtn = mkBtn('translate', 'trans')
      transBtn.addEventListener('click', function () {
        if (transDiv.textContent) { transDiv.textContent = ''; return }
        transBtn.textContent = '...'; transBtn.disabled = true
        fetch(SERVER + '/api/claude/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: s })
        })
        .then(function (r) { return r.json() })
        .then(function (d) { transDiv.textContent = d.translation || '' })
        .catch(function () { transDiv.textContent = 'error' })
        .finally(function () { transBtn.textContent = 'translate'; transBtn.disabled = false })
      })

      var saveBtn = mkBtn('save', 'save')
      saveBtn.addEventListener('click', function () {
        templates.unshift(s)
        if (templates.length > 20) templates.pop()
        saveTemplates(templates)
        flash(saveBtn, 'saved ✓')
      })

      var useBtn = mkBtn('use as reply', 'use')
      useBtn.addEventListener('click', function () {
        var ok = injectIntoInstagram(s)
        if (ok) flash(useBtn, 'sent ✓')
        else { navigator.clipboard.writeText(s); flash(useBtn, 'copied') }
      })

      actions.appendChild(copyBtn)
      actions.appendChild(transBtn)
      actions.appendChild(saveBtn)
      actions.appendChild(useBtn)

      txt.appendChild(t)
      txt.appendChild(transDiv)
      txt.appendChild(actions)

      item.appendChild(num)
      item.appendChild(txt)
      suggs.appendChild(item)
    })
  }
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

  console.log('[TP] ready')
})()
