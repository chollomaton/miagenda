import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {MirrorApp} from '../src/mirror/MirrorApp';
import {MirrorReader} from '../src/mirror/reader';
import {MemoryMirrorCache} from '../src/mirror/cache';
import {setupTransport,source,stamp} from './fixtures/mirror/helpers';
import {StartupApp} from '../src/app/StartupApp';
async function renderMirror(){const {transport}=await setupTransport();const reader=new MirrorReader(transport,new MemoryMirrorCache(),source.publisherID,()=>true,()=>Date.parse(stamp));await reader.refresh();const result=render(<MirrorApp source={reader} demo now={stamp}/>);return {...result,reader,transport};}
function navigate(name:string){fireEvent.click(within(screen.getByRole('navigation',{name:'Secciones'})).getByRole('button',{name}));}
describe('readonly mirror UI',()=>{
 it('shows read-only source, freshness and no mutation affordances',async()=>{
  await renderMirror();expect(screen.getByText('iCloud · Solo lectura · Datos de ejemplo')).toBeInTheDocument();expect(screen.getByText('Actualizada ahora')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/crear|nuevo|guardar|eliminar|completar|duplicar|reabrir|importar|deshacer|fijar/i})).not.toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 });
 it('searches only mirror data and opens text detail without editors',async()=>{
  await renderMirror();fireEvent.change(screen.getByRole('searchbox',{name:'Buscar en iCloud'}),{target:{value:'Ideas para clase'}});fireEvent.click(screen.getByRole('button',{name:/Ideas para clase/}));
  const detail=screen.getByRole('dialog',{name:'Detalle de Ideas para clase'});expect(within(detail).getByText(/Una pregunta para empezar/)).toBeInTheDocument();expect(detail.querySelector('input,textarea,select,form')).toBeNull();expect(within(detail).getAllByRole('button')).toHaveLength(1);
  fireEvent.keyDown(detail,{key:'Escape'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('views completions without reopen/checkbox commands',async()=>{
  await renderMirror();navigate('Completados');expect(screen.getByRole('button',{name:/Clase preparada/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Reabrir'})).not.toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 });
 it('reads native captureText template and flat labels',async()=>{
  await renderMirror();navigate('Plantillas');fireEvent.click(screen.getByRole('button',{name:/Clase semanal/}));expect(within(screen.getByRole('dialog')).getByText('tarea Preparar clase #clases')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Cerrar detalle'}));navigate('Etiquetas');expect(screen.getByRole('button',{name:/ClasesAzul/})).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Nueva etiqueta/})).not.toBeInTheDocument();
 });
 it('has calendar segmented views and explicit published scope',async()=>{
  await renderMirror();navigate('Calendario');fireEvent.click(screen.getByRole('button',{name:'Consultar 2026-10-25'}));expect(within(screen.getByRole('region',{name:'Detalle del día'})).getByRole('button',{name:/Cambio de hora/})).toBeInTheDocument();expect(screen.getByText(/2026-10-01 a 2026-11-01/)).toBeInTheDocument();const views=screen.getByRole('group',{name:'Vista del calendario'});fireEvent.click(within(views).getByRole('button',{name:'Semana'}));expect(within(views).getByRole('button',{name:'Semana'})).toHaveAttribute('aria-pressed','true');expect(screen.queryByRole('button',{name:/Nuevo evento/})).not.toBeInTheDocument();
 });
 it('has master-detail settings with local appearance only',async()=>{
  await renderMirror();navigate('Ajustes');fireEvent.change(screen.getByRole('combobox',{name:'Apariencia'}),{target:{value:'dark'}});expect(document.documentElement.dataset.theme).toBe('dark');fireEvent.click(screen.getByRole('button',{name:'Fuente y sincronización'}));expect(screen.getByText('g1')).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Importar|Restaurar|Borrar/})).not.toBeInTheDocument();
 });
 it('keeps readable UI during offline refresh and hides commands',async()=>{
  const {transport}=await renderMirror();transport.offline=true;fireEvent.click(screen.getByRole('button',{name:'Actualizar copia'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Se conserva la última copia'));expect(screen.getByText(/Sin conexión · copia de/)).toBeInTheDocument();navigate('Notas rápidas');expect(screen.getByRole('button',{name:/Ideas para clase/})).toBeInTheDocument();
 });
 it('boots directly to the empty iCloud dashboard without a selector or local landing',()=>{
  window.history.replaceState({},'','/');render(<StartupApp/>);expect(screen.getByRole('searchbox',{name:'Buscar en iCloud'})).toBeInTheDocument();expect(screen.queryByRole('navigation',{name:'Fuente de agenda'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Abrir agenda local'})).not.toBeInTheDocument();expect(screen.queryByText(/Datos de ejemplo/)).not.toBeInTheDocument();
 });
 it('explicit dev preview opens directly in iCloud without Online',async()=>{
  window.history.replaceState({},'','/?mirrorPreview=1');render(<StartupApp/>);await screen.findByText('iCloud · Solo lectura · Datos de ejemplo',{}, {timeout:5000});expect(screen.queryByRole('button',{name:'Online'})).not.toBeInTheDocument();window.history.replaceState({},'','/');
 });
});
