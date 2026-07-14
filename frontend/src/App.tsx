import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { homeOutline, addCircleOutline, flashOutline, ellipsisHorizontalOutline } from 'ionicons/icons';
import { useAuth } from './auth';
import Login from './pages/Login';
import Home from './pages/Home';
import Add from './pages/Add';
import Utilities from './pages/Utilities';
import More from './pages/More';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <IonApp>
        <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
          <IonSpinner />
        </div>
      </IonApp>
    );
  }

  if (!user) {
    return (
      <IonApp>
        <Login />
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/home" component={Home} />
            <Route exact path="/add" component={Add} />
            <Route exact path="/utilities" component={Utilities} />
            <Route exact path="/more" component={More} />
            <Route exact path="/">
              <Redirect to="/home" />
            </Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="home" href="/home">
              <IonIcon icon={homeOutline} />
              <IonLabel>Главная</IonLabel>
            </IonTabButton>
            <IonTabButton tab="add" href="/add">
              <IonIcon icon={addCircleOutline} />
              <IonLabel>Добавить</IonLabel>
            </IonTabButton>
            <IonTabButton tab="utilities" href="/utilities">
              <IonIcon icon={flashOutline} />
              <IonLabel>Коммуналка</IonLabel>
            </IonTabButton>
            <IonTabButton tab="more" href="/more">
              <IonIcon icon={ellipsisHorizontalOutline} />
              <IonLabel>Ещё</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
}
