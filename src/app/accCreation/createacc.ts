import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';

@Component({
  selector: 'app-createacc',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS],
  templateUrl: './createacc.html',
  styleUrl: './createacc.css'
})
export class CreateAcc {

}
