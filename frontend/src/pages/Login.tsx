import { useEffect, useState } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonInput,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/react';
import { api, type User } from '../api';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.users().then((u) => {
      setUsers(u);
      if (u[0]) setUserId(u[0].id);
    });
  }, []);

  const submit = async () => {
    if (!userId || pin.length < 3) return;
    setBusy(true);
    setError('');
    try {
      await login(userId, pin);
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '100%',
            maxWidth: 420,
            margin: '0 auto',
            gap: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontWeight: 700 }}>Семейный бюджет</h1>
            <p className="hint">Выберите пользователя и введите PIN</p>
          </div>

          <IonSegment
            value={String(userId ?? '')}
            onIonChange={(e) => setUserId(Number(e.detail.value))}
          >
            {users.map((u) => (
              <IonSegmentButton key={u.id} value={String(u.id)}>
                <IonLabel>{u.name}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>

          <IonInput
            type="password"
            inputmode="numeric"
            label="PIN-код"
            labelPlacement="stacked"
            fill="outline"
            value={pin}
            onIonInput={(e) => setPin(e.detail.value ?? '')}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {error && (
            <IonText color="danger">
              <p style={{ margin: 0 }}>{error}</p>
            </IonText>
          )}

          <IonButton expand="block" onClick={submit} disabled={busy || pin.length < 3}>
            Войти
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
