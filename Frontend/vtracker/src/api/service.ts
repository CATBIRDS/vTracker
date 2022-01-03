import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'

@Injectable()
export class vtuberService {
    private dataURL = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/live.json';
    private masterURL = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/vtubers.json';
    private histURL = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/history.json';
    constructor(private http: HttpClient) { }

    getData(){
        return this.http.get(this.dataURL)
    }

    getMaster(){
        return this.http.get(this.masterURL)
    }

    getHist(){
        return this.http.get(this.histURL)
    }

}   