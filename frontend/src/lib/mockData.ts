/**
 * mockData.ts
 *
 * Previously contained hardcoded Alice / Bob data.
 * All static mock data has been removed.  Profile creation is now dynamic
 * via ProfileSetup and persisted in localStorage through the messaging service.
 *
 * This file is kept as a utility barrel — it re-exports the canonical types
 * so that existing imports like `import { Peer } from '@/lib/mockData'`
 * continue to work until all consumers are migrated.
 *
 * ⚠️  DEPRECATED — prefer importing directly from `@/types/messaging`.
 */

export type { UserProfile as User, Peer, Message, FileAttachment } from '@/types/messaging';
