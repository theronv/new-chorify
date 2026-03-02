// ── Keptt starter pack definitions ───────────────────────────────────────────
// Shared between onboarding/packs.tsx and app/(app)/settings/packs.tsx.

import type { Category, Recurrence } from '@/types'

export interface PackTask {
  title:      string
  category:   Category
  recurrence: Recurrence
  points:     number
}

export interface Pack {
  id:          string
  name:        string
  emoji:       string
  description: string
  advanced?:   boolean   // shown with "Advanced" badge in Browse Packs
  tasks:       PackTask[]
}

export const PACKS: Pack[] = [
  {
    id:          'essential',
    name:        'Essential Home',
    emoji:       '🏠',
    description: 'Core chores every household needs',
    tasks: [
      { title: 'Vacuum all floors',     category: 'home', recurrence: 'weekly',   points: 15 },
      { title: 'Clean bathrooms',       category: 'home', recurrence: 'weekly',   points: 20 },
      { title: 'Take out trash',        category: 'home', recurrence: 'weekly',   points: 10 },
      { title: 'Wash dishes',           category: 'home', recurrence: 'daily',    points:  5 },
      { title: 'Wipe kitchen counters', category: 'home', recurrence: 'daily',    points:  5 },
      { title: 'Do laundry',            category: 'home', recurrence: 'weekly',   points: 15 },
      { title: 'Mop floors',            category: 'home', recurrence: 'biweekly', points: 20 },
    ],
  },
  {
    id:          'dog',
    name:        'Dog Care',
    emoji:       '🐶',
    description: 'Keep your pup happy and healthy',
    tasks: [
      { title: 'Feed the dog',      category: 'pet',     recurrence: 'daily',   points:  5 },
      { title: 'Walk the dog',      category: 'pet',     recurrence: 'daily',   points: 10 },
      { title: 'Clean up the yard', category: 'outdoor', recurrence: 'weekly',  points: 10 },
      { title: 'Bathe the dog',     category: 'pet',     recurrence: 'monthly', points: 15 },
    ],
  },
  {
    id:          'cat',
    name:        'Cat Care',
    emoji:       '🐱',
    description: 'Keep your kitty purring',
    tasks: [
      { title: 'Clean the litter box', category: 'pet', recurrence: 'daily',  points: 10 },
      { title: 'Feed the cat',         category: 'pet', recurrence: 'daily',  points:  5 },
      { title: 'Brush the cat',        category: 'pet', recurrence: 'weekly', points:  5 },
    ],
  },
  {
    id:          'parent',
    name:        'Parent Pack',
    emoji:       '👨‍👩‍👧',
    description: 'Keep the family running smoothly',
    tasks: [
      { title: 'Prep school lunches',     category: 'family', recurrence: 'daily', points:  5 },
      { title: 'School pickup & dropoff', category: 'family', recurrence: 'daily', points: 10 },
      { title: 'Help with homework',      category: 'family', recurrence: 'daily', points: 10 },
      { title: 'Bedtime reading',         category: 'family', recurrence: 'daily', points:  5 },
    ],
  },
  {
    id:          'maintenance',
    name:        'Home Maintenance',
    emoji:       '🔧',
    description: 'Seasonal and periodic home upkeep',
    advanced:    true,
    tasks: [
      { title: 'Replace air filters',      category: 'home', recurrence: 'quarterly', points: 20 },
      { title: 'Check smoke detectors',    category: 'home', recurrence: 'biannual',  points: 15 },
      { title: 'Deep clean refrigerator',  category: 'home', recurrence: 'quarterly', points: 25 },
      { title: 'Clean oven',               category: 'home', recurrence: 'monthly',   points: 20 },
      { title: 'Inspect roof & gutters',   category: 'home', recurrence: 'biannual',  points: 30 },
      { title: 'Service HVAC system',      category: 'home', recurrence: 'annual',    points: 30 },
      { title: 'Flush water heater',       category: 'home', recurrence: 'annual',    points: 20 },
    ],
  },
  {
    id:          'vehicle',
    name:        'Vehicle Care',
    emoji:       '🚗',
    description: 'Keep your vehicles in top shape',
    advanced:    true,
    tasks: [
      { title: 'Check tyre pressure',      category: 'vehicle', recurrence: 'monthly',   points: 10 },
      { title: 'Check engine oil',         category: 'vehicle', recurrence: 'monthly',   points: 10 },
      { title: 'Wash the car',             category: 'vehicle', recurrence: 'biweekly',  points: 15 },
      { title: 'Oil change',               category: 'vehicle', recurrence: 'quarterly', points: 20 },
      { title: 'Rotate tyres',             category: 'vehicle', recurrence: 'biannual',  points: 20 },
      { title: 'Check windshield wipers',  category: 'vehicle', recurrence: 'biannual',  points: 10 },
    ],
  },
  {
    id:          'garden',
    name:        'Garden & Outdoor',
    emoji:       '🌱',
    description: 'Keep your outdoor spaces thriving',
    advanced:    true,
    tasks: [
      { title: 'Mow the lawn',        category: 'outdoor', recurrence: 'weekly',    points: 20 },
      { title: 'Water plants',        category: 'outdoor', recurrence: 'daily',     points:  5 },
      { title: 'Weed the garden',     category: 'outdoor', recurrence: 'weekly',    points: 15 },
      { title: 'Sweep the driveway',  category: 'outdoor', recurrence: 'weekly',    points: 10 },
      { title: 'Trim hedges',         category: 'outdoor', recurrence: 'monthly',   points: 20 },
      { title: 'Fertilise lawn',      category: 'outdoor', recurrence: 'quarterly', points: 15 },
      { title: 'Clean outdoor furniture', category: 'outdoor', recurrence: 'monthly', points: 15 },
    ],
  },
]
