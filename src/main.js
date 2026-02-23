import './styles/main.css';
import { appStore, getTodaysTasks, getUpcomingTasks, isCompletedToday, getMemberPoints, getStreak } from './lib/store.js';
import { supabase } from './lib/supabase.js';
import {
  createHousehold, getHouseholdByCode, loadHousehold,
  createMember, loadMembers, getMemberByUserId,
  loadTasks, createTask, deleteTask, completeTask as dbCompleteTask,
  loadCompletions, loadRewards, createReward,
  installStarterPacks, upsertProfile, getUserProfile,
  STARTER_PACKS, calcNextDue
} from './lib/db.js';

// ─── Routing ──────────────────────────────────────────────────────────────────
const root = document.getElementById('root');
let _currentScreen = null;

function render() {
  root.innerHTML = '';
  const state = appStore.get();

  if (state.loading) {
    root.appendChild(renderLoading());
    return;
  }

  if (state.childMode && state.childMember) {
    root.appendChild(renderChildDashboard(state));
    return;
  }

  const screens = {
    welcome: renderWelcome,
    login: renderLogin,
    signup: renderSignup,
    onboard: renderOnboard,
    dashboard: renderDashboard,
  };

  const screenFn = screens[state.screen] || renderWelcome;
  const el = screenFn(state);
  el.classList.add('screen', 'active');
  root.appendChild(el);

  // Toast
  if (state.notification) {
    root.appendChild(renderToast(state.notification));
  }
}

appStore.subscribe(render);

function navigate(screen) {
  appStore.set({ screen });
}

