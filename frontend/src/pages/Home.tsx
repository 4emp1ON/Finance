import { useState, useCallback } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
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
import { warningOutline, chevronForward } from 'ionicons/icons';
import * as ionIcons from 'ionicons/icons';
import { api, type Summary, type Transaction, type UtilityStatus } from '../api';
import { money, currentPeriod, periodLabel, dateLabel } from '../format';
import CategoryDonut from '../components/CategoryDonut';

function icon(name: string | null): string {
  if (!name) return ionIcons.pricetagOutline;
  const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return (ionIcons as Record<string, string>)[key] || ionIcons.pricetagOutline;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [util, setUtil] = useState<UtilityStatus | null>(null);
  const router = useIonRouter();
  const period = currentPeriod();

  const load = useCallback(async () => {
    const [s, t, u] = await Promise.all([
      api.summary(period),
      api.transactions(period, 30),
      api.utilityStatus(period),
    ]);
    setSummary(s);
    setTxs(t);
    setUtil(u);
  }, [period]);

  useIonViewWillEnter(() => {
    load();
  });

  const del = async (id: number) => {
    await api.deleteTransaction(id);
    load();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{periodLabel(period)}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().then(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <IonCard>
          <IonCardContent>
            <div className="hint">Расходы за месяц</div>
            <div className="amount-big">{money(summary?.total ?? 0)}</div>
          </IonCardContent>
        </IonCard>

        {util && !util.allFilled && (
          <IonCard
            color={util.overdue ? 'danger' : 'warning'}
            button
            onClick={() => router.push('/utilities')}
          >
            <IonCardContent style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IonIcon icon={warningOutline} style={{ fontSize: 24 }} />
              <div style={{ flex: 1 }}>
                <strong>
                  {util.overdue
                    ? 'Коммуналка просрочена!'
                    : 'Не заполнена коммуналка'}
                </strong>
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
              <h2 style={{ fontWeight: 600 }}>Последние операции</h2>
            </IonLabel>
          </IonItem>
          {txs.length === 0 && (
            <IonItem>
              <IonLabel className="hint">Пока нет операций за этот месяц</IonLabel>
            </IonItem>
          )}
          {txs.map((t) => (
            <IonItemSliding key={t.id}>
              <IonItem>
                <div
                  className="cat-dot"
                  slot="start"
                  style={{ background: t.category_color || '#92949c' }}
                >
                  <IonIcon icon={icon(t.category_icon)} />
                </div>
                <IonLabel>
                  <h3>{t.note || t.category_name || 'Расход'}</h3>
                  <p className="hint">
                    {t.category_name} · {dateLabel(t.occurred_at)}
                    {t.user_name ? ` · ${t.user_name}` : ''}
                    {t.source === 'ai' ? ' · 🤖' : ''}
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
