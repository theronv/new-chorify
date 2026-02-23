import { supabase } from './supabase.js';
import { appStore } from './store.js';

// ─── Households ───────────────────────────────────────────────────────────────
export async function createHousehold(name, userId) {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase.from('households').insert({
    name,
    invite_code: inviteCode,
    owner_id: userId,
  });
  return { data, error };
}

export async function getHouseholdByCode(code) {
  const { data, error } = await supabase.from('households')
    .select('*').eq('invite_code', code.toUpperCase()).single();
  return { data, error };
}

export async function loadHousehold(householdId) {
  const { data, error } = await supabase.from('households')
    .select('*').eq('id', householdId).single();
  if (data) appStore.set({ household: data });
  return { data, error };
}

// ─── Members ──────────────────────────────────────────────────────────────────
export async function createMember({ userId, householdId, displayName, emoji, isChild, parentId }) {
  const { data, error } = await supabase.from('members').insert({
    user_id: userId,
    household_id: householdId,
    display_name: displayName,
    emoji: emoji || '🙂',
    is_child: isChild || false,
    parent_id: parentId || null,
    points_total: 0,
  });
  return { data, error };
}

export async function loadMembers(householdId) {
  const { data, error } = await supabase.from('members')
    .select('*').eq('household_id', householdId).order('created_at');
  if (data) appStore.set({ members: data });
  return { data, error };
}

export async function getMemberByUserId(userId, householdId) {
  const { data, error } = await supabase.from('members')
    .select('*').eq('user_id', userId).eq('household_id', householdId).single();
  return { data, error };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function loadTasks(householdId) {
  const { data, error } = await supabase.from('tasks')
    .select('*').eq('household_id', householdId).order('next_due');
  if (data) appStore.set({ tasks: data });
  return { data, error };
}

export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert(task);
  if (!error) {
    await loadTasks(task.household_id);
  }
  return { data, error };
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id);
  return { data, error };
}

export async function deleteTask(id) {
  const { data, error } = await supabase.from('tasks').delete().eq('id', id);
  return { data, error };
}

export async function completeTask(taskId, memberId, points, householdId) {
  const today = new Date().toISOString().split('T')[0];

  // Record completion
  const { data: comp, error: compError } = await supabase.from('completions').insert({
    task_id: taskId,
    member_id: memberId,
    household_id: householdId,
    completed_date: today,
    completed_at: new Date().toISOString(),
    points: points || 5,
  });

  if (compError) return { error: compError };

  // Advance next_due date
  const state = appStore.get();
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    const nextDue = calcNextDue(task.recurrence, task.recurrence_interval);
    await supabase.from('tasks').update({ next_due: nextDue, last_completed: today }).eq('id', taskId);
  }

  // Update member points
  await supabase.from('members').update({
    points_total: (state.members.find(m => m.id === memberId)?.points_total || 0) + (points || 5)
  }).eq('id', memberId);

  // Reload
  await loadTasks(householdId);
  await loadCompletions(householdId);
  await loadMembers(householdId);

  return { error: null };
}

export function calcNextDue(recurrence, interval = 1) {
  const d = new Date();
  switch (recurrence) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7 * interval); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + interval); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'biannual': d.setMonth(d.getMonth() + 6); break;
    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
    case 'once': return null;
    default: d.setDate(d.getDate() + 7);
  }
  return d.toISOString().split('T')[0];
}

// ─── Completions ──────────────────────────────────────────────────────────────
export async function loadCompletions(householdId) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase.from('completions')
    .select('*')
    .eq('household_id', householdId)
    .order('completed_at', { ascending: false });
  if (data) appStore.set({ completions: data });
  return { data, error };
}

// ─── Rewards ──────────────────────────────────────────────────────────────────
export async function loadRewards(householdId) {
  const { data, error } = await supabase.from('rewards')
    .select('*').eq('household_id', householdId).order('points_required');
  return { data, error };
}

export async function createReward({ householdId, title, pointsRequired, assignedTo, emoji }) {
  const { data, error } = await supabase.from('rewards').insert({
    household_id: householdId,
    title,
    points_required: pointsRequired,
    assigned_to: assignedTo,
    emoji: emoji || '🎁',
  });
  return { data, error };
}

