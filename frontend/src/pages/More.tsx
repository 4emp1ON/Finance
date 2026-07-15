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
  IonButton,
  IonListHeader,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonModal,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonButtons,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  useIonViewWillEnter,
} from '@ionic/react';
import { addOutline, logOutOutline } from 'ionicons/icons';
import * as ionIcons from 'ionicons/icons';
import { api, type Category, type Recurring } from '../api';
import { money } from '../format';
import { useAuth } from '../auth';
import { getThemePref, setThemePref, type ThemePref } from '../theme/theme';

function icon(name: string | null): string {
  if (!name) return ionIcons.pricetagOutline;
  const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return (ionIcons as Record<string, string>)[key] || ionIcons.pricetagOutline;
}

export default function More() {
  const { user, logout } = useAuth();
  const [cats, setCats] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [toast, setToast] = useState('');

  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState('');

  const [recModal, setRecModal] = useState(false);
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState('1');
  const [recCat, setRecCat] = useState<number | null>(null);

  const [pinModal, setPinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const [theme, setThemeState] = useState<ThemePref>(getThemePref());
  const changeTheme = (t: ThemePref) => {
    setThemeState(t);
    setThemePref(t);
  };

  const toggleAuto = async (r: Recurring, auto: boolean) => {
    setRecurring((list) => list.map((x) => (x.id === r.id ? { ...x, auto: auto ? 1 : 0 } : x)));
    try {
      await api.updateRecurring(r.id, { auto });
    } catch {
      load();
    }
  };

  const load = useCallback(() => {
    api.categories().then(setCats);
    api.recurring().then(setRecurring);
  }, []);

  useIonViewWillEnter(() => {
    load();
  });

  const addCat = async () => {
    if (!newCat.trim()) return;
    try {
      await api.addCategory(newCat.trim(), 'pricetag', '#5260ff');
      setNewCat('');
      setCatModal(false);
      load();
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const addRec = async () => {
    const amt = parseFloat(recAmount.replace(',', '.'));
    if (!recName.trim() || !amt) {
      setToast('Заполните название и сумму');
      return;
    }
    await api.addRecurring({
      name: recName.trim(),
      amount: amt,
      categoryId: recCat,
      dayOfMonth: Number(recDay) || 1,
    });
    setRecName('');
    setRecAmount('');
    setRecDay('1');
    setRecCat(null);
    setRecModal(false);
    load();
  };

  const changePin = async () => {
    try {
      await api.changePin(oldPin, newPin);
      setToast('PIN изменён');
      setPinModal(false);
      setOldPin('');
      setNewPin('');
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Ещё</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Ежемесячные платежи */}
        <IonList inset>
          <IonListHeader>
            <IonLabel>Ежемесячные платежи</IonLabel>
            <IonButton onClick={() => setRecModal(true)}>
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
          </IonListHeader>
          {recurring.length === 0 && (
            <IonItem>
              <IonLabel className="hint">Нет регулярных платежей</IonLabel>
            </IonItem>
          )}
          {recurring.map((r) => (
            <IonItemSliding key={r.id}>
              <IonItem>
                <div
                  className="cat-dot"
                  slot="start"
                  style={{ background: r.category_color || '#92949c' }}
                >
                  <IonIcon icon={icon(r.category_icon)} />
                </div>
                <IonLabel>
                  <h3>{r.name}</h3>
                  <p className="hint">
                    {money(r.amount)} · {r.day_of_month} числа · {r.auto ? 'авто' : 'вручную'}
                  </p>
                </IonLabel>
                <IonToggle
                  slot="end"
                  checked={!!r.auto}
                  onIonChange={(e) => toggleAuto(r, e.detail.checked)}
                  aria-label="Авто-проведение"
                />
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption
                  color="primary"
                  onClick={async () => {
                    await api.applyRecurring(r.id);
                    setToast('Платёж проведён');
                  }}
                >
                  Провести
                </IonItemOption>
                <IonItemOption
                  color="danger"
                  onClick={async () => {
                    await api.deleteRecurring(r.id);
                    load();
                  }}
                >
                  Удалить
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>

        {/* Категории */}
        <IonList inset>
          <IonListHeader>
            <IonLabel>Категории</IonLabel>
            <IonButton onClick={() => setCatModal(true)}>
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
          </IonListHeader>
          {cats.map((c) => (
            <IonItemSliding key={c.id}>
              <IonItem>
                <div className="cat-dot" slot="start" style={{ background: c.color }}>
                  <IonIcon icon={icon(c.icon)} />
                </div>
                <IonLabel>{c.name}</IonLabel>
                {c.is_system ? <IonNote slot="end">системная</IonNote> : null}
              </IonItem>
              {!c.is_system && (
                <IonItemOptions side="end">
                  <IonItemOption
                    color="danger"
                    onClick={async () => {
                      try {
                        await api.deleteCategory(c.id);
                        load();
                      } catch (e) {
                        setToast((e as Error).message);
                      }
                    }}
                  >
                    Удалить
                  </IonItemOption>
                </IonItemOptions>
              )}
            </IonItemSliding>
          ))}
        </IonList>

        {/* Оформление */}
        <IonList inset>
          <IonListHeader>
            <IonLabel>Тема</IonLabel>
          </IonListHeader>
          <IonItem lines="none">
            <IonSegment value={theme} onIonChange={(e) => changeTheme(e.detail.value as ThemePref)}>
              <IonSegmentButton value="dark">
                <IonLabel>Тёмная</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="light">
                <IonLabel>Светлая</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="system">
                <IonLabel>Система</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </IonItem>
        </IonList>

        {/* Аккаунт */}
        <IonList inset>
          <IonListHeader>
            <IonLabel>Аккаунт: {user?.name}</IonLabel>
          </IonListHeader>
          <IonItem button onClick={() => setPinModal(true)}>
            <IonLabel>Сменить PIN</IonLabel>
          </IonItem>
          <IonItem button onClick={logout}>
            <IonIcon slot="start" icon={logOutOutline} color="danger" />
            <IonLabel color="danger">Выйти</IonLabel>
          </IonItem>
        </IonList>
        <div style={{ height: 24 }} />

        {/* Модалка: новая категория */}
        <IonModal isOpen={catModal} onDidDismiss={() => setCatModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Новая категория</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setCatModal(false)}>Отмена</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonInput
              label="Название"
              labelPlacement="stacked"
              fill="outline"
              value={newCat}
              onIonInput={(e) => setNewCat(e.detail.value ?? '')}
            />
            <IonButton expand="block" style={{ marginTop: 16 }} onClick={addCat}>
              Добавить
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Модалка: новый платёж */}
        <IonModal isOpen={recModal} onDidDismiss={() => setRecModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Ежемесячный платёж</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setRecModal(false)}>Отмена</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <IonInput
                label="Название"
                labelPlacement="stacked"
                fill="outline"
                value={recName}
                onIonInput={(e) => setRecName(e.detail.value ?? '')}
              />
              <IonInput
                type="text"
                inputmode="decimal"
                label="Сумма, ₽"
                labelPlacement="stacked"
                fill="outline"
                value={recAmount}
                onIonInput={(e) => setRecAmount(e.detail.value ?? '')}
              />
              <IonInput
                type="number"
                label="День месяца"
                labelPlacement="stacked"
                fill="outline"
                value={recDay}
                onIonInput={(e) => setRecDay(e.detail.value ?? '1')}
              />
              <IonSelect
                label="Категория"
                labelPlacement="stacked"
                fill="outline"
                value={recCat}
                onIonChange={(e) => setRecCat(e.detail.value)}
              >
                {cats.map((c) => (
                  <IonSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
              <IonButton expand="block" onClick={addRec}>
                Добавить
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        {/* Модалка: смена PIN */}
        <IonModal isOpen={pinModal} onDidDismiss={() => setPinModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Сменить PIN</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setPinModal(false)}>Отмена</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <IonInput
                type="password"
                inputmode="numeric"
                label="Текущий PIN"
                labelPlacement="stacked"
                fill="outline"
                value={oldPin}
                onIonInput={(e) => setOldPin(e.detail.value ?? '')}
              />
              <IonInput
                type="password"
                inputmode="numeric"
                label="Новый PIN"
                labelPlacement="stacked"
                fill="outline"
                value={newPin}
                onIonInput={(e) => setNewPin(e.detail.value ?? '')}
              />
              <IonButton expand="block" onClick={changePin} disabled={newPin.length < 3}>
                Сохранить
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={1800}
          onDidDismiss={() => setToast('')}
        />
      </IonContent>
    </IonPage>
  );
}
