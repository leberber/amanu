import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  toggleDarkMode (){
    console.log('app running times')
    const element = document.querySelector('html');
    if(element !== null) {
      element.classList.toggle('my-app-dark');
    }
  }
  title = 'vtx-gco';
}
