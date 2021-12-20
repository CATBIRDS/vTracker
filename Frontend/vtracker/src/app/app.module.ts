import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { DeckModule } from '../cards/deck.module';
import { AnalyticsModule } from '../analytics/analytics.module';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button'; 
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { FlexLayoutModule } from '@angular/flex-layout';  
import { HttpClientModule } from '@angular/common/http';

import { DeckComponent } from '../cards/deck.component';
import { AnalyticsComponent } from '../analytics/analytics.component';
import { NgChartsModule } from 'ng2-charts';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', component: DeckComponent, pathMatch: 'full' },
      { path: 'analytics/:id', component: AnalyticsComponent, pathMatch: 'prefix' }
    ]),
    BrowserAnimationsModule,
    MatButtonModule,
    MatCardModule,
    MatToolbarModule,
    FlexLayoutModule,
    HttpClientModule,
    DeckModule,
    NgChartsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
