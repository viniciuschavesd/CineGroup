import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css'
})
export class Inicio {

}