function showToast(msg, duration = 2500) {
  appStore.set({ notification: msg });
  setTimeout(() => appStore.set({ notification: null }), duration);
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function renderLoading() {
  const div = el('div', { class: 'loading-screen screen active' });
  div.innerHTML = `
    <div style="font-size:48px;margin-bottom:16px;animation:logoFloat 3s ease-in-out infinite">🏠</div>
    <div class="spinner"></div>
  `;
  return div;
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
function renderWelcome() {
  const div = el('div');
  div.style.cssText = 'background:linear-gradient(160deg,#C4673A 0%,#8B4513 60%,#3D2010 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 32px 48px;text-align:center;min-height:100%';
  div.innerHTML = `
    <div style="width:88px;height:88px;background:rgba(255,255,255,0.15);border-radius:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 28px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:logoFloat 3s ease-in-out infinite;font-size:44px">🏠</div>
    <div style="font-family:'Fraunces',serif;font-size:44px;font-weight:700;color:white;letter-spacing:-1.5px;margin-bottom:12px">Chorify</div>
    <div style="font-size:16px;color:rgba(255,255,255,0.75);font-weight:300;line-height:1.6;margin-bottom:52px">Your household, in harmony.<br>Track chores, reward the family.</div>
    <div style="display:flex;gap:10px;width:100%;margin-bottom:48px">
      ${['🏠 One home,<br>many users','⭐ Points &<br>rewards','🔄 Smart<br>recurring tasks'].map(t=>`<div style="flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:16px 10px;font-size:12px;color:rgba(255,255,255,0.85);line-height:1.5">${t}</div>`).join('')}
    </div>
    <button class="btn btn-primary btn-full" id="btn-getstarted" style="margin-bottom:14px">Get started</button>
    <button class="btn btn-ghost btn-full" id="btn-signin">Sign in</button>
  `;
  div.querySelector('#btn-getstarted').onclick = () => {
    appStore.set({ screen: 'signup', onboardMode: true });
  };
  div.querySelector('#btn-signin').onclick = () => navigate('login');
  return div;
}

// ─── Auth: Login ──────────────────────────────────────────────────────────────
function renderLogin() {
  const div = el('div');
  div.style.cssText = 'display:flex;flex-direction:column;padding:60px 28px 48px;min-height:100%';
  div.innerHTML = `
    <button class="back-btn" id="back" style="background:none;border:none;font-size:24px;cursor:pointer;text-align:left;margin-bottom:28px;color:var(--text-mid)">←</button>
    <div style="font-family:'Fraunces',serif;font-size:32px;font-weight:500;margin-bottom:8px">Welcome back 👋</div>
    <div style="color:var(--text-light);font-size:15px;margin-bottom:36px">Sign in to your household</div>
    <div class="input-group">
      <label class="input-label">Email</label>
      <input class="input" id="email" type="email" placeholder="you@example.com" autocomplete="email" />
    </div>
    <div class="input-group">
      <label class="input-label">Password</label>
      <input class="input" id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
    </div>
    <div id="err" style="color:var(--rose);font-size:14px;margin-bottom:12px;display:none"></div>
    <button class="btn btn-terra btn-full" id="login-btn" style="margin-top:8px">Sign in</button>
    <button class="btn btn-outline btn-full" id="to-signup" style="margin-top:12px">Create account</button>
  `;
  div.querySelector('#back').onclick = () => navigate('welcome');
  div.querySelector('#to-signup').onclick = () => navigate('signup');
  const errEl = div.querySelector('#err');

  div.querySelector('#login-btn').onclick = async () => {
    const email = div.querySelector('#email').value.trim();
    const pwd = div.querySelector('#password').value;
    if (!email || !pwd) { errEl.textContent = 'Please fill in all fields'; errEl.style.display = 'block'; return; }
    const btn = div.querySelector('#login-btn');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      errEl.textContent = error.message || 'Incorrect email or password';
      errEl.style.display = 'block';
      btn.textContent = 'Sign in'; btn.disabled = false;
    }
    // Auth state change will trigger navigation
  };
  return div;
}

// ─── Auth: Signup ─────────────────────────────────────────────────────────────
function renderSignup() {
  const div = el('div');
  div.style.cssText = 'display:flex;flex-direction:column;padding:60px 28px 48px;min-height:100%';
  div.innerHTML = `
    <button id="back" style="background:none;border:none;font-size:24px;cursor:pointer;text-align:left;margin-bottom:28px;color:var(--text-mid)">←</button>
    <div style="font-family:'Fraunces',serif;font-size:32px;font-weight:500;margin-bottom:8px">Create account</div>
    <div style="color:var(--text-light);font-size:15px;margin-bottom:36px">Set up your Chorify account</div>
    <div class="input-group">
      <label class="input-label">Your name</label>
      <input class="input" id="name" type="text" placeholder="Sarah" autocomplete="given-name" />
    </div>
    <div class="input-group">
      <label class="input-label">Email</label>
      <input class="input" id="email" type="email" placeholder="you@example.com" autocomplete="email" />
    </div>
    <div class="input-group">
      <label class="input-label">Password</label>
      <input class="input" id="password" type="password" placeholder="At least 6 characters" autocomplete="new-password" />
    </div>
    <div id="err" style="color:var(--rose);font-size:14px;margin-bottom:12px;display:none"></div>
    <button class="btn btn-terra btn-full" id="signup-btn" style="margin-top:8px">Create account</button>
    <button class="btn btn-outline btn-full" id="to-login" style="margin-top:12px">Already have an account</button>
  `;
  div.querySelector('#back').onclick = () => navigate('welcome');
  div.querySelector('#to-login').onclick = () => navigate('login');
  const errEl = div.querySelector('#err');

  div.querySelector('#signup-btn').onclick = async () => {
    const name = div.querySelector('#name').value.trim();
    const email = div.querySelector('#email').value.trim();
    const pwd = div.querySelector('#password').value;
    if (!name || !email || !pwd) { errEl.textContent = 'Please fill in all fields'; errEl.style.display = 'block'; return; }
    if (pwd.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return; }
    const btn = div.querySelector('#signup-btn');
    btn.textContent = 'Creating…'; btn.disabled = true;
    const { data, error } = await supabase.auth.signUp({ email, password: pwd, options: { data: { display_name: name } } });
    if (error) {
      errEl.textContent = error.message || 'Signup failed';
      errEl.style.display = 'block';
      btn.textContent = 'Create account'; btn.disabled = false;
    }
    // Auth state triggers onboarding
  };
  return div;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
let onboardState = { step: 1, householdName: '', userName: '', emoji: '👩', joinCode: '', mode: 'create', selectedPacks: ['essential'], householdId: null };

function renderOnboard(state) {
  const div = el('div');
  div.style.minHeight = '100%';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  renderOnboardStep(div, onboardState.step, state);
  return div;
}

const EMOJIS = ['👩','👨','👧','👦','👵','👴','🧑','👩‍🦱','👨‍🦱','👩‍🦳','👨‍🦳','👩‍🦰','🧔','🧕'];

function renderOnboardStep(container, step, state) {
  container.innerHTML = '';
  const totalSteps = 4;

  const header = el('div', { style: 'padding:60px 28px 20px;flex-shrink:0' });
  header.innerHTML = `
    <div class="step-dots">
      ${[1,2,3,4].map(i => `<div class="step-dot${i < step ? ' done' : i === step ? ' active' : ''}"></div>`).join('')}
    </div>
  `;
  container.appendChild(header);

  const body = el('div', { style: 'flex:1;padding:0 28px;overflow-y:auto' });
  const footer = el('div', { style: 'padding:20px 28px max(36px,env(safe-area-inset-bottom));flex-shrink:0' });

  if (step === 1) {
    header.querySelector('.step-dots').insertAdjacentHTML('afterend', `
      <div style="font-family:'Fraunces',serif;font-size:30px;font-weight:500;margin-bottom:8px">Let's set up your home</div>
      <div style="color:var(--text-light);font-size:15px">Create a new household or join an existing one.</div>
    `);
    body.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:24px">
        <div class="mode-btn${onboardState.mode === 'create' ? ' selected' : ''}" data-mode="create" style="flex:1;background:white;border:2px solid ${onboardState.mode==='create'?'var(--terra)':'var(--parchment)'};border-radius:16px;padding:18px;cursor:pointer;text-align:center">
          <div style="font-size:28px;margin-bottom:8px">🏠</div>
          <div style="font-weight:600;font-size:14px">Create new</div>
          <div style="font-size:12px;color:var(--text-light)">Start fresh</div>
        </div>
        <div class="mode-btn${onboardState.mode === 'join' ? ' selected' : ''}" data-mode="join" style="flex:1;background:white;border:2px solid ${onboardState.mode==='join'?'var(--terra)':'var(--parchment)'};border-radius:16px;padding:18px;cursor:pointer;text-align:center">
          <div style="font-size:28px;margin-bottom:8px">🔑</div>
          <div style="font-weight:600;font-size:14px">Join existing</div>
          <div style="font-size:12px;color:var(--text-light)">Have an invite code</div>
        </div>
      </div>
      ${onboardState.mode === 'create' ? `
        <div class="input-group">
          <label class="input-label">Household name</label>
          <input class="input" id="hname" value="${onboardState.householdName}" placeholder="e.g. The Smith Home" />
        </div>
      ` : `
        <div class="input-group">
          <label class="input-label">Invite code</label>
          <input class="input" id="hcode" value="${onboardState.joinCode}" placeholder="e.g. AB12CD" style="text-transform:uppercase;letter-spacing:4px;font-size:20px;text-align:center" />
        </div>
      `}
      <div class="input-group">
        <label class="input-label">Your name</label>
        <input class="input" id="uname" value="${onboardState.userName}" placeholder="e.g. Sarah" />
      </div>
      <div class="input-group">
        <label class="input-label">Your avatar</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${EMOJIS.map(e => `<button class="emoji-pick" data-emoji="${e}" style="width:44px;height:44px;border-radius:50%;background:${onboardState.emoji===e?'var(--terra-pale)':'var(--cream-dark)'};border:2px solid ${onboardState.emoji===e?'var(--terra)':'transparent'};font-size:22px;cursor:pointer;transition:all 0.15s">${e}</button>`).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.mode-btn').forEach(b => {
      b.onclick = () => { onboardState.mode = b.dataset.mode; renderOnboardStep(container, step, state); };
    });
    body.querySelectorAll('.emoji-pick').forEach(b => {
      b.onclick = () => { onboardState.emoji = b.dataset.emoji; renderOnboardStep(container, step, state); };
    });

    footer.innerHTML = `<button class="btn btn-terra btn-full" id="next">Continue →</button>`;
    footer.querySelector('#next').onclick = async () => {
      const hname = body.querySelector('#hname')?.value?.trim();
      const hcode = body.querySelector('#hcode')?.value?.trim();
      const uname = body.querySelector('#uname')?.value?.trim();
      if (onboardState.mode === 'create' && !hname) { showToast('Please enter a household name'); return; }
      if (onboardState.mode === 'join' && !hcode) { showToast('Please enter an invite code'); return; }
      if (!uname) { showToast('Please enter your name'); return; }
      onboardState.householdName = hname || '';
      onboardState.joinCode = hcode || '';
      onboardState.userName = uname;
      onboardState.step = onboardState.mode === 'join' ? 3 : 2;
      renderOnboardStep(container, onboardState.step, state);
    };
  }

  else if (step === 2) {
    header.querySelector('.step-dots').insertAdjacentHTML('afterend', `
      <div style="font-family:'Fraunces',serif;font-size:30px;font-weight:500;margin-bottom:8px">Pick starter packs</div>
      <div style="color:var(--text-light);font-size:15px">We'll add these tasks automatically. Edit anytime.</div>
    `);
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
      ${Object.entries(STARTER_PACKS).map(([id, pack]) => `
        <div class="pack-card${onboardState.selectedPacks.includes(id) ? ' sel' : ''}" data-id="${id}" style="background:white;border:2px solid ${onboardState.selectedPacks.includes(id)?'var(--terra)':'var(--parchment)'};border-radius:20px;padding:16px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.2s;${onboardState.selectedPacks.includes(id)?'background:var(--terra-pale)':''}">
          <div style="width:48px;height:48px;background:${onboardState.selectedPacks.includes(id)?'rgba(196,103,58,0.15)':'var(--cream-dark)'};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${pack.emoji}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:15px">${pack.name}</div>
            <div style="font-size:12px;color:var(--text-light)">${pack.tasks.length} tasks</div>
          </div>
          <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${onboardState.selectedPacks.includes(id)?'var(--terra)':'var(--parchment)'};background:${onboardState.selectedPacks.includes(id)?'var(--terra)':'white'};display:flex;align-items:center;justify-content:center;font-size:13px">
            ${onboardState.selectedPacks.includes(id) ? '✓' : ''}
          </div>
        </div>
      `).join('')}
      <div style="height:8px"></div>
    </div>`;

    body.querySelectorAll('.pack-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        const idx = onboardState.selectedPacks.indexOf(id);
        if (idx >= 0) onboardState.selectedPacks.splice(idx, 1);
        else onboardState.selectedPacks.push(id);
        renderOnboardStep(container, step, state);
      };
    });

    footer.innerHTML = `
      <button class="btn btn-terra btn-full" id="next">Continue →</button>
      <button class="btn btn-outline btn-full" id="back" style="margin-top:10px">Back</button>
    `;
    footer.querySelector('#next').onclick = () => { onboardState.step = 3; renderOnboardStep(container, 3, state); };
    footer.querySelector('#back').onclick = () => { onboardState.step = 1; renderOnboardStep(container, 1, state); };
  }

  else if (step === 3) {
    header.querySelector('.step-dots').insertAdjacentHTML('afterend', `
      <div style="font-family:'Fraunces',serif;font-size:30px;font-weight:500;margin-bottom:8px">Almost there!</div>
      <div style="color:var(--text-light);font-size:15px">Setting up your household…</div>
    `);

    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:32px 0;gap:16px">
      <div class="spinner"></div>
      <div id="setup-msg" style="color:var(--text-light);font-size:14px">Creating your household…</div>
    </div>`;

    // Do setup
    (async () => {
      const userId = supabase.auth.getUser()?.id;
      if (!userId) { showToast('Session expired. Please sign in again.'); navigate('login'); return; }
      const msgEl = body.querySelector('#setup-msg');

      let householdId;

      if (onboardState.mode === 'join') {
        msgEl.textContent = 'Finding household…';
        const { data: hh, error } = await getHouseholdByCode(onboardState.joinCode);
        if (error || !hh) { showToast('Invalid invite code'); onboardState.step = 1; renderOnboardStep(container, 1, state); return; }
        householdId = hh.id;
      } else {
        msgEl.textContent = 'Creating household…';
        const { data: hh, error } = await createHousehold(onboardState.householdName, userId);
        if (error) { showToast('Error creating household'); return; }
        householdId = hh?.id || hh?.[0]?.id;
      }

      msgEl.textContent = 'Adding you as a member…';
      await createMember({ userId, householdId, displayName: onboardState.userName, emoji: onboardState.emoji });

      if (onboardState.mode === 'create' && onboardState.selectedPacks.length) {
        msgEl.textContent = 'Installing starter packs…';
        await installStarterPacks(onboardState.selectedPacks, householdId);
      }

      msgEl.textContent = 'Loading your dashboard…';
      await upsertProfile(userId, { household_id: householdId, display_name: onboardState.userName, emoji: onboardState.emoji });
      await bootstrapUser(userId, householdId);
    })();
  }

  container.appendChild(header);
  container.appendChild(body);
  container.appendChild(footer);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
let dashTab = 'today';
let dashSection = null; // family | schedule | rewards | settings

function renderDashboard(state) {
  if (dashSection) {
    return renderDashSection(dashSection, state);
  }

  const div = el('div');
  div.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden';

  // Top header
  const todayTasks = getTodaysTasks(state);
  const completedToday = todayTasks.filter(t => isCompletedToday(t.id, state)).length;
  const member = state.currentMember;
  const streak = member ? getStreak(member.id, state) : 0;
  const pts = member ? getMemberPoints(member.id, state) : 0;

  const header = el('div');
  header.style.cssText = 'background:linear-gradient(160deg,var(--terra) 0%,#9E4E1C 100%);padding:max(52px,env(safe-area-inset-top)) 22px 0;flex-shrink:0;border-radius:0 0 32px 32px';
  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:500;color:white;line-height:1.2">${getGreeting()}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:2px">${state.household?.name || 'Your Home'}</div>
      </div>
      <div id="avatar-btn" style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid rgba(255,255,255,0.3);cursor:pointer">${member?.emoji || '🙂'}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px">
      ${statPill('🔥', streak, 'streak')}
      ${statPill('⭐', pts, 'pts')}
      ${statPill('✅', `${completedToday}/${todayTasks.length}`, 'today')}
    </div>
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.15)">
      ${['today','upcoming','all'].map(t => `
        <div class="dash-tab" data-tab="${t}" style="flex:1;text-align:center;padding:12px 0 14px;font-size:14px;font-weight:500;color:${dashTab===t?'white':'rgba(255,255,255,0.55)'};cursor:pointer;position:relative">
          ${t.charAt(0).toUpperCase()+t.slice(1)}
          ${dashTab===t?'<div style="position:absolute;bottom:-1px;left:25%;right:25%;height:2px;background:white;border-radius:2px"></div>':''}
        </div>
      `).join('')}
    </div>
  `;

  header.querySelector('#avatar-btn').onclick = () => { dashSection = 'profile'; appStore.set({}); };
  header.querySelectorAll('.dash-tab').forEach(t => {
    t.onclick = () => { dashTab = t.dataset.tab; appStore.set({}); };
  });

  // Body
  const body = el('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:16px 18px 110px';
  body.appendChild(renderTabContent(dashTab, state));

  // FAB
  const fab = el('button');
  fab.style.cssText = 'position:fixed;bottom:90px;right:20px;width:58px;height:58px;background:var(--terra);border-radius:50%;border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(196,103,58,0.45);cursor:pointer;z-index:150;font-size:28px;color:white;transition:transform 0.15s';
  fab.innerHTML = '+';
  fab.onclick = () => showAddTaskModal(state);

  // Bottom nav
  const nav = renderBottomNav('home');

  div.appendChild(header);
  div.appendChild(body);
  div.appendChild(fab);
  div.appendChild(nav);
  return div;
}

function statPill(icon, val, label) {
  return `<div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);border-radius:100px;padding:9px 14px;display:flex;align-items:center;gap:7px;flex:1">
    <span style="font-size:15px">${icon}</span>
    <div>
      <div style="font-size:14px;font-weight:600;color:white;line-height:1">${val}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.7)">${label}</div>
    </div>
  </div>`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤';
  return 'Good evening 🌙';
}

function renderTabContent(tab, state) {
  const div = el('div');
  if (tab === 'today') {
    const tasks = getTodaysTasks(state);
    const overdue = tasks.filter(t => { const d = new Date(t.next_due); d.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); return d < today; });
    const due = tasks.filter(t => { const d = new Date(t.next_due); d.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); return d.getTime() === today.getTime(); });
    const done = tasks.filter(t => isCompletedToday(t.id, state));

    if (!tasks.length) {
      div.innerHTML = `<div class="empty-state"><div class="emoji">🎉</div><h3>All clear!</h3><p>Nothing due today. Tap + to add a chore.</p></div>`;
    } else {
      if (overdue.length) {
        div.appendChild(sectionLabel('Overdue'));
        overdue.forEach(t => !isCompletedToday(t.id, state) && div.appendChild(renderTaskCard(t, state, true)));
      }
      const duePending = due.filter(t => !isCompletedToday(t.id, state));
      if (duePending.length) {
        div.appendChild(sectionLabel('Due today'));
        duePending.forEach(t => div.appendChild(renderTaskCard(t, state, false)));
      }
      if (done.length) {
        div.appendChild(sectionLabel(`Completed today (${done.length})`));
        done.forEach(t => div.appendChild(renderTaskCard(t, state, false)));
      }
    }

    // Leaderboard preview
    div.appendChild(sectionLabel('This week'));
    div.appendChild(renderLeaderboardCard(state));

  } else if (tab === 'upcoming') {
    const tasks = getUpcomingTasks(state);
    if (!tasks.length) {
      div.innerHTML = `<div class="empty-state"><div class="emoji">📅</div><h3>Nothing upcoming</h3><p>Your schedule looks clear for the next two weeks.</p></div>`;
    } else {
      let lastDate = null;
      tasks.forEach(t => {
        const dateStr = formatDueDate(t.next_due);
        if (dateStr !== lastDate) { div.appendChild(sectionLabel(dateStr)); lastDate = dateStr; }
        div.appendChild(renderTaskCard(t, state, false));
      });
    }
  } else if (tab === 'all') {
    const groups = {};
    state.tasks.forEach(t => {
      const g = t.recurrence || 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    const order = ['daily','weekly','biweekly','monthly','quarterly','biannual','annual','once','other'];
    order.forEach(g => {
      if (!groups[g]?.length) return;
      const labels = { daily:'Daily', weekly:'Weekly', biweekly:'Every 2 weeks', monthly:'Monthly', quarterly:'Quarterly', biannual:'Every 6 months', annual:'Annual', once:'One-off', other:'Other' };
      div.appendChild(sectionLabel(`${labels[g]} (${groups[g].length})`));
      groups[g].forEach(t => div.appendChild(renderTaskCard(t, state, false)));
    });
    if (!state.tasks.length) div.innerHTML = `<div class="empty-state"><div class="emoji">📋</div><h3>No chores yet</h3><p>Add tasks using the + button, or go back and set up starter packs.</p></div>`;
  }
  return div;
}

function renderTaskCard(task, state, isOverdue) {
  const done = isCompletedToday(task.id, state);
  const card = el('div');
  card.style.cssText = `background:white;border-radius:18px;padding:14px 16px;margin-bottom:9px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 10px var(--shadow);transition:transform 0.15s,opacity 0.2s;cursor:pointer;position:relative;overflow:hidden;${isOverdue && !done?'border-left:3px solid var(--rose)':''}${done?'opacity:0.55':''}`;

  const assignee = task.assigned_to ? state.members.find(m => m.id === task.assigned_to) : null;

  card.innerHTML = `
    <div class="task-check-btn" style="width:30px;height:30px;border-radius:50%;border:2px solid ${done?'var(--sage)':'var(--parchment)'};background:${done?'var(--sage)':'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)">
      ${done ? '<span style="color:white;font-size:14px">✓</span>' : ''}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:15px;font-weight:500;color:${done?'var(--text-light)':'var(--text)'};${done?'text-decoration:line-through':''}; white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${task.title}</div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:3px;flex-wrap:wrap">
        <span class="cat-pill cat-${task.category}">${task.category}</span>
        <span style="font-size:12px;color:${isOverdue && !done?'var(--rose)':'var(--text-light)'};font-weight:${isOverdue && !done?'500':'400'}">${isOverdue && !done ? daysOverdue(task.next_due) : formatRecurrence(task.recurrence)}</span>
        ${assignee ? `<span style="font-size:12px">${assignee.emoji} ${assignee.display_name}</span>` : ''}
      </div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--terra);background:var(--terra-pale);padding:5px 9px;border-radius:8px;flex-shrink:0">${task.points || 5}pts</div>
  `;

  const checkBtn = card.querySelector('.task-check-btn');
  checkBtn.onclick = async (e) => {
    e.stopPropagation();
    if (done) return;
    const member = appStore.get().currentMember;
    if (!member) { showToast('No member profile found'); return; }
    spawnConfetti(e);
    showToast(`+${task.points || 5} points! 🎉`);
    await dbCompleteTask(task.id, member.id, task.points || 5, task.household_id);
  };

  card.onclick = () => showTaskDetail(task, state);

  return card;
}

function daysOverdue(dateStr) {
  const due = new Date(dateStr);
  const today = new Date();
  const days = Math.floor((today - due) / 86400000);
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day overdue';
  return `${days} days overdue`;
}

function formatRecurrence(r) {
  const map = { daily:'Daily', weekly:'Weekly', biweekly:'Every 2 weeks', monthly:'Monthly', quarterly:'Every 3 months', biannual:'Every 6 months', annual:'Annual', once:'One-off' };
  return map[r] || r || 'Custom';
}

function formatDueDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  d.setHours(0,0,0,0);
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function renderLeaderboardCard(state) {
  const card = el('div');
  card.className = 'card';
  card.style.padding = '18px';
  card.style.marginBottom = '10px';

  const sorted = [...state.members].map(m => ({
    ...m,
    weekPts: getMemberPoints(m.id, state)
  })).sort((a, b) => b.weekPts - a.weekPts);

  const maxPts = sorted[0]?.weekPts || 1;
  const medals = ['🥇','🥈','🥉'];

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-family:'Fraunces',serif;font-size:20px;font-weight:500">Leaderboard 🏆</div>
      <div style="font-size:12px;color:var(--text-light);background:var(--cream-dark);padding:4px 10px;border-radius:100px">This week</div>
    </div>
    ${sorted.length ? sorted.map((m, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < sorted.length-1?'border-bottom:1px solid var(--cream-dark)':''}">
        <div style="font-size:18px;width:22px;text-align:center">${medals[i] || `${i+1}`}</div>
        <div style="width:38px;height:38px;border-radius:50%;background:var(--cream-dark);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${m.emoji}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:500">${m.display_name}${m.is_child?' ⭐':''}</div>
          <div style="width:80px;height:5px;background:var(--parchment);border-radius:3px;margin-top:5px;overflow:hidden">
            <div style="height:100%;width:${maxPts?Math.round(m.weekPts/maxPts*100):0}%;background:linear-gradient(90deg,var(--terra),var(--terra-light));border-radius:3px;transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1)"></div>
          </div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--terra)">${m.weekPts} pts</div>
      </div>
    `).join('') : '<div style="text-align:center;color:var(--text-light);padding:16px 0;font-size:14px">No completions yet this week</div>'}
  `;

  card.onclick = () => { dashSection = 'family'; appStore.set({}); };
  return card;
}

// ─── Dash Sections (Family, Schedule, Rewards, Settings) ─────────────────────
function renderDashSection(section, state) {
  const div = el('div');
  div.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden';

  const topbar = el('div');
  topbar.style.cssText = 'padding:max(52px,env(safe-area-inset-top)) 22px 18px;flex-shrink:0;background:var(--cream);border-bottom:1px solid var(--cream-dark)';
  topbar.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <button id="back-dash" style="width:38px;height:38px;border-radius:50%;background:var(--cream-dark);border:none;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center">←</button>
      <div style="font-family:'Fraunces',serif;font-size:24px;font-weight:500">${{family:'Family',schedule:'Schedule',rewards:'Rewards',settings:'Settings',profile:'Profile'}[section]}</div>
    </div>
  `;
  topbar.querySelector('#back-dash').onclick = () => { dashSection = null; appStore.set({}); };

  const body = el('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:20px 18px max(90px,env(safe-area-inset-bottom))';

  if (section === 'family') body.appendChild(renderFamilySection(state));
  else if (section === 'schedule') body.appendChild(renderScheduleSection(state));
  else if (section === 'rewards') body.appendChild(renderRewardsSection(state));
  else if (section === 'settings') body.appendChild(renderSettingsSection(state));
  else if (section === 'profile') body.appendChild(renderProfileSection(state));

  div.appendChild(topbar);
  div.appendChild(body);
  div.appendChild(renderBottomNav(section === 'family' ? 'family' : section === 'rewards' ? 'rewards' : section === 'settings' ? 'settings' : 'home'));
  return div;
}

