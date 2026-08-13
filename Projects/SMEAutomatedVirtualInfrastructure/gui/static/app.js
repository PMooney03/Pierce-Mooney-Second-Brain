(function () {
  'use strict';

  const API = {
    prereqs: () => fetch('/api/prerequisites', { credentials: 'include' }).then(r => r.json()),
    presets: () => fetch('/api/presets', { credentials: 'include' }).then(r => r.json()),
    usersList: () => fetch('/api/users', { credentials: 'include' }).then(r => r.json()),
    createUser: (username, password, role) =>
      fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password, role: role || 'user' })
      }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); }),
    updateUserRole: (username, role) =>
      fetch('/api/users/' + encodeURIComponent(username), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role || 'user' })
      }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); }),
    deleteUser: (username) =>
      fetch('/api/users/' + encodeURIComponent(username), {
        method: 'DELETE',
        credentials: 'include'
      }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); }),
    status: (includeProvisioning) =>
      fetch('/api/status?provisioning=' + (includeProvisioning !== false ? '1' : '0'), { credentials: 'include' }).then(r => r.json()),
    actionStream: async function (preset, action, callbacks, options) {
      options = options || {};
      const body = { preset, action };
      if (action === 'up') body.run_async = !!options.run_async;
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && (err.require_admin || err.error)) {
          throw new Error(err.error || 'Admin access required');
        }
        throw new Error(err.stderr || err.message || 'Request failed');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || '';
        for (var i = 0; i < events.length; i++) {
          const match = events[i].match(/^data:\s*(.+)/m);
          if (!match) continue;
          try {
            const data = JSON.parse(match[1]);
            if (data.type === 'line' && data.text != null && callbacks.onLine) callbacks.onLine(data.text);
            if (data.type === 'keepalive' && callbacks.onKeepalive) callbacks.onKeepalive();
            if (data.type === 'done' && callbacks.onDone) callbacks.onDone(data.success === true);
          } catch (e) { /* ignore parse */ }
        }
      }
      if (buffer.trim()) {
        const match = buffer.match(/^data:\s*(.+)/m);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if (data.type === 'line' && data.text != null && callbacks.onLine) callbacks.onLine(data.text);
            if (data.type === 'keepalive' && callbacks.onKeepalive) callbacks.onKeepalive();
            if (data.type === 'done' && callbacks.onDone) callbacks.onDone(data.success === true);
          } catch (e) { /* ignore */ }
        }
      }
    }
  };

  let autoRefreshTimer = null;

  function showOutput(el, text, isError) {
    el.textContent = text || '';
    el.className = 'output' + (isError ? ' err' : '') + (el.id === 'action-output' ? ' output-terminal' : '');
    if (el.id === 'action-output') {
      el.style.display = 'block';
    } else {
      el.style.display = text ? 'block' : 'none';
    }
  }

  function setLoading(el, loading) {
    if (loading) {
      el.innerHTML = '<span class="loading">Loading…</span>';
    }
  }

  function renderPrereqs(data) {
    const div = document.getElementById('prereqs-result');
    // Some pages (like the Presets and Manage Users pages) don't include
    // the prerequisites panel. In that case, skip rendering entirely so
    // we don't throw and break preset loading.
    if (!div) {
      console.log('renderPrereqs: no prereqs-result container on this page, skipping.');
      return;
    }
    if (data.ok) {
      div.innerHTML = '<span class="ok">All prerequisites installed. Ready to run presets.</span>';
      div.className = 'prereqs-result ok';
    } else {
      div.innerHTML = '<span class="err">' + (data.message || 'Missing tools.') + '</span>';
      if (data.missing && data.missing.length) {
        div.innerHTML += ' <span class="err">(' + data.missing.join(', ') + ')</span>';
      }
      div.className = 'prereqs-result err';
    }
  }

  function stateToBadge(state) {
    if (!state) return '';
    const s = (state + '').toLowerCase();
    if (s.includes('running')) return '<span class="badge badge-running">Running</span>';
    if (s.includes('saved') || s.includes('poweroff') || s.includes('stopped')) return '<span class="badge badge-stopped">Stopped</span>';
    if (s.includes('not created')) return '<span class="badge badge-not-created">Not created</span>';
    return '<span class="badge badge-provisioning">' + state + '</span>';
  }

  function confirmStart(preset, onQuickboot, onDebugboot) {
    var overlay = document.getElementById('start-choice-overlay');
    var title = document.getElementById('start-choice-title');
    var cancelBtn = document.getElementById('start-choice-cancel');
    var quickBtn = document.getElementById('start-choice-quickboot');
    var debugBtn = document.getElementById('start-choice-debugboot');
    title.textContent = 'Start ' + preset + '?';
    overlay.hidden = false;
    function close() {
      overlay.hidden = true;
      cancelBtn.removeEventListener('click', close);
      quickBtn.removeEventListener('click', doQuick);
      debugBtn.removeEventListener('click', doDebug);
      document.removeEventListener('keydown', escHandler);
    }
    function doQuick() { close(); onQuickboot(); }
    function doDebug() { close(); onDebugboot(); }
    var escHandler = function (e) { if (e.key === 'Escape') close(); };
    cancelBtn.addEventListener('click', close);
    quickBtn.addEventListener('click', doQuick);
    debugBtn.addEventListener('click', doDebug);
    document.addEventListener('keydown', escHandler);
  }

  function isAdmin() {
    return window.GUI_USER && window.GUI_USER.role === 'admin';
  }

  function renderPresets(data) {
    const div = document.getElementById('presets-list');
    if (!div) {
      // Non-admin dashboards don't include the presets panel.
      return;
    }
    if (!Array.isArray(data) || data.length === 0) {
      div.innerHTML = '<span class="loading">No presets.</span>';
      return;
    }
    const admin = isAdmin();
    div.innerHTML = data.map(p => {
      const hostsShort = (p.hosts || []).slice(0, 4).join(', ') + (p.host_count > 4 ? '…' : '');
      const actionsHtml = admin
        ? `<button type="button" class="btn btn-primary" data-preset="${escapeHtml(p.id)}" data-action="up">Start</button>
           <button type="button" class="btn btn-reprovision" data-preset="${escapeHtml(p.id)}" data-action="reprovision">Re-Provision</button>
           <button type="button" class="btn btn-secondary" data-preset="${escapeHtml(p.id)}" data-action="halt">Halt</button>
           <button type="button" class="btn btn-danger" data-preset="${escapeHtml(p.id)}" data-action="destroy">Destroy</button>`
        : '<p class="preset-view-only">View only. Admins can start, halt, or destroy.</p>';
      return `
        <div class="preset-card">
          <div class="preset-name">${escapeHtml(p.id)}</div>
          <div class="preset-meta">${escapeHtml(p.description)} · ${p.host_count} VMs</div>
          <div class="preset-hosts" title="${escapeHtml((p.hosts || []).join(', '))}">${escapeHtml(hostsShort)}</div>
          <div class="preset-actions">${actionsHtml}</div>
        </div>
      `;
    }).join('');
    div.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const action = btn.dataset.action;
        if (action === 'up') {
          confirmStart(preset, function () { runAction(preset, 'up', true); }, function () { runAction(preset, 'up', false); });
        } else if (action === 'reprovision') {
          confirmReProvision(preset, () => runAction(preset, 'reprovision'));
        } else if (action === 'halt') {
          confirmHalt(preset, () => runAction(preset, action));
        } else if (action === 'destroy') {
          confirmDestroy(preset, () => runAction(preset, action));
        }
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  var KNOWN_VMS = ['fw-1','fw-2','dc-1','dc-2','filesrv-1','filesrv-2','web-1','web-2','monitor-1','log-1','mgmt-1','mgmt-2'];

  function vmRole(name) {
    var m = name && name.match(/^([a-z]+)/);
    return m ? m[1] : '';
  }

  function provisioningBadge(state, provisioning, reason) {
    var stateLower = (state || '').toLowerCase();
    if (!stateLower.includes('running')) return { badge: '', reason: '' };
    var title = reason ? (' title="' + escapeHtml(reason) + '"') : '';
    if (provisioning === 'ready') return { badge: '<span class="badge badge-ready">Ready</span>', reason: '' };
    if (provisioning === 'provisioning') return { badge: '<span class="badge badge-provisioning"' + title + '>Provisioning</span>', reason: reason || '' };
    if (provisioning === 'loading') return { badge: '<span class="badge badge-unknown">…</span>', reason: '' };
    if (provisioning === 'timeout') return { badge: '<span class="badge badge-unknown"' + title + '>Timeout</span>', reason: reason || '' };
    return { badge: '<span class="badge badge-unknown">—</span>', reason: '' };
  }

  // Update a single VM's provisioning badge + reason in the table.
  function updateVmProvisioning(name, provisioning, reason) {
    if (!name) return;
    var badgeEl = document.getElementById('vm-prov-' + name);
    var rowEl = document.getElementById('vm-row-' + name);
    if (!badgeEl || !rowEl) return;

    var state = rowEl.getAttribute('data-state') || '';
    var prov = provisioningBadge(state, provisioning, reason);

    // Update badge HTML
    badgeEl.innerHTML = prov.badge || '';

    // Update or remove reason text
    var reasonId = 'vm-prov-reason-' + name;
    var reasonEl = document.getElementById(reasonId);
    if (prov.reason) {
      if (!reasonEl) {
        reasonEl = document.createElement('div');
        reasonEl.id = reasonId;
        reasonEl.className = 'vm-provisioning-reason';
        badgeEl.after(reasonEl);
      }
      reasonEl.textContent = prov.reason;
    } else if (reasonEl) {
      reasonEl.remove();
    }
  }

  function renderStatus(data) {
    const container = document.getElementById('status-result');
    if (!container) return;

    if (!data || data.ok === false) {
      const msg = data && data.raw ? data.raw : (data && data.error) || 'failed';
      container.innerHTML =
        '<div class="status-table-wrap"><p class="loading">Error: ' + escapeHtml(msg) + '</p></div>';
      return;
    }

    const vms = Array.isArray(data.vms) ? data.vms : [];
    if (!vms.length) {
      container.innerHTML =
        '<div class="status-table-wrap"><p class="loading">No VM status available.</p></div>';
      return;
    }

    // Order rows by KNOWN_VMS first, then any extra VMs from the backend.
    const byName = {};
    vms.forEach(function (vm) {
      if (vm && vm.name) byName[vm.name] = vm;
    });
    const ordered = [];
    KNOWN_VMS.forEach(function (name) {
      if (byName[name]) ordered.push(byName[name]);
    });
    vms.forEach(function (vm) {
      if (vm && vm.name && KNOWN_VMS.indexOf(vm.name) === -1) ordered.push(vm);
    });

    var runningCount = ordered.filter(function (vm) { return (vm.state || '').toLowerCase() === 'running'; }).length;
    var summaryText = ordered.length + ' VM' + (ordered.length !== 1 ? 's' : '') + ' · <strong>' + runningCount + ' running</strong>';
    if (runningCount < ordered.length) {
      summaryText += ' · ' + (ordered.length - runningCount) + ' not running';
    }

    const rowsHtml = ordered.map(function (vm) {
      var name = vm.name || '';
      var state = vm.state || '';
      var stateBadge = stateToBadge(state);
      var role = vmRole(name);
      var prov = provisioningBadge(state, vm.provisioning, vm.provisioning_reason);

      var provisioningHtml =
        '<span class="vm-provisioning-badge" id="vm-prov-' + escapeHtml(name) + '">' +
        (prov.badge || '') +
        '</span>';
      if (prov.reason) {
        provisioningHtml +=
          '<div class="vm-provisioning-reason" id="vm-prov-reason-' + escapeHtml(name) + '">' +
          escapeHtml(prov.reason) +
          '</div>';
      }

      return (
        '<tr id="vm-row-' + escapeHtml(name) + '" data-vm="' + escapeHtml(name) +
        '" data-state="' + escapeHtml(state) + '">' +
          '<td class="vm-name"><code>' + escapeHtml(name) + '</code></td>' +
          '<td class="vm-role">' + escapeHtml(role) + '</td>' +
          '<td class="vm-state">' + stateBadge + '</td>' +
          '<td class="vm-provisioning">' + provisioningHtml + '</td>' +
        '</tr>'
      );
    }).join('');

    const tableHtml =
      '<div class="status-table-wrap">' +
        '<div class="status-summary">' + summaryText + '</div>' +
        '<table class="status-table">' +
          '<thead>' +
            '<tr>' +
              '<th>VM</th>' +
              '<th>Role</th>' +
              '<th>State</th>' +
              '<th>Provisioning</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    container.innerHTML = tableHtml;
  }

  function fetchProvisioningInBackground(runningVms) {
    if (!runningVms || runningVms.length === 0) return;
    runningVms.forEach(function (vm) {
      fetch('/api/status/provisioning/' + encodeURIComponent(vm.name), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.name) updateVmProvisioning(data.name, data.provisioning, data.provisioning_reason);
        })
        .catch(function () { updateVmProvisioning(vm.name, null, null); });
    });
  }

  function confirmHalt(preset, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');
    title.textContent = 'Halt preset';
    body.textContent = 'Stop all VMs in preset "' + preset + '"? This does not destroy them; you can start again later.';
    overlay.hidden = false;
    var escHandler;
    function close() {
      overlay.hidden = true;
      document.removeEventListener('keydown', escHandler);
      cancelBtn.removeEventListener('click', close);
      confirmBtn.removeEventListener('click', doConfirm);
    }
    function doConfirm() {
      close();
      onConfirm();
    }
    escHandler = function (e) {
      if (e.key === 'Escape') close();
    };
    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', doConfirm);
    confirmBtn.textContent = 'Halt';
    document.addEventListener('keydown', escHandler);
  }

  function confirmReProvision(preset, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');
    title.textContent = 'Re-Provision preset';
    body.textContent = 'Bring up any stopped VMs in preset "' + preset + '" and re-run provisioning on all. Use this after turning the PC back on or when provisioning failed (e.g. clock skew). Continue?';
    overlay.hidden = false;
    var escHandler;
    function close() {
      overlay.hidden = true;
      document.removeEventListener('keydown', escHandler);
      cancelBtn.removeEventListener('click', close);
      confirmBtn.removeEventListener('click', doConfirm);
    }
    function doConfirm() {
      close();
      onConfirm();
    }
    escHandler = function (e) {
      if (e.key === 'Escape') close();
    };
    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', doConfirm);
    confirmBtn.textContent = 'Re-Provision';
    document.addEventListener('keydown', escHandler);
  }

  function confirmDestroy(preset, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');
    title.textContent = 'Destroy preset';
    body.textContent = 'Destroy all VMs in preset "' + preset + '"? This removes the VMs and their disks permanently. This cannot be undone.';
    overlay.hidden = false;
    var escHandler;
    function close() {
      overlay.hidden = true;
      document.removeEventListener('keydown', escHandler);
      cancelBtn.removeEventListener('click', close);
      confirmBtn.removeEventListener('click', doConfirm);
    }
    function doConfirm() {
      close();
      onConfirm();
    }
    escHandler = function (e) {
      if (e.key === 'Escape') close();
    };
    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', doConfirm);
    confirmBtn.textContent = 'Destroy';
    document.addEventListener('keydown', escHandler);
  }

  async function runAction(preset, action, asyncOverride) {
    const out = document.getElementById('action-output');
    const actionLabels = { up: 'Starting', halt: 'Halting', destroy: 'Destroying', reprovision: 'Re-Provisioning' };
    const lines = [(actionLabels[action] || action) + ' ' + preset + '…'];
    showOutput(out, lines[0], false);
    out.scrollTop = out.scrollHeight;
    const buttons = document.querySelectorAll('.btn[data-preset], #btn-start-minimal, #btn-reprovision-minimal, #btn-halt-minimal, #btn-destroy-minimal');
    buttons.forEach(b => b.disabled = true);
    var isError = false;
    var asyncOpt = (action === 'up' && asyncOverride !== undefined) ? asyncOverride : true;
    try {
      await API.actionStream(preset, action, {
        onLine: function (text) {
          if (lines.length > 0 && lines[lines.length - 1] === '…') lines.pop();
          lines.push(text);
          out.textContent = lines.join('\n');
          out.className = 'output';
          out.style.display = 'block';
          out.scrollTop = out.scrollHeight;
        },
        onKeepalive: function () {
          if (lines.length > 0 && lines[lines.length - 1] !== '…') lines.push('…');
          out.textContent = lines.join('\n');
          out.scrollTop = out.scrollHeight;
        },
        onDone: function (success) {
          isError = !success;
          if (lines.length === 1) lines.push(success ? 'Done.' : 'Failed.');
          out.textContent = lines.join('\n');
          out.className = 'output' + (isError ? ' err' : '');
          out.scrollTop = out.scrollHeight;
        }
      }, { run_async: asyncOpt });
      if (!isError) await loadStatus();
    } catch (e) {
      var msg = e.message || 'Request failed';
      if (msg.indexOf('Admin') !== -1) {
        msg = 'Admin access required. Only admins can start, halt, or destroy VMs.';
      }
      lines.push(msg);
      out.textContent = lines.join('\n');
      out.className = 'output err';
      out.scrollTop = out.scrollHeight;
    }
    buttons.forEach(b => b.disabled = false);
  }

  // Track if a refresh is in progress to prevent multiple clicks
  var isRefreshing = false;
  var isAutoRefresh = false;

  // Define loadStatus function
  async function loadStatus(showButtonLoading = false, isAuto = false) {
    // Prevent multiple simultaneous refreshes, but allow manual refresh to interrupt auto-refresh
    if (isRefreshing && showButtonLoading && !isAuto) {
      console.log('Refresh already in progress, ignoring click');
      return;
    }
    
    // If it's a manual refresh, stop auto-refresh temporarily
    if (showButtonLoading && isAutoRefresh) {
      console.log('Manual refresh requested, pausing auto-refresh');
      stopAutoRefresh();
    }
    
    const div = document.getElementById('status-result');
    const btn = document.getElementById('btn-status');

    // If the status panel doesn't exist on this page (e.g. presets/admin),
    // skip loading status entirely to avoid null access errors.
    if (!div) {
      console.log('loadStatus: no status-result container on this page, skipping.');
      return;
    }

    // Only show loading state on button if explicitly requested (user clicked)
    let originalHTML = null;
    let buttonWasModified = false;
    
    if (showButtonLoading && btn) {
      isRefreshing = true;
      console.log('Setting button to loading state');
      originalHTML = btn.innerHTML || btn.textContent || 'Refresh';
      buttonWasModified = true;
      // Update button immediately - use simple text first to ensure it works
      btn.disabled = true;
      // Force immediate visual update
      btn.style.cursor = 'wait';
      btn.textContent = 'Refreshing...';
      // Force browser to render the change immediately (may log a minor perf warning, but is reliable)
      btn.offsetHeight; // Trigger reflow
      console.log('Button updated to:', btn.textContent);
      console.log('Button disabled:', btn.disabled);
      // Then add the spinner after a brief delay
      setTimeout(function() {
        if (btn && isRefreshing) {
          btn.innerHTML = '<span class="btn-loading">⟳</span> Refreshing...';
          console.log('Button HTML updated with spinner');
        }
      }, 100);
    } else {
      console.log('Button loading skipped - showButtonLoading:', showButtonLoading, 'btn exists:', !!btn);
    }
    
    // Show loading in status area immediately
    div.innerHTML = '<div class="status-table-wrap"><span class="loading">Loading…</span></div>';
    console.log('Status area set to loading');
    
    // Small delay to ensure loading state is visible (minimum 300ms)
    var startTime = Date.now();
    var minDelay = 300;
    
    try {
      console.log('Fetching status from API...');
      var includeProv = document.getElementById('include-provisioning');
      var wantProvisioning = includeProv ? includeProv.checked : false;
      var data = await API.status(wantProvisioning);
      console.log('Status API response:', data);
      
      // Ensure minimum delay for loading state visibility
      var elapsed = Date.now() - startTime;
      if (elapsed < minDelay && buttonWasModified) {
        await new Promise(function(resolve) { setTimeout(resolve, minDelay - elapsed); });
      }
      // If we asked for provisioning but some running VMs don't have it (e.g. backend timeout), show loading and fetch per-VM
      var running = [];
      if (wantProvisioning && data.vms && data.vms.length) {
        running = data.vms.filter(function (v) {
          return (v.state || '').toLowerCase().indexOf('running') !== -1 && KNOWN_VMS.indexOf(v.name) !== -1 && v.provisioning == null;
        });
        running.forEach(function (r) { r.provisioning = 'loading'; });
      }
      renderStatus(data);
      if (running.length) fetchProvisioningInBackground(running);
    } catch (e) {
      div.innerHTML = '<div class="status-table-wrap"><p class="loading">Error: ' + escapeHtml(e.message || 'failed') + '</p></div>';
    } finally {
      // Restore button state only if we modified it
      if (buttonWasModified && btn && originalHTML !== null) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        console.log('Button restored to:', btn.textContent);
      }
      isRefreshing = false;
    }
  }

  function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    const cb = document.getElementById('auto-refresh');
    if (!cb || !cb.checked) {
      isAutoRefresh = false;
      return;
    }
    isAutoRefresh = true;
    console.log('Auto-refresh started (every 5 minutes)');
    autoRefreshTimer = setInterval(function() {
      console.log('Auto-refresh triggered');
      loadStatus(false, true);  // Pass isAuto=true
    }, 300000);  // 5 minutes = 300000 milliseconds
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    isAutoRefresh = false;
    console.log('Auto-refresh stopped');
  }

  // Make loadStatus available on window IMMEDIATELY (before init)
  window.loadStatus = loadStatus;
  console.log('loadStatus exposed to window object');

  async function init() {
    try {
      const [prereqs, presets] = await Promise.all([API.prereqs(), API.presets()]);
      renderPrereqs(prereqs);
      renderPresets(presets);
    } catch (e) {
      var prereqEl = document.getElementById('prereqs-result');
      if (prereqEl) {
        prereqEl.innerHTML = '<span class="err">Error: ' + escapeHtml(e.message || 'failed') + '</span>';
      }
      var presetsEl = document.getElementById('presets-list');
      if (presetsEl) {
        presetsEl.innerHTML = '<span class="loading">Error loading presets.</span>';
      }
    }
    // Attach refresh button handler FIRST (most important)
    try {
      var btnStatus = document.getElementById('btn-status');
      if (btnStatus) {
        console.log('Found btn-status button, attaching click handler');
        
        // Use direct onclick (most reliable and immediate)
        btnStatus.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('=== REFRESH BUTTON CLICKED ===');
          console.log('Calling loadStatus(true)...');
          try {
            loadStatus(true);
          } catch (err) {
            console.error('Error calling loadStatus:', err);
          }
          return false;
        };
        
        console.log('Click handler attached to btn-status');
      } else {
        console.error('ERROR: btn-status button not found!');
      }
    } catch (err) {
      console.error('ERROR attaching refresh button handler:', err);
    }

    await loadStatus(false);  // Don't show button loading on initial page load

    try {
      var startBtn = document.getElementById('btn-start-minimal');
      var reprovisionBtn = document.getElementById('btn-reprovision-minimal');
      var haltBtn = document.getElementById('btn-halt-minimal');
      var destroyBtn = document.getElementById('btn-destroy-minimal');
      if (isAdmin() && startBtn && haltBtn && destroyBtn) {
        startBtn.addEventListener('click', function () {
          confirmStart('minimal', function () { runAction('minimal', 'up', true); }, function () { runAction('minimal', 'up', false); });
        });
        if (reprovisionBtn) {
          reprovisionBtn.addEventListener('click', () => {
            confirmReProvision('minimal', () => runAction('minimal', 'reprovision'));
          });
        }
        haltBtn.addEventListener('click', () => {
          confirmHalt('minimal', () => runAction('minimal', 'halt'));
        });
        destroyBtn.addEventListener('click', () => {
          confirmDestroy('minimal', () => runAction('minimal', 'destroy'));
        });
      } else {
        var quickPanel = document.querySelector('.panel-actions .buttons');
        if (quickPanel && !isAdmin()) {
          quickPanel.innerHTML = '<p class="preset-view-only">View only. Admins can start, halt, or destroy VMs.</p>';
        }
      }
    } catch (err) {
      console.error('Error attaching other button handlers:', err);
    }

    var autoRefreshEl = document.getElementById('auto-refresh');
    if (autoRefreshEl) {
      autoRefreshEl.addEventListener('change', function () {
        if (this.checked) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
      });
    }

    if (isAdmin()) {
      var panelUsers = document.getElementById('panel-users');
      if (panelUsers) {
        panelUsers.hidden = false;
        loadUsersList();
        var formCreate = document.getElementById('form-create-user');
        if (formCreate) {
          formCreate.addEventListener('submit', function (e) {
            e.preventDefault();
            var username = (document.getElementById('new-username') && document.getElementById('new-username').value || '').trim();
            var password = document.getElementById('new-password') ? document.getElementById('new-password').value : '';
            var roleEl = document.getElementById('new-role');
            var role = roleEl ? roleEl.value : 'user';
            var msgEl = document.getElementById('user-create-message');
            if (!username || !password) {
              if (msgEl) { msgEl.textContent = 'Username and password are required.'; msgEl.className = 'user-create-message err'; }
              return;
            }
            if (msgEl) { msgEl.textContent = ''; msgEl.className = 'user-create-message'; }
            API.createUser(username, password, role).then(function (res) {
              if (res.ok && res.data && res.data.success) {
                if (msgEl) { msgEl.textContent = "User " + escapeHtml(res.data.username) + " created as " + res.data.role + "."; msgEl.className = "user-create-message ok"; }
                document.getElementById('new-username').value = '';
                document.getElementById('new-password').value = '';
                if (roleEl) roleEl.value = 'user';
                loadUsersList();
              } else {
                if (msgEl) { msgEl.textContent = (res.data && res.data.error) || 'Failed to create user.'; msgEl.className = 'user-create-message err'; }
              }
            }).catch(function () {
              if (msgEl) { msgEl.textContent = 'Request failed.'; msgEl.className = 'user-create-message err'; }
            });
          });
        }
        var usersListEl = document.getElementById('users-list');
        if (usersListEl && !usersListEl.dataset.boundActions) {
          usersListEl.dataset.boundActions = '1';
          usersListEl.addEventListener('click', function (e) {
            var target = e.target;
            if (!target) return;
            var row = target.closest('li[data-username]');
            if (!row) return;
            var username = row.getAttribute('data-username') || '';
            var msgEl = document.getElementById('user-create-message');

            if (target.classList.contains('btn-user-role-save')) {
              var roleSelect = row.querySelector('.user-role-select');
              var role = roleSelect ? roleSelect.value : 'user';
              API.updateUserRole(username, role).then(function (res) {
                if (res.ok && res.data && res.data.success) {
                  if (msgEl) { msgEl.textContent = "Updated " + escapeHtml(username) + " to role " + escapeHtml(role) + "."; msgEl.className = "user-create-message ok"; }
                  loadUsersList();
                } else {
                  if (msgEl) { msgEl.textContent = (res.data && res.data.error) || 'Failed to update role.'; msgEl.className = 'user-create-message err'; }
                }
              }).catch(function () {
                if (msgEl) { msgEl.textContent = 'Request failed.'; msgEl.className = 'user-create-message err'; }
              });
              return;
            }

            if (target.classList.contains('btn-user-delete')) {
              if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;
              API.deleteUser(username).then(function (res) {
                if (res.ok && res.data && res.data.success) {
                  if (msgEl) { msgEl.textContent = "Deleted user " + escapeHtml(username) + "."; msgEl.className = "user-create-message ok"; }
                  loadUsersList();
                } else {
                  if (msgEl) { msgEl.textContent = (res.data && res.data.error) || 'Failed to delete user.'; msgEl.className = 'user-create-message err'; }
                }
              }).catch(function () {
                if (msgEl) { msgEl.textContent = 'Request failed.'; msgEl.className = 'user-create-message err'; }
              });
            }
          });
        }
      }
    }
  }

  function loadUsersList() {
    var ul = document.getElementById('users-list');
    if (!ul) return;
    ul.innerHTML = '<li class="loading">Loading…</li>';
    API.usersList().then(function (data) {
      var users = (data && data.users) || [];
      if (users.length === 0) {
        ul.innerHTML = '<li class="muted">No users yet.</li>';
        return;
      }
      var currentUsername = (window.GUI_USER && window.GUI_USER.username) ? String(window.GUI_USER.username) : '';
      ul.innerHTML = users.map(function (u) {
        var username = String(u.username || '');
        var role = (u.role || 'user') === 'admin' ? 'admin' : 'user';
        var isSelf = username === currentUsername;
        return '' +
          '<li data-username="' + escapeHtml(username) + '">' +
            '<code>' + escapeHtml(username) + '</code> ' +
            '<span class="role-badge role-' + escapeHtml(role) + '">' + escapeHtml(role) + '</span> ' +
            '<select class="user-role-select">' +
              '<option value="user"' + (role === 'user' ? ' selected' : '') + '>User</option>' +
              '<option value="admin"' + (role === 'admin' ? ' selected' : '') + '>Admin</option>' +
            '</select> ' +
            '<button type="button" class="btn btn-secondary btn-user-role-save">Save role</button> ' +
            '<button type="button" class="btn btn-danger btn-user-delete"' + (isSelf ? ' disabled title="You cannot delete your own active account"' : '') + '>Delete</button>' +
          '</li>';
      }).join('');
    }).catch(function () {
      ul.innerHTML = '<li class="err">Could not load users.</li>';
    });
  }

  init();
  
  // Test: Log when page is fully loaded
  console.log('Page loaded, init() called');
  console.log('btn-status element:', document.getElementById('btn-status'));
  console.log('loadStatus function:', typeof loadStatus);
  
  // FALLBACK: Attach button handler after a short delay in case init() didn't complete
  setTimeout(function() {
    var btnStatus = document.getElementById('btn-status');
    if (btnStatus && !btnStatus.onclick) {
      console.log('FALLBACK: Attaching refresh button handler');
      btnStatus.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(' REFRESH BUTTON CLICKED (FALLBACK) ');
        loadStatus(true);
        return false;
      };
      console.log('FALLBACK: Click handler attached');
    }
  }, 500);
})();
