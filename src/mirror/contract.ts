/** Independent wire contract. Never an editable AgendaEntity. Native string IDs are opaque. */
export const MIRROR_SCHEMA_VERSION = 1 as const;
export type MirrorKind = 'CalendarItem' | 'Label' | 'QuickNote' | 'Template' | 'TimeBlock';
export interface MirrorCivilTime { date: string; time: string | null; timeZone: string | null }
export interface MirrorRecurrence {
 frequency: number; interval: number; endDate: string | null; occurrenceCount: number;
 weekdays: number[]; weekNumbers: number[]; monthDays: number[] | null;
 yearDays: number[] | null; yearWeeks: number[] | null; months: number[] | null; positions: number[] | null;
}
export interface MirrorMetadata {
 labelID: string | null; isPinned: boolean; isFavorite: boolean; courseMode: string | null;
 subtasks: {id: string; title: string; isDone: boolean}[];
 parts: {id: string; title: string; time: string | null}[];
 estimatedDurationMinutes: number | null;
}
export interface MirrorCalendarItem {
 externalID: string | null; calendarID: string; calendarTitle: string; isEvent: boolean;
 title: string; notes: string; location: string | null; url: string | null;
 start: string | null; end: string | null; allDay: boolean;
 dueComponents: MirrorCivilTime | null; startComponents: MirrorCivilTime | null;
 completed: boolean; completionDate: string | null; priority: number;
 alarms: {absolute: string | null; relative: number}[]; recurrence: MirrorRecurrence[];
 readOnly: boolean; modifiedAt: string; metadata: MirrorMetadata | null;
}
interface Payloads {
 CalendarItem: MirrorCalendarItem;
 Label: {name: string; colorToken: string; symbol: string};
 QuickNote: {title: string; body: string; isPinned: boolean; isFavorite: boolean; createdAt: string; modifiedAt: string};
 Template: {name: string; captureText: string; updatedAt: string};
 TimeBlock: {taskID: string; title: string; start: string; end: string; updatedAt: string};
}
export type MirrorEntity = {[K in MirrorKind]: {id: string; kind: K; lifecycle: 'active'; payload: Payloads[K]}}[MirrorKind]
 | {id: string; kind: MirrorKind; lifecycle: 'deleted'; payload: null};
export interface MirrorSourceInfo {
 source: 'apple-agenda'; sourceSchemaVersion: 3; publisherAppVersion: string;
 publisherID: string; calendarScope: {start: string; end: string}[];
}
export interface MirrorReference {id: string; kind: MirrorKind; hash: string}
export interface MirrorBucketManifest {mirrorSchemaVersion: 1; entities: MirrorReference[]}
export interface MirrorGenerationManifest {
 mirrorSchemaVersion: 1; generationID: string; source: MirrorSourceInfo; rootHash: string;
 entityCount: number; buckets: {hash: string; entityCount: number}[];
 capturedAt: string; publishedAt: string;
}
export interface MirrorState {
 mirrorSchemaVersion: 1; currentGeneration: string; previousGeneration: string | null;
 publisherID: string; publishedAt: string; rootHash: string;
}
export interface MirrorSnapshot {manifest: MirrorGenerationManifest; entities: MirrorEntity[]}
export interface MirrorValidationResult {valid: boolean; issues: string[]}
export interface MirrorFreshness {status: 'fresh' | 'stale' | 'offline' | 'empty'; publishedAt: string | null; ageMilliseconds: number | null}
