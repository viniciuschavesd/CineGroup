import { Routes } from '@angular/router';
import { Inicio } from './view/inicio/inicio';
import { CreateAcc } from './view/accCreation/createacc';
import { Login } from './view/login/login';
import { Dashboard } from './view/dashboard/dashboard';
import { Groups } from './view/groups/groups';
import { GroupDetail } from './view/group-detail/group-detail';
export const routes: Routes = [
  {
    path: '',
    component: Inicio
  },
  {
    path: 'inicio',
    component: Inicio
  },
  {
    path: 'createacc',
    component: CreateAcc
  },
  {
    path: 'login',
    component: Login
  },
  {
    path: 'dashboard',
    component: Dashboard
  },
  {
    path: 'groups',
    component: Groups
  },
  {
    path: 'groups/:id',
    component: GroupDetail
  }

];