import * as SecureStore from 'expo-secure-store'

export const TIMEZONE_KEY     = 'chorify.timezone'
export const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export interface TimezoneOption {
  label: string
  city:  string
  value: string
}

export const TIMEZONES: TimezoneOption[] = [
  { label: 'Pacific Time',         city: 'Seattle, Los Angeles', value: 'America/Los_Angeles' },
  { label: 'Mountain Time',        city: 'Denver, Calgary',      value: 'America/Denver'      },
  { label: 'Mountain Time (no DST)', city: 'Phoenix',            value: 'America/Phoenix'     },
  { label: 'Central Time',         city: 'Chicago, Dallas',      value: 'America/Chicago'     },
  { label: 'Eastern Time',         city: 'New York, Toronto',    value: 'America/New_York'    },
  { label: 'Atlantic Time',        city: 'Halifax',              value: 'America/Halifax'     },
  { label: 'Alaska Time',          city: 'Anchorage',            value: 'America/Anchorage'   },
  { label: 'Hawaii Time',          city: 'Honolulu',             value: 'Pacific/Honolulu'    },
  { label: 'UTC',                  city: '',                     value: 'UTC'                 },
]

export async function getTimezone(): Promise<string> {
  return (await SecureStore.getItemAsync(TIMEZONE_KEY)) ?? DEFAULT_TIMEZONE
}

export async function saveTimezone(tz: string): Promise<void> {
  await SecureStore.setItemAsync(TIMEZONE_KEY, tz)
}