function renderFamilySection(state) {
  const div = el('div');
  const sorted = [...state.members].map(m => ({ ...m, pts: getMemberPoints(m.id, state), streak: getStreak(m.id, state) })).sort((a,b) => b.pts - a.pts);

  div.innerHTML = `
    <div style="font-size:13px;color:var(--text-light);margin-bottom:18px">Household: <strong style="color:var(--terra)">${state.household?.invite_code}</strong> — share this code to invite members</div>
    ${sorted.map((m,i) => `
      <div class="card" style="padding:18px;margin-bottom:12px;display:flex;align-items:center;gap:14px;${m.id === state.currentMember?.id ? 'border:2px solid var(--terra-pale)' : ''}">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--cream-dark);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">${m.emoji}</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:600">${m.display_name} ${m.id === state.currentMember?.id ? '<span style="font-size:11px;color:var(--terra);background:var(--terra-pale);padding:2px 7px;border-radius:100px">You</span>' : ''} ${m.is_child ? '<span style="font-size:11px;color:var(--amber);background:var(--amber-pale);padding:2px 7px;border-radius:100px">Child</span>' : ''}</div>
          <div style="font-size:13px;color:var(--text-light);margin-top:3px">🔥 ${m.streak}-day streak · ${m.pts_total || 0} pts all-time</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:700;color:var(--terra)">${m.pts}</div>
          <div style="font-size:11px;color:var(--text-light)">this week</div>
        </div>
      </div>
    `).join('')}
  `;

  const addBtn = el('button');
  addBtn.className = 'btn btn-terra btn-full';
  addBtn.textContent = '+ Add family member';
  addBtn.style.marginTop = '8px';
  addBtn.onclick = () => showAddMemberModal(state);
  div.appendChild(addBtn);

  // Child mode switcher
  const childAccounts = state.members.filter(m => m.is_child);
  if (childAccounts.length) {
    const sep = el('div');
    sep.style.cssText = 'margin:24px 0 16px;font-family:Fraunces,serif;font-size:18px;font-weight:500';
    sep.textContent = 'Switch to child mode';
    div.appendChild(sep);
    childAccounts.forEach(child => {
      const btn = el('button');
      btn.className = 'btn btn-outline btn-full';
      btn.style.marginBottom = '10px';
      btn.innerHTML = `${child.emoji} ${child.display_name}'s view`;
      btn.onclick = () => {
        appStore.set({ childMode: true, childMember: child });
        dashSection = null;
      };
      div.appendChild(btn);
    });
  }

  return div;
}

