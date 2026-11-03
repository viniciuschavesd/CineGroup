import { Routes } from '@angular/router';
import { Inicio } from './inicio/inicio';
import { CreateAcc } from './accCreation/createacc';
import { Login } from './login/login';

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
  }
];