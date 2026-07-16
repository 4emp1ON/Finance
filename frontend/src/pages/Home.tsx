import { useState, useEffect, useCallback } from 'react';
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
  cloudOfflineOutline,
  timeOutline,
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
import { getCache, setCache } from '../cache';
import { getPending, syncPending, discardPending, onPendingChange, type PendingTx } from '../offline';
import CategoryDonut from '../components/CategoryDonut';
import BarChart from '../components/BarChart';

function icon(name: string | null): string {
  if (!name) return ionIcons.pricetagOutline;
  const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return (ionIcons as Record<string, string>)[key] || ionIcons.pricetagOutline;
}

interface Row {
  key: string;
  pending: boolean;
  id?: number;
  tempId?: string;
  amount: number;
  note: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  user_name: string | null;
  occurred_at: string;
  source: string;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [util, setUtil] = useState<UtilityStatus | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [period, setPeriod] = useState(currentPeriod());
  const router = useIonRouter();

  const isCurrent = period === currentPeriod();

  const load = useCallback(async (p: string) => {
    try {
      const [s, t, u, tr] = await Promise.all([
        api.summary(p),
        api.transactions(p, 50),
        api.utilityStatus(p),
        api.trends(p, 6),
      ]);
      setCache(`summary_${p}`, s);
      setCache(`txs_${p}`, t);
      setCache(`util_${p}`, u);
      setCache(`trends_${p}`, tr);
      setSummary(s);
      setTxs(t);
      setUtil(u);
      setTrends(tr);
    } catch {
      // бэк недоступен → показываем последние закэшированные данные
      setSummary(getCache<Summary>(`summary_${p}`));
      setTxs(getCache<Transaction[]>(`txs_${p}`) ?? []);
      setUtil(getCache<UtilityStatus>(`util_${p}`));
      setTrends(getCache<TrendPoint[]>(`trends_${p}`) ?? []);
    }
  }, []);

  useIonViewWillEnter(() => {
    setPending(getPending());
    syncPending().finally(() => {
      setPending(getPending());
      load(period);
    });
  });

  useEffect(() => {
    const off = onPendingChange(() => setPending(getPending()));
    const onOnline = () => {
      setOnline(true);
      syncPending().finally(() => {
        setPending(getPending());
        load(period);
      });
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      off();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load, period]);

  const goTo = (p: string) => {
    setPeriod(p);
    load(p);
  };

  const del = async (row: Row) => {
    if (row.pending && row.tempId) {
      discardPending(row.tempId);
    } else if (row.id != null) {
      try {
        await api.deleteTransaction(row.id);
      } catch {
        return;
      }
      load(period);
    }
  };

  // --- слияние офлайн-трат текущего периода в отображение ---
  const pendingHere = pending.filter((p) => p.occurred_at.slice(0, 7) === period);
  const pendingSum = pendingHere.reduce((s, p) => s + p.amount, 0);
  const displayTotal = (summary?.total ?? 0) + pendingSum;

  const catMap = new Map<
    number | null,
    { category_id: number | null; name: string | null; icon: string | null; color: string | null; total: number }
  >();
  for (const c of summary?.byCategory ?? []) catMap.set(c.category_id, { ...c });
  for (const p of pendingHere) {
    const ex = catMap.get(p.category_id);
    if (ex) ex.total += p.amount;
    else
      catMap.set(p.category_id, {
        category_id: p.category_id,
        name: p.category_name,
        icon: p.category_icon,
        color: p.category_color,
        total: p.amount,
      });
  }
  const mergedCats = [...catMap.values()];

  const rows: Row[] = [
    ...pendingHere.map((p) => ({
      key: p.tempId,
      pending: true,
      tempId: p.tempId,
      amount: p.amount,
      note: p.note,
      category_name: p.category_name,
      category_icon: p.category_icon,
      category_color: p.category_color,
      user_name: null,
      occurred_at: p.occurred_at,
      source: 'manual',
    })),
    ...txs.map((t) => ({
      key: `s${t.id}`,
      pending: false,
      id: t.id,
      amount: t.amount,
      note: t.note,
      category_name: t.category_name,
      category_icon: t.category_icon,
      category_color: t.category_color,
      user_name: t.user_name,
      occurred_at: t.occurred_at,
      source: t.source,
    })),
  ];

  const delta = displayTotal - (summary?.prevTotal ?? 0);
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

        {(!online || pending.length > 0) && (
          <IonCard color={!online ? 'medium' : 'warning'}>
            <IonCardContent style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
              <IonIcon icon={!online ? cloudOfflineOutline : timeOutline} style={{ fontSize: 20 }} />
              <div style={{ fontSize: '0.85rem' }}>
                {!online && 'Нет связи — работаете офлайн. '}
                {pending.length > 0 && `${pending.length} ${pending.length === 1 ? 'трата ждёт' : 'трат ждут'} синхронизации.`}
              </div>
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardContent>
            <div className="hint">Расходы за {isCurrent ? 'месяц' : periodLabel(period)}</div>
            <div className="amount-big">{money(displayTotal)}</div>
            {summary && (displayTotal > 0 || summary.prevTotal > 0) && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.85rem' }}
              >
                {delta !== 0 && (
                  <IonIcon icon={delta > 0 ? arrowUp : arrowDown} color={delta > 0 ? 'danger' : 'success'} />
                )}
                <span
                  style={{
                    color:
                      delta > 0
                        ? 'var(--ion-color-danger)'
                        : delta < 0
                          ? 'var(--ion-color-success)'
                          : 'var(--ion-color-medium)',
                  }}
                >
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
                bars={trends.map((t) => ({
                  key: t.month,
                  label: monthShort(t.month),
                  value: t.month === period ? t.total + pendingSum : t.total,
                }))}
                selected={period}
                onSelect={(m) => goTo(m)}
              />
            </IonCardContent>
          </IonCard>
        )}

        {isCurrent && util && !util.allFilled && (
          <IonCard color={util.overdue ? 'danger' : 'warning'} button onClick={() => router.push('/utilities')}>
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

        {displayTotal > 0 && (
          <IonCard>
            <IonCardContent>
              <div className="hint" style={{ marginBottom: 4 }}>По категориям</div>
              <CategoryDonut cats={mergedCats} />
            </IonCardContent>
          </IonCard>
        )}

        <IonList inset>
          <IonItem lines="none">
            <IonLabel>
              <h2 style={{ fontWeight: 600 }}>Операции</h2>
            </IonLabel>
          </IonItem>
          {rows.length === 0 && (
            <IonItem>
              <IonLabel className="hint">Нет операций за этот месяц</IonLabel>
            </IonItem>
          )}
          {rows.map((t) => (
            <IonItemSliding key={t.key}>
              <IonItem style={t.pending ? { opacity: 0.7 } : undefined}>
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
                    {t.pending ? ' · ⏳ не синхр.' : ''}
                  </p>
                </IonLabel>
                <IonNote slot="end" color="dark">
                  {money(t.amount)}
                </IonNote>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption color="danger" onClick={() => del(t)}>
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
