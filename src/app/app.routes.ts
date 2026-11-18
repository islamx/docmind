import { Routes } from '@angular/router';
import { sourceResolver } from './features/chat/source.resolver';

/** Every feature is lazy: the home page does not pay for the chat UI and vice versa. */
export const routes: Routes = [
  {
    path: '',
    title: 'DocMind',
    loadComponent: () => import('./features/ingest/home.page').then((m) => m.HomePage),
  },
  {
    path: 'chat/:owner/:repo',
    title: (route) => `${route.paramMap.get('owner')}/${route.paramMap.get('repo')} · DocMind`,
    resolve: { source: sourceResolver },
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  { path: '**', redirectTo: '' },
];
