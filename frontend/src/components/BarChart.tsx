export interface Bar {
  key: string;
  label: string;
  value: number;
}

function short(n: number): string {
  if (n <= 0) return '';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + 'к';
  return String(Math.round(n));
}

export default function BarChart({
  bars,
  selected,
  onSelect,
  color = 'var(--ion-color-primary)',
  height = 80,
  showValues = true,
}: {
  bars: Bar[];
  selected?: string;
  onSelect?: (key: string) => void;
  color?: string;
  height?: number;
  showValues?: boolean;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      {bars.map((b) => {
        const h = b.value > 0 ? Math.max((b.value / max) * height, 3) : 2;
        const isSel = selected != null && b.key === selected;
        const barColor = selected == null ? color : isSel ? color : 'var(--ion-color-step-250, #cfcfcf)';
        return (
          <div
            key={b.key}
            onClick={onSelect ? () => onSelect(b.key) : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: onSelect ? 'pointer' : 'default',
              minWidth: 0,
            }}
          >
            {showValues && (
              <span style={{ fontSize: '0.6rem', color: 'var(--ion-color-medium)', whiteSpace: 'nowrap' }}>
                {short(b.value)}
              </span>
            )}
            <div
              style={{
                width: '72%',
                height: h,
                borderRadius: 4,
                background: barColor,
                transition: 'height 0.2s, background 0.2s',
              }}
            />
            <span
              style={{
                fontSize: '0.65rem',
                color: isSel ? color : 'var(--ion-color-medium)',
                fontWeight: isSel ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