// ─── Starter packs ────────────────────────────────────────────────────────────
export const STARTER_PACKS = {
  essential: {
    name: 'Essential Home',
    emoji: '🧹',
    tasks: [
      { title: 'Vacuum downstairs', category: 'home', recurrence: 'weekly', points: 10 },
      { title: 'Vacuum upstairs', category: 'home', recurrence: 'weekly', points: 10 },
      { title: 'Mop floors', category: 'home', recurrence: 'weekly', points: 10 },
      { title: 'Clean bathrooms', category: 'home', recurrence: 'weekly', points: 15 },
      { title: 'Run dishwasher', category: 'home', recurrence: 'daily', points: 5 },
      { title: 'Wipe kitchen counters', category: 'home', recurrence: 'daily', points: 5 },
      { title: 'Take out trash', category: 'home', recurrence: 'weekly', points: 5 },
      { title: 'Take out recycling', category: 'outdoor', recurrence: 'weekly', points: 5 },
      { title: 'Do laundry', category: 'home', recurrence: 'weekly', points: 10 },
      { title: 'Change bed sheets', category: 'home', recurrence: 'biweekly', points: 10 },
    ]
  },
  maintenance: {
    name: 'Home Maintenance',
    emoji: '🔧',
    tasks: [
      { title: 'Replace HVAC filter', category: 'home', recurrence: 'quarterly', points: 20 },
      { title: 'Test smoke alarms', category: 'health', recurrence: 'biannual', points: 15 },
      { title: 'Test carbon monoxide detectors', category: 'health', recurrence: 'biannual', points: 15 },
      { title: 'Clean refrigerator coils', category: 'home', recurrence: 'biannual', points: 20 },
      { title: 'Deep clean oven', category: 'home', recurrence: 'monthly', points: 20 },
      { title: 'Clean gutters', category: 'outdoor', recurrence: 'biannual', points: 25 },
      { title: 'Check fire extinguisher', category: 'health', recurrence: 'annual', points: 15 },
      { title: 'Flush water heater', category: 'home', recurrence: 'annual', points: 25 },
      { title: 'Inspect roof', category: 'home', recurrence: 'annual', points: 20 },
      { title: 'Service garage door', category: 'home', recurrence: 'annual', points: 15 },
    ]
  },
  dog: {
    name: 'Dog Care',
    emoji: '🐕',
    tasks: [
      { title: 'Walk the dog — morning', category: 'pet', recurrence: 'daily', points: 10 },
      { title: 'Walk the dog — evening', category: 'pet', recurrence: 'daily', points: 10 },
      { title: 'Feed the dog', category: 'pet', recurrence: 'daily', points: 5 },
      { title: 'Refill water bowl', category: 'pet', recurrence: 'daily', points: 3 },
      { title: 'Clean dog bowl', category: 'pet', recurrence: 'weekly', points: 5 },
      { title: 'Monthly flea & tick treatment', category: 'pet', recurrence: 'monthly', points: 15 },
      { title: 'Dog bath / grooming', category: 'pet', recurrence: 'monthly', points: 20 },
      { title: 'Vet annual checkup', category: 'pet', recurrence: 'annual', points: 25 },
      { title: 'Refill pet food', category: 'pet', recurrence: 'biweekly', points: 10 },
    ]
  },
  cat: {
    name: 'Cat Care',
    emoji: '🐱',
    tasks: [
      { title: 'Scoop litter box', category: 'pet', recurrence: 'daily', points: 8 },
      { title: 'Full litter box clean', category: 'pet', recurrence: 'weekly', points: 15 },
      { title: 'Feed the cat', category: 'pet', recurrence: 'daily', points: 5 },
      { title: 'Refill water fountain', category: 'pet', recurrence: 'daily', points: 3 },
      { title: 'Monthly flea treatment', category: 'pet', recurrence: 'monthly', points: 15 },
      { title: 'Vet annual checkup', category: 'pet', recurrence: 'annual', points: 25 },
    ]
  },
  parent: {
    name: 'Parent Pack',
    emoji: '👶',
    tasks: [
      { title: 'Pack school lunches', category: 'family', recurrence: 'daily', points: 8 },
      { title: 'Check school backpacks', category: 'family', recurrence: 'daily', points: 5 },
      { title: 'Tidy kids\' rooms', category: 'home', recurrence: 'daily', points: 5 },
      { title: 'Wash school uniforms', category: 'home', recurrence: 'weekly', points: 10 },
      { title: 'Kids\' bath night', category: 'family', recurrence: 'biweekly', points: 8 },
      { title: 'Review school notes / newsletters', category: 'family', recurrence: 'weekly', points: 5 },
      { title: 'Stock up on school supplies', category: 'family', recurrence: 'monthly', points: 10 },
    ]
  },
  garden: {
    name: 'Garden & Outdoor',
    emoji: '🌱',
    tasks: [
      { title: 'Water houseplants', category: 'outdoor', recurrence: 'weekly', points: 5 },
      { title: 'Water garden / outdoor plants', category: 'outdoor', recurrence: 'weekly', points: 8 },
      { title: 'Mow the lawn', category: 'outdoor', recurrence: 'biweekly', points: 15 },
      { title: 'Pull weeds', category: 'outdoor', recurrence: 'biweekly', points: 12 },
      { title: 'Trim hedges', category: 'outdoor', recurrence: 'monthly', points: 15 },
      { title: 'Seasonal planting', category: 'outdoor', recurrence: 'quarterly', points: 20 },
      { title: 'Fertilise lawn', category: 'outdoor', recurrence: 'quarterly', points: 15 },
      { title: 'Rake leaves', category: 'outdoor', recurrence: 'monthly', points: 12 },
    ]
  },
  vehicle: {
    name: 'Vehicle Care',
    emoji: '🚗',
    tasks: [
      { title: 'Check tyre pressure', category: 'vehicle', recurrence: 'monthly', points: 10 },
      { title: 'Oil change', category: 'vehicle', recurrence: 'quarterly', points: 20 },
      { title: 'Wash car', category: 'vehicle', recurrence: 'monthly', points: 10 },
      { title: 'Check engine oil level', category: 'vehicle', recurrence: 'monthly', points: 8 },
      { title: 'Rotate tyres', category: 'vehicle', recurrence: 'biannual', points: 15 },
      { title: 'Annual service', category: 'vehicle', recurrence: 'annual', points: 25 },
      { title: 'Refill windscreen washer fluid', category: 'vehicle', recurrence: 'monthly', points: 5 },
    ]
  }
};

