import { useState } from 'react'
import { Alert } from 'react-native'
import { tasks as tasksApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import type { Task } from '@/types'

export function useTaskActions(confettiRef?: React.RefObject<any>) {
  const memberId = useAuthStore((s) => s.memberId)
  const { addCompletion, updateTask, removeTask } = useHouseholdStore()

  const [completing, setCompleting] = useState<Record<string, boolean>>({})
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleComplete = (task: Task) => {
    if (!memberId || completing[task.id]) return
    Alert.alert(
      'Mark as done?',
      task.title,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete ✓',
          onPress: async () => {
            setCompleting((prev) => ({ ...prev, [task.id]: true }))
            try {
              const res = await tasksApi.complete(task.id, memberId)
              addCompletion({
                id:             res.completion.id,
                task_id:        res.completion.task_id,
                member_id:      res.completion.member_id,
                household_id:   task.household_id,
                completed_date: res.completion.completed_date,
                completed_at:   new Date().toISOString(),
              })
              updateTask(task.id, {
                next_due:       res.nextDue,
                last_completed: res.completion.completed_date,
              })
              confettiRef?.current?.start()
            } catch (e) {
              console.error('[useTaskActions] Complete failed:', e)
              setDeleteError('Failed to complete task. Please check your connection.')
            } finally {
              setCompleting((prev) => ({ ...prev, [task.id]: false }))
            }
          },
        },
      ],
    )
  }

  const handleDelete = async (task: Task) => {
    try {
      await tasksApi.delete(task.id)
      removeTask(task.id)
    } catch (e) {
      console.error('[useTaskActions] Delete failed:', e)
      setDeleteError('Failed to delete task. Please check your connection.')
    }
  }

  return {
    handleComplete,
    handleDelete,
    completing,
    deleteError,
    setDeleteError,
  }
}
