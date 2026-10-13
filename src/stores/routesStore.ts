import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RouteSummary } from '../routes/model';
import { deleteRouteFile } from '../services/routeStorage';

interface RoutesState {
  routes: RouteSummary[];
  add(route: RouteSummary): void;
  remove(id: string): void;
}

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set) => ({
      routes: [],
      add: (route) => set((s) => ({ routes: [route, ...s.routes.filter((r) => r.id !== route.id)] })),
      remove: (id) => {
        deleteRouteFile(id);
        set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }));
      },
    }),
    { name: 'routes-index', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
