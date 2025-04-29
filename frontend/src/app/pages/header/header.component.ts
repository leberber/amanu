import { Component, OnInit, OnDestroy } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { BadgeModule } from 'primeng/badge';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { RouterModule } from '@angular/router';
import { User } from '../../models/models';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

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
export class HeaderComponent implements OnInit, OnDestroy {
  user: User | null = null;
  menuVisible = false;
  isDarkMode = false;
  currentThemeIcon = 'pi pi-moon'; // default icon for light mode
  
  private userSubscription: Subscription | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Subscribe to user changes from the auth service
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.user = user;
      
      // Close mobile menu if user logs in or out
      if (this.menuVisible) {
        this.menuVisible = false;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription when component is destroyed
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    
  }

  logout() {
    this.authService.logout();
    // No need to reload - the subscription will handle UI updates
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.currentThemeIcon = this.isDarkMode ? 'pi pi-sun' : 'pi pi-moon';
    const element = document.querySelector('html');
    if (element !== null) {
      element.classList.toggle('my-app-dark');
    }
  }


  // Add to your HeaderComponent class
showProfileMenu = false;
profileMenuClickListener: any;

toggleProfileMenuOn(event: Event): void {
  this.showProfileMenu = !this.showProfileMenu;
}

toggleProfileMenuOff(event: Event): void {
  this.showProfileMenu = !this.showProfileMenu;
}


// Make sure to add this to ngOnDestroy

}