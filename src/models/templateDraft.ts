import {clone,validate} from './entities';
import type {Template,TemplateDefinition} from './entities';
// Dates and recurrence anchors are supplied later by the target editor.
export function templateToDraft(template:Template){
 validate(template);
 const definition=clone(template.fields.definition);
 return {
  kind:definition.targetKind,
  fields:definition.values,
  ...(definition.targetKind==='Reminder'&&definition.recurrence?{recurrence:definition.recurrence}:{}),
  ...(definition.targetKind==='Event'&&definition.durationMinutes!==undefined?{durationMinutes:definition.durationMinutes}:{})
 } satisfies {kind:TemplateDefinition['targetKind'];fields:TemplateDefinition['values']};
}
