// ─── Simple Reactive Store ────────────────────────────────────────────────────
class Store {
  constructor(initial) {
    this._state = { ...initial };
    this._listeners = new Set();
  }

  get() { return this._state; }

  set(patch) {
    this._state = { ...this._state, ...(typeof patch === 'function' ? patch(this._state) : patch) };
    this._listeners.forEach(fn => fn(this._state));
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this._state);
    return () => this._listeners.delete(fn);
  }
}

export const appStore = new Store({
  // Auth
  session: null,
  user: null,
  loading: true,

  // Current screen
  screen: 'welcome', // welcome | login | signup | onboard | dashboard | child

  // Household
  household: null,
  members: [],
  currentMember: null, // the profile record for current user

  // Tasks
  tasks: [],
  completions: [], // today's completions

  // Child mode
  childMode: false,
  childMember: null,

  // UI
  activeTab: 'today',
  showAddTask: false,
  showAddMember: false,
  notification: null,
});

// Computed helpers
export function getTodaysTasks(state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  return state.tasks.filter(task => {
    if (!task.next_due) return false;
    const due = new Date(task.next_due);
    due.setHours(0, 0, 0, 0);
    return due <= today;
  }).sort((a, b) => {
    const aOver = new Date(a.next_due) < today;
    const bOver = new Date(b.next_due) < today;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function getUpcomingTasks(state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 14);

  return state.tasks.filter(task => {
    if (!task.next_due) return false;
    const due = new Date(task.next_due);
    due.setHours(0, 0, 0, 0);
    return due > today && due <= nextWeek;
  }).sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
}

export function isCompletedToday(taskId, state) {
  const todayStr = new Date().toISOString().split('T')[0];
  return state.completions.some(c => c.task_id === taskId && c.completed_date === todayStr);
}

export function getMemberPoints(memberId, state) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return state.completions
    .filter(c => c.member_id === memberId && new Date(c.completed_at) >= weekAgo)
    .reduce((sum, c) => sum + (c.points || 0), 0);
}

export function getStreak(memberId, state) {
  if (!state.completions.length) return 0;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const dStr = d.toISOString().split('T')[0];
    const hasCompletion = state.completions.some(
      c => c.member_id === memberId && c.completed_date === dStr
    );
    if (hasCompletion) streak++;
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