function renderScheduleSection(state) {
  const div = el('div');
  // Group tasks by next_due
  const upcoming = [...state.tasks].sort((a,b) => new Date(a.next_due || '9999') - new Date(b.next_due || '9999'));
  if (!upcoming.length) {
    div.innerHTML = `<div class="empty-state"><div class="emoji">📅</div><h3>No tasks yet</h3><p>Add tasks using the + button on the home screen.</p></div>`;
    return div;
  }
  let lastDate = null;
  upcoming.forEach(t => {
    if (!t.next_due) return;
    const d = new Date(t.next_due);
    const dStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (dStr !== lastDate) { div.appendChild(sectionLabel(dStr)); lastDate = dStr; }
    div.appendChild(renderTaskCard(t, state, new Date(t.next_due) < new Date()));
  });
  return div;
}

function renderRewardsSection(state) {
  const div = el('div');
  const member = state.currentMember;
  if (member) {
    const pts = member.points_total || 0;
    div.innerHTML += `
      <div class="card" style="padding:22px;margin-bottom:20px;background:linear-gradient(135deg,var(--terra),#9E4E1C);color:white;text-align:center">
        <div style="font-size:48px;margin-bottom:8px">${member.emoji}</div>
        <div style="font-family:Fraunces,serif;font-size:28px;font-weight:500">${pts} points</div>
        <div style="font-size:14px;opacity:0.8;margin-top:4px">${member.display_name}'s total</div>
      </div>
    `;
  }

  const childMembers = state.members.filter(m => m.is_child);
  if (childMembers.length) {
    div.appendChild(sectionLabel('Child rewards'));
    childMembers.forEach(child => {
      const childPts = child.points_total || 0;
      const rewardCard = el('div');
      rewardCard.className = 'card';
      rewardCard.style.cssText = 'padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px';
      rewardCard.innerHTML = `
        <div style="font-size:32px">${child.emoji}</div>
        <div style="flex:1">
          <div style="font-weight:600">${child.display_name}</div>
          <div style="font-size:13px;color:var(--text-light)">${childPts} pts earned</div>
        </div>
        <button class="btn btn-sm btn-terra" id="add-reward-${child.id}">Set reward</button>
      `;
      rewardCard.querySelector(`#add-reward-${child.id}`).onclick = () => showAddRewardModal(child, state);
      div.appendChild(rewardCard);
    });
  }

  const addBtn = el('button');
  addBtn.className = 'btn btn-outline btn-full';
  addBtn.style.marginTop = '12px';
  addBtn.textContent = '+ Create reward';
  addBtn.onclick = () => showAddRewardModal(null, state);
  div.appendChild(addBtn);

  return div;
}

