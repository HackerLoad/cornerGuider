import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RouteSummary } from '../routes/model';
import { deleteRouteFile } from '../services/routeStorage';
import { useSettingsStore } from './settingsStore';

interface RoutesState {
  routes: RouteSummary[];
  add(route: RouteSummary): void;
  remove(id: string): void;
}

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set) => ({
      routes: [],
      add: (route) => {
        set((s) => ({ routes: [route, ...s.routes.filter((r) => r.id !== route.id)] }));
        // neu importierte Strecke wird gleich die Go-Strecke
        useSettingsStore.getState().set({ activeRouteId: route.id, goMode: 'route' });
      },
      remove: (id) => {
        deleteRouteFile(id);
        set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
        const settings = useSettingsStore.getState();
        if (settings.activeRouteId === id) settings.set({ activeRouteId: useRoutesStore.getState().routes[0]?.id ?? null });
      },
    }),
    { name: 'routes-index', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
