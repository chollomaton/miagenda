import {describe,it,expect} from 'vitest';
import {parseQuickCapture} from '../src/quick-capture/parser';
import type {QuickCaptureOptions} from '../src/quick-capture/types';
const options:QuickCaptureOptions={now:'2026-10-04T10:00:00Z',timezone:'Europe/Madrid',locale:'es-ES',labels:[{id:'work',name:'Trabajo'}]};
const parse=(input:string)=>parseQuickCapture(input,options);
describe('Quick Capture pure parser',()=>{
 it.each(['mañana llamar a Ana','hoy 18:00 comprar pan','viernes 9:30 revisión','tarea 27/09 entregar informe','recordatorio martes 17:00 ITV','evento lunes 12:00-13:00 reunión','#Trabajo preparar informe','!alta entregar propuesta mañana','mañana preparar informe #Trabajo !alta','nota idea para vídeo de mañana'])('exact: %s',input=>expect(parse(input).status).toBe('exact'));
 it.each(['lunes 6 reunión','mañana informe #EtiquetaDesconocida','mañana llamada !alta !baja','hoy mañana informe','lunes martes informe','hoy 12:00 13:00 llamada'])('review: %s',input=>expect(parse(input).status).toBe('needsReview'));
 it.each(['','   ','32/15 reunión','25:99 llamar','#Trabajo','!alta','evento lunes 13:00-12:00 reunión','31/02 reunión'])('invalid: %s',input=>expect(parse(input).status).toBe('invalid'));
 it('uses future local dates and next weekday',()=>{
  expect(parse('27/09 informe').date).toBe('2027-09-27');expect(parse('27/10 informe').date).toBe('2026-10-27');expect(parse('domingo informe').date).toBe('2026-10-11');expect(parse('pasado mañana informe').date).toBe('2026-10-06');
 });
 it('resolves and deduplicates canonical labels',()=>{expect(parse('#trabajo informe').labelIDs).toEqual(['work']);expect(parse('#Trabajo #TRABAJO informe').labelIDs).toEqual(['work'])});
 it('keeps notes literal and unknown tokens visible',()=>{
  expect(parse('nota idea #Trabajo !alta mañana 18:00').title).toBe('idea #Trabajo !alta mañana 18:00');
  expect(parse('mañana informe #Desconocida !urgente').title).toBe('informe #Desconocida !urgente');expect(parse('llamar a Ana mañana').title).toBe('llamar a Ana');
 });
 it.each([['18.00','18:00'],['18h','18:00'],['a las 18:00','18:00'],['a las 6 de la tarde','18:00'],['a las 9 de la mañana','09:00']])('time %s',(token,time)=>expect(parse(token+' llamar').time).toBe(time));
 it('does not choose ambiguous metadata',()=>{
  expect(parse('lunes 6 reunión').candidates.times).toEqual(['06:00','18:00']);expect(parse('a las 6 llamar').time).toBeNull();expect(parse('lunes martes llamar').date).toBeNull();expect(parse('!alta !baja llamar').priority).toBeNull();
 });
 it('supports event ranges without inventing duration',()=>{expect(parse('evento lunes 12:00 a 13:00 reunión')).toMatchObject({time:'12:00',endTime:'13:00'});expect(parse('evento lunes 12:00 reunión').endTime).toBeNull()});
 it('preserves ordinary numbers and noninitial prefixes',()=>{expect(parse('mañana comprar 20 panes').title).toBe('comprar 20 panes');expect(parse('preparar nota mañana').kind).toBe('task')});
 it('uses local day across midnight',()=>expect(parseQuickCapture('hoy llamar',{...options,now:'2026-10-04T22:30:00Z'}).date).toBe('2026-10-05'));
 it('matches accents and reports ambiguity without choosing',()=>{
  expect(parseQuickCapture('#Cafe informe',{...options,labels:[{id:'c',name:'Café'}]}).labelIDs).toEqual(['c']);
  expect(parseQuickCapture('#Cafe informe',{...options,labels:[{id:'c',name:'Café'},{id:'d',name:'Cafe'}]})).toMatchObject({status:'needsReview',labelIDs:[],title:'#Cafe informe'});
 });
 it('is deterministic, repeatable and does not mutate options',()=>{const before=JSON.stringify(options);const a=parse('mañana preparar informe #Trabajo !alta');expect(parse('mañana preparar informe #Trabajo !alta')).toEqual(a);expect(JSON.stringify(options)).toBe(before)});
});
