/**
 * WRAYVE console.
 *
 * This file renders state and calls governed API routes. It contains no
 * provider logic, no authority logic and no approval logic — it cannot, by
 * construction, bypass the AuthorityCheck, because the only way it can cause an
 * execution is POST /api/executions/:id/execute, which re-evaluates authority
 * server-side before touching an adapter.
 */

const el = document.getElementById('view');
const ledgerList = document.getElementById('ledger-list');
const breadcrumb = document.getElementById('breadcrumb');
const toastEl = document.getElementById('toast');

const ui = {
  view: 'identity',
  state: null,
  selectedRequest: null,
  selectedGeneration: null,
  busy: false,
};

// ------------------------------------------------------------------ plumbing

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? { code: 'UNKNOWN', message: `HTTP ${response.status}` };
    const thrown = new Error(error.message);
    thrown.payload = error;
    throw thrown;
  }
  return payload;
}

function toast(message, bad = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('bad', bad);
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 6000);
}

async function guard(fn) {
  if (ui.busy) return;
  ui.busy = true;
  try {
    await fn();
  } catch (error) {
    const detail = error.payload?.detail;
    toast(`${error.payload?.code ?? 'ERROR'} — ${error.message}`, true);
    if (detail) console.warn('WRAYVE refusal detail:', detail);
  } finally {
    ui.busy = false;
  }
}

async function refresh() {
  ui.state = await api('GET', '/api/state');
  render();
}

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const h = (strings, ...values) => strings.reduce((out, str, i) => out + str + (values[i] ?? ''), '');

function stateClass(value) {
  if (['ACTIVE', 'AUTHORIZED', 'APPROVED', 'GENERATED', 'COMPLETED', 'ALLOWED', 'REVIEWED', 'ok'].includes(value)) return 'ok';
  if (['DENIED', 'REJECTED', 'FAILED', 'PROHIBITED', 'CANCELLED'].includes(value)) return 'bad';
  if (['SIMULATION', 'SIMULATED', 'EXECUTING'].includes(value)) return 'ember';
  if (['PENDING_APPROVAL', 'PENDING', 'REQUIRED', 'READY_FOR_REVIEW'].includes(value)) return 'gold';
  return 'idle';
}

// ---------------------------------------------------------------- selectors

const S = {
  identity: () => ui.state?.identities?.[0] ?? null,
  activeSnapshot(identity) {
    return identity?.snapshots?.find((snapshot) => snapshot.id === identity.active_snapshot_id) ?? null;
  },
  snapshotById(id) {
    for (const identity of ui.state?.identities ?? []) {
      const found = identity.snapshots.find((snapshot) => snapshot.id === id);
      if (found) return found;
    }
    return null;
  },
  sceneById: (id) => ui.state?.scenes?.find((scene) => scene.id === id) ?? null,
  requestById: (id) => ui.state?.requests?.find((request) => request.id === id) ?? null,
};

// -------------------------------------------------------------------- views

function render() {
  if (!ui.state) return;
  breadcrumb.textContent = ui.view.toUpperCase();
  renderChips();
  renderLedger();
  const views = { identity: viewIdentity, scenes: viewScenes, executions: viewExecutions, provenance: viewProvenance, settings: viewSettings };
  el.innerHTML = views[ui.view]();
  el.scrollTop = ui.keepScroll ? el.scrollTop : 0;
  bind();
}

function renderChips() {
  const heygen = ui.state.providers.find((provider) => provider.provider === 'HEYGEN');
  document.getElementById('provider-chip').textContent =
    `HEYGEN ${heygen?.readiness.ready_for_real_execution ? 'READY' : 'CONTRACT INCOMPLETE'}`;
  const sims = ui.state.requests.filter((request) => request.execution_mode === 'SIMULATION').length;
  document.getElementById('mode-chip').textContent = `SIMULATED RUNS ${sims}`;

  const strip = document.getElementById('integrity-strip');
  const integrity = ui.state.integrity;
  strip.textContent = `LEDGER ${integrity.length} EVENTS · ${integrity.intact ? 'CHAIN INTACT' : 'CHAIN BROKEN'}`;
  strip.classList.toggle('is-broken', !integrity.intact);
}

function renderLedger() {
  ledgerList.innerHTML = ui.state.events.map((event) => {
    const tone = event.type.includes('CONTRACT') || event.type.includes('FAILED') || event.type.includes('REJECTED')
      ? 'deny'
      : event.type.includes('APPROVAL') || event.type.includes('AUTHORITY') ? 'gold' : '';
    return h`<li class="${tone}">
      <span class="seq">${String(event.sequence).padStart(3, '0')}</span><span class="type">${esc(event.type)}</span>
      <span class="meta">${esc(event.subject ?? '—')} · ${esc(event.actor)} · ${esc(event.recorded_at.replace('T', ' ').slice(0, 19))}</span>
    </li>`;
  }).join('');
}

