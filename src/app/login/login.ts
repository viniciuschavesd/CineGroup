import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

}