function renderSettingsSection(state) {
  const div = el('div');
  div.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      ${settingsRow('🏠', 'Household', state.household?.name || '—')}
      ${settingsRow('🔑', 'Invite code', state.household?.invite_code || '—')}
    </div>
    <div class="card" style="margin-bottom:16px">
      ${settingsRow('👤', 'Your name', state.currentMember?.display_name || '—')}
      ${settingsRow('✉️', 'Email', state.user?.email || '—')}
    </div>
  `;

  const signOutBtn = el('button');
  signOutBtn.className = 'btn btn-outline btn-full';
  signOutBtn.textContent = 'Sign out';
  signOutBtn.style.marginTop = '8px';
  signOutBtn.onclick = async () => {
    await supabase.auth.signOut();
    onboardState = { step: 1, householdName: '', userName: '', emoji: '👩', joinCode: '', mode: 'create', selectedPacks: ['essential'], householdId: null };
    appStore.set({ session: null, user: null, household: null, members: [], tasks: [], completions: [], currentMember: null, screen: 'welcome' });
  };
  div.appendChild(signOutBtn);
  return div;
}

function settingsRow(icon, label, value) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--cream-dark)">
    <span style="font-size:20px">${icon}</span>
    <div style="flex:1">
      <div style="font-size:12px;color:var(--text-light)">${label}</div>
      <div style="font-size:15px;font-weight:500;color:var(--text)">${value}</div>
    </div>
  </div>`;
}

