export type CaptureKind = 'task' | 'reminder' | 'event' | 'note';
export interface QuickCaptureOptions {
 now: Date | string;
 timezone: string;
 locale: 'es-ES';
 labels: readonly {id: string; name: string}[];
}
export interface QuickCaptureResult {
 status: 'exact' | 'needsReview' | 'invalid';
 kind: CaptureKind;
 title: string;
 date: string | null;
 time: string | null;
 endTime: string | null;
 priority: 'alta' | 'media' | 'baja' | null;
 labelIDs: string[];
 candidates: {dates: string[]; times: string[]; priorities: string[]; labelIDs: string[]};
 issues: string[];
}
