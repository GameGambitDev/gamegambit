import { createClient } from '@supabase/supabase-js'
import { Database } from '@/integrations/supabase/types'

/**
 * Data consistency models for 200k+ MAUs
 * Handles concurrent updates, conflict resolution, and data integrity
 */

type TableName = 'achievements' | 'nfts' | 'players' | 'wager_transactions' | 'wagers'

export interface OptimisticLockConfig {
  table: TableName
  id: string
  version: number
}

export interface TransactionResult {
  success: boolean
  data?: any
  error?: Error
  retries?: number
}

/**
 * OPTIMISTIC LOCKING - Prevent lost updates in concurrent scenarios
 * Add a 'version' column to tables that need this
 */
export async function updateWithOptimisticLock(
  client: ReturnType<typeof createClient<Database>>,
  config: OptimisticLockConfig,
  updates: Record<string, any>,
  maxRetries: number = 3
): Promise<TransactionResult> {
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      // Fetch current version
      const { data: current, error: fetchError } = await client
        .from(config.table)
        .select('*')
        .eq('id', config.id)
        .single()

      if (fetchError) throw fetchError
      if (!current) throw new Error('Record not found')

      // Attempt update only if version matches
      const query = client
        .from(config.table)
        .update({
          ...updates,
          version: current.version + 1,
        })
        .eq('id', config.id)
        .eq('version', current.version)
        .select()
        .single()

      const result = await query
      const data = result.data
      const error = result.error

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows updated - version mismatch
          attempt++
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100)) // Exponential backoff
          continue
        }
        throw error
      }

      return { success: true, data, retries: attempt }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return { success: false, error: error as Error, retries: attempt }
      }
      attempt++
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
    }
  }

  return { success: false, error: new Error('Max retries exceeded'), retries: attempt }
}

/**
 * PESSIMISTIC LOCKING - For critical operations (e.g., wager resolution)
 * Uses row-level locks to prevent concurrent access
 */
export async function lockAndUpdate(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    table: TableName
    id: string
    updates: Record<string, any>
    maxWait?: number // milliseconds
  }
): Promise<TransactionResult> {
  const { table, id, updates, maxWait = 5000 } = options

  try {
    // In Supabase, use transactions with FOR UPDATE
    const { data, error } = await client.rpc('lock_and_update', {
      p_table: table,
      p_id: id,
      p_updates: updates,
      p_max_wait: maxWait / 1000,
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error as Error }
  }
}

/**
 * CONFLICT RESOLUTION - Handle concurrent wager updates
 */
export interface ConflictResolutionStrategy {
  type: 'last-write-wins' | 'first-write-wins' | 'merge' | 'custom'
  customResolver?: (current: any, incoming: any) => any
}

export async function resolveConflict(
  current: any,
  incoming: any,
  strategy: ConflictResolutionStrategy
): Promise<any> {
  switch (strategy.type) {
    case 'last-write-wins':
      return incoming

    case 'first-write-wins':
      return current

    case 'merge':
      // For objects, merge non-conflicting fields
      return { ...current, ...incoming }

    case 'custom':
      if (!strategy.customResolver) {
        throw new Error('Custom resolver required for custom strategy')
      }
      return strategy.customResolver(current, incoming)

    default:
      throw new Error(`Unknown conflict resolution strategy: ${strategy.type}`)
  }
}

/**
 * TRANSACTIONAL OPERATIONS - Ensure ACID properties
 * For complex multi-table updates (e.g., settle wager + update stats)
 */
export async function executeTransaction(
  client: ReturnType<typeof createClient<Database>>,
  operations: Array<{
    table: TableName
    operation: 'insert' | 'update' | 'delete'
    data: any
    match?: Record<string, any>
  }>
): Promise<TransactionResult> {
  try {
    // Supabase doesn't have native transactions in PostgREST, so we use stored procedures
    const { data, error } = await client.rpc('execute_transaction', {
      p_operations: JSON.stringify(operations),
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    return { success: false, error: error as Error }
  }
}

/**
 * EVENTUAL CONSISTENCY - For non-critical updates
 * Allows propagation delays but guarantees eventual consistency
 */
export async function eventualConsistencyUpdate(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    table: TableName
    id: string
    updates: Record<string, any>
    retryCount?: number
    retryDelay?: number // milliseconds
  }
): Promise<TransactionResult> {
  const { table, id, updates, retryCount = 5, retryDelay = 1000 } = options

  let lastError: Error | null = null

  for (let i = 0; i < retryCount; i++) {
    try {
      const { data, error } = await client
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { success: true, data, retries: i }
    } catch (error) {
      lastError = error as Error
      if (i < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(1.5, i)))
      }
    }
  }

  return { success: false, error: lastError || new Error('Unknown error'), retries: retryCount }
}