function renderProfileSection(state) {
  return renderSettingsSection(state);
}

// ─── Child Dashboard ──────────────────────────────────────────────────────────
function renderChildDashboard(state) {
  const child = state.childMember;
  const myTasks = getTodaysTasks(state).filter(t => !t.assigned_to || t.assigned_to === child.id);
  const pts = child.points_total || 0;
  const div = el('div');
  div.className = 'screen active';
  div.style.cssText = 'background:linear-gradient(160deg,#FFF3E8 0%,var(--cream) 100%);display:flex;flex-direction:column;min-height:100%';

  div.innerHTML = `
    <div style="padding:max(52px,env(safe-area-inset-top)) 24px 24px;text-align:center">
      <div style="font-size:64px;margin-bottom:8px">${child.emoji}</div>
      <div style="font-family:'Fraunces',serif;font-size:28px;font-weight:500">${child.display_name}'s Chores</div>
      <div style="margin:16px auto;background:var(--terra);color:white;padding:12px 24px;border-radius:100px;display:inline-flex;align-items:center;gap:8px;font-size:18px;font-weight:700">⭐ ${pts} points</div>
    </div>
    <div style="flex:1;padding:0 18px 120px;overflow-y:auto" id="child-tasks">
      ${myTasks.length ? '' : '<div class="empty-state"><div class="emoji">🎉</div><h3>All done!</h3><p>You finished all your chores!</p></div>'}
    </div>
    <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;padding:16px 24px max(24px,env(safe-area-inset-bottom));background:white;border-top:1px solid var(--parchment);display:flex;gap:12px">
      <button class="btn btn-outline" style="flex:1" id="exit-child">← Parent view</button>
    </div>
  `;

  const tasksContainer = div.querySelector('#child-tasks');
  myTasks.forEach(task => {
    const done = isCompletedToday(task.id, state);
    const card = el('div');
    card.style.cssText = `background:white;border-radius:22px;padding:20px;margin-bottom:14px;text-align:center;box-shadow:0 4px 16px var(--shadow);transition:transform 0.15s;${done?'opacity:0.6':''}`;
    card.innerHTML = `
      <div style="font-size:40px;margin-bottom:10px">${catEmoji(task.category)}</div>
      <div style="font-size:18px;font-weight:600;margin-bottom:6px;${done?'text-decoration:line-through;color:var(--text-light)':''}">${task.title}</div>
      <div style="font-size:14px;color:var(--text-light);margin-bottom:14px">${done ? '✅ Done!' : `Worth ${task.points || 5} ⭐`}</div>
      ${done ? '' : `<button class="btn btn-sage btn-full" id="done-${task.id}" style="font-size:18px">I did it! 🙌</button>`}
    `;
    if (!done) {
      card.querySelector(`#done-${task.id}`).onclick = async (e) => {
        spawnConfetti(e);
        showToast(`+${task.points || 5} ⭐ Great job!`);
        await dbCompleteTask(task.id, child.id, task.points || 5, task.household_id);
        appStore.set({ childMember: { ...child, points_total: (child.points_total || 0) + (task.points || 5) } });
      };
    }
    tasksContainer.appendChild(card);
  });

  div.querySelector('#exit-child').onclick = () => appStore.set({ childMode: false, childMember: null });
  return div;
}