export async function installStarterPacks(packIds, householdId) {
  const today = new Date().toISOString().split('T')[0];
  const allTasks = [];
  packIds.forEach(id => {
    const pack = STARTER_PACKS[id];
    if (!pack) return;
    pack.tasks.forEach(t => {
      const due = calcNextDueFromNow(t.recurrence);
      allTasks.push({
        household_id: householdId,
        title: t.title,
        category: t.category,
        recurrence: t.recurrence,
        recurrence_interval: 1,
        points: t.points,
        next_due: due,
        created_at: new Date().toISOString(),
      });
    });
  });

  // Insert in batches of 10
  for (let i = 0; i < allTasks.length; i += 10) {
    const batch = allTasks.slice(i, i + 10);
    await supabase.from('tasks').insert(batch);
  }
}

function calcNextDueFromNow(recurrence) {
  const d = new Date();
  switch (recurrence) {
    case 'daily': return d.toISOString().split('T')[0];
    case 'weekly': return d.toISOString().split('T')[0];
    case 'biweekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': return d.toISOString().split('T')[0];
    case 'quarterly': d.setDate(d.getDate() + 7); break;
    case 'biannual': d.setMonth(d.getMonth() + 2); break;
    case 'annual': d.setMonth(d.getMonth() + 6); break;
    default: return d.toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
}

// ─── Profile / User setup ─────────────────────────────────────────────────────
export async function getUserProfile(userId) {
  const { data, error } = await supabase.from('profiles')
    .select('*').eq('user_id', userId).single();
  return { data, error };
}

export async function upsertProfile(userId, patch) {
  // Try update first
  const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', userId).single();
  if (existing) {
    return supabase.from('profiles').update(patch).eq('user_id', userId);
  } else {
    return supabase.from('profiles').insert({ user_id: userId, ...patch });
  }
}
