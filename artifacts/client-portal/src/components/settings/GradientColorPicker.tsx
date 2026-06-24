import { useState, useRef } from 'react';
import { ArrowRight, ArrowDown, ArrowDownRight, Blend } from 'lucide-react';

export interface GradientValue {
  isGradient: boolean;
  color1: string;
  color2: string;
  direction: 'to right' | 'to bottom' | 'to bottom right';
}

const DIR_ICONS = [
  { value: 'to right' as const, icon: ArrowRight },
  { value: 'to bottom' as const, icon: ArrowDown },
  { value: 'to bottom right' as const, icon: ArrowDownRight },
];

export function parseGradient(value: string): GradientValue {
  const match = value.match(/^linear-gradient\((to [^,]+),\s*(#[0-9a-fA-F]{6,8}),\s*(#[0-9a-fA-F]{6,8})\)$/);
  if (match) {
    return { isGradient: true, color1: match[2], color2: match[3], direction: match[1] as GradientValue['direction'] };
  }
  return { isGradient: false, color1: value, color2: value, direction: 'to right' };
}

export function serializeGradient(g: GradientValue): string {
  if (!g.isGradient) return g.color1;
  return `linear-gradient(${g.direction}, ${g.color1}, ${g.color2})`;
}

export function gradientStyle(value: string): React.CSSProperties {
  const g = parseGradient(value);
  if (g.isGradient) return { background: serializeGradient(g) };
  return { backgroundColor: g.color1 };
}

interface Props {
  label: string;
  desc?: string;
  value: string;
  onChange: (cssValue: string) => void;
}

export default function GradientColorPicker({ label, desc, value, onChange }: Props) {
  const [grad, setGrad] = useState<GradientValue>(() => parseGradient(value));
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<GradientValue>) => {
    const next = { ...grad, ...partial };
    setGrad(next);
    onChange(serializeGradient(next));
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Label */}
      <div className="w-28 shrink-0">
        <p className="text-xs font-medium leading-tight">{label}</p>
        {desc && <p className="text-[9px] text-muted-foreground leading-tight">{desc}</p>}
      </div>

      {/* Color 1 swatch */}
      <button
        type="button"
        onClick={() => ref1.current?.click()}
        className="w-7 h-7 rounded-md border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
        style={{ backgroundColor: grad.color1 }}
        title="Couleur 1"
      />
      <input ref={ref1} type="color" value={grad.color1} onChange={e => update({ color1: e.target.value })} className="sr-only" />

      {/* Gradient toggle */}
      <button
        type="button"
        onClick={() => update({ isGradient: !grad.isGradient, color2: !grad.isGradient ? grad.color1 : grad.color1 })}
        className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 transition-all ${
          grad.isGradient ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
        }`}
        title="Activer le dégradé"
      >
        <Blend className="w-3.5 h-3.5" />
      </button>

      {/* Color 2 swatch (if gradient) */}
      {grad.isGradient && (
        <>
          <button
            type="button"
            onClick={() => ref2.current?.click()}
            className="w-7 h-7 rounded-md border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            style={{ backgroundColor: grad.color2 }}
            title="Couleur 2"
          />
          <input ref={ref2} type="color" value={grad.color2} onChange={e => update({ color2: e.target.value })} className="sr-only" />

          {/* Direction buttons */}
          <div className="flex gap-0.5">
            {DIR_ICONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => update({ direction: d.value })}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  grad.direction === d.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                title={d.value}
              >
                <d.icon className="w-3 h-3" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Mini preview */}
      <div
        className="h-7 flex-1 min-w-[60px] rounded-md border border-border"
        style={gradientStyle(serializeGradient(grad))}
      />
    </div>
  );
}
