// WRASAL Reality Graph — client.
// The client renders records. It does not interpret them: every status, chip
// and classification shown here comes from the server's domain layer.

const api = {
  async get(path) {
    const r = await fetch(path, { headers: { 'x-wrasal-actor': state.actorId } });
    const body = await r.json();
    if (!r.ok) throw Object.assign(new Error(body.error ?? 'Request failed'), { detail: body.detail });
    return body;
  },
  async post(path, payload) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-wrasal-actor': state.actorId },
      body: JSON.stringify({ ...payload, actor_id: state.actorId }),
    });
    const body = await r.json();
    if (!r.ok) throw Object.assign(new Error(body.error ?? 'Request failed'), { detail: body.detail });
    return body;
  },
};

const state = {
  actorId: 'usr_wray',
  actor: null,
  view: 'graph',
  selected: null,
  boot: null,
  graph: null,
};

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (v, extra = '') => v ? `<span class="chip ${esc(v)} ${extra}">${esc(String(v).replace(/_/g, ' ').toUpperCase())}</span>` : '';
const when = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) : 'UNKNOWN';

function toast(message, kind = 'ok') {
  const t = $('#toast');
  t.textContent = message;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 5200);
}

// ---------------------------------------------------------------- bootstrap

async function boot() {
  state.boot = await api.get('/api/bootstrap');
  const sel = $('#actor-select');
  sel.innerHTML = state.boot.actors
    .map((a) => `<option value="${a.id}">${esc(a.display_name)} · ${a.kind}</option>`).join('');
  sel.value = state.actorId;
  sel.onchange = () => { state.actorId = sel.value; refreshActor(); render(); };
  await refreshActor();

  $('#stat-entities').textContent = state.boot.entities.length;

  document.querySelectorAll('.rail button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.rail button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.view = b.dataset.view;
      render();
    };
  });

  $('#ask-open').onclick = () => { $('#ask-panel').hidden = false; $('#ask-input').focus(); };
  $('#ask-close').onclick = () => { $('#ask-panel').hidden = true; };
  $('#ask-form').onsubmit = (e) => { e.preventDefault(); runAsk($('#ask-input').value); };
  $('#ask-suggestions').innerHTML = state.boot.suggested_questions
    .map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('');
  $('#ask-suggestions').onclick = (e) => {
    const q = e.target.dataset.q;
    if (q) { $('#ask-input').value = q; runAsk(q); }
  };

  await render();
  if (state.boot.entities.length) select(state.boot.entities.find((e) => e.name === 'Miss Celia')?.id
    ?? state.boot.entities[0].id);
}

async function refreshActor() {
  const a = await api.get(`/api/authority?actor_id=${state.actorId}`);
  state.actor = a.actor;
  state.capabilities = a.capabilities;
  const chipEl = $('#actor-authority');
  chipEl.textContent = a.actor.authority_level.toUpperCase() + (a.actor.kind === 'ai' ? ' · AI' : '');
  chipEl.className = `authority-chip ${a.actor.authority_level} ${a.actor.kind}`;
  $('#stat-events').textContent = a.events.length;
}

// ------------------------------------------------------------------- render

async function render() {
  const stage = $('#stage');
  stage.innerHTML = '';
  const view = VIEWS[state.view] ?? VIEWS.graph;
  await view(stage);
}

