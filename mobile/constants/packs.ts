// ── Chorify starter pack definitions ─────────────────────────────────────────
// Shared between onboarding/packs.tsx and app/(app)/settings/packs.tsx.

import type { Category, Recurrence } from '@/types'

export interface PackTask {
  title:      string
  category:   Category
  recurrence: Recurrence
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
      { title: 'Vacuum all floors',     category: 'home', recurrence: 'weekly'   },
      { title: 'Clean bathrooms',       category: 'home', recurrence: 'weekly'   },
      { title: 'Take out trash',        category: 'home', recurrence: 'weekly'   },
      { title: 'Wash dishes',           category: 'home', recurrence: 'daily'    },
      { title: 'Wipe kitchen counters', category: 'home', recurrence: 'daily'    },
      { title: 'Do laundry',            category: 'home', recurrence: 'weekly'   },
      { title: 'Mop floors',            category: 'home', recurrence: 'biweekly' },
    ],
  },
  {
    id:          'dog',
    name:        'Dog Care',
    emoji:       '🐶',
    description: 'Keep your pup happy and healthy',
    tasks: [
      { title: 'Feed the dog',      category: 'pet',     recurrence: 'daily'   },
      { title: 'Walk the dog',      category: 'pet',     recurrence: 'daily'   },
      { title: 'Clean up the yard', category: 'outdoor', recurrence: 'weekly'  },
      { title: 'Bathe the dog',     category: 'pet',     recurrence: 'monthly' },
    ],
  },
  {
    id:          'cat',
    name:        'Cat Care',
    emoji:       '🐱',
    description: 'Keep your kitty purring',
    tasks: [
      { title: 'Clean the litter box', category: 'pet', recurrence: 'daily'  },
      { title: 'Feed the cat',         category: 'pet', recurrence: 'daily'  },
      { title: 'Brush the cat',        category: 'pet', recurrence: 'weekly' },
    ],
  },
  {
    id:          'parent',
    name:        'Parent Pack',
    emoji:       '👨‍👩‍👧',
    description: 'Keep the family running smoothly',
    tasks: [
      { title: 'Prep school lunches',     category: 'family', recurrence: 'daily' },
      { title: 'School pickup & dropoff', category: 'family', recurrence: 'daily' },
      { title: 'Help with homework',      category: 'family', recurrence: 'daily' },
      { title: 'Bedtime reading',         category: 'family', recurrence: 'daily' },
    ],
  },
  {
    id:          'maintenance',
    name:        'Home Maintenance',
    emoji:       '🔧',
    description: 'Seasonal and periodic home upkeep',
    advanced:    true,
    tasks: [
      { title: 'Replace air filters',      category: 'home', recurrence: 'quarterly' },
      { title: 'Check smoke detectors',    category: 'home', recurrence: 'biannual'  },
      { title: 'Deep clean refrigerator',  category: 'home', recurrence: 'quarterly' },
      { title: 'Clean oven',               category: 'home', recurrence: 'monthly'   },
      { title: 'Inspect roof & gutters',   category: 'home', recurrence: 'biannual'  },
      { title: 'Service HVAC system',      category: 'home', recurrence: 'annual'    },
      { title: 'Flush water heater',       category: 'home', recurrence: 'annual'    },
    ],
  },
  {
    id:          'vehicle',
    name:        'Vehicle Care',
    emoji:       '🚗',
    description: 'Keep your vehicles in top shape',
    advanced:    true,
    tasks: [
      { title: 'Check tyre pressure',     category: 'vehicle', recurrence: 'monthly'   },
      { title: 'Check engine oil',        category: 'vehicle', recurrence: 'monthly'   },
      { title: 'Wash the car',            category: 'vehicle', recurrence: 'biweekly'  },
      { title: 'Oil change',              category: 'vehicle', recurrence: 'quarterly' },
      { title: 'Rotate tyres',            category: 'vehicle', recurrence: 'biannual'  },
      { title: 'Check windshield wipers', category: 'vehicle', recurrence: 'biannual'  },
    ],
  },
  {
    id:          'garden',
    name:        'Garden & Outdoor',
    emoji:       '🌱',
    description: 'Keep your outdoor spaces thriving',
    advanced:    true,
    tasks: [
      { title: 'Mow the lawn',            category: 'outdoor', recurrence: 'weekly'    },
      { title: 'Water plants',            category: 'outdoor', recurrence: 'daily'     },
      { title: 'Weed the garden',         category: 'outdoor', recurrence: 'weekly'    },
      { title: 'Sweep the driveway',      category: 'outdoor', recurrence: 'weekly'    },
      { title: 'Trim hedges',             category: 'outdoor', recurrence: 'monthly'   },
      { title: 'Fertilise lawn',          category: 'outdoor', recurrence: 'quarterly' },
      { title: 'Clean outdoor furniture', category: 'outdoor', recurrence: 'monthly'   },
    ],
  },
]
