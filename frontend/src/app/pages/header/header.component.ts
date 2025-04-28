

import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { BadgeModule } from 'primeng/badge';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [
    CommonModule,
    ButtonModule,
    RippleModule,
    BadgeModule,
    TooltipModule,
    BadgeModule,
    AvatarModule,
    RouterModule
    


   
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  menuVisible = false;
  isDarkMode = false;
  currentThemeIcon = 'pi pi-moon'; // default icon for light mode
  isLoggedIn: boolean = false;

  toggleDarkMode (){
  
    this.isDarkMode = !this.isDarkMode;
    this.currentThemeIcon = this.isDarkMode ? 'pi pi-sun' : 'pi pi-moon';
    const element = document.querySelector('html');
    if(element !== null) {
      element.classList.toggle('my-app-dark');
    }
  }
  

}