/**
 * ATOMIC COUNTER UPDATES - For stats like wins, earnings
 * Ensures accurate counting under high concurrency
 */
export async function atomicIncrement(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    table: TableName
    id: string
    field: string
    amount: number
  }
): Promise<TransactionResult> {
  const { table, id, field, amount } = options

  try {
    const { data, error } = await client.rpc('atomic_increment', {
      p_table: table,
      p_id: id,
      p_field: field,
      p_amount: amount,
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error as Error }
  }
}

/**
 * DISTRIBUTED TRANSACTION LOG - Track multi-step operations
 * Enables recovery and audit trails for critical operations
 */
export interface TransactionLog {
  id: string
  operation: string
  status: 'pending' | 'completed' | 'failed' | 'rolled_back'
  data: Record<string, any>
  startTime: Date
  endTime?: Date
  error?: string
}

export async function logTransaction(
  client: ReturnType<typeof createClient<Database>>,
  log: Omit<TransactionLog, 'id' | 'startTime'>
): Promise<string> {
  const { data, error } = await client
    .from('transaction_logs')
    .insert({
      ...log,
      startTime: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateTransactionLog(
  client: ReturnType<typeof createClient<Database>>,
  logId: string,
  updates: Partial<TransactionLog>
): Promise<void> {
  const { error } = await client
    .from('transaction_logs')
    .update({
      ...updates,
      endTime: new Date().toISOString(),
    })
    .eq('id', logId)

  if (error) throw error
}

/**
 * DEAD LETTER QUEUE - Handle failed operations
 * Enables retry strategies and manual intervention
 */
export async function addToDeadLetterQueue(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    operation: string
    payload: Record<string, any>
    error: Error
    retryCount?: number
  }
): Promise<string> {
  const { operation, payload, error, retryCount = 0 } = options

  const { data, error: dbError } = await client
    .from('dead_letter_queue')
    .insert({
      operation,
      payload,
      errorMessage: error.message,
      retryCount,
      status: 'pending',
    })
    .select('id')
    .single()

  if (dbError) throw dbError
  return data.id
}

export async function retryFromDeadLetterQueue(
  client: ReturnType<typeof createClient<Database>>,
  queueId: string,
  handler: (payload: any) => Promise<void>
): Promise<TransactionResult> {
  try {
    const { data: queueItem, error: fetchError } = await client
      .from('dead_letter_queue')
      .select('*')
      .eq('id', queueId)
      .single()

    if (fetchError) throw fetchError

    await handler(queueItem.payload)

    // Mark as resolved
    await client
      .from('dead_letter_queue')
      .update({ status: 'resolved' })
      .eq('id', queueId)

    return { success: true }
  } catch (error) {
    return { success: false, error: error as Error }
  }
}

/**
 * CHANGE DATA CAPTURE - Track changes for analytics
 * Enables event-driven architecture and audit trails
 */
export async function captureDataChange(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    table: TableName
    operation: 'insert' | 'update' | 'delete'
    recordId: string
    before?: any
    after?: any
    changedBy: string
  }
): Promise<void> {
  const { table, operation, recordId, before, after, changedBy } = options

  await client.from('data_change_log').insert({
    table,
    operation,
    recordId,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    changedBy,
    changedAt: new Date().toISOString(),
  })
}
