import Purchases, { LOG_LEVEL } from 'react-native-purchases'
import { Platform } from 'react-native'

const REVENUECAT_API_KEY = Platform.select({
  ios:     process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '',
}) ?? ''

export async function initializePurchases(userId: string) {
  if (!REVENUECAT_API_KEY) {
    if (__DEV__) console.warn('[Purchases] No RevenueCat API key found.')
    return
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId })
  if (__DEV__) console.log('[Purchases] Initialized for user:', userId)
}

export async function getOfferings() {
  try {
    return await Purchases.getOfferings()
  } catch (e) {
    console.error('[Purchases] getOfferings failed:', e)
    return null
  }
}

export async function purchasePackage(pkg: any) {
  try {
    return await Purchases.purchasePackage(pkg)
  } catch (e: any) {
    if (!e.userCancelled) {
      console.error('[Purchases] purchasePackage failed:', e)
    }
    throw e
  }
}

export async function restorePurchases() {
  try {
    return await Purchases.restorePurchases()
  } catch (e) {
    console.error('[Purchases] restorePurchases failed:', e)
    throw e
  }
}
