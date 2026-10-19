import { useEffect, useId, useState } from 'react';
import { useLab } from '../app/LabContext';
import type { Route } from '../contract/schema';
import { journey } from '../viewer/journey';
import { BILE, FOOD, PANCREATIC } from '../viewer/palette';

/** Follows the food's current stage (updates when it enters a new organ, not every frame). */
function useStage(): string | null {
  const [stage, setStage] = useState(journey.stage);
  useEffect(() => {
    setStage(journey.stage);
    return journey.subscribe(setStage);
  }, []);
  return stage;
}

function Steps({ route, colour, current }: { route: Route; colour: string; current?: string | null }) {
  const { state, dispatch } = useLab();
  return (
    <ol className="flow-steps">
      {route.steps.map((st, i) => {
        const here = !!st.structure && st.structure === current;
        return (
          <li key={i} className={here ? 'is-current' : undefined} aria-current={here ? 'step' : undefined}>
            <span className="dot" aria-hidden="true" style={{ background: colour }} />
            {st.structure ? (
              <button type="button" className="link" aria-pressed={state.selected === st.structure} onClick={() => dispatch({ type: 'select', id: st.structure! })}>{st.label}</button>
            ) : (
              <span className="offmodel">{st.label} <span className="tag">not on model</span></span>
            )}
            {st.note && <span className="muted small block">{st.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Digestion mode: the journey of food, the digestive juices, their facts and model assumptions. */
export function DigestionPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const stage = useStage();
  const food = def.foodRoute;
  const current = food.steps.find((s) => s.structure === stage);
  return (
    <section className="sheet digestion-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head">
        <h2 id={`${id}-title`} className="panel-title">Digestion</h2>
        <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-playing', value: !state.playing })} aria-pressed={!state.playing}>
          {state.playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <div className="row toggles">
        <label className="check"><input type="checkbox" checked={state.food} onChange={(e) => dispatch({ type: 'set-food', value: e.target.checked })} /> Food</label>
        <label className="check"><input type="checkbox" checked={state.juices} onChange={(e) => dispatch({ type: 'set-juices', value: e.target.checked })} /> Bile and pancreatic juice</label>
      </div>

      {state.food && (
        <>
          <div className="phase" aria-live="polite" data-stage={stage ?? ''}>
            <span className="dot" aria-hidden="true" style={{ background: FOOD }} />
            <strong>{current ? `Now in: ${current.label}` : 'The journey of food'}</strong>
            <p className="small">{current?.note ?? food.description}</p>
          </div>
          <h3 className="group-title">{food.label}</h3>
          <Steps route={food} colour={FOOD} current={stage} />
          <ul className="small facts">{food.facts.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}

      {state.juices && def.juiceRoutes.map((r) => (
        <div key={r.id}>
          <h3 className="group-title">{r.label}</h3>
          <p className="small">{r.description}</p>
          <Steps route={r} colour={r.id === 'bile' ? BILE : PANCREATIC} />
          <ul className="small facts">{r.facts.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      ))}

      <div className="legend small" aria-label="Colour key">
        <span><span className="dot" style={{ background: FOOD }} aria-hidden="true" /> Food</span>
        <span><span className="dot" style={{ background: BILE }} aria-hidden="true" /> Bile</span>
        <span><span className="dot" style={{ background: PANCREATIC }} aria-hidden="true" /> Pancreatic juice</span>
      </div>
      <details className="more">
        <summary>Model assumptions</summary>
        <ul className="small disclaimers">
          {[food, ...def.juiceRoutes].flatMap((r) => r.assumptions).map((a) => <li key={a}>{a}</li>)}
        </ul>
      </details>
    </section>
  );
}
