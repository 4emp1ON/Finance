import { useState, useCallback } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  warningOutline,
  chevronForward,
  chevronBack,
  arrowUp,
  arrowDown,
} from 'ionicons/icons';
import * as ionIcons from 'ionicons/icons';
import {
  api,
  type Summary,
  type Transaction,
  type UtilityStatus,
  type TrendPoint,
} from '../api';
import { money, currentPeriod, periodLabel, monthShort, addMonths, dateLabel } from '../format';
import CategoryDonut from '../components/CategoryDonut';
import BarChart from '../components/BarChart';

function icon(name: string | null): string {
  if (!name) return ionIcons.pricetagOutline;
  const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return (ionIcons as Record<string, string>)[key] || ionIcons.pricetagOutline;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [util, setUtil] = useState<UtilityStatus | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const router = useIonRouter();

  const isCurrent = period === currentPeriod();

  const load = useCallback(async (p: string) => {
    const [s, t, u, tr] = await Promise.all([
      api.summary(p),
      api.transactions(p, 50),
      api.utilityStatus(p),
      api.trends(p, 6),
    ]);
    setSummary(s);
    setTxs(t);
    setUtil(u);
    setTrends(tr);
  }, []);

  useIonViewWillEnter(() => {
    load(period);
  });

  const goTo = (p: string) => {
    setPeriod(p);
    load(p);
  };

  const del = async (id: number) => {
    await api.deleteTransaction(id);
    load(period);
  };

  // Сравнение с прошлым месяцем
  const delta = summary ? summary.total - summary.prevTotal : 0;
  const pct =
    summary && summary.prevTotal > 0 ? Math.round((delta / summary.prevTotal) * 100) : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => goTo(addMonths(period, -1))}>
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{periodLabel(period)}</IonTitle>
          <IonButtons slot="end">
            <IonButton disabled={isCurrent} onClick={() => goTo(addMonths(period, 1))}>
              <IonIcon slot="icon-only" icon={chevronForward} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load(period).then(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <IonCard>
          <IonCardContent>
            <div className="hint">Расходы за {isCurrent ? 'месяц' : periodLabel(period)}</div>
            <div className="amount-big">{money(summary?.total ?? 0)}</div>
            {summary && (summary.total > 0 || summary.prevTotal > 0) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 4,
                  fontSize: '0.85rem',
                }}
                // расходы выросли — красный, снизились — зелёный
                className={delta > 0 ? 'ion-color-danger' : delta < 0 ? 'ion-color-success' : ''}
              >
                {delta !== 0 && (
                  <IonIcon
                    icon={delta > 0 ? arrowUp : arrowDown}
                    color={delta > 0 ? 'danger' : 'success'}
                  />
                )}
                <span style={{ color: delta > 0 ? 'var(--ion-color-danger)' : delta < 0 ? 'var(--ion-color-success)' : 'var(--ion-color-medium)' }}>
                  {delta === 0
                    ? 'Как в прошлом месяце'
                    : `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}${pct != null ? ` (${delta > 0 ? '+' : '−'}${Math.abs(pct)}%)` : ''} vs ${monthShort(summary.prevMonth)}`}
                </span>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        {trends.length > 0 && (
          <IonCard>
            <IonCardContent>
              <div className="hint" style={{ marginBottom: 8 }}>Динамика по месяцам</div>
              <BarChart
                bars={trends.map((t) => ({ key: t.month, label: monthShort(t.month), value: t.total }))}
                selected={period}
                onSelect={(m) => goTo(m)}
              />
            </IonCardContent>
          </IonCard>
        )}

        {isCurrent && util && !util.allFilled && (
          <IonCard
            color={util.overdue ? 'danger' : 'warning'}
            button
            onClick={() => router.push('/utilities')}
          >
            <IonCardContent style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IonIcon icon={warningOutline} style={{ fontSize: 24 }} />
              <div style={{ flex: 1 }}>
                <strong>{util.overdue ? 'Коммуналка просрочена!' : 'Не заполнена коммуналка'}</strong>
                <div style={{ fontSize: '0.85rem' }}>
                  Осталось заполнить: {util.missing.length} из 4. Срок — до 20 числа.
                </div>
              </div>
              <IonIcon icon={chevronForward} />
            </IonCardContent>
          </IonCard>
        )}

        {summary && summary.total > 0 && (
          <IonCard>
            <IonCardContent>
              <div className="hint" style={{ marginBottom: 4 }}>По категориям</div>
              <CategoryDonut cats={summary.byCategory} />
            </IonCardContent>
          </IonCard>
        )}

        <IonList inset>
          <IonItem lines="none">
            <IonLabel>
              <h2 style={{ fontWeight: 600 }}>Операции</h2>
            </IonLabel>
          </IonItem>
          {txs.length === 0 && (
            <IonItem>
              <IonLabel className="hint">Нет операций за этот месяц</IonLabel>
            </IonItem>
          )}
          {txs.map((t) => (
            <IonItemSliding key={t.id}>
              <IonItem>
                <div className="cat-dot" slot="start" style={{ background: t.category_color || '#92949c' }}>
                  <IonIcon icon={icon(t.category_icon)} />
                </div>
                <IonLabel>
                  <h3>{t.note || t.category_name || 'Расход'}</h3>
                  <p className="hint">
                    {t.category_name} · {dateLabel(t.occurred_at)}
                    {t.user_name ? ` · ${t.user_name}` : ''}
                    {t.source === 'ai' ? ' · 🤖' : ''}
                    {t.source === 'recurring' ? ' · 🔁' : ''}
                  </p>
                </IonLabel>
                <IonNote slot="end" color="dark">
                  {money(t.amount)}
                </IonNote>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption color="danger" onClick={() => del(t.id)}>
                  Удалить
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>
        <div style={{ height: 24 }} />
      </IonContent>
    </IonPage>
  );
}
