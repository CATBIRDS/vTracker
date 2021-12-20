import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { NgChartsModule } from 'ng2-charts';

import { AnalyticsComponent } from './analytics.component';

import { MatButtonModule } from '@angular/material/button'; 
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import {MatTabsModule} from '@angular/material/tabs';
import { FlexLayoutModule } from '@angular/flex-layout';  

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    MatButtonModule,
    MatCardModule,
    MatToolbarModule,
    FlexLayoutModule,
    NgChartsModule,
    MatTabsModule
  ],
  exports: [
    AnalyticsComponent,
  ],
  declarations: [AnalyticsComponent],
  providers: [],
})

export class AnalyticsModule { }
