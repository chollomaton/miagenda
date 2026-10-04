export function PlaceholderView({ name }: { name: string }) {
  return <section aria-labelledby="section-title"><p className="eyebrow">Proyecto base · Fase 1</p><h2 id="section-title">{name}</h2><p>Esta sección se desarrollará en una fase posterior.</p></section>;
}
