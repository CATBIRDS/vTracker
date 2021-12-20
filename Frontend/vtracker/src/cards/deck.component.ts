import { Component } from '@angular/core';
import { vtuberService } from 'src/api/service';
import {PageEvent} from '@angular/material/paginator';

@Component({
  selector: 'pm-deck',
  templateUrl: './deck.component.html',
  styleUrls: ['./deck.component.css'],
  providers: [vtuberService, PageEvent]
})
export class DeckComponent {

  constructor(private vtubers: vtuberService, public pageEvent: PageEvent) { }

  private dataurl = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/vtubers.json';
  private histurl = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/history.json';

  public favoritesArray = this.initStorage();
  public favoritesDict: any = [];

  public length = 100;
  public pageSize = 10;
  public pageSizeOptions: number[] = [5, 10, 25, 100];

  private live: any = [];
  private dead: any = [];
  public vtuberDict: any = [];

  nuke(){
    // remove all localstorage
    localStorage.removeItem('favorites');
  }

  parseFavorite(input: string, parameter: string){
    for (let vtuber in this.vtuberDict) {
      if (this.vtuberDict[vtuber]['twitch']['user_login'] == input) {
        switch(parameter) {
          case 'user_name':
            return this.vtuberDict[vtuber]['twitch']['user_name'].toLowerCase() == 
              this.vtuberDict[vtuber]['twitch']['user_login'] ? 
              this.vtuberDict[vtuber]['twitch']['user_name'] : 
              this.vtuberDict[vtuber]['twitch']['user_name'] +  ' (' + this.vtuberDict[vtuber]['twitch']['user_login'] + ')'
          case 'viewer_string':
            return this.vtuberDict[vtuber]['twitch']['viewer_count'] == 0 ? '' : 
              this.numberStringFormat(this.vtuberDict[vtuber]['twitch']['viewer_count']) + ' viewers'
          default:
            return this.vtuberDict[vtuber]['twitch'][parameter];
        }
      }
    }
    return "error";
  }

  initStorage(){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      return [];
    }
    else {
      return JSON.parse(favorites);
    }
  }

  checkFavorite(input: string){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) return false;
    else {
      let favoritesArray = JSON.parse(favorites);
      return favoritesArray.includes(input);
    }
  }

  addFavorite(input: string){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      let favoritesArray = [];
      favoritesArray.push(input);
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
    else {
      let favoritesArray = JSON.parse(favorites);
      favoritesArray.push(input);
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
  }

  tagStrip(input: Array<string>){
    let vGUID = '52d7e4cc-633d-46f5-818c-bb59102d9549'; // Manually added GUID for Vtuber Tag
    let filtered = input.filter(e => e !== vGUID);
    return filtered;
  }
  
  listStreamers() {
    this.vtubers.getData().toPromise().then(data => {
      let temp: any = data;
      length = temp.length;
      for (let streamer in temp) {

        // Push Live Streamers
        if (temp[streamer]['twitch']['type'] == 'live') {
          if (temp[0] != undefined && temp[streamer]['twitch']['viewer_count'] > temp[0]['twitch']['viewer_count']) {
            this.live.ushift(temp[streamer]);
          }
          else {
            this.live.push(temp[streamer]);
          }
        }   
        
        // Push Offline Streamers (TODO)
        else this.dead.push(temp[streamer])
      }

      // Sort live by Viewer Count
      this.live.sort((a: any, b: any) => {
        return b.twitch.viewer_count - a.twitch.viewer_count;
      });

      // Add live to vtuberDict, then add dead to vtuberDict
      for (let streamer in this.live) {
        this.vtuberDict.push(this.live[streamer]);
      }
      for (let streamer in this.dead) {
        this.vtuberDict.push(this.dead[streamer]);
      }

    });
    
  }

  numberStringFormat(input: string){
    let number = parseInt(input);
    if (number < 1e3) return number.toString();
    else return +(number / 1e3).toFixed(1) + "K";
  }

  ngOnInit() {
    this.listStreamers();
  }

}