const VIEWS = {
  async graph(stage) {
    state.graph = await api.get('/api/graph');
    stage.innerHTML = `
      <div class="graph-title">THE REALITY GRAPH</div>
      <svg id="graph-svg"></svg>
      <div class="graph-legend">
        <div><i style="background:rgba(255,255,255,.3)"></i>recorded by a person</div>
        <div><i style="background:rgba(63,185,176,.6)"></i>externally supported</div>
        <div><i style="background:rgba(124,107,209,.7)"></i>machine interpretation — not fact</div>
      </div>`;
    drawGraph(state.graph);
  },

  async entities(stage) {
    const rows = await api.get('/api/entities');
    stage.append(pane('REALITY', 'Entities', `${rows.length} entities recorded in the graph.`, `
      <table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Connections</th><th>Identifier</th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr class="clickable" data-id="${r.id}">
          <td style="font-family:var(--serif);font-size:15px">${esc(r.name)}</td>
          <td>${esc(r.type_label)}</td>
          <td>${chip(r.status)}</td>
          <td>${r.degree}</td>
          <td class="id">${r.id}</td>
        </tr>`).join('')}</tbody></table>`));
    stage.querySelectorAll('tr[data-id]').forEach((tr) => { tr.onclick = () => select(tr.dataset.id); });
  },

  async memory(stage) {
    const rows = await api.get('/api/memories');
    stage.append(pane('REALITY', 'Memory', 'Persistent recollection attached to entities. A memory may record that its own time is unknown.',
      rows.map((m) => `
        <div class="record ${m.epistemic_status === 'unknown' ? 'ember' : 'teal'}">
          <div class="body">${esc(m.body)}</div>
          <div class="meta">
            ${chip(m.epistemic_status)}
            <span>${esc(m.entity_name)}</span>
            <span>occurred ${when(m.occurred_at)}</span>
            <span>recorded by ${esc(m.recorded_by_name)}</span>
            <span>confidence ${m.confidence ?? 'UNKNOWN'}</span>
          </div>
        </div>`).join('') || '<p class="empty">No memories recorded.</p>'));
  },

  async evidence(stage) {
    const rows = await api.get('/api/evidence');
    stage.append(pane('REALITY', 'Evidence', 'Source records. Evidence can never be machine-generated interpretation — the database refuses it.',
      rows.map((e) => `
        <div class="record teal">
          <div class="body">${esc(e.title)}</div>
          <div class="meta">${chip(e.epistemic_status)}<span>${esc(e.source_kind)}</span>
            <span>${esc(e.source)}</span><span>${esc(e.entity_name ?? 'unattached')}</span></div>
          <p style="margin:8px 0 0;color:var(--ink-dim);font-size:12px">${esc(e.observed_result)}</p>
        </div>`).join('') || '<p class="empty">No evidence recorded.</p>'));
  },

  async story(stage) { await simpleList(stage, 'CREATE', 'Story', '/api/bootstrap', 'stories'); },

  async specification(stage) {
    const e = state.selected ? await api.get(`/api/entities/${state.selected}`) : null;
    const specs = e?.specifications ?? [];
    stage.append(pane('CREATE', 'Specification',
      'Structured descriptions of creative objects. A specification states what must and must not appear — including what is unresolved.',
      specs.map((s) => `
        <div class="record gold">
          <div class="body">${esc(s.title)}</div>
          <div class="meta">${chip(s.epistemic_status)}${chip(s.status)}</div>
          <pre style="margin:10px 0 0;color:var(--ink-dim);font-size:11px;white-space:pre-wrap">${esc(JSON.stringify(s.body, null, 2))}</pre>
        </div>`).join('') || '<p class="empty">Select an entity with a specification. Miss Celia has one.</p>'));
  },

  async media(stage) {
    const e = state.selected ? await api.get(`/api/entities/${state.selected}`) : null;
    const arts = e?.artifacts ?? [];
    stage.append(pane('CREATE', 'Media', 'Artifacts and their versions. Generation context is stored opaquely: the domain model does not know what a "model" is.',
      arts.map((a) => `
        <div class="record ${a.status === 'canonical' ? 'gold' : ''}">
          <div class="body">${esc(a.name)} ${chip(a.status)}</div>
          <div class="meta"><span>${esc(a.kind)}</span><span class="id">${a.id}</span></div>
          ${(a.versions ?? []).map((v) => `
            <div style="margin-top:10px;padding-left:12px;border-left:1px solid var(--edge)">
              <div style="font-size:11px;color:var(--ink-faint);letter-spacing:.14em">VERSION ${v.version_number} · ${when(v.created_at)}</div>
              <div style="font-family:var(--serif);font-size:13px;margin:3px 0">${esc(v.change_summary)}</div>
              ${chip(v.epistemic_status)}
            </div>`).join('')}
        </div>`).join('') || '<p class="empty">Select an entity with artifacts. Miss Celia has the Porch Portrait.</p>'));
  },

  async simulation(stage) {
    stage.append(pane('OPERATE', 'Simulation', 'Not implemented in V0.1.', `
      <div class="unknown-block"><p class="big">UNKNOWN</p>
      <p class="why">Simulation is a V0.6 layer. WRASAL does not display a feature it cannot perform.<br>
      The substrate reserves <code class="inline">events</code> and <code class="inline">canonical_states</code> for it.</p></div>`));
  },

  async release(stage) {
    const r = await api.post('/api/ask', { question: 'What can I safely release?' });
    stage.append(pane('OPERATE', 'Release', 'Release readiness computed from recorded state. WRASAL does not grant release; a steward does.',
      r.answer === 'UNKNOWN' ? unknownBlock(r) : `
        <h4>READY</h4>
        ${r.answer.releasable.map((a) => `<div class="record gold"><div class="body">${esc(a.name)}</div>
          <div class="meta"><span class="id">${a.id}</span></div></div>`).join('') || '<p class="empty">Nothing is release-ready.</p>'}
        <h4>BLOCKED</h4>
        ${r.answer.blocked.map((a) => `<div class="record ember"><div class="body">${esc(a.name)}</div>
          <div class="meta">${a.blockers.map((b) => `<span>· ${esc(b)}</span>`).join('')}</div></div>`).join('') || '<p class="empty">Nothing blocked.</p>'}`));
  },

  async archive(stage) {
    const rows = await api.get('/api/archive');
    stage.append(pane('OPERATE', 'Archive', 'Frozen snapshots: artifact, versions, provenance, relationships, supporting evidence, decisions, canonical status, timestamps — hashed.',
      rows.map((a) => `
        <div class="record gold">
          <div class="body">${esc(a.subject_name ?? a.subject_id)}</div>
          <div class="meta"><span>${a.version_count} version(s)</span><span>archived ${when(a.archived_at)}</span>
            <span>by ${esc(a.archived_by_name)}</span></div>
          <div class="meta"><span class="id">sha256 ${esc(a.snapshot_hash)}</span></div>
          <p style="margin:8px 0 0;font-size:12px;color:var(--ink-dim)">${esc(a.reason)}</p>
        </div>`).join('') || '<p class="empty">Nothing archived yet. Select an artifact-bearing entity and archive it from the inspector.</p>'));
  },

  async provenance(stage) {
    const rows = await api.get('/api/provenance');
    stage.append(pane('GOVERN', 'Provenance', 'Lineage relationships describe derivation and context. They do not establish ownership, licence, or rights.',
      `<table><thead><tr><th>Subject</th><th>Relation</th><th>Related</th><th>Origin</th><th>Creator</th></tr></thead>
       <tbody>${rows.map((p) => `<tr>
         <td class="id">${p.subject_kind}:${p.subject_id}</td>
         <td>${chip(p.relation)}</td>
         <td class="id">${p.related_id ? `${p.related_kind}:${p.related_id}` : '—'}</td>
         <td style="max-width:280px">${esc(p.origin)}</td>
         <td>${p.creator ? esc(p.creator) : '<span class="chip unknown">UNKNOWN</span>'}</td>
       </tr>`).join('')}</tbody></table>`));
  },

  async decisions(stage) {
    const rows = await api.get('/api/decisions');
    stage.append(pane('GOVERN', 'Decisions', 'Authoritative state changes pass through a decision. Nothing becomes canonical by accident.',
      rows.map((d) => `
        <div class="record ${d.status === 'accepted' ? 'gold' : ''}">
          <div class="body">${esc(d.question)}</div>
          <div class="meta">${chip(d.status)}<span>proposed by ${esc(d.proposed_by_name)}</span>
            <span>decided by ${esc(d.decided_by_name ?? 'UNKNOWN')}</span><span>${when(d.decided_at)}</span></div>
          <p style="margin:8px 0 0;font-size:12px;color:var(--ink-dim)">${esc(d.resolution ?? d.rationale ?? '')}</p>
        </div>`).join('') || '<p class="empty">No decisions recorded.</p>'));
  },

  async authority(stage) {
    const a = await api.get(`/api/authority?actor_id=${state.actorId}`);
    stage.append(pane('GOVERN', 'Authority',
      'Intelligence may participate in reality without owning reality. Every mutation below carries who, what, when, why, source, previous state and new state.',
      `<h4>CURRENT ACTOR — ${esc(a.actor.display_name).toUpperCase()}</h4>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
         <div><p class="eyebrow" style="color:var(--teal)">MAY</p>
           ${a.capabilities.may.map((x) => `<div style="font-size:11px;line-height:1.9">${esc(x)}</div>`).join('')}</div>
         <div><p class="eyebrow" style="color:var(--ember)">MAY NOT</p>
           ${a.capabilities.may_not.map((x) => `<div style="font-size:11px;line-height:1.9;color:var(--ember)">${esc(x)}</div>`).join('') || '<div class="empty">—</div>'}</div>
       </div>
       <h4>AUTHORITY EVENTS — ${a.events.length}</h4>
       <table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Subject</th><th>Previous → New</th><th>Reason</th></tr></thead>
       <tbody>${a.events.map((e) => `<tr>
         <td class="id">${when(e.occurred_at)}</td>
         <td>${esc(e.actor_name)} ${e.actor_kind === 'ai' ? chip('ai') : ''}</td>
         <td><code class="inline">${esc(e.action)}</code></td>
         <td class="id">${e.subject_kind}:${e.subject_id}</td>
         <td class="id">${e.previous_state ? esc(JSON.stringify(e.previous_state)) : '—'} → ${e.new_state ? esc(JSON.stringify(e.new_state)) : '—'}</td>
         <td style="max-width:260px;font-size:11px">${esc(e.reason)}</td>
       </tr>`).join('')}</tbody></table>`));
  },
};

async function simpleList(stage, eyebrow, title, path, key) {
  stage.append(pane(eyebrow, title, 'Worlds and the stories recorded inside them.',
    (await api.get('/api/bootstrap')).worlds.map((w) => `
      <div class="record gold"><div class="body">${esc(w.name)}</div>
        <div class="meta">${chip(w.status)}<span class="id">${w.id}</span></div>
        <p style="margin:8px 0 0;font-size:13px;font-family:var(--serif);color:var(--ink-dim)">${esc(w.summary ?? '')}</p>
      </div>`).join('')));
}

function pane(eyebrow, title, lead, html) {
  const p = el('div', 'pane');
  p.innerHTML = `<p class="eyebrow">${esc(eyebrow)}</p><h3>${esc(title)}</h3>
    <p class="muted" style="max-width:720px;margin:0 0 20px">${esc(lead)}</p>${html}`;
  return p;
}

// -------------------------------------------------------------------- graph

function drawGraph(data) {
  const svg = $('#graph-svg');
  const W = svg.clientWidth || 900;
  const H = svg.clientHeight || 700;
  const NS = 'http://www.w3.org/2000/svg';

  const nodes = data.nodes.map((n, i) => ({ ...n, x: W / 2 + Math.cos(i * 2.4) * 190, y: H / 2 + Math.sin(i * 2.4) * 150, vx: 0, vy: 0 }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = data.links.filter((l) => byId[l.source_entity_id] && byId[l.target_entity_id]);

  // Light force relaxation — deterministic, no dependency.
  for (let step = 0; step < 320; step += 1) {
    for (const a of nodes) {
      for (const b of nodes) {
        if (a === b) continue;
        const dx = a.x - b.x; const dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 400);
        const f = 26000 / d2;
        a.vx += (dx / Math.sqrt(d2)) * f; a.vy += (dy / Math.sqrt(d2)) * f;
      }
      a.vx += (W / 2 - a.x) * 0.012; a.vy += (H / 2 - a.y) * 0.012;
    }
    for (const l of links) {
      const a = byId[l.source_entity_id]; const b = byId[l.target_entity_id];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - 210) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) { n.x += n.vx * 0.5; n.y += n.vy * 0.5; n.vx *= 0.72; n.vy *= 0.72; }
  }

  const frag = document.createDocumentFragment();
  const mk = (tag, attrs, cls) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (cls) e.setAttribute('class', cls);
    return e;
  };

  for (const l of links) {
    const a = byId[l.source_entity_id]; const b = byId[l.target_entity_id];
    frag.append(mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, `link ${l.epistemic_status}`));
    const label = mk('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 4, 'text-anchor': 'middle' }, 'link-label');
    label.textContent = l.predicate.replace(/_/g, ' ').toUpperCase();
    frag.append(label);
  }

  const satsBy = {};
  for (const s of data.satellites) (satsBy[s.entity_id] ??= []).push(s);

  for (const n of nodes) {
    const sats = satsBy[n.id] ?? [];
    sats.forEach((s, i) => {
      const ang = (i / Math.max(sats.length, 1)) * Math.PI * 2 + 0.6;
      const sx = n.x + Math.cos(ang) * 58; const sy = n.y + Math.sin(ang) * 58;
      frag.append(mk('line', { x1: n.x, y1: n.y, x2: sx, y2: sy, stroke: 'rgba(63,185,176,.18)' }));
      const g = mk('g', {}, 'sat');
      g.append(mk('circle', { cx: sx, cy: sy, r: 12 }));
      const t = mk('text', { x: sx, y: sy + 2.5, 'text-anchor': 'middle' });
      t.textContent = `${s.kind.slice(0, 3).toUpperCase()}·${s.count}`;
      g.append(t);
      frag.append(g);
    });

    const g = mk('g', {}, `node ${n.id === state.selected ? 'selected' : ''}`);
    const fill = n.status === 'canonical' ? 'rgba(201,162,39,.18)'
      : n.status === 'disputed' ? 'rgba(210,104,58,.18)' : 'rgba(63,185,176,.1)';
    const stroke = n.status === 'canonical' ? 'rgba(201,162,39,.8)'
      : n.status === 'disputed' ? 'rgba(210,104,58,.8)' : 'rgba(63,185,176,.5)';
    g.append(mk('circle', { cx: n.x, cy: n.y, r: 26, fill, stroke }));
    const name = mk('text', { x: n.x, y: n.y + 48, 'text-anchor': 'middle' });
    name.textContent = n.name;
    const sub = mk('text', { x: n.x, y: n.y + 61, 'text-anchor': 'middle' }, 'sub');
    sub.textContent = n.type_label.toUpperCase();
    g.append(name, sub);
    g.style.cursor = 'pointer';
    g.onclick = () => select(n.id);
    frag.append(g);
  }

  svg.innerHTML = '';
  svg.append(frag);
}

// ---------------------------------------------------------------- inspector

async function select(entityId) {
  state.selected = entityId;
  if (state.view === 'graph' && state.graph) drawGraph(state.graph);
  const d = await api.get(`/api/entities/${entityId}`);
  renderInspector(d);
}

function renderInspector(d) {
  const e = d.entity;
  const canDeclare = state.capabilities?.may.includes('declare_canonical');
  const canArchive = state.capabilities?.may.includes('archive');

  const i = $('#inspector');
  i.innerHTML = `
    <p class="eyebrow">ENTITY · ${esc(e.type_label).toUpperCase()}</p>
    <h3>${esc(e.name)}</h3>
    <div style="display:flex;gap:6px;margin:8px 0 2px;flex-wrap:wrap">
      ${chip(e.status)}${e.world_name ? `<span class="chip">${esc(e.world_name)}</span>` : ''}
      ${e.archived_at ? chip('archived') : ''}
    </div>
    <p style="font-family:var(--serif);font-size:14px;color:var(--ink-dim);margin:12px 0 0">
      ${e.summary ? esc(e.summary) : '<span class="chip unknown">UNKNOWN</span> no summary recorded'}</p>

    <div class="action-bar">
      <button id="btn-canon" ${canDeclare ? '' : 'disabled'} title="${canDeclare ? 'Declare canonical' : 'Requires steward authority'}">DECLARE CANONICAL</button>
      <button id="btn-memory">+ MEMORY</button>
      <button id="btn-ask">ASK ABOUT THIS</button>
      ${d.artifacts.length ? `<button id="btn-archive" ${canArchive ? '' : 'disabled'}>ARCHIVE ARTIFACT</button>` : ''}
    </div>

    <h4>IDENTITY</h4>
    <dl class="kv">
      <dt>ID</dt><dd class="id">${e.id}</dd>
      <dt>TYPE</dt><dd>${esc(e.type_label)}</dd>
      <dt>SUMMARY BASIS</dt><dd>${chip(e.summary_epistemic_status)}</dd>
      <dt>CREATED</dt><dd>${when(e.created_at)}</dd>
    </dl>

    <h4>RELATIONSHIPS — ${d.relationships.outgoing.length + d.relationships.incoming.length}</h4>
    ${[...d.relationships.outgoing.map((r) => ({ p: r.predicate, o: r.target_name, id: r.target_entity_id, dir: '→', es: r.epistemic_status, note: r.note })),
       ...d.relationships.incoming.map((r) => ({ p: r.predicate, o: r.source_name, id: r.source_entity_id, dir: '←', es: r.epistemic_status, note: r.note }))]
      .map((r) => `<div class="record ${r.es === 'generated_interpretation' ? 'violet' : ''}" style="padding:9px 12px">
        <div style="font-size:12px">${r.dir} <code class="inline">${esc(r.p)}</code>
          <a class="entity-link" data-goto="${r.id}">${esc(r.o)}</a></div>
        <div class="meta">${chip(r.es)}${r.note ? `<span style="max-width:260px">${esc(r.note)}</span>` : ''}</div>
      </div>`).join('') || '<p class="empty">No relationships.</p>'}

    <h4>MEMORY — ${d.memories.length}</h4>
    ${d.memories.map((m) => `<div class="record ${m.epistemic_status === 'unknown' ? 'ember' : 'teal'}" style="padding:10px 12px">
      <div class="body" style="font-size:13px">${esc(m.body)}</div>
      <div class="meta">${chip(m.epistemic_status)}<span>${when(m.occurred_at)}</span></div>
    </div>`).join('') || '<p class="empty">No memories.</p>'}

    <h4>CLAIMS — ${d.claims.length}</h4>
    ${d.claims.map((c) => `<div class="record ${c.status === 'supported' ? 'teal' : 'ember'}" style="padding:10px 12px">
      <div class="body" style="font-size:13px">${esc(c.statement)}</div>
      <div class="meta">${chip(c.status)}
        ${(c.support ?? []).length ? (c.support).map((s) => `<span>${s.stance === 'supports' ? '✓' : '✗'} ${esc(s.title)}</span>`).join('')
          : '<span class="chip unknown">NO EVIDENCE LINKED</span>'}</div>
    </div>`).join('') || '<p class="empty">No claims.</p>'}

    <h4>EVIDENCE — ${d.evidence.length}</h4>
    ${d.evidence.map((v) => `<div class="record teal" style="padding:10px 12px">
      <div style="font-size:12px">${esc(v.title)}</div>
      <div class="meta">${chip(v.epistemic_status)}<span>${esc(v.source)}</span></div>
    </div>`).join('') || '<p class="empty">No evidence.</p>'}

    <h4>ARTIFACTS — ${d.artifacts.length}</h4>
    ${d.artifacts.map((a) => `<div class="record ${a.status === 'canonical' ? 'gold' : ''}" style="padding:10px 12px">
      <div style="font-size:12px">${esc(a.name)} ${chip(a.status)}</div>
      ${(a.versions ?? []).map((v) => `<div style="font-size:11px;color:var(--ink-faint);margin-top:5px">
        v${v.version_number} · ${esc(v.change_summary)} ${chip(v.epistemic_status)}</div>`).join('')}
    </div>`).join('') || '<p class="empty">No artifacts.</p>'}

    <h4>PROVENANCE — ${d.provenance.length}</h4>
    ${d.provenance.map((p) => `<div class="record" style="padding:9px 12px">
      <div style="font-size:12px"><code class="inline">${esc(p.relation)}</code> ${esc(p.origin)}</div>
      <div class="meta"><span>creator ${p.creator ? esc(p.creator) : 'UNKNOWN'}</span></div>
    </div>`).join('') || '<p class="empty">No provenance records.</p>'}

    <h4>EVENT HISTORY — ${d.timeline.length}</h4>
    <ul class="timeline" style="padding-left:16px">
      ${d.timeline.map((t) => `<li class="${t.kind === 'declare_canonical' ? 'canon' : ''}">
        <div class="when">${when(t.occurred_at)} · ${esc(t.actor_name ?? 'system')}</div>
        <div class="what">${esc(t.description)}</div></li>`).join('')}
    </ul>

    <h4>ARCHIVE — ${d.archive_records.length}</h4>
    ${d.archive_records.map((a) => `<div class="record gold" style="padding:9px 12px">
      <div style="font-size:12px">${esc(a.reason)}</div>
      <div class="meta"><span class="id">${esc(a.snapshot_hash.slice(0, 24))}…</span><span>${when(a.archived_at)}</span></div>
    </div>`).join('') || '<p class="empty">Not archived.</p>'}
  `;

  i.querySelectorAll('[data-goto]').forEach((a) => { a.onclick = () => select(a.dataset.goto); });
  const btn = (id, fn) => { const b = i.querySelector(id); if (b) b.onclick = fn; };

  btn('#btn-ask', () => {
    $('#ask-panel').hidden = false;
    const q = `What do I actually know about ${e.name}?`;
    $('#ask-input').value = q;
    runAsk(q);
  });

  btn('#btn-canon', async () => {
    const reason = prompt(`Declare "${e.name}" canonical. State the reason this is warranted — WRASAL refuses unexplained authority.`);
    if (!reason) return;
    try {
      await api.post('/api/decisions', { subject_kind: 'entity', subject_id: e.id,
        question: `Is ${e.name} canonical?`, rationale: reason, source: 'operator', reason: 'open a governed decision' });
      await api.post('/api/canonical', { subject_kind: 'entity', subject_id: e.id, status: 'canonical',
        source: `steward declaration by ${state.actor.display_name}`, reason });
      toast(`${e.name} declared canonical. Authority event recorded.`, 'ok');
      await refreshActor(); await render(); await select(e.id);
    } catch (err) { toast(err.message, 'error'); }
  });

  btn('#btn-memory', async () => {
    const body = prompt('Record a memory for ' + e.name);
    if (!body) return;
    try {
      await api.post('/api/memories', { entity_id: e.id, body,
        source: `recorded by ${state.actor.display_name}`, reason: 'attach recollection' });
      toast('Memory recorded.', 'ok');
      await select(e.id);
    } catch (err) { toast(err.message, 'error'); }
  });

  btn('#btn-archive', async () => {
    const artifact = d.artifacts[0];
    try {
      const r = await api.post('/api/archive', { artifact_id: artifact.id,
        reason: `preserve ${artifact.name} with full context`, source: 'operator archive request' });
      toast(`Archived. ${r.description}`, 'ok');
      await select(e.id);
    } catch (err) { toast(err.message, 'error'); }
  });
}

// -------------------------------------------------------------- ASK WRASAL

async function runAsk(question) {
  const out = $('#ask-result');
  out.innerHTML = '<p class="muted">Querying the Reality Graph…</p>';
  let r;
  try {
    r = await api.post('/api/ask', { question, entity_id: state.selected });
  } catch (err) { out.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }

  if (r.answer === 'UNKNOWN') { out.innerHTML = unknownBlock(r); return; }

  const a = r.answer;
  let html = `<p class="eyebrow">INTENT · ${esc(r.intent)} · ${r.records_checked} RECORDS EXAMINED</p>`;

  if (a.established) {
    html += section('ESTABLISHED BY THE RECORD', 'established', a.established.map((f) => `
      <p class="statement">${esc(f.statement)}</p>
      <p class="cites">${chip(f.epistemic_status)} ${esc(f.basis)}${f.occurred_at ? ` · ${esc(f.occurred_at)}` : ''}${
        f.supporting_evidence && f.supporting_evidence !== 'UNKNOWN' ? ` · evidence ${f.supporting_evidence.join(', ')}` : ''}</p>`).join('<hr style="border:0;border-top:1px solid rgba(255,255,255,.04);margin:10px 0">'));
  }
  if (a.not_established?.length) {
    html += section('NOT ESTABLISHED — CLAIM OR INTERPRETATION', 'not-established', a.not_established.map((f) => `
      <p class="statement">${esc(f.statement)}</p>
      <p class="cites">${chip(f.epistemic_status)}${f.claim_status ? chip(f.claim_status) : ''} ${esc(f.basis)}
        ${f.supporting_evidence === 'UNKNOWN' ? '· <span class="chip unknown">NO SUPPORTING EVIDENCE</span>' : ''}</p>`).join(''));
  }
  if (a.unknown?.length) {
    html += section('WHAT REMAINS UNKNOWN', 'unknowns', a.unknown.map((u) => `<p class="statement" style="font-size:13px">· ${esc(u)}</p>`).join(''));
  }
  if (a.connections?.length) {
    html += section('CONNECTIONS', '', a.connections.map((c) => `<p class="cites" style="font-size:11px">
      ${c.direction === 'out' ? '→' : '←'} <code class="inline">${esc(c.predicate)}</code> ${esc(c.other)} ${chip(c.epistemic_status)}</p>`).join(''));
  }
  if (a.relationships?.length) {
    html += section('RELATIONSHIPS', '', a.relationships.map((c) => `<p class="cites" style="font-size:11px">
      <code class="inline">${esc(c.predicate)}</code> ${esc(c.entity)} ${chip(c.epistemic_status)}</p>`).join(''));
  }
  if (a.origin_chain) {
    html += section('ORIGIN CHAIN', 'established', a.origin_chain.map((o) => `
      <p class="statement" style="font-size:13px"><code class="inline">${esc(o.relation)}</code> ${esc(o.origin)}</p>
      <p class="cites">creator ${esc(o.creator)} · source ${esc(o.source)}${o.related ? ` · ${esc(o.related)}` : ''}</p>`).join(''));
    html += section('OWNERSHIP', 'unknowns', `<p class="statement"><span class="chip unknown">UNKNOWN</span></p>
      <p class="cites">Derivation is recorded. Ownership is not inferred from it.</p>`);
  }
  if (a.changes) {
    html += section('CHANGES', 'established', a.changes.map((c) => `
      <p class="statement" style="font-size:13px">v${c.from} → v${c.to}: ${esc(c.change_summary)}</p>
      <p class="cites">${esc(c.author)} · ${when(c.at)} ${chip(c.epistemic_status)}</p>`).join(''));
  }
  if (a.claims) {
    html += section('CLAIMS AND THEIR EVIDENCE', '', a.claims.map((c) => `
      <p class="statement">${esc(c.claim)} ${chip(c.claim_status)}</p>
      ${c.supporting.map((s) => `<p class="cites">✓ ${esc(s.title)} — ${esc(s.observed_result)}</p>`).join('')}
      ${c.contradicting.map((s) => `<p class="cites" style="color:var(--ember)">✗ ${esc(s.title)} — ${esc(s.observed_result)}</p>`).join('')}
      ${c.verdict === 'UNKNOWN' ? '<p class="cites"><span class="chip unknown">UNKNOWN</span> no evidence linked</p>' : ''}`).join(''));
  }
  if (a.canonical) {
    html += section('CANONICAL', 'established', a.canonical.map((c) => `<p class="statement" style="font-size:13px">${esc(c.name)}</p>`).join('') || '<p class="empty">None.</p>');
    html += section('DECLARATIONS', '', a.declarations.map((dd) => `<p class="cites">${esc(dd.subject)} → ${esc(dd.status)} by ${esc(dd.declared_by)} (${esc(dd.declared_by_kind)})</p>`).join(''));
  }
  if (a.open_questions) {
    html += section('OPEN QUESTIONS', 'unknowns', a.open_questions.map((q) => `
      <p class="statement" style="font-size:13px">${esc(q.detail)}</p>
      <p class="cites">${chip(q.status)} ${esc(q.kind)} · ${esc(q.subject)}</p>`).join(''));
  }
  if (a.decisions) {
    html += section('DECISIONS', '', a.decisions.map((dd) => `
      <p class="statement" style="font-size:13px">${esc(dd.question)} ${chip(dd.status)}</p>
      <p class="cites">${esc(dd.resolution)} · decided by ${esc(dd.decided_by)}</p>`).join(''));
  }
  if (a.releasable) {
    html += section('READY', 'established', a.releasable.map((x) => `<p class="statement" style="font-size:13px">${esc(x.name)}</p>`).join('') || '<p class="cites">None.</p>');
    html += section('BLOCKED', 'unknowns', a.blocked.map((x) => `<p class="statement" style="font-size:13px">${esc(x.name)}</p>
      <p class="cites">${x.blockers.map(esc).join(' · ')}</p>`).join(''));
  }

  html += `<div class="footnote">
    <strong style="color:var(--ink-dim)">CITED RECORDS</strong><br>
    ${r.citations.map((c) => `${esc(c.record_kind)}:${esc(c.record_id)}`).join(' · ') || 'none'}
    ${r.note ? `<br><br>${esc(r.note)}` : ''}
  </div>`;
  out.innerHTML = html;
}

function section(title, cls, inner) {
  return `<div class="answer-section ${cls}"><h5>${esc(title)}</h5>${inner}</div>`;
}

function unknownBlock(r) {
  return `<div class="unknown-block">
    <p class="big">UNKNOWN</p>
    <p class="why">${esc(r.reason ?? 'The graph does not hold records sufficient to answer.')}<br><br>
    ${r.records_checked} record(s) examined.<br>${esc(r.note ?? '')}</p>
  </div>`;
}

boot().catch((e) => { document.body.innerHTML = `<pre style="padding:40px;color:#d2683a">${esc(e.stack ?? e.message)}</pre>`; });