function catEmoji(cat) {
  const map = { home:'🧹', pet:'🐾', health:'❤️', outdoor:'🌿', family:'👨‍👩‍👧', vehicle:'🚗' };
  return map[cat] || '📋';
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function showAddTaskModal(state) {
  const overlay = el('div', { class: 'modal-overlay' });
  const sheet = el('div', { class: 'modal-sheet' });
  sheet.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Add a chore</div>
    <div class="input-group">
      <label class="input-label">Task name</label>
      <input class="input" id="t-name" placeholder="e.g. Vacuum downstairs" />
    </div>
    <div style="display:flex;gap:12px">
      <div class="input-group" style="flex:1">
        <label class="input-label">Category</label>
        <select class="input" id="t-cat">
          <option value="home">🧹 Home</option>
          <option value="pet">🐾 Pet</option>
          <option value="outdoor">🌿 Outdoor</option>
          <option value="health">❤️ Health</option>
          <option value="family">👨‍👩‍👧 Family</option>
          <option value="vehicle">🚗 Vehicle</option>
        </select>
      </div>
      <div class="input-group" style="flex:1">
        <label class="input-label">Points</label>
        <input class="input" id="t-pts" type="number" value="10" min="1" max="100" />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">How often?</label>
      <select class="input" id="t-rec">
        <option value="daily">Daily</option>
        <option value="weekly" selected>Weekly</option>
        <option value="biweekly">Every 2 weeks</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Every 3 months</option>
        <option value="biannual">Every 6 months</option>
        <option value="annual">Annual</option>
        <option value="once">One-off</option>
      </select>
    </div>
    <div class="input-group">
      <label class="input-label">Assign to</label>
      <select class="input" id="t-assign">
        <option value="">Anyone</option>
        ${state.members.map(m => `<option value="${m.id}">${m.emoji} ${m.display_name}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn btn-outline" style="flex:1" id="cancel">Cancel</button>
      <button class="btn btn-terra" style="flex:1" id="save">Add chore</button>
    </div>
  `;

  sheet.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  sheet.querySelector('#save').onclick = async () => {
    const title = sheet.querySelector('#t-name').value.trim();
    if (!title) { showToast('Please enter a task name'); return; }
    const rec = sheet.querySelector('#t-rec').value;
    const nextDue = calcNextDue(rec);
    await createTask({
      household_id: state.household.id,
      title,
      category: sheet.querySelector('#t-cat').value,
      recurrence: rec,
      points: parseInt(sheet.querySelector('#t-pts').value) || 10,
      assigned_to: sheet.querySelector('#t-assign').value || null,
      next_due: nextDue || new Date().toISOString().split('T')[0],
    });
    overlay.remove();
    showToast('Chore added! ✅');
  };

  overlay.appendChild(sheet);
  root.appendChild(overlay);
}

function showTaskDetail(task, state) {
  const overlay = el('div', { class: 'modal-overlay' });
  const sheet = el('div', { class: 'modal-sheet' });
  const assignee = task.assigned_to ? state.members.find(m => m.id === task.assigned_to) : null;

  sheet.innerHTML = `
    <div class="modal-handle"></div>
    <div style="font-family:'Fraunces',serif;font-size:24px;font-weight:500;margin-bottom:6px">${task.title}</div>
    <div style="display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap">
      <span class="cat-pill cat-${task.category}">${task.category}</span>
      <span style="font-size:13px;color:var(--text-light);display:flex;align-items:center">${formatRecurrence(task.recurrence)}</span>
      ${assignee ? `<span style="font-size:13px">${assignee.emoji} ${assignee.display_name}</span>` : ''}
    </div>
    <div class="card" style="padding:16px;margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;color:var(--text-light)">Points per completion</span>
        <span style="font-weight:700;color:var(--terra);font-size:18px">${task.points || 5}</span>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;color:var(--text-light)">Next due</span>
        <span style="font-weight:500">${task.next_due ? new Date(task.next_due).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'N/A'}</span>
      </div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-outline" style="flex:1" id="close">Close</button>
      <button class="btn btn-outline" style="flex:1;color:var(--rose);border-color:var(--rose-pale)" id="del-task">Delete</button>
    </div>
  `;

  sheet.querySelector('#close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  sheet.querySelector('#del-task').onclick = async () => {
    await deleteTask(task.id);
    await loadTasks(state.household.id);
    overlay.remove();
    showToast('Task deleted');
  };

  overlay.appendChild(sheet);
  root.appendChild(overlay);
}

function showAddMemberModal(state) {
  const overlay = el('div', { class: 'modal-overlay' });
  const sheet = el('div', { class: 'modal-sheet' });
  let selectedEmoji = '🧒';

  sheet.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Add family member</div>
    <div style="background:var(--amber-pale);border-radius:12px;padding:14px;margin-bottom:20px;font-size:14px;color:var(--amber)">
      💡 To add an adult, share your invite code: <strong>${state.household?.invite_code}</strong> — they sign up and enter this code.
    </div>
    <div style="font-family:Fraunces,serif;font-size:18px;font-weight:500;margin-bottom:16px">Add a child account</div>
    <div class="input-group">
      <label class="input-label">Child's name</label>
      <input class="input" id="child-name" placeholder="e.g. Lily" />
    </div>
    <div class="input-group">
      <label class="input-label">Avatar</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px" id="child-emojis">
        ${['🧒','👧','👦','🧒‍♀️','🧒‍♂️','🐣','🦄','🐶'].map(e => `<button data-e="${e}" style="width:42px;height:42px;border-radius:50%;background:${e===selectedEmoji?'var(--terra-pale)':'var(--cream-dark)'};border:2px solid ${e===selectedEmoji?'var(--terra)':'transparent'};font-size:22px;cursor:pointer">${e}</button>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn btn-outline" style="flex:1" id="cancel">Cancel</button>
      <button class="btn btn-terra" style="flex:1" id="add-child">Add child</button>
    </div>
  `;

  sheet.querySelector('#child-emojis').querySelectorAll('button').forEach(b => {
    b.onclick = () => { selectedEmoji = b.dataset.e; sheet.querySelectorAll('#child-emojis button').forEach(x => { x.style.background = x.dataset.e === selectedEmoji ? 'var(--terra-pale)' : 'var(--cream-dark)'; x.style.borderColor = x.dataset.e === selectedEmoji ? 'var(--terra)' : 'transparent'; }); };
  });

  sheet.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  sheet.querySelector('#add-child').onclick = async () => {
    const name = sheet.querySelector('#child-name').value.trim();
    if (!name) { showToast('Please enter a name'); return; }
    const userId = supabase.auth.getUser()?.id;
    await createMember({ userId: `child_${Date.now()}`, householdId: state.household.id, displayName: name, emoji: selectedEmoji, isChild: true, parentId: state.currentMember?.id });
    await loadMembers(state.household.id);
    overlay.remove();
    showToast(`${selectedEmoji} ${name} added!`);
  };

  overlay.appendChild(sheet);
  root.appendChild(overlay);
}

function showAddRewardModal(child, state) {
  const overlay = el('div', { class: 'modal-overlay' });
  const sheet = el('div', { class: 'modal-sheet' });

  sheet.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Set a reward${child ? ` for ${child.display_name}` : ''}</div>
    <div class="input-group">
      <label class="input-label">Reward name</label>
      <input class="input" id="r-name" placeholder="e.g. Movie night, Extra screen time" />
    </div>
    <div class="input-group">
      <label class="input-label">Points needed</label>
      <input class="input" id="r-pts" type="number" value="100" min="1" />
    </div>
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn btn-outline" style="flex:1" id="cancel">Cancel</button>
      <button class="btn btn-terra" style="flex:1" id="save">Save reward</button>
    </div>
  `;

  sheet.querySelector('#cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  sheet.querySelector('#save').onclick = async () => {
    const title = sheet.querySelector('#r-name').value.trim();
    const pts = parseInt(sheet.querySelector('#r-pts').value);
    if (!title) { showToast('Please enter a reward name'); return; }
    await createReward({ householdId: state.household.id, title, pointsRequired: pts, assignedTo: child?.id, emoji: '🎁' });
    overlay.remove();
    showToast('Reward created! 🎁');
  };

  overlay.appendChild(sheet);
  root.appendChild(overlay);
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function renderBottomNav(active) {
  const nav = el('nav', { class: 'bottom-nav' });
  const items = [
    { id: 'home', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', label: 'Home' },
    { id: 'schedule', icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', label: 'Schedule' },
    { id: 'family', icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>', label: 'Family' },
    { id: 'rewards', icon: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>', label: 'Rewards' },
    { id: 'settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>', label: 'More' },
  ];
  items.forEach(item => {
    const btn = el('button', { class: `nav-item${item.id === active ? ' active' : ''}` });
    btn.innerHTML = `<svg viewBox="0 0 24 24">${item.icon}</svg><div class="nav-label">${item.label}</div>`;
    btn.onclick = () => {
      if (item.id === 'home') { dashSection = null; dashTab = 'today'; }
      else dashSection = item.id;
      appStore.set({});
    };
    nav.appendChild(btn);
  });
  return nav;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  });
  return e;
}

function sectionLabel(text) {
  const d = el('div', { class: 'section-label' });
  d.textContent = text;
  return d;
}

function renderToast(msg) {
  const t = el('div', { class: 'toast' });
  t.textContent = msg;
  return t;
}

function spawnConfetti(e) {
  const colors = ['#C4673A','#7A8C6E','#E07B4A','#4A3728','#A8B89A'];
  const rect = e.target.getBoundingClientRect();
  const burst = el('div', { class: 'confetti-burst' });
  burst.style.cssText = `left:${rect.left + rect.width/2}px;top:${rect.top + rect.height/2}px`;
  for (let i = 0; i < 16; i++) {
    const p = el('div', { class: 'confetti-piece' });
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 30 + Math.random() * 60;
    p.style.cssText = `background:${colors[i%colors.length]};width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;border-radius:${Math.random()>.5?'50%':'2px'};--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;--rot:${Math.random()*360}deg;animation-delay:${Math.random()*0.08}s`;
    burst.appendChild(p);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrapUser(userId, householdId) {
  await loadHousehold(householdId);
  await loadMembers(householdId);
  await loadTasks(householdId);
  await loadCompletions(householdId);
  const { data: member } = await getMemberByUserId(userId, householdId);
  appStore.set({ currentMember: member, screen: 'dashboard', loading: false });
}

async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Auth listener
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      appStore.set({ session, user: session.user, loading: true });
      // Check if user has a household
      const userId = session.user.id;
      const { data: profile } = await getUserProfile(userId);
      if (profile?.household_id) {
        await bootstrapUser(userId, profile.household_id);
      } else {
        // New user - go to onboarding
        const displayName = session.user.user_metadata?.display_name || '';
        onboardState.userName = displayName;
        appStore.set({ loading: false, screen: 'onboard' });
      }
    } else if (event === 'SIGNED_OUT') {
      appStore.set({ session: null, user: null, screen: 'welcome', loading: false });
    }
  });

  // Initial check
  const { data: { session } } = supabase.auth.getSession();
  if (!session) {
    appStore.set({ loading: false, screen: 'welcome' });
  }
}

// Floating pulse animation
const style = document.createElement('style');
style.textContent = `@keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`;
document.head.appendChild(style);

init();
