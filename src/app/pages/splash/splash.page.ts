import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  imports: [IonContent, CommonModule]
})
export class SplashPage implements OnInit {

  nombresEquipo: string[] = [
    'Nicolas Macri',
    'Mateo Garcia',
    'Matias Goncalves',
    'Jaled Breyaui'
  ];

  constructor(private router: Router) { }

  ngOnInit() {
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

}