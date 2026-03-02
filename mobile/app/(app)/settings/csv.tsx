import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { households as householdsApi, tasks as tasksApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { tasksToCSV, parseTaskRows } from '@/lib/csv'
import type { ParsedTaskRow } from '@/lib/csv'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Category, Recurrence } from '@/types'

interface ImportResult {
  created: number
  updated: number
  skipped: number
}

export default function CsvScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { contentPadding, headerPadding, contentMaxWidth } = useLayout()

  const householdId = useAuthStore((s) => s.householdId)
  const tasks       = useHouseholdStore((s) => s.tasks)
  const rooms       = useHouseholdStore((s) => s.rooms)
  const members     = useHouseholdStore((s) => s.members)
  const addTask     = useHouseholdStore((s) => s.addTask)
  const updateTask  = useHouseholdStore((s) => s.updateTask)

  const [exporting,   setExporting]   = useState(false)
  const [importing,   setImporting]   = useState(false)
  const [lastResult,  setLastResult]  = useState<ImportResult | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function roomIdByName(name: string): string | undefined {
    if (!name) return undefined
    return rooms.find((r) => r.name.toLowerCase() === name.toLowerCase())?.id
  }

  function memberIdByName(name: string): string | undefined {
    if (!name) return undefined
    return members.find((m) => m.display_name.toLowerCase() === name.toLowerCase())?.id
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!tasks.length) {
      Alert.alert('No tasks', 'Add some tasks before exporting.')
      return
    }

    setExporting(true)
    try {
      const csv      = tasksToCSV(tasks, rooms, members)
      const today    = new Date().toISOString().slice(0, 10)
      const filename = `chorify-tasks-${today}.csv`
      const fileUri  = `${FileSystem.cacheDirectory}${filename}`

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      const canShare = await Sharing.isAvailableAsync()
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'File written to app cache — connect a device to retrieve it.')
        return
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:    'text/csv',
        dialogTitle: 'Export Tasks',
        UTI:         'public.comma-separated-values-text',
      })
    } catch (e) {
      Alert.alert('Export failed', 'Could not export tasks. Please try again.')
      console.error('[CSV] Export error:', e)
    } finally {
      setExporting(false)
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!householdId) return
    setLastResult(null)

    let content: string
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type:                ['text/csv', 'text/plain', 'public.comma-separated-values-text'],
        copyToCacheDirectory: true,
      })
      if (picked.canceled) return

      content = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      })
    } catch (e) {
      Alert.alert('Import failed', 'Could not read the file. Make sure it is a valid CSV.')
      console.error('[CSV] Read error:', e)
      return
    }

    const rows = parseTaskRows(content)

    if (!rows.length) {
      Alert.alert(
        'Unrecognised file',
        'No task rows found. Make sure the first row contains column headers including "title".',
      )
      return
    }

    const valid   = rows.filter((r) => r.errors.length === 0)
    const invalid = rows.filter((r) => r.errors.length > 0)

    // Rows with a known task ID → update; everything else → create
    const existingIds = new Set(tasks.map((t) => t.id))
    const toUpdate    = valid.filter((r) => r.id && existingIds.has(r.id))
    const toCreate    = valid.filter((r) => !r.id || !existingIds.has(r.id))

    if (!toCreate.length && !toUpdate.length) {
      const errorSample = invalid
        .slice(0, 3)
        .map((r) => `• ${r.title || '(empty)'}: ${r.errors[0]}`)
        .join('\n')
      Alert.alert(
        'Nothing to import',
        invalid.length
          ? `All ${invalid.length} row${invalid.length !== 1 ? 's' : ''} had validation errors:\n\n${errorSample}`
          : 'No valid tasks found in the file.',
      )
      return
    }

    const lines: string[] = []
    if (toCreate.length) lines.push(`Create ${toCreate.length} new task${toCreate.length !== 1 ? 's' : ''}`)
    if (toUpdate.length) lines.push(`Update ${toUpdate.length} existing task${toUpdate.length !== 1 ? 's' : ''}`)
    if (invalid.length)  lines.push(`Skip ${invalid.length} invalid row${invalid.length !== 1 ? 's' : ''}`)

    Alert.alert('Confirm import', lines.join('\n'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: () => executeImport(toCreate, toUpdate, invalid.length, householdId),
      },
    ])
  }

  async function executeImport(
    toCreate:  ParsedTaskRow[],
    toUpdate:  ParsedTaskRow[],
    skipped:   number,
    hid:       string,
  ) {
    setImporting(true)
    let created = 0
    let updated = 0
    let failed  = 0

    const createResults = await Promise.allSettled(
      toCreate.map((r) =>
        householdsApi.createTask(hid, {
          title:      r.title,
          category:   r.category  as Category,
          recurrence: r.recurrence as Recurrence,
          points:     r.points,
          roomId:     roomIdByName(r.room),
          assignedTo: memberIdByName(r.assignedTo),
          nextDue:    r.nextDue   || undefined,
          notes:      r.notes     || undefined,
        }),
      ),
    )

    createResults.forEach((res) => {
      if (res.status === 'fulfilled') { addTask(res.value.task); created++ }
      else                            { failed++ }
    })

    const updateResults = await Promise.allSettled(
      toUpdate.map((r) =>
        tasksApi.update(r.id, {
          title:      r.title,
          category:   r.category  as Category,
          recurrence: r.recurrence as Recurrence,
          points:     r.points,
          roomId:     roomIdByName(r.room)     ?? null,
          assignedTo: memberIdByName(r.assignedTo) ?? null,
          nextDue:    r.nextDue || null,
          notes:      r.notes   || null,
        }),
      ),
    )

    updateResults.forEach((res, i) => {
      if (res.status === 'fulfilled') { updateTask(toUpdate[i].id, res.value.task); updated++ }
      else                            { failed++ }
    })

    setImporting(false)
    setLastResult({ created, updated, skipped: skipped + failed })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[styles.header, { paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Import / Export</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            paddingLeft:   contentPadding + insets.left,
            paddingRight:  contentPadding + insets.right,
            maxWidth:      contentMaxWidth,
            alignSelf:     contentMaxWidth ? 'center' : undefined,
            width:         contentMaxWidth ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Export ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Export</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            Download all your tasks as a CSV file. Open it in any spreadsheet app, edit the values, then re-import to apply your changes.
          </Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Text style={styles.actionLabel}>Export Tasks CSV</Text>
                <Text style={styles.actionArrow}>↑</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Import ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Import</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            Select a CSV file from your device. Rows whose <Text style={styles.inlineCode}>id</Text> matches an existing task will update it — all other rows create new tasks.
          </Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleImport}
            disabled={importing}
            activeOpacity={0.7}
          >
            {importing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Text style={styles.actionLabel}>Import from CSV</Text>
                <Text style={styles.actionArrow}>↓</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Last result ─────────────────────────────────────────────── */}
        {lastResult && (
          <>
            <Text style={styles.sectionLabel}>Last Import</Text>
            <View style={styles.card}>
              <View style={styles.resultRow}>
                <View style={styles.resultCell}>
                  <Text style={styles.resultCount}>{lastResult.created}</Text>
                  <Text style={styles.resultCellLabel}>Created</Text>
                </View>
                <View style={styles.resultSep} />
                <View style={styles.resultCell}>
                  <Text style={styles.resultCount}>{lastResult.updated}</Text>
                  <Text style={styles.resultCellLabel}>Updated</Text>
                </View>
                <View style={styles.resultSep} />
                <View style={styles.resultCell}>
                  <Text style={[
                    styles.resultCount,
                    lastResult.skipped > 0 && styles.resultCountWarn,
                  ]}>
                    {lastResult.skipped}
                  </Text>
                  <Text style={styles.resultCellLabel}>Skipped</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Format reference ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>CSV Format</Text>
        <View style={styles.card}>
          <View style={styles.formatSection}>
            <Text style={styles.formatHeading}>Required columns</Text>
            <Text style={styles.formatBody}>
              <Text style={styles.inlineCode}>title</Text>{'  '}
              <Text style={styles.inlineCode}>category</Text>{'  '}
              <Text style={styles.inlineCode}>recurrence</Text>{'  '}
              <Text style={styles.inlineCode}>points</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.formatSection}>
            <Text style={styles.formatHeading}>Optional columns</Text>
            <Text style={styles.formatBody}>
              <Text style={styles.inlineCode}>id</Text>{'  '}
              <Text style={styles.inlineCode}>room</Text>{'  '}
              <Text style={styles.inlineCode}>assigned_to</Text>{'  '}
              <Text style={styles.inlineCode}>next_due</Text>{'  '}
              <Text style={styles.inlineCode}>notes</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.formatSection}>
            <Text style={styles.formatHeading}>Valid categories</Text>
            <Text style={styles.formatBody}>
              home  ·  pet  ·  outdoor  ·  health  ·  family  ·  vehicle
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.formatSection}>
            <Text style={styles.formatHeading}>Valid recurrences</Text>
            <Text style={styles.formatBody}>
              daily  ·  weekly  ·  biweekly  ·  monthly{'\n'}
              quarterly  ·  biannual  ·  annual  ·  once
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.formatSection}>
            <Text style={styles.formatHeading}>Notes</Text>
            <Text style={styles.formatBody}>
              {'• '}Dates use <Text style={styles.inlineCode}>YYYY-MM-DD</Text> format{'\n'}
              {'• '}Room and member names must match exactly{'\n'}
              {'• '}Fields with commas must be quoted
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom:     12,
    backgroundColor:   Colors.background,
  },
  backBtn:    { marginBottom: 4 },
  backText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
  },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  sectionLabel: {
    fontFamily:    Font.semiBold,
    fontSize:      FontSize.xs,
    color:         Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  8,
    marginTop:     20,
    paddingLeft:   4,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },

  cardDesc: {
    fontFamily:        Font.regular,
    fontSize:          FontSize.sm,
    color:             Colors.textSecondary,
    lineHeight:        20,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },

  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft:      16,
  },

  actionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   16,
    minHeight:         52,
  },
  actionLabel: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },
  actionArrow: {
    fontFamily: Font.bold,
    fontSize:   18,
    color:      Colors.primary,
  },

  // Result card
  resultRow: {
    flexDirection:   'row',
    paddingVertical: 20,
  },
  resultCell: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  resultSep: {
    width:           StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  resultCount: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['2xl'],
    color:      Colors.textPrimary,
  },
  resultCountWarn: {
    color: Colors.danger,
  },
  resultCellLabel: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
  },

  // Format reference
  formatSection: {
    paddingHorizontal: 16,
    paddingVertical:   13,
    gap:               6,
  },
  formatHeading: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
  },
  formatBody: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 22,
  },
  inlineCode: {
    fontFamily:      Font.medium,
    fontSize:        FontSize.xs,
    color:           Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
})