// ---------------------------------------------------------------- 16 IDENTITY

function viewIdentity() {
  const identity = S.identity();
  if (!identity) return emptyState('NO IDENTITY RECORDED');
  const snapshot = S.activeSnapshot(identity);
  const policy = snapshot?.policy ?? null;

  return h`
  <div class="grid-2">
    <div>
      <div class="panel accent">
        <h2 class="headline">${esc(identity.canonical_name).toUpperCase()}</h2>
        <h3 class="sub">${esc(identity.id)} · canonical identity reference</h3>
        <div class="grid-3">
          <dl class="kv"><dt>Identity Snapshot</dt><dd>${esc(snapshot?.version ?? 'NONE')}</dd></dl>
          <dl class="kv"><dt>Identity Status</dt><dd><span class="state ${stateClass(identity.status)}">${esc(identity.status)}</span></dd></dl>
          <dl class="kv"><dt>Likeness Authority</dt><dd><span class="state gold">CONTROLLED</span></dd></dl>
          <dl class="kv"><dt>Approval</dt><dd><span class="state ${policy?.approval_required ? 'gold' : 'idle'}">${policy?.approval_required ? 'REQUIRED' : 'NOT REQUIRED'}</span></dd></dl>
        </div>
      </div>

      <div class="panel">
        <p class="section-title">Active snapshot — ${esc(snapshot?.id ?? '—')}</p>
        <dl class="kv"><dt>Appearance profile</dt><dd class="small">${esc(snapshot?.appearance_profile ?? '—')}</dd></dl>
        <dl class="kv"><dt>Performance profile</dt><dd class="small">${esc(snapshot?.performance_profile ?? '—')}</dd></dl>
        <dl class="kv"><dt>Face reference</dt><dd class="mono">${esc(snapshot?.face_reference ?? 'UNKNOWN')}</dd></dl>
        <dl class="kv"><dt>Voice reference</dt><dd class="mono">${esc(snapshot?.voice_reference ?? 'UNKNOWN')}</dd></dl>
        <dl class="kv"><dt>Canonical notes</dt><dd class="small">${esc(snapshot?.canonical_notes ?? '—')}</dd></dl>
      </div>

      <div class="panel">
        <p class="section-title">Snapshot history — never overwritten</p>
        <table class="data">
          <thead><tr><th>VERSION</th><th>ID</th><th>STATUS</th><th>CREATED</th></tr></thead>
          <tbody>${identity.snapshots.map((item) => h`<tr>
            <td>${esc(item.version)}</td>
            <td class="mono">${esc(item.id)}</td>
            <td><span class="state ${stateClass(item.status)}">${esc(item.status)}</span></td>
            <td class="mono">${esc(item.created_at.slice(0, 19).replace('T', ' '))}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    <div>
      <div class="panel">
        <p class="section-title">Likeness policy — ${esc(policy?.id ?? 'NONE')}</p>
        ${policy ? policyLines(policy) : '<p class="note">No LikenessPolicy is bound to this snapshot. Execution will be DENIED.</p>'}
        <div class="spacer"></div>
        <p class="note">${esc(policy?.notes ?? '')}</p>
      </div>

      <div class="panel">
        <p class="section-title">Revise likeness policy</p>
        <p class="note">A revision appends a <strong>new policy version</strong>. The previous version stays readable in the ledger forever.</p>
        <div class="spacer"></div>
        <div class="checks" id="policy-checks">
          ${Object.keys(ui.state.vocabulary.default_policy).map((key) => h`
            <label class="check"><input type="checkbox" data-policy="${key}" ${policy?.[key] ? 'checked' : ''} /> ${esc(key.replace(/_/g, ' ').toUpperCase())}</label>
          `).join('')}
        </div>
        <div class="spacer"></div>
        <label class="field"><span>Notes</span><input type="text" id="policy-notes" placeholder="Reason for this revision" /></label>
        <button class="act" id="save-policy" ${snapshot ? '' : 'disabled'}>APPEND POLICY VERSION</button>
      </div>

      <div class="panel">
        <p class="section-title">Create new snapshot</p>
        <p class="note">Identity data is never edited in place. A new snapshot supersedes the current one and becomes the canonical version.</p>
        <div class="spacer"></div>
        <label class="field"><span>Appearance profile</span><textarea id="snap-appearance"></textarea></label>
        <label class="field"><span>Performance profile</span><textarea id="snap-performance"></textarea></label>
        <label class="field"><span>Face reference</span><input type="text" id="snap-face" placeholder="wrasal-ref://..." /></label>
        <label class="field"><span>Voice reference</span><input type="text" id="snap-voice" placeholder="wrasal-ref://..." /></label>
        <label class="field"><span>Canonical notes</span><input type="text" id="snap-notes" /></label>
        <button class="act" id="create-snapshot">CREATE NEW SNAPSHOT</button>
      </div>
    </div>
  </div>`;
}

function policyLines(policy) {
  const contexts = ui.state.vocabulary.scene_contexts;
  return contexts.map((context) => {
    const field = `${context}_allowed`;
    const permitted = policy[field] === true;
    return h`<div class="policy-line">
      <span class="ctx">${esc(context.replace(/_/g, ' '))}</span>
      <span class="verdict ${permitted ? 'allowed' : 'prohibited'}">${permitted ? 'ALLOWED' : 'PROHIBITED'}</span>
    </div>`;
  }).join('') + h`<div class="policy-line">
      <span class="ctx">approval required</span>
      <span class="verdict ${policy.approval_required ? 'prohibited' : 'allowed'}">${policy.approval_required ? 'REQUIRED' : 'NOT REQUIRED'}</span>
    </div>`;
}

// ------------------------------------------------------------- 17 SCENE BUILDER

function viewScenes() {
  const identity = S.identity();
  const snapshot = S.activeSnapshot(identity);

  return h`
  <div class="grid-2">
    <div class="panel">
      <p class="section-title">Scene builder — creative intent only</p>
      <p class="note">A SceneSpec holds direction, not provider parameters. Nothing in this form is HeyGen-specific.</p>
      <div class="spacer"></div>
      <label class="field"><span>Scene name</span><input type="text" id="sc-title" placeholder="WRAY / BLACK ROOM TEST" /></label>
      <label class="field"><span>Environment</span><input type="text" id="sc-env" placeholder="Minimal black studio" /></label>
      <label class="field"><span>Wardrobe</span><input type="text" id="sc-wardrobe" placeholder="Black structured jacket" /></label>
      <label class="field"><span>Performance</span><input type="text" id="sc-performance" placeholder="Still, controlled, direct eye contact" /></label>
      <label class="field"><span>Camera</span><input type="text" id="sc-camera" placeholder="85mm portrait, subtle dolly-in" /></label>
      <label class="field"><span>Dialogue</span><textarea id="sc-dialogue" placeholder="This is not an avatar. This is an identity under authority."></textarea></label>
      <label class="field"><span>Voice</span><input type="text" id="sc-voice" placeholder="Low register. Unhurried." /></label>
      <label class="field"><span>Duration (seconds)</span><input type="number" id="sc-duration" value="12" /></label>
      <label class="field"><span>Declared context — evaluated against the likeness policy</span></label>
      <div class="checks">
        ${ui.state.vocabulary.scene_contexts.map((context) => h`
          <label class="check"><input type="checkbox" data-context="${context}" ${context === 'commercial' ? 'checked' : ''} /> ${esc(context.replace(/_/g, ' ').toUpperCase())}</label>
        `).join('')}
      </div>
      <div class="spacer"></div>
      <button class="act" id="create-scene" ${snapshot ? '' : 'disabled'}>CREATE SCENE</button>
    </div>

    <div>
      <div class="panel accent">
        <p class="section-title">Scenes</p>
        ${ui.state.scenes.length === 0 ? emptyState('NO SCENES') : ui.state.scenes.map((scene) => sceneCard(scene)).join('')}
      </div>
    </div>
  </div>`;
}

function sceneCard(scene) {
  const snapshot = S.snapshotById(scene.identity_snapshot_id);
  const identity = ui.state.identities.find((item) => item.id === snapshot?.identity_id);
  const declared = Object.entries(scene.intended_context).filter(([, value]) => value).map(([key]) => key);

  return h`
  <div class="panel" style="margin-bottom:14px">
    <dl class="kv"><dt>Identity</dt><dd>${esc(identity?.canonical_name ?? 'UNKNOWN')} / SNAPSHOT ${esc(snapshot?.version ?? 'UNKNOWN')}</dd></dl>
    <dl class="kv"><dt>Scene</dt><dd>${esc(scene.title)}</dd></dl>
    <dl class="kv"><dt>Declared context</dt><dd class="mono">${declared.length ? esc(declared.join(' · ').toUpperCase()) : 'NONE DECLARED'}</dd></dl>
    <dl class="kv"><dt>Dialogue</dt><dd class="small">${esc(scene.dialogue || '—')}</dd></dl>
    <div class="row">
      <select data-provider-for="${scene.id}" style="max-width:150px">
        ${ui.state.providers.map((provider) => h`<option value="${provider.provider}">${esc(provider.provider)}</option>`).join('')}
      </select>
      <select data-mode-for="${scene.id}" style="max-width:150px">
        ${ui.state.vocabulary.modes.map((mode) => h`<option value="${mode}">${esc(mode)}</option>`).join('')}
      </select>
      <button class="act" data-request-execution="${scene.id}">REQUEST EXECUTION</button>
    </div>
    <div class="spacer"></div>
    <p class="note">AUTHORITY <strong>PENDING</strong> until the request is reviewed.</p>
  </div>`;
}

// --------------------------------------------------- 18/19 EXECUTION REVIEW

function viewExecutions() {
  const requests = [...ui.state.requests].reverse();
  if (!requests.length) return emptyState('NO EXECUTION REQUESTS');
  const selected = ui.selectedRequest ? S.requestById(ui.selectedRequest) : requests[0];

  return h`
  <div class="panel">
    <p class="section-title">Execution requests</p>
    <table class="data">
      <thead><tr><th>REQUEST</th><th>SCENE</th><th>PROVIDER</th><th>MODE</th><th>AUTHORITY</th><th>APPROVAL</th><th>EXECUTION</th><th></th></tr></thead>
      <tbody>${requests.map((request) => h`<tr>
        <td class="mono">${esc(request.id)}</td>
        <td>${esc(S.sceneById(request.scene_spec_id)?.title ?? 'UNKNOWN')}</td>
        <td class="mono">${esc(request.provider)}</td>
        <td><span class="state ${stateClass(request.execution_mode)}">${esc(request.execution_mode)}</span></td>
        <td><span class="state ${stateClass(request.authority_status)}">${esc(request.authority_status)}</span></td>
        <td><span class="state ${stateClass(request.approval_status)}">${esc(request.approval_status)}</span></td>
        <td><span class="state ${stateClass(request.execution_status)}">${esc(request.execution_status)}</span></td>
        <td><button class="act quiet" data-select-request="${request.id}">OPEN</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>
  ${selected ? executionPanel(selected) : ''}`;
}

function executionPanel(request) {
  const scene = S.sceneById(request.scene_spec_id);
  const snapshot = S.snapshotById(request.identity_snapshot_id);
  const identity = ui.state.identities.find((item) => item.id === request.identity_id);
  const policy = snapshot?.policy ?? null;
  const generation = ui.state.generation_events.find((event) => event.id === request.generation_event_id) ?? null;
  const media = generation?.output_reference ?? null;
  const isSimulation = request.execution_mode === 'SIMULATION';

  const policyRows = (ui.state.vocabulary.scene_contexts).map((context) => {
    const field = `${context}_allowed`;
    const permitted = policy?.[field] === true;
    const declared = scene?.intended_context?.[context] === true;
    return h`<div class="policy-line">
      <span class="ctx">${esc(context.replace(/_/g, ' '))}${declared ? '<span class="declared">DECLARED BY SCENE</span>' : ''}</span>
      <span class="verdict ${permitted ? 'allowed' : 'prohibited'}">${permitted ? 'ALLOWED' : 'PROHIBITED'}</span>
    </div>`;
  }).join('');

  return h`
  <div class="grid-2">
    <div class="panel ${isSimulation ? 'sim' : 'accent'}">
      <h2 class="headline">EXECUTION REVIEW</h2>
      <h3 class="sub">${esc(request.id)}</h3>
      ${isSimulation ? '<div class="banner">SIMULATION — NO EXTERNAL PROVIDER WILL BE CONTACTED</div>' : ''}
      <div class="grid-3">
        <dl class="kv"><dt>Identity</dt><dd>${esc(identity?.canonical_name ?? '—')} / ${esc(snapshot?.version ?? '—')}</dd></dl>
        <dl class="kv"><dt>Provider</dt><dd>${esc(request.provider)}</dd></dl>
        <dl class="kv"><dt>Mode</dt><dd><span class="state ${stateClass(request.execution_mode)}">${esc(request.execution_mode)}</span></dd></dl>
      </div>
      <dl class="kv"><dt>Purpose</dt><dd class="small">${esc(request.purpose || scene?.description || 'Cinematic identity test')}</dd></dl>
      <div class="spacer"></div>
      ${policyRows}
      <div class="policy-line">
        <span class="ctx">execution</span>
        <span class="verdict ${request.authority_status === 'AUTHORIZED' ? 'allowed' : 'prohibited'}">
          ${request.authority_status === 'AUTHORIZED' ? (request.approval_status === 'APPROVED' ? 'AUTHORIZED' : 'AUTHORIZED AFTER APPROVAL') : 'DENIED'}
        </span>
      </div>
      <div class="spacer"></div>
      <div class="row">
        <button class="act primary" data-approve="${request.id}" ${['PENDING_APPROVAL', 'READY_FOR_REVIEW'].includes(request.lifecycle_state) ? '' : 'disabled'}>APPROVE</button>
        <button class="act danger" data-reject="${request.id}" ${['PENDING_APPROVAL', 'READY_FOR_REVIEW'].includes(request.lifecycle_state) ? '' : 'disabled'}>REJECT</button>
        <button class="act" data-execute="${request.id}" ${request.lifecycle_state === 'APPROVED' || (isSimulation && ['READY_FOR_REVIEW', 'PENDING_APPROVAL'].includes(request.lifecycle_state)) ? '' : 'disabled'}>EXECUTE</button>
        <button class="act quiet" data-recheck="${request.id}">RE-RUN AUTHORITY CHECK</button>
      </div>
    </div>

    <div>
      <div class="panel">
        <p class="section-title">Execution</p>
        <dl class="kv"><dt>Scene</dt><dd>${esc(scene?.title ?? '—')}</dd></dl>
        <dl class="kv"><dt>Authority</dt><dd><span class="state ${stateClass(request.authority_status)}">${esc(request.authority_status)}</span></dd></dl>
        <dl class="kv"><dt>Lifecycle</dt><dd><span class="state ${stateClass(request.lifecycle_state)}">${esc(request.lifecycle_state)}</span></dd></dl>
        ${request.failure ? h`<div class="banner deny">${esc(request.failure.code)} @ ${esc(request.failure.stage)}</div><p class="note">${esc(request.failure.message)}</p>${request.failure.detail ? h`<div class="spacer"></div><pre class="raw">${esc(JSON.stringify(request.failure.detail, null, 2))}</pre>` : ''}` : ''}
        ${media ? h`
          <div class="spacer"></div>
          <dl class="kv"><dt>Output</dt><dd class="mono">${esc(media)}</dd></dl>
          ${mediaFrame(media, generation)}
          <div class="spacer"></div>
          <div class="row">
            <button class="act quiet" data-record-review="${request.id}" ${request.lifecycle_state === 'GENERATED' ? '' : 'disabled'}>RECORD REVIEW</button>
            <button class="act" data-open-provenance="${generation.id}">OPEN PROVENANCE</button>
          </div>` : ''}
      </div>
      ${authorityReasonsPanel(request)}
    </div>
  </div>`;
}

function mediaFrame(reference, generation) {
  const localMatch = /^wrasal-local:\/\/media\/(.+)$/.exec(reference ?? '');
  if (localMatch) {
    return h`<div class="media-frame"><img src="/media/${esc(localMatch[1])}" alt="Simulated execution placeholder" /></div>
      <p class="note">${generation?.simulated ? 'This artefact was produced by the WRASAL simulation adapter. It is not provider output.' : ''}</p>`;
  }
  if (/^https?:\/\//.test(reference ?? '')) {
    return h`<div class="media-frame"><video src="${esc(reference)}" controls></video></div>`;
  }
  return h`<p class="note">No renderable output reference.</p>`;
}

function authorityReasonsPanel(request) {
  const check = ui.state.events
    .find((event) => event.type === 'AUTHORITY_CHECKED' && event.payload.execution_request_id === request.id)?.payload?.check;
  if (!check) return '';
  return h`
  <div class="panel ${check.decision === 'AUTHORIZED' ? '' : 'deny'}">
    <p class="section-title">Authority check — ${esc(check.decision)} (mode ${esc(check.mode)})</p>
    ${check.reasons.map((reason) => h`<div class="reason">
      <span class="verd ${reason.result === 'ALLOW' ? 'allow' : 'deny'}">${esc(reason.result)}</span>
      <span class="rule">${esc(reason.rule)}</span>
      <span class="detail">${esc(reason.detail)}</span>
    </div>`).join('')}
    ${check.waived.map((waiver) => h`<div class="reason">
      <span class="verd waive">WAIVED</span>
      <span class="rule">${esc(waiver.rule)}</span>
      <span class="detail">${esc(waiver.detail)}</span>
    </div>`).join('')}
    <div class="spacer"></div>
    <p class="note">Evaluated ${esc(check.evaluated_at)} · this check is re-run server-side immediately before any provider call.</p>
  </div>`;
}

// ------------------------------------------------------------ 20 PROVENANCE

function viewProvenance() {
  const events = [...ui.state.generation_events].reverse();
  if (!events.length) return emptyState('NO GENERATION EVENTS');
  const selectedId = ui.selectedGeneration ?? events[0].id;

  return h`
  <div class="panel">
    <p class="section-title">Generation events — immutable</p>
    <table class="data">
      <thead><tr><th>EVENT</th><th>PROVIDER</th><th>MODE</th><th>JOB</th><th>STATUS</th><th></th></tr></thead>
      <tbody>${events.map((event) => h`<tr>
        <td class="mono">${esc(event.id)}</td>
        <td>${esc(event.provider)}</td>
        <td><span class="state ${stateClass(event.execution_mode)}">${esc(event.simulated ? 'SIMULATED' : 'REAL')}</span></td>
        <td class="mono">${esc(event.provider_job_id ?? 'UNKNOWN')}</td>
        <td><span class="state ${stateClass(event.execution_status)}">${esc(event.execution_status)}</span></td>
        <td><button class="act quiet" data-select-generation="${event.id}">CHAIN</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>
  <div id="chain-slot">${chainPlaceholder(selectedId)}</div>`;
}

function chainPlaceholder(id) {
  queueMicrotask(() => loadChain(id));
  return h`<div class="empty">LOADING CHAIN ${esc(id)}</div>`;
}

async function loadChain(id) {
  const slot = document.getElementById('chain-slot');
  if (!slot) return;
  try {
    const chain = await api('GET', `/api/provenance/${encodeURIComponent(id)}`);
    slot.innerHTML = renderChain(chain);
    bind();
  } catch (error) {
    slot.innerHTML = h`<div class="banner deny">${esc(error.message)}</div>`;
  }
}

function renderChain(chain) {
  const event = chain.generation_event;
  const nodes = chain.links.map((link, index) => h`
    ${index ? '<div class="chain-arrow">↓</div>' : ''}
    <div class="chain-node ${link.step === 'PROVIDER' ? (event.simulated ? 'is-sim' : 'is-real') : ''}">
      <div>
        <div class="step">${esc(link.step)}</div>
        <div class="id">${esc(link.id)}</div>
        <div class="label">${esc(link.label)}</div>
      </div>
      <span class="state ${stateClass(link.status)}">${esc(link.status)}</span>
    </div>`).join('');

  return h`
  <div class="grid-2">
    <div class="panel">
      <p class="section-title">Provenance chain — where did this media come from?</p>
      <div class="chain">${nodes}</div>
    </div>
    <div>
      <div class="panel ${event.simulated ? 'sim' : 'accent'}">
        <p class="section-title">Generation event ${esc(event.id)}</p>
        ${event.simulated ? '<div class="banner">SIMULATED EXECUTION — NOT PROVIDER OUTPUT</div>' : ''}
        <div class="grid-3">
          <dl class="kv"><dt>Provider</dt><dd>${esc(event.provider)}</dd></dl>
          <dl class="kv"><dt>Job</dt><dd class="mono">${esc(event.provider_job_id ?? 'UNKNOWN')}</dd></dl>
          <dl class="kv"><dt>Model</dt><dd class="mono">${esc(event.provider_model)}</dd></dl>
          <dl class="kv"><dt>Model version</dt><dd class="mono">${esc(event.provider_model_version)}</dd></dl>
          <dl class="kv"><dt>Provider timestamp</dt><dd class="mono">${esc(event.provider_timestamp ?? 'null')}</dd></dl>
          <dl class="kv"><dt>Status</dt><dd><span class="state ${stateClass(event.execution_status)}">${esc(event.execution_status)}</span></dd></dl>
        </div>
        ${event.unresolved_contract_fields?.length ? h`
          <p class="note"><strong>Not returned by the provider — recorded as UNKNOWN/null rather than inferred:</strong><br />${esc(event.unresolved_contract_fields.join(', '))}</p>` : ''}
        ${event.carried_but_unexecuted?.length ? h`
          <div class="spacer"></div>
          <p class="note"><strong>Creative direction carried but not executed by this provider:</strong></p>
          <pre class="raw">${esc(JSON.stringify(event.carried_but_unexecuted, null, 2))}</pre>` : ''}
        ${event.failure ? h`<div class="spacer"></div><div class="banner deny">${esc(event.failure.code)} @ ${esc(event.failure.stage)}</div><p class="note">${esc(event.failure.message)}</p>` : ''}
      </div>

      <div class="panel">
        <p class="section-title">Freebuff handoff</p>
        ${chain.handoff ? h`
          <div class="banner">${esc(chain.handoff.label)}</div>
          <p class="note">${esc(chain.handoff.certification_statement)}</p>
          <div class="spacer"></div>
          <pre class="raw">${esc(JSON.stringify(chain.handoff.payload, null, 2))}</pre>`
    : h`<p class="note">No handoff payload has been produced for this generation event.</p>
          <div class="spacer"></div>
          <button class="act" data-handoff="${esc(event.id)}" ${event.execution_status === 'COMPLETED' ? '' : 'disabled'}>PRODUCE FREEBUFF PAYLOAD</button>`}
      </div>
    </div>
  </div>`;
}

// -------------------------------------------------------------- 23 SETTINGS

function viewSettings() {
  const settings = ui.state.settings;
  return h`
  <div class="grid-2">
    <div>
      <div class="panel accent">
        <p class="section-title">Provider adapters</p>
        <p class="note">The application never calls a provider from the browser. Every call goes IdentityExecutionAdapter → concrete adapter, server-side.</p>
        <div class="spacer"></div>
        ${ui.state.providers.map((provider) => h`
          <div class="panel" style="margin-bottom:12px">
            <div class="row" style="justify-content:space-between">
              <div>
                <div class="id" style="font-family:var(--mono);font-size:13px">${esc(provider.provider)}</div>
                <div class="note">${esc(provider.label)}</div>
              </div>
              <span class="state ${provider.readiness.ready_for_real_execution ? 'ok' : 'bad'}">
                ${provider.readiness.ready_for_real_execution ? 'READY' : 'CONTRACT INCOMPLETE'}
              </span>
            </div>
            <div class="spacer"></div>
            <dl class="kv"><dt>Contract verification</dt><dd class="mono">${esc(provider.contract.verification_state)}</dd></dl>
            ${provider.contract.verification_note ? h`<p class="note">${esc(provider.contract.verification_note)}</p>` : ''}
            ${provider.readiness.missing_contract_elements.length ? h`
              <div class="spacer"></div>
              <p class="section-title">Missing contract elements</p>
              ${provider.readiness.missing_contract_elements.map((item) => h`<div class="reason">
                <span class="verd deny">${esc(item.status)}</span>
                <span class="rule">${esc(item.contract_element)}</span>
                <span class="detail">${esc(item.detail)}</span>
              </div>`).join('')}` : ''}
            ${provider.contract.endpoints?.length ? h`
              <div class="spacer"></div>
              <p class="section-title">Declared endpoints</p>
              ${provider.contract.endpoints.map((endpoint) => h`<div class="reason">
                <span class="verd ${endpoint.confirmed ? 'allow' : 'waive'}">${endpoint.confirmed ? 'CONFIRMED' : 'DECLARED'}</span>
                <span class="rule">${esc(endpoint.method)} ${esc(endpoint.path)}</span>
                <span class="detail">${esc(endpoint.purpose)}</span>
              </div>`).join('')}` : ''}
          </div>`).join('')}
      </div>
    </div>

    <div>
      <div class="panel">
        <p class="section-title">Secrets — presence only</p>
        <p class="note">Values are never transmitted to the browser and never appear in client code.</p>
        <div class="spacer"></div>
        ${settings.secrets.map((secret) => h`<div class="policy-line">
          <span class="ctx">${esc(secret.name)}</span>
          <span class="verdict ${secret.present ? 'allowed' : 'prohibited'}">${secret.present ? 'PRESENT' : 'ABSENT'}</span>
        </div>`).join('')}
        <div class="spacer"></div>
        <p class="note">Set <strong>HEYGEN_API_KEY</strong>, <strong>HEYGEN_AVATAR_ID</strong> and <strong>HEYGEN_VOICE_ID</strong> in the server environment to enable real HeyGen execution. Until then WRAYVE refuses real execution at the adapter boundary rather than simulating a success.</p>
      </div>

      <div class="panel">
        <p class="section-title">Ledger integrity</p>
        <dl class="kv"><dt>Recorded events</dt><dd class="mono">${esc(ui.state.integrity.length)}</dd></dl>
        <dl class="kv"><dt>Hash chain</dt><dd><span class="state ${ui.state.integrity.intact ? 'ok' : 'bad'}">${ui.state.integrity.intact ? 'INTACT' : 'BROKEN'}</span></dd></dl>
        <dl class="kv"><dt>Default asset visibility</dt><dd class="mono">${esc(settings.default_asset_visibility)}</dd></dl>
        <dl class="kv"><dt>Data directory</dt><dd class="mono">${esc(settings.data_directory)}</dd></dl>
      </div>

      <div class="panel">
        <p class="section-title">Separation of concerns</p>
        <p class="note">
          <strong>HeyGen</strong> generates media.<br />
          <strong>WRASAL</strong> governs the identity.<br />
          <strong>Freebuff</strong> preserves the evidence.<br />
          <strong>FOR3NSIC</strong> investigates what happens outside the system.
        </p>
      </div>
    </div>
  </div>`;
}

function emptyState(text) {
  return h`<div class="empty">${esc(text)}</div>`;
}

// ------------------------------------------------------------------ bindings

function bind() {
  on('#create-snapshot', 'click', () => guard(async () => {
    const identity = S.identity();
    await api('POST', '/api/snapshots', {
      identity_id: identity.id,
      appearance_profile: val('#snap-appearance'),
      performance_profile: val('#snap-performance'),
      face_reference: val('#snap-face') || null,
      voice_reference: val('#snap-voice') || null,
      canonical_notes: val('#snap-notes'),
    });
    toast('SNAPSHOT_CREATED — previous snapshot superseded, not overwritten');
    await refresh();
  }));

  on('#save-policy', 'click', () => guard(async () => {
    const identity = S.identity();
    const snapshot = S.activeSnapshot(identity);
    const permissions = {};
    document.querySelectorAll('[data-policy]').forEach((input) => {
      permissions[input.dataset.policy] = input.checked;
    });
    await api('POST', '/api/policies', {
      identity_snapshot_id: snapshot.id,
      permissions,
      notes: val('#policy-notes'),
    });
    toast('POLICY_CREATED — new policy version appended');
    await refresh();
  }));

  on('#create-scene', 'click', () => guard(async () => {
    const identity = S.identity();
    const snapshot = S.activeSnapshot(identity);
    const intended_context = {};
    document.querySelectorAll('[data-context]').forEach((input) => {
      intended_context[input.dataset.context] = input.checked;
    });
    await api('POST', '/api/scenes', {
      identity_snapshot_id: snapshot.id,
      title: val('#sc-title') || 'UNTITLED SCENE',
      environment: val('#sc-env'),
      wardrobe: val('#sc-wardrobe'),
      performance_direction: val('#sc-performance'),
      camera_direction: val('#sc-camera'),
      dialogue: val('#sc-dialogue'),
      voice_direction: val('#sc-voice'),
      duration_seconds: val('#sc-duration') || null,
      intended_context,
    });
    toast('SCENE_CREATED');
    await refresh();
  }));

  all('[data-request-execution]', (button) => button.addEventListener('click', () => guard(async () => {
    const sceneId = button.dataset.requestExecution;
    const provider = document.querySelector(`[data-provider-for="${sceneId}"]`).value;
    const mode = document.querySelector(`[data-mode-for="${sceneId}"]`).value;
    const request = await api('POST', '/api/executions', { scene_spec_id: sceneId, provider, mode });
    ui.selectedRequest = request.id;
    ui.view = 'executions';
    setNav('executions');
    toast(`EXECUTION_REQUESTED — ${request.id}`);
    await refresh();
  })));

  all('[data-select-request]', (button) => button.addEventListener('click', () => {
    ui.selectedRequest = button.dataset.selectRequest;
    render();
  }));

  all('[data-recheck]', (button) => button.addEventListener('click', () => guard(async () => {
    const result = await api('POST', `/api/executions/${button.dataset.recheck}/authority-check`, {});
    toast(`AUTHORITY_CHECKED — ${result.check.decision}`, result.check.decision !== 'AUTHORIZED');
    await refresh();
  })));

  all('[data-approve]', (button) => button.addEventListener('click', () => guard(async () => {
    await api('POST', `/api/executions/${button.dataset.approve}/approve`, { approver: 'operator' });
    toast('APPROVAL_GRANTED');
    await refresh();
  })));

  all('[data-reject]', (button) => button.addEventListener('click', () => guard(async () => {
    await api('POST', `/api/executions/${button.dataset.reject}/reject`, { reason: 'rejected in console' });
    toast('APPROVAL_REJECTED');
    await refresh();
  })));

  all('[data-execute]', (button) => button.addEventListener('click', () => guard(async () => {
    button.disabled = true;
    const result = await api('POST', `/api/executions/${button.dataset.execute}/execute`, {});
    if (result.status === 'FAILED') {
      toast(`EXECUTION FAILED — ${result.failure.code} @ ${result.failure.stage}`, true);
    } else if (result.status === 'IN_PROGRESS') {
      toast(result.message);
    } else {
      toast(`MEDIA_GENERATED — ${result.generation_event.id}`);
    }
    await refresh();
  })));

  all('[data-record-review]', (button) => button.addEventListener('click', () => guard(async () => {
    await api('POST', `/api/executions/${button.dataset.recordReview}/record-review`, { verdict: 'ACCEPTED', notes: 'reviewed in console' });
    toast('REVIEW_RECORDED');
    await refresh();
  })));

  all('[data-open-provenance]', (button) => button.addEventListener('click', () => {
    ui.selectedGeneration = button.dataset.openProvenance;
    ui.view = 'provenance';
    setNav('provenance');
    render();
  }));

  all('[data-select-generation]', (button) => button.addEventListener('click', () => {
    ui.selectedGeneration = button.dataset.selectGeneration;
    render();
  }));

  all('[data-handoff]', (button) => button.addEventListener('click', () => guard(async () => {
    await api('POST', `/api/freebuff/${button.dataset.handoff}`, {});
    toast('FREEBUFF_HANDOFF_CREATED — SIMULATED, not certified');
    await refresh();
  })));
}

function on(selector, event, handler) {
  const node = document.querySelector(selector);
  if (node && !node.dataset.bound) {
    node.dataset.bound = '1';
    node.addEventListener(event, handler);
  }
}
/** bind() can run more than once per render (the chain loads async), so every
 *  node is bound exactly once. */
function all(selector, fn) {
  document.querySelectorAll(selector).forEach((node) => {
    if (node.dataset.bound) return;
    node.dataset.bound = '1';
    fn(node);
  });
}
function val(selector) { return document.querySelector(selector)?.value?.trim() ?? ''; }

function setNav(view) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === view);
  });
}

document.getElementById('nav').addEventListener('click', (event) => {
  const button = event.target.closest('.nav-item');
  if (!button) return;
  ui.view = button.dataset.view;
  setNav(ui.view);
  render();
});

document.getElementById('refresh').addEventListener('click', () => guard(refresh));

refresh().catch((error) => {
  el.innerHTML = `<div class="banner deny">${error.message}</div>`;
});
