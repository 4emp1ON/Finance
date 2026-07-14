import { useEffect, useState, useCallback } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonInput,
  IonButton,
  IonIcon,
  IonBadge,
  IonToast,
  IonNote,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  flameOutline,
  waterOutline,
  flashOutline,
  trashBinOutline,
  checkmarkCircle,
  alertCircle,
} from 'ionicons/icons';
import { api, type UtilityStatus, type UtilityItem } from '../api';
import { money, currentPeriod, periodLabel } from '../format';

const ICONS: Record<string, string> = {
  gas: flameOutline,
  water: waterOutline,
  electricity: flashOutline,
  garbage: trashBinOutline,
};

function UtilityCard({
  item,
  period,
  onSaved,
}: {
  item: UtilityItem;
  period: string;
  onSaved: () => void;
}) {
  const [volume, setVolume] = useState(item.reading?.volume?.toString() ?? '');
  const [amount, setAmount] = useState(item.reading?.amount?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setVolume(item.reading?.volume?.toString() ?? '');
    setAmount(item.reading?.amount?.toString() ?? '');
  }, [item.reading]);

  const save = async () => {
    setErr('');
    const vol = volume.trim() === '' ? null : parseFloat(volume.replace(',', '.'));
    const amt = amount.trim() === '' ? null : parseFloat(amount.replace(',', '.'));
    if (item.volumeRequired && (vol == null || isNaN(vol))) {
      setErr('Объём обязателен');
      return;
    }
    setBusy(true);
    try {
      await api.saveUtility({ type: item.type, period, volume: vol, amount: amt });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const r = item.reading;

  return (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.1rem' }}>
          <IonIcon icon={ICONS[item.type]} color="primary" />
          {item.label}
          {item.filled ? (
            <IonBadge color="success" style={{ marginLeft: 'auto' }}>
              <IonIcon icon={checkmarkCircle} /> заполнено
            </IonBadge>
          ) : (
            <IonBadge color="medium" style={{ marginLeft: 'auto' }}>
              не заполнено
            </IonBadge>
          )}
        </IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <div style={{ display: 'flex', gap: 10 }}>
          <IonInput
            type="text"
            inputmode="decimal"
            label={`Объём${item.volumeRequired ? ' *' : ''}`}
            labelPlacement="stacked"
            fill="outline"
            placeholder={item.volumeRequired ? 'обязательно' : 'не обязательно'}
            value={volume}
            onIonInput={(e) => setVolume(e.detail.value ?? '')}
          />
          <IonInput
            type="text"
            inputmode="decimal"
            label="Сумма, ₽"
            labelPlacement="stacked"
            fill="outline"
            value={amount}
            onIonInput={(e) => setAmount(e.detail.value ?? '')}
          />
        </div>

        {r && (r.diff_volume != null || r.diff_amount != null) && (
          <IonNote color="medium" style={{ display: 'block', marginTop: 10 }}>
            Разница с прошлым периодом:
            {r.diff_volume != null && ` объём ${r.diff_volume > 0 ? '+' : ''}${r.diff_volume}`}
            {r.diff_amount != null &&
              ` · сумма ${r.diff_amount > 0 ? '+' : ''}${money(r.diff_amount)}`}
          </IonNote>
        )}

        {err && (
          <IonNote color="danger" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <IonIcon icon={alertCircle} /> {err}
          </IonNote>
        )}

        <IonButton
          expand="block"
          fill={item.filled ? 'outline' : 'solid'}
          style={{ marginTop: 12 }}
          onClick={save}
          disabled={busy}
        >
          {item.filled ? 'Обновить' : 'Сохранить'}
        </IonButton>
      </IonCardContent>
    </IonCard>
  );
}

export default function Utilities() {
  const [status, setStatus] = useState<UtilityStatus | null>(null);
  const [toast, setToast] = useState('');
  const period = currentPeriod();

  const load = useCallback(() => {
    api.utilityStatus(period).then(setStatus);
  }, [period]);

  useIonViewWillEnter(() => {
    load();
  });

  const onSaved = () => {
    setToast('Показание сохранено');
    load();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Коммуналка</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding" style={{ paddingBottom: 0 }}>
          <div className="hint">Период: {periodLabel(period)} · срок до 20 числа</div>
          {status && (
            <div style={{ marginTop: 6 }}>
              {status.allFilled ? (
                <IonBadge color="success">Все 4 платежа заполнены</IonBadge>
              ) : status.overdue ? (
                <IonBadge color="danger">Просрочено! Осталось {status.missing.length}</IonBadge>
              ) : (
                <IonBadge color="warning">Осталось заполнить: {status.missing.length}</IonBadge>
              )}
            </div>
          )}
        </div>

        {status?.items.map((item) => (
          <UtilityCard key={item.type} item={item} period={period} onSaved={onSaved} />
        ))}
        <div style={{ height: 24 }} />

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={1500}
          onDidDismiss={() => setToast('')}
        />
      </IonContent>
    </IonPage>
  );
}